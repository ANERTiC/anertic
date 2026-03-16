package device

import (
	"context"
	"time"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/pgsql"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/acoshift/pgsql/pgstmt"
	"github.com/moonrhythm/validator"
	"github.com/rs/xid"

	"github.com/anertic/anertic/api/iam"
)

var (
	ErrNotFound = arpc.NewErrorCode("device/not-found", "device not found")
)

// List

type ListParams struct {
	SiteID string `json:"siteId"`
	Type   string `json:"type"`
	Search string `json:"search"`
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
			&it.LastSeenAt,
		)
		if err != nil {
			return err
		}
		it.ConnectionStatus = deriveConnectionStatus(it.MeterCount, onlineCount, it.LastSeenAt)
		items = append(items, it)
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &ListResult{Items: items}, nil
}

func deriveConnectionStatus(meterCount, onlineCount int, lastSeenAt *time.Time) string {
	if meterCount == 0 {
		return "offline"
	}
	if onlineCount > 0 {
		return "online"
	}
	if lastSeenAt != nil && time.Since(*lastSeenAt) < 30*time.Minute {
		return "degraded"
	}
	return "offline"
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

	return &r, nil
}

// Update

type UpdateParams struct {
	ID    string  `json:"id"`
	Name  *string `json:"name"`
	Brand *string `json:"brand"`
	Model *string `json:"model"`
}

func (p *UpdateParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
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

	_, err := pgstmt.Update(func(b pgstmt.UpdateStatement) {
		b.Table("devices")
		if p.Name != nil {
			b.Set("name").To(*p.Name)
		}
		if p.Brand != nil {
			b.Set("brand").To(*p.Brand)
		}
		if p.Model != nil {
			b.Set("model").To(*p.Model)
		}
		b.Set("updated_at").ToRaw("NOW()")
		b.Where(func(c pgstmt.Cond) {
			c.Eq("id", p.ID)
		})
	}).ExecWith(ctx)
	if err != nil {
		return nil, err
	}

	return new(struct{}), nil
}
