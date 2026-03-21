package room

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
	ErrNotFound       = arpc.NewErrorCode("room/not-found", "room not found")
	ErrDeviceNotFound = arpc.NewErrorCode("room/device-not-found", "device not found")

	validRoomTypes = []string{"living", "bedroom", "kitchen", "bathroom", "office", "garage", "laundry", "storage", "outdoor", "other"}
)

// List

type ListParams struct {
	SiteID string `json:"siteId"`
	Type   string `json:"type"`
	Search string `json:"search"`
	Level  *int   `json:"level"`
}

func (p *ListParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	return v.Error()
}

type Item struct {
	ID               string    `json:"id"`
	SiteID           string    `json:"siteId"`
	Name             string    `json:"name"`
	Type             string    `json:"type"`
	DeviceCount      int       `json:"deviceCount"`
	LivePowerW       *float64  `json:"livePowerW"`
	ConnectionStatus string    `json:"connectionStatus"`
	CreatedAt        time.Time `json:"createdAt"`
	UpdatedAt        time.Time `json:"updatedAt"`
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

	items := make([]Item, 0)

	err := pgstmt.Select(func(b pgstmt.SelectStatement) {
		b.Columns(
			"r.id",
			"r.site_id",
			"r.name",
			"r.type",
			"r.created_at",
			"r.updated_at",
			pgstmt.Raw("coalesce(agg.device_count, 0)"),
			pgstmt.Raw("coalesce(agg.meter_count, 0)"),
			pgstmt.Raw("coalesce(agg.online_count, 0)"),
			"agg.last_seen_at",
			"agg.live_power_w",
		)
		b.From("rooms r")
		b.LeftJoinLateralSelect(func(b pgstmt.SelectStatement) {
			b.Columns(
				pgstmt.Raw("count(distinct d.id) as device_count"),
				pgstmt.Raw("count(m.*) as meter_count"),
				pgstmt.Raw("count(m.*) filter (where m.is_online) as online_count"),
				pgstmt.Raw("max(m.last_seen_at) as last_seen_at"),
				pgstmt.Raw("sum((m.latest_reading->>'power_w')::numeric) as live_power_w"),
			)
			b.From("room_devices rd")
			b.Join("devices d").On(func(c pgstmt.Cond) {
				c.EqRaw("d.id", "rd.device_id")
				c.IsNull("d.deleted_at")
			})
			b.LeftJoin("meters m").On(func(c pgstmt.Cond) {
				c.EqRaw("m.device_id", "d.id")
			})
			b.Where(func(c pgstmt.Cond) {
				c.EqRaw("rd.room_id", "r.id")
			})
		}, "agg").On(func(c pgstmt.Cond) {
			c.Raw("true")
		})
		b.Where(func(c pgstmt.Cond) {
			c.Mode().And()
			c.Eq("r.site_id", p.SiteID)
			c.IsNull("r.deleted_at")
			if p.Type != "" {
				c.Eq("r.type", p.Type)
			}
			if p.Search != "" {
				c.ILike("r.name", "%"+p.Search+"%")
			}
			if p.Level != nil {
				c.Eq("r.level", *p.Level)
			}
		})
		b.OrderBy("r.created_at").Desc()
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
		var it Item
		var meterCount, onlineCount int
		var lastSeenAt *time.Time
		err := scan(
			&it.ID,
			&it.SiteID,
			&it.Name,
			&it.Type,
			&it.CreatedAt,
			&it.UpdatedAt,
			&it.DeviceCount,
			&meterCount,
			&onlineCount,
			pgsql.Null(&lastSeenAt),
			pgsql.Null(&it.LivePowerW),
		)
		if err != nil {
			return err
		}
		it.ConnectionStatus = devicestatus.Derive(meterCount, onlineCount, lastSeenAt)
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
}

func (p *CreateParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	v.Must(p.Name != "", "name is required")
	v.Must(p.Type != "", "type is required")
	v.Must(slices.Contains(validRoomTypes, p.Type), "type must be one of: living, bedroom, kitchen, bathroom, office, garage, laundry, storage, outdoor, other")
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
		insert into rooms (
			id,
			site_id,
			name,
			type
		) values ($1, $2, $3, $4)
	`,
		id,
		p.SiteID,
		p.Name,
		p.Type,
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

type DeviceItem struct {
	ID               string     `json:"id"`
	Name             string     `json:"name"`
	Type             string     `json:"type"`
	Tag              string     `json:"tag"`
	ConnectionStatus string     `json:"connectionStatus"`
	MeterCount       int        `json:"meterCount"`
	LastSeenAt       *time.Time `json:"lastSeenAt"`
}

type GetResult struct {
	Item
	Devices []DeviceItem `json:"devices"`
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
			created_at,
			updated_at
		from rooms
		where id = $1
		  and deleted_at is null
	`, p.ID).Scan(
		&r.ID,
		&r.SiteID,
		&r.Name,
		&r.Type,
		&r.CreatedAt,
		&r.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, r.SiteID); err != nil {
		return nil, err
	}

	r.Devices = make([]DeviceItem, 0)

	// Fetch assigned devices with meter aggregation
	err = pgstmt.Select(func(b pgstmt.SelectStatement) {
		b.Columns(
			"d.id",
			"d.name",
			"d.type",
			"d.tag",
			pgstmt.Raw("coalesce(m.meter_count, 0)"),
			pgstmt.Raw("coalesce(m.online_count, 0)"),
			"m.last_seen_at",
		)
		b.From("room_devices rd")
		b.Join("devices d").On(func(c pgstmt.Cond) {
			c.EqRaw("d.id", "rd.device_id")
			c.IsNull("d.deleted_at")
		})
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
		b.Where(func(c pgstmt.Cond) {
			c.Eq("rd.room_id", p.ID)
		})
		b.OrderBy("d.created_at").Desc()
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
		var it DeviceItem
		var onlineCount int
		err := scan(
			&it.ID,
			&it.Name,
			&it.Type,
			&it.Tag,
			&it.MeterCount,
			&onlineCount,
			pgsql.Null(&it.LastSeenAt),
		)
		if err != nil {
			return err
		}
		it.ConnectionStatus = devicestatus.Derive(it.MeterCount, onlineCount, it.LastSeenAt)
		r.Devices = append(r.Devices, it)
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &r, nil
}

// Update

type UpdateParams struct {
	SiteID string  `json:"siteId"`
	ID     string  `json:"id"`
	Name   *string `json:"name"`
	Type   *string `json:"type"`
}

func (p *UpdateParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	v.Must(p.ID != "", "id is required")
	if p.Type != nil {
		v.Must(slices.Contains(validRoomTypes, *p.Type), "type must be one of: living, bedroom, kitchen, bathroom, office, garage, laundry, storage, outdoor, other")
	}
	return v.Error()
}

func Update(ctx context.Context, p *UpdateParams) (*struct{}, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	_, err := pgstmt.Update(func(b pgstmt.UpdateStatement) {
		b.Table("rooms")
		if p.Name != nil {
			b.Set("name").To(*p.Name)
		}
		if p.Type != nil {
			b.Set("type").To(*p.Type)
		}
		b.Set("updated_at").ToRaw("now()")
		b.Where(func(c pgstmt.Cond) {
			c.Eq("id", p.ID)
			c.Eq("site_id", p.SiteID)
			c.IsNull("deleted_at")
		})
	}).ExecWith(ctx)
	if err != nil {
		return nil, err
	}

	return new(struct{}), nil
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

	// Remove device associations first
	_, err := pgctx.Exec(ctx, `
		delete from room_devices
		where room_id = $1
	`, p.ID)
	if err != nil {
		return nil, err
	}

	// Soft-delete the room
	res, err := pgctx.Exec(ctx, `
		update rooms
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

// AssignDevice

type AssignDeviceParams struct {
	SiteID   string `json:"siteId"`
	RoomID   string `json:"roomId"`
	DeviceID string `json:"deviceId"`
}

func (p *AssignDeviceParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	v.Must(p.RoomID != "", "roomId is required")
	v.Must(p.DeviceID != "", "deviceId is required")
	return v.Error()
}

func AssignDevice(ctx context.Context, p *AssignDeviceParams) (*struct{}, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	if err := verifyRoomInSite(ctx, p.RoomID, p.SiteID); err != nil {
		return nil, err
	}
	if err := verifyDeviceInSite(ctx, p.DeviceID, p.SiteID); err != nil {
		return nil, err
	}

	_, err := pgctx.Exec(ctx, `
		insert into room_devices (room_id, device_id)
		values ($1, $2)
		on conflict (room_id, device_id) do nothing
	`, p.RoomID, p.DeviceID)
	if err != nil {
		return nil, err
	}

	return new(struct{}), nil
}

// UnassignDevice

type UnassignDeviceParams struct {
	SiteID   string `json:"siteId"`
	RoomID   string `json:"roomId"`
	DeviceID string `json:"deviceId"`
}

func (p *UnassignDeviceParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	v.Must(p.RoomID != "", "roomId is required")
	v.Must(p.DeviceID != "", "deviceId is required")
	return v.Error()
}

func UnassignDevice(ctx context.Context, p *UnassignDeviceParams) (*struct{}, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	_, err := pgctx.Exec(ctx, `
		delete from room_devices
		where room_id = $1
		  and device_id = $2
	`, p.RoomID, p.DeviceID)
	if err != nil {
		return nil, err
	}

	return new(struct{}), nil
}

// verifyRoomInSite checks that the room belongs to the given site and is not deleted.
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
	`, roomID, siteID).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return ErrNotFound
	}
	return nil
}

// verifyDeviceInSite checks that the device belongs to the given site and is not deleted.
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
	`, deviceID, siteID).Scan(&exists)
	if err != nil {
		return err
	}
	if !exists {
		return ErrDeviceNotFound
	}
	return nil
}
