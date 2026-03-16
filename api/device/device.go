package device

import (
	"context"
	"fmt"
	"time"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/acoshift/pgsql/pgstmt"
	"github.com/moonrhythm/validator"

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

	args := []any{p.SiteID}
	argN := 1

	q := `
		select
			d.id,
			d.site_id,
			d.name,
			d.type,
			d.tag,
			d.brand,
			d.model,
			d.is_active,
			d.created_at,
			coalesce(m.meter_count, 0),
			coalesce(m.online_count, 0),
			m.last_seen_at
		from devices d
		left join lateral (
			select
				count(*) as meter_count,
				count(*) filter (where is_online) as online_count,
				max(last_seen_at) as last_seen_at
			from meters
			where device_id = d.id
		) m on true
		where d.site_id = $1
	`

	if p.Type != "" {
		argN++
		q += fmt.Sprintf(" and d.type = $%d", argN)
		args = append(args, p.Type)
	}
	if p.Search != "" {
		argN++
		q += fmt.Sprintf(" and (d.name ilike $%d or d.brand ilike $%d or d.model ilike $%d)", argN, argN, argN)
		args = append(args, "%"+p.Search+"%")
	}

	q += " order by d.created_at desc"

	rows, err := pgctx.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var items []Item
	for rows.Next() {
		var it Item
		var onlineCount int
		err := rows.Scan(
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
			return nil, err
		}
		it.ConnectionStatus = deriveConnectionStatus(it.MeterCount, onlineCount, it.LastSeenAt)
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
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

	var id string
	err := pgctx.QueryRow(ctx, `
		insert into devices (
			site_id,
			name,
			type,
			tag,
			brand,
			model
		) values ($1, $2, $3, $4, $5, $6)
		returning id
	`,
		p.SiteID,
		p.Name,
		p.Type,
		p.Tag,
		p.Brand,
		p.Model,
	).Scan(&id)
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
