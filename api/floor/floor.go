package floor

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/pgsql"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/acoshift/pgsql/pgstmt"
	"github.com/moonrhythm/validator"

	"github.com/anertic/anertic/api/iam"
	"github.com/anertic/anertic/pkg/devicestatus"
	"github.com/anertic/anertic/pkg/floor"
)

var (
	ErrNotFound       = arpc.NewErrorCode("floor/not-found", "floor not found")
	ErrDuplicate      = arpc.NewErrorCode("floor/duplicate-level", "a floor with this level already exists")
	ErrDeviceNotFound = arpc.NewErrorCode("floor/device-not-found", "device not found")
)

// List

type ListParams struct {
	SiteID string `json:"siteId"`
	Search string `json:"search"`
}

func (p *ListParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	return v.Error()
}

type Item struct {
	SiteID    string     `json:"siteId"`
	Name      string     `json:"name"`
	Level     int        `json:"level"`
	Stats     floor.Stats `json:"stats"`
	CreatedAt time.Time  `json:"createdAt"`
	UpdatedAt time.Time  `json:"updatedAt"`
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
			"site_id",
			"level",
			"name",
			"stats",
			"created_at",
			"updated_at",
		)
		b.From("floors")
		b.Where(func(c pgstmt.Cond) {
			c.Mode().And()
			c.Eq("site_id", p.SiteID)
			if p.Search != "" {
				c.ILike("name", "%"+p.Search+"%")
			}
		})
		b.OrderBy("level").Asc()
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
		var f Item
		if err := scan(
			&f.SiteID,
			&f.Level,
			&f.Name,
			pgsql.JSON(&f.Stats),
			&f.CreatedAt,
			&f.UpdatedAt,
		); err != nil {
			return err
		}
		items = append(items, f)
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
	Level  int    `json:"level"`
}

func (p *CreateParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	v.Must(p.Name != "", "name is required")
	v.Must(p.Level >= -99 && p.Level <= 99, "level must be between -99 and 99")
	return v.Error()
}

type CreateResult struct {
	Level int `json:"level"`
}

func Create(ctx context.Context, p *CreateParams) (*CreateResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	_, err := pgctx.Exec(ctx, `
		insert into floors (
			site_id,
			level,
			name
		) values ($1, $2, $3)
	`,
		p.SiteID,
		p.Level,
		p.Name,
	)
	if err != nil {
		if pgsql.IsUniqueViolation(err) {
			return nil, ErrDuplicate
		}
		return nil, err
	}

	return &CreateResult{Level: p.Level}, nil
}

// Get

type GetParams struct {
	SiteID string `json:"siteId"`
	Level  int    `json:"level"`
}

func (p *GetParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
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
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	var r GetResult
	err := pgctx.QueryRow(ctx, `
		select
			site_id,
			level,
			name,
			stats,
			created_at,
			updated_at
		from floors
		where site_id = $1
		  and level = $2
	`,
		p.SiteID,
		p.Level,
	).Scan(
		&r.SiteID,
		&r.Level,
		&r.Name,
		pgsql.JSON(&r.Stats),
		&r.CreatedAt,
		&r.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	r.Devices = make([]DeviceItem, 0)

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
		b.From("floor_devices fd")
		b.Join("devices d").On(func(c pgstmt.Cond) {
			c.EqRaw("d.id", "fd.device_id")
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
			c.Eq("fd.site_id", p.SiteID)
			c.Eq("fd.level", p.Level)
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

// Update (name only — level is the PK)

type UpdateParams struct {
	SiteID string  `json:"siteId"`
	Level  int     `json:"level"`
	Name   *string `json:"name"`
}

func (p *UpdateParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	return v.Error()
}

type UpdateResult struct {
	Item `json:"item"`
}

func Update(ctx context.Context, p *UpdateParams) (*UpdateResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	res, err := pgstmt.Update(func(b pgstmt.UpdateStatement) {
		b.Table("floors")
		if p.Name != nil {
			b.Set("name").To(*p.Name)
		}
		b.Set("updated_at").ToRaw("now()")
		b.Where(func(c pgstmt.Cond) {
			c.Eq("site_id", p.SiteID)
			c.Eq("level", p.Level)
		})
	}).ExecWith(ctx)
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

	var r UpdateResult
	err = pgctx.QueryRow(ctx, `
		select
			site_id,
			level,
			name,
			stats,
			created_at,
			updated_at
		from floors
		where site_id = $1
		  and level = $2
	`,
		p.SiteID,
		p.Level,
	).Scan(
		&r.SiteID,
		&r.Level,
		&r.Name,
		pgsql.JSON(&r.Stats),
		&r.CreatedAt,
		&r.UpdatedAt,
	)
	if err != nil {
		return nil, err
	}

	return &r, nil
}

// Delete

type DeleteParams struct {
	SiteID string `json:"siteId"`
	Level  int    `json:"level"`
}

func (p *DeleteParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	return v.Error()
}

func Delete(ctx context.Context, p *DeleteParams) (*struct{}, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	// Reset rooms on this floor to level 0
	_, err := pgctx.Exec(ctx, `
		update rooms
		set level = 0,
		    updated_at = now()
		where site_id = $1
		  and level = $2
		  and deleted_at is null
	`, p.SiteID, p.Level)
	if err != nil {
		return nil, err
	}

	// Remove floor device assignments
	_, err = pgctx.Exec(ctx, `
		delete from floor_devices
		where site_id = $1
		  and level = $2
	`, p.SiteID, p.Level)
	if err != nil {
		return nil, err
	}

	// Hard-delete the floor
	res, err := pgctx.Exec(ctx, `
		delete from floors
		where site_id = $1
		  and level = $2
	`, p.SiteID, p.Level)
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
	Level    int    `json:"level"`
	DeviceID string `json:"deviceId"`
}

func (p *AssignDeviceParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
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

	if err := verifyFloorExists(ctx, p.SiteID, p.Level); err != nil {
		return nil, err
	}
	if err := verifyDeviceInSite(ctx, p.DeviceID, p.SiteID); err != nil {
		return nil, err
	}

	_, err := pgctx.Exec(ctx, `
		insert into floor_devices (site_id, level, device_id)
		values ($1, $2, $3)
		on conflict (site_id, level, device_id) do nothing
	`, p.SiteID, p.Level, p.DeviceID)
	if err != nil {
		return nil, err
	}

	return new(struct{}), nil
}

// UnassignDevice

type UnassignDeviceParams struct {
	SiteID   string `json:"siteId"`
	Level    int    `json:"level"`
	DeviceID string `json:"deviceId"`
}

func (p *UnassignDeviceParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
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
		delete from floor_devices
		where site_id = $1
		  and level = $2
		  and device_id = $3
	`, p.SiteID, p.Level, p.DeviceID)
	if err != nil {
		return nil, err
	}

	return new(struct{}), nil
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
	).Scan(
		&exists,
	)
	if err != nil {
		return err
	}
	if !exists {
		return ErrNotFound
	}
	return nil
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
	).Scan(
		&exists,
	)
	if err != nil {
		return err
	}
	if !exists {
		return ErrDeviceNotFound
	}
	return nil
}
