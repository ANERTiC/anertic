package meter

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
	"github.com/rs/xid"

	"github.com/anertic/anertic/api/iam"
)

var (
	ErrNotFound  = arpc.NewErrorCode("meter/not-found", "meter not found")
	ErrDuplicate = arpc.NewErrorCode("meter/duplicate", "serial number already exists")
)

// List

type ListParams struct {
	DeviceID string `json:"deviceId"`
}

func (p *ListParams) Valid() error {
	v := validator.New()
	v.Must(p.DeviceID != "", "deviceId is required")
	return v.Error()
}

type Item struct {
	ID           string     `json:"id"`
	DeviceID     string     `json:"deviceId"`
	SerialNumber string     `json:"serialNumber"`
	Protocol     string     `json:"protocol"`
	Vendor       string     `json:"vendor"`
	Phase        int        `json:"phase"`
	Channel      string     `json:"channel"`
	IsOnline     bool       `json:"isOnline"`
	LastSeenAt   *time.Time `json:"lastSeenAt"`
	CreatedAt    time.Time  `json:"createdAt"`
	UpdatedAt    time.Time  `json:"updatedAt"`
}

type ListResult struct {
	Items []Item `json:"items"`
}

func List(ctx context.Context, p *ListParams) (*ListResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var siteID string
	err := pgctx.QueryRow(ctx, `
		select site_id
		from devices
		where id = $1
	`, p.DeviceID).Scan(&siteID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, arpc.NewErrorCode("device/not-found", "device not found")
	}
	if err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, siteID); err != nil {
		return nil, err
	}

	var items []Item

	err = pgstmt.Select(func(b pgstmt.SelectStatement) {
		b.Columns(
			"id",
			"device_id",
			"serial_number",
			"protocol",
			"vendor",
			"phase",
			"channel",
			"is_online",
			"last_seen_at",
			"created_at",
			"updated_at",
		)
		b.From("meters")
		b.Where(func(c pgstmt.Cond) {
			c.Eq("device_id", p.DeviceID)
		})
		b.OrderBy("created_at desc")
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
		var it Item
		err := scan(
			&it.ID,
			&it.DeviceID,
			&it.SerialNumber,
			&it.Protocol,
			&it.Vendor,
			&it.Phase,
			&it.Channel,
			&it.IsOnline,
			pgsql.Null(&it.LastSeenAt),
			&it.CreatedAt,
			&it.UpdatedAt,
		)
		if err != nil {
			return err
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
	DeviceID     string `json:"deviceId"`
	SerialNumber string `json:"serialNumber"`
	Protocol     string `json:"protocol"`
	Vendor       string `json:"vendor"`
	Phase        int    `json:"phase"`
	Channel      string `json:"channel"`
}

func (p *CreateParams) Valid() error {
	v := validator.New()
	v.Must(p.DeviceID != "", "deviceId is required")
	v.Must(p.SerialNumber != "", "serialNumber is required")
	v.Must(p.Protocol != "", "protocol is required")
	v.Must(p.Protocol == "mqtt" || p.Protocol == "http", "protocol must be mqtt or http")
	return v.Error()
}

type CreateResult struct {
	ID string `json:"id"`
}

func Create(ctx context.Context, p *CreateParams) (*CreateResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var siteID string
	err := pgctx.QueryRow(ctx, `
		select site_id
		from devices
		where id = $1
	`, p.DeviceID).Scan(&siteID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, arpc.NewErrorCode("device/not-found", "device not found")
	}
	if err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, siteID); err != nil {
		return nil, err
	}

	id := xid.New().String()
	_, err = pgctx.Exec(ctx, `
		insert into meters (
			id,
			device_id,
			serial_number,
			protocol,
			vendor,
			phase,
			channel
		) values ($1, $2, $3, $4, $5, $6, $7)
	`,
		id,
		p.DeviceID,
		p.SerialNumber,
		p.Protocol,
		p.Vendor,
		p.Phase,
		p.Channel,
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
			device_id,
			serial_number,
			protocol,
			vendor,
			phase,
			channel,
			is_online,
			last_seen_at,
			created_at,
			updated_at
		from meters
		where id = $1
	`, p.ID).Scan(
		&r.ID,
		&r.DeviceID,
		&r.SerialNumber,
		&r.Protocol,
		&r.Vendor,
		&r.Phase,
		&r.Channel,
		&r.IsOnline,
		pgsql.Null(&r.LastSeenAt),
		&r.CreatedAt,
		&r.UpdatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	return &r, nil
}

// Update

type UpdateParams struct {
	ID      string  `json:"id"`
	Vendor  *string `json:"vendor"`
	Phase   *int    `json:"phase"`
	Channel *string `json:"channel"`
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
		b.Table("meters")
		if p.Vendor != nil {
			b.Set("vendor").To(*p.Vendor)
		}
		if p.Phase != nil {
			b.Set("phase").To(*p.Phase)
		}
		if p.Channel != nil {
			b.Set("channel").To(*p.Channel)
		}
		b.Set("updated_at").ToRaw("now()")
		b.Where(func(c pgstmt.Cond) {
			c.Eq("id", p.ID)
		})
	}).ExecWith(ctx)
	if err != nil {
		return nil, err
	}

	return new(struct{}), nil
}

// Delete

type DeleteParams struct {
	ID string `json:"id"`
}

func (p *DeleteParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

func Delete(ctx context.Context, p *DeleteParams) (*struct{}, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var siteID string
	err := pgctx.QueryRow(ctx, `
		select d.site_id
		from meters m
		join devices d on d.id = m.device_id
		where m.id = $1
	`, p.ID).Scan(&siteID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, siteID); err != nil {
		return nil, err
	}

	_, err = pgctx.Exec(ctx, `
		delete from meters
		where id = $1
	`, p.ID)
	if err != nil {
		return nil, err
	}

	return new(struct{}), nil
}
