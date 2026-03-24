package device

import (
	"context"
	"database/sql"
	"errors"
	"slices"
	"time"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/pgsql"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/acoshift/pgsql/pgstmt"
	"github.com/moonrhythm/validator"
	"github.com/rs/xid"

	"github.com/anertic/anertic/api/iam"
	"github.com/anertic/anertic/pkg/devicestatus"
)

var (
	ErrNotFound        = arpc.NewErrorCode("device/not-found", "device not found")
	ErrFloorNotFound   = arpc.NewErrorCode("device/floor-not-found", "floor not found")
	ErrRoomNotFound    = arpc.NewErrorCode("device/room-not-found", "room not found")
	ErrInvalidLocation = arpc.NewErrorCode("device/invalid-location", "location must be site, floor, room, or empty")

	validDeviceTypes  = []string{"meter", "inverter", "solar_panel", "appliance"}
	validLocations    = []string{"site", "floor", "room", ""}
)

// List

type ListParams struct {
	SiteID string `json:"siteId"`
	Type   string `json:"type"`
	Search string `json:"search"`
	Status string `json:"status"`
}

func (p *ListParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	return v.Error()
}

type Item struct {
	ID               string     `json:"id"`
	SiteID           string     `json:"siteId"`
	Name             string     `json:"name"`
	Type             string     `json:"type"`
	Tag              string     `json:"tag"`
	Brand            string     `json:"brand"`
	Model            string     `json:"model"`
	IsActive         bool       `json:"isActive"`
	CreatedAt        time.Time  `json:"createdAt"`
	MeterCount       int        `json:"meterCount"`
	ConnectionStatus string     `json:"connectionStatus"`
	LastSeenAt       *time.Time `json:"lastSeenAt"`
	RoomID           *string    `json:"roomId"`
	RoomName         *string    `json:"roomName"`
	Level            *int       `json:"level"`
	IsSiteDevice     bool       `json:"isSiteDevice"`
}

type ListResult struct {
	Items []Item `json:"items"`
}

