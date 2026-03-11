package site

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
)

var (
	ErrNotFound = arpc.NewErrorCode("site/not-found", "site not found")
)

// List

type ListParams struct {
	Search string `json:"search"`
}

type Item struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Address   string    `json:"address"`
	Timezone  string    `json:"timezone"`
	CreatedAt time.Time `json:"createdAt"`
}

type ListResult struct {
	Items []Item `json:"items"`
}

func List(ctx context.Context, p *ListParams) (*ListResult, error) {
	items := make([]Item, 0)

	err := pgstmt.Select(func(b pgstmt.SelectStatement) {
		b.Columns(
			"id",
			"name",
			"address",
			"timezone",
			"created_at",
		)
		b.From("sites")
		if p.Search != "" {
			b.Where(func(c pgstmt.Cond) {
				c.Mode().Or()
				c.ILike("name", "%"+p.Search+"%")
				c.ILike("address", "%"+p.Search+"%")
			})
		}
		b.OrderBy("created_at DESC")
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
		var it Item
		err := scan(
			&it.ID,
			&it.Name,
			&it.Address,
			&it.Timezone,
			&it.CreatedAt,
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
	Name     string `json:"name"`
	Address  string `json:"address"`
	Timezone string `json:"timezone"`
}

func (p *CreateParams) Valid() error {
	v := validator.New()
	v.Must(p.Name != "", "name is required")
	return v.Error()
}

type CreateResult struct {
	ID string `json:"id"`
}

func Create(ctx context.Context, p *CreateParams) (*CreateResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	tz := p.Timezone
	if tz == "" {
		tz = "Asia/Bangkok"
	}
	if _, err := time.LoadLocation(tz); err != nil {
		return nil, arpc.NewErrorCode("site/invalid-timezone", "invalid timezone")
	}

	id := xid.New().String()
	_, err := pgctx.Exec(ctx, `
		INSERT INTO sites (
			id,
			name,
			address,
			timezone
		) VALUES ($1, $2, $3, $4)
	`,
		id,
		p.Name,
		p.Address,
		tz,
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
		SELECT
			id,
			name,
			address,
			timezone,
			created_at
		FROM sites
		WHERE id = $1
	`, p.ID).Scan(
		&r.ID,
		&r.Name,
		&r.Address,
		&r.Timezone,
		&r.CreatedAt,
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
	ID       string  `json:"id"`
	Name     *string `json:"name"`
	Address  *string `json:"address"`
	Timezone *string `json:"timezone"`
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
		b.Table("sites")
		if p.Name != nil {
			b.Set("name").To(*p.Name)
		}
		if p.Address != nil {
			b.Set("address").To(*p.Address)
		}
		if p.Timezone != nil {
			b.Set("timezone").To(*p.Timezone)
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
