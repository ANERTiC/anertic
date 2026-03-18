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
	"github.com/lib/pq"
	"github.com/moonrhythm/validator"
	"github.com/rs/xid"

	"github.com/anertic/anertic/api/iam"
	"github.com/anertic/anertic/pkg/devicestatus"
)

var (
	ErrNotFound  = arpc.NewErrorCode("floor/not-found", "floor not found")
	ErrDuplicate = arpc.NewErrorCode("floor/duplicate-level", "a floor with this level already exists")
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

type RoomItem struct {
	ID               string   `json:"id"`
	Name             string   `json:"name"`
	Type             string   `json:"type"`
	DeviceCount      int      `json:"deviceCount"`
	LivePowerW       *float64 `json:"livePowerW"`
	ConnectionStatus string   `json:"connectionStatus"`
}

type Item struct {
	ID        string     `json:"id"`
	SiteID    string     `json:"siteId"`
	Name      string     `json:"name"`
	Level     int        `json:"level"`
	Rooms     []RoomItem `json:"rooms"`
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

	floors := make([]Item, 0)
	err := pgstmt.Select(func(b pgstmt.SelectStatement) {
		b.Columns(
			"id",
			"site_id",
			"name",
			"level",
			"created_at",
			"updated_at",
		)
		b.From("floors")
		b.Where(func(c pgstmt.Cond) {
			c.Mode().And()
			c.Eq("site_id", p.SiteID)
			c.IsNull("deleted_at")
			if p.Search != "" {
				c.ILike("name", "%"+p.Search+"%")
			}
		})
		b.OrderBy("level").Asc()
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
		var f Item
		if err := scan(
			&f.ID,
			&f.SiteID,
			&f.Name,
			&f.Level,
			&f.CreatedAt,
			&f.UpdatedAt,
		); err != nil {
			return err
		}
		f.Rooms = make([]RoomItem, 0)
		floors = append(floors, f)
		return nil
	})
	if err != nil {
		return nil, err
	}

	if len(floors) == 0 {
		return &ListResult{Items: floors}, nil
	}

	// Build floor ID index for room attachment
	floorIndex := make(map[string]int, len(floors))
	floorIDs := make([]string, len(floors))
	for i, f := range floors {
		floorIndex[f.ID] = i
		floorIDs[i] = f.ID
	}

	// Query rooms with device aggregation for the fetched floors
	err = pgstmt.Select(func(b pgstmt.SelectStatement) {
		b.Columns(
			"r.id",
			"r.name",
			"r.type",
			"r.floor_id",
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
			c.IsNull("r.deleted_at")
			c.Eq("r.floor_id", pgstmt.Any(pq.Array(floorIDs)))
		})
		b.OrderBy("r.created_at").Asc()
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
		var ri RoomItem
		var floorID string
		var meterCount, onlineCount int
		var lastSeenAt *time.Time
		if err := scan(
			&ri.ID,
			&ri.Name,
			&ri.Type,
			&floorID,
			&ri.DeviceCount,
			&meterCount,
			&onlineCount,
			pgsql.Null(&lastSeenAt),
			pgsql.Null(&ri.LivePowerW),
		); err != nil {
			return err
		}
		ri.ConnectionStatus = devicestatus.Derive(meterCount, onlineCount, lastSeenAt)
		if idx, ok := floorIndex[floorID]; ok {
			floors[idx].Rooms = append(floors[idx].Rooms, ri)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &ListResult{Items: floors}, nil
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
		insert into floors (
			id,
			site_id,
			name,
			level
		) values ($1, $2, $3, $4)
	`,
		id,
		p.SiteID,
		p.Name,
		p.Level,
	)
	if err != nil {
		if pgsql.IsUniqueViolation(err) {
			return nil, ErrDuplicate
		}
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
			level,
			created_at,
			updated_at
		from floors
		where id = $1
		  and deleted_at is null
	`, p.ID).Scan(
		&r.ID,
		&r.SiteID,
		&r.Name,
		&r.Level,
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

	r.Rooms = make([]RoomItem, 0)

	// Fetch rooms for this floor with device aggregation
	err = pgstmt.Select(func(b pgstmt.SelectStatement) {
		b.Columns(
			"r.id",
			"r.name",
			"r.type",
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
			c.IsNull("r.deleted_at")
			c.Eq("r.floor_id", p.ID)
		})
		b.OrderBy("r.created_at").Asc()
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
		var ri RoomItem
		var meterCount, onlineCount int
		var lastSeenAt *time.Time
		if err := scan(
			&ri.ID,
			&ri.Name,
			&ri.Type,
			&ri.DeviceCount,
			&meterCount,
			&onlineCount,
			pgsql.Null(&lastSeenAt),
			pgsql.Null(&ri.LivePowerW),
		); err != nil {
			return err
		}
		ri.ConnectionStatus = devicestatus.Derive(meterCount, onlineCount, lastSeenAt)
		r.Rooms = append(r.Rooms, ri)
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
	Level  *int    `json:"level"`
}

func (p *UpdateParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	v.Must(p.ID != "", "id is required")
	if p.Level != nil {
		v.Must(*p.Level >= -99 && *p.Level <= 99, "level must be between -99 and 99")
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

	res, err := pgstmt.Update(func(b pgstmt.UpdateStatement) {
		b.Table("floors")
		if p.Name != nil {
			b.Set("name").To(*p.Name)
		}
		if p.Level != nil {
			b.Set("level").To(*p.Level)
		}
		b.Set("updated_at").ToRaw("now()")
		b.Where(func(c pgstmt.Cond) {
			c.Eq("id", p.ID)
			c.Eq("site_id", p.SiteID)
			c.IsNull("deleted_at")
		})
	}).ExecWith(ctx)
	if err != nil {
		if pgsql.IsUniqueViolation(err) {
			return nil, ErrDuplicate
		}
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

	// Unassign rooms from this floor first
	_, err := pgctx.Exec(ctx, `
		update rooms
		set floor_id = null,
		    updated_at = now()
		where floor_id = $1
		  and deleted_at is null
	`, p.ID)
	if err != nil {
		return nil, err
	}

	// Soft-delete the floor
	res, err := pgctx.Exec(ctx, `
		update floors
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

// Reorder

type ReorderItem struct {
	ID    string `json:"id"`
	Level int    `json:"level"`
}

type ReorderParams struct {
	SiteID string        `json:"siteId"`
	Floors []ReorderItem `json:"floors"`
}

func (p *ReorderParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	v.Must(len(p.Floors) > 0, "floors is required")

	seen := make(map[int]bool, len(p.Floors))
	for _, f := range p.Floors {
		v.Must(f.ID != "", "floor id is required")
		v.Must(f.Level >= -99 && f.Level <= 99, "level must be between -99 and 99")
		v.Must(!seen[f.Level], "floor levels must be unique within the request")
		seen[f.Level] = true
	}
	return v.Error()
}

func Reorder(ctx context.Context, p *ReorderParams) (*struct{}, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	err := pgctx.RunInTx(ctx, func(ctx context.Context) error {
		// Step 1: offset all affected floors to a safe range (avoids unique constraint
		// collisions during the two-phase reorder)
		ids := make([]string, len(p.Floors))
		for i, f := range p.Floors {
			ids[i] = f.ID
		}

		_, err := pgctx.Exec(ctx, `
			update floors
			set level = level + 100000,
			    updated_at = now()
			where id = any($1)
			  and site_id = $2
			  and deleted_at is null
		`, pq.Array(ids), p.SiteID)
		if err != nil {
			return err
		}

		// Step 2: set each floor to its target level
		for _, f := range p.Floors {
			_, err := pgctx.Exec(ctx, `
				update floors
				set level = $1,
				    updated_at = now()
				where id = $2
				  and site_id = $3
				  and deleted_at is null
			`, f.Level, f.ID, p.SiteID)
			if err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}

	return new(struct{}), nil
}