func List(ctx context.Context, p *ListParams) (*ListResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	var items []Item

	err := pgstmt.Select(func(b pgstmt.SelectStatement) {
		b.Columns(
			"d.id",
			"d.site_id",
			"d.name",
			"d.type",
			"d.tag",
			"d.brand",
			"d.model",
			"d.is_active",
			"d.created_at",
			pgstmt.Raw("coalesce(m.meter_count, 0)"),
			pgstmt.Raw("coalesce(m.online_count, 0)"),
			"m.last_seen_at",
			"r.id",
			"r.name",
			"fd.level",
			pgstmt.Raw("sd.device_id is not null"),
		)
		b.From("devices d")
		b.LeftJoinLateralSelect(func(b pgstmt.SelectStatement) {
			b.Columns(
				pgstmt.Raw("count(*) as meter_count"),
				pgstmt.Raw("count(*) filter (where is_online) as online_count"),
				pgstmt.Raw("max(last_seen_at) as last_seen_at"),
			)
			b.From("meters")
			b.Where(func(c pgstmt.Cond) {
				c.EqRaw("device_id", "d.id")
			})
		}, "m").On(func(c pgstmt.Cond) {
			c.Raw("true")
		})
		b.LeftJoin("room_devices rd").On(func(c pgstmt.Cond) {
			c.EqRaw("rd.device_id", "d.id")
		})
		b.LeftJoin("rooms r").On(func(c pgstmt.Cond) {
			c.EqRaw("r.id", "rd.room_id")
			c.IsNull("r.deleted_at")
		})
		b.LeftJoin("floor_devices fd").On(func(c pgstmt.Cond) {
			c.EqRaw("fd.device_id", "d.id")
			c.EqRaw("fd.site_id", "d.site_id")
		})
		b.LeftJoin("site_devices sd").On(func(c pgstmt.Cond) {
			c.EqRaw("sd.device_id", "d.id")
		})
		b.Where(func(c pgstmt.Cond) {
			c.Mode().And()
			c.Eq("d.site_id", p.SiteID)
			c.IsNull("d.deleted_at")
			if p.Type != "" {
				c.Eq("d.type", p.Type)
			}
			if p.Search != "" {
				search := "%" + p.Search + "%"
				c.And(func(b pgstmt.Cond) {
					b.Mode().Or()
					b.ILike("d.name", search)
					b.ILike("d.brand", search)
					b.ILike("d.model", search)
					b.ILike("d.tag", search)
				})
			}
		})
		b.OrderBy("d.created_at").Desc()
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
		var it Item
		var onlineCount int
		err := scan(
			&it.ID,
			&it.SiteID,
			&it.Name,
			&it.Type,
			&it.Tag,
			&it.Brand,
			&it.Model,
			&it.IsActive,
			&it.CreatedAt,
			&it.MeterCount,
			&onlineCount,
			pgsql.Null(&it.LastSeenAt),
			pgsql.Null(&it.RoomID),
			pgsql.Null(&it.RoomName),
			pgsql.Null(&it.Level),
			&it.IsSiteDevice,
		)
		if err != nil {
			return err
		}
		it.ConnectionStatus = devicestatus.Derive(it.MeterCount, onlineCount, it.LastSeenAt)
		if p.Status != "" && it.ConnectionStatus != p.Status {
			return nil
		}
		items = append(items, it)
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &ListResult{Items: items}, nil
}

// Create

type CreateParams struct {
	SiteID string `json:"siteId"`
	Name   string `json:"name"`
	Type   string `json:"type"`
	Tag    string `json:"tag"`
	Brand  string `json:"brand"`
	Model  string `json:"model"`
}

func (p *CreateParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	v.Must(p.Name != "", "name is required")
	v.Must(p.Type != "", "type is required")
	v.Must(slices.Contains(validDeviceTypes, p.Type), "type must be one of: meter, inverter, solar_panel, appliance")
	return v.Error()
}

type CreateResult struct {
	ID string `json:"id"`
}

func Create(ctx context.Context, p *CreateParams) (*CreateResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	id := xid.New().String()
	_, err := pgctx.Exec(ctx, `
		insert into devices (
			id,
			site_id,
			name,
			type,
			tag,
			brand,
			model
		) values ($1, $2, $3, $4, $5, $6, $7)
	`,
		id,
		p.SiteID,
		p.Name,
		p.Type,
		p.Tag,
		p.Brand,
		p.Model,
	)
	if err != nil {
		return nil, err
	}

	return &CreateResult{ID: id}, nil
}

// Get

type GetParams struct {
	ID string `json:"id"`
}

func (p *GetParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

type GetResult struct {
	Item
	Metadata map[string]any `json:"metadata"`
}

func Get(ctx context.Context, p *GetParams) (*GetResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var r GetResult
	err := pgctx.QueryRow(ctx, `
		select
			id,
			site_id,
			name,
			type,
			tag,
			brand,
			model,
			is_active,
			created_at
		from devices
		where id = $1
	`, p.ID).Scan(
		&r.ID,
		&r.SiteID,
		&r.Name,
		&r.Type,
		&r.Tag,
		&r.Brand,
		&r.Model,
		&r.IsActive,
		&r.CreatedAt,
	)
	if err != nil {
		return nil, ErrNotFound
	}

	if err := iam.InSite(ctx, r.SiteID); err != nil {
		return nil, err
	}

	return &r, nil
}

// GetLocation

type GetLocationParams struct {
	SiteID   string `json:"siteId"`
	DeviceID string `json:"deviceId"`
}

func (p *GetLocationParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	v.Must(p.DeviceID != "", "deviceId is required")
	return v.Error()
}

type GetLocationResult struct {
	Location  string  `json:"location"`
	Level     *int    `json:"level"`
	FloorName *string `json:"floorName"`
	RoomID    *string `json:"roomId"`
	RoomName  *string `json:"roomName"`
}

func GetLocation(ctx context.Context, p *GetLocationParams) (*GetLocationResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	var (
		isSiteDevice bool
		floorLevel   *int
		floorName    *string
		roomID       *string
		roomName     *string
		roomLevel    *int
	)
	err := pgctx.QueryRow(ctx, `
		select
			sd.device_id is not null as is_site_device,
			fd.level as floor_level,
			f.name as floor_name,
			rd.room_id,
			rm.name as room_name,
			rm.level as room_level
		from devices d
		left join site_devices sd on sd.device_id = d.id
		left join floor_devices fd on fd.device_id = d.id
		left join floors f on f.site_id = fd.site_id and f.level = fd.level
		left join room_devices rd on rd.device_id = d.id
		left join rooms rm on rm.id = rd.room_id and rm.deleted_at is null
		where d.id = $1
		  and d.site_id = $2
		  and d.deleted_at is null
	`, p.DeviceID, p.SiteID).Scan(
		&isSiteDevice,
		pgsql.Null(&floorLevel),
		pgsql.Null(&floorName),
		pgsql.Null(&roomID),
		pgsql.Null(&roomName),
		pgsql.Null(&roomLevel),
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	var r GetLocationResult
	switch {
	case roomID != nil:
		r.Location = "room"
		r.RoomID = roomID
		r.RoomName = roomName
		r.Level = roomLevel
	case floorLevel != nil:
		r.Location = "floor"
		r.Level = floorLevel
		r.FloorName = floorName
	case isSiteDevice:
		r.Location = "site"
	default:
		r.Location = ""
	}

	return &r, nil
}

// Update

type UpdateParams struct {
	ID       string  `json:"id"`
	SiteID   string  `json:"siteId"`
	Name     *string `json:"name"`
	Tag      *string `json:"tag"`
	Brand    *string `json:"brand"`
	Model    *string `json:"model"`
	IsActive *bool   `json:"isActive"`
}

func (p *UpdateParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	v.Must(p.SiteID != "", "siteId is required")
	return v.Error()
}

// Delete

type DeleteParams struct {
	SiteID string `json:"siteId"`
	ID     string `json:"id"`
}

func (p *DeleteParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

func Delete(ctx context.Context, p *DeleteParams) (*struct{}, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	res, err := pgctx.Exec(ctx, `
		update devices
		set deleted_at = now(),
		    updated_at = now()
		where id = $1
		  and site_id = $2
		  and deleted_at is null
	`, p.ID, p.SiteID)
	if err != nil {
		return nil, err
	}
	affected, err := res.RowsAffected()
	if err != nil {
		return nil, err
	}
	if affected == 0 {
		return nil, ErrNotFound
	}

	return new(struct{}), nil
}

// Update

func Update(ctx context.Context, p *UpdateParams) (*struct{}, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	_, err := pgstmt.Update(func(b pgstmt.UpdateStatement) {
		b.Table("devices")
		if p.Name != nil {
			b.Set("name").To(*p.Name)
		}
		if p.Tag != nil {
			b.Set("tag").To(*p.Tag)
		}
		if p.Brand != nil {
			b.Set("brand").To(*p.Brand)
		}
		if p.Model != nil {
			b.Set("model").To(*p.Model)
		}
		if p.IsActive != nil {
			b.Set("is_active").To(*p.IsActive)
		}
		b.Set("updated_at").ToRaw("NOW()")
		b.Where(func(c pgstmt.Cond) {
			c.Eq("id", p.ID)
			c.Eq("site_id", p.SiteID)
		})
	}).ExecWith(ctx)
	if err != nil {
		return nil, err
	}

	return new(struct{}), nil
}

// SetLocation

type SetLocationParams struct {
	SiteID   string  `json:"siteId"`
	DeviceID string  `json:"deviceId"`
	Location string  `json:"location"`
	Level    *int    `json:"level"`
	RoomID   *string `json:"roomId"`
}

func (p *SetLocationParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	v.Must(p.DeviceID != "", "deviceId is required")
	v.Must(slices.Contains(validLocations, p.Location), "location must be site, floor, room, or empty")
	if p.Location == "floor" {
		v.Must(p.Level != nil, "level is required when location is floor")
	}
	if p.Location == "room" {
		v.Must(p.RoomID != nil, "roomId is required when location is room")
	}
	return v.Error()
}

func SetLocation(ctx context.Context, p *SetLocationParams) (*struct{}, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	if err := verifyDeviceInSite(ctx, p.DeviceID, p.SiteID); err != nil {
		return nil, err
	}

	// Verify target exists before clearing assignments
	if p.Location == "floor" {
		if err := verifyFloorExists(ctx, p.SiteID, *p.Level); err != nil {
			return nil, err
		}
	}
	if p.Location == "room" {
		if err := verifyRoomInSite(ctx, *p.RoomID, p.SiteID); err != nil {
			return nil, err
		}
	}

	// Remove all existing location assignments for this device
	_, err := pgctx.Exec(ctx, `
		delete from site_devices
		where device_id = $1
	`, p.DeviceID)
	if err != nil {
		return nil, err
	}

	_, err = pgctx.Exec(ctx, `
		delete from floor_devices
		where device_id = $1
	`, p.DeviceID)
	if err != nil {
		return nil, err
	}

	_, err = pgctx.Exec(ctx, `
		delete from room_devices
		where device_id = $1
	`, p.DeviceID)
	if err != nil {
		return nil, err
	}

	// Insert into the requested location
	switch p.Location {
	case "site":
		_, err = pgctx.Exec(ctx, `
			insert into site_devices (site_id, device_id)
			values ($1, $2)
			on conflict (site_id, device_id) do nothing
		`, p.SiteID, p.DeviceID)
		if err != nil {
			return nil, err
		}
	case "floor":
		_, err = pgctx.Exec(ctx, `
			insert into floor_devices (site_id, level, device_id)
			values ($1, $2, $3)
			on conflict (site_id, level, device_id) do nothing
		`, p.SiteID, *p.Level, p.DeviceID)
		if err != nil {
			return nil, err
		}
	case "room":
		_, err = pgctx.Exec(ctx, `
			insert into room_devices (room_id, device_id)
			values ($1, $2)
			on conflict (room_id, device_id) do nothing
		`, *p.RoomID, p.DeviceID)
		if err != nil {
			return nil, err
		}
	}

	return new(struct{}), nil
}

func verifyDeviceInSite(ctx context.Context, deviceID, siteID string) error {
	var exists bool
	err := pgctx.QueryRow(ctx, `
		select exists (
			select 1
			from devices
			where id = $1
			  and site_id = $2
			  and deleted_at is null
		)
	`,
		deviceID,
		siteID,
	).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return ErrNotFound
	}
	return nil
}

func verifyFloorExists(ctx context.Context, siteID string, level int) error {
	var exists bool
	err := pgctx.QueryRow(ctx, `
		select exists (
			select 1
			from floors
			where site_id = $1
			  and level = $2
		)
	`,
		siteID,
		level,
	).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return ErrFloorNotFound
	}
	return nil
}

func verifyRoomInSite(ctx context.Context, roomID, siteID string) error {
	var exists bool
	err := pgctx.QueryRow(ctx, `
		select exists (
			select 1
			from rooms
			where id = $1
			  and site_id = $2
			  and deleted_at is null
		)
	`,
		roomID,
		siteID,
	).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return ErrRoomNotFound
	}
	return nil
}
