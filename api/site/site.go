package site

import (
	"context"
	"database/sql"
	"errors"
	"time"
	"unicode/utf8"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/pgsql"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/acoshift/pgsql/pgstmt"

	"github.com/anertic/anertic/api/auth"
	"github.com/anertic/anertic/api/iam"
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
	ID        string         `json:"id"`
	Name      string         `json:"name"`
	Address   string         `json:"address"`
	Timezone  string         `json:"timezone"`
	Metadata  map[string]any `json:"metadata"`
	CreatedAt time.Time      `json:"createdAt"`
}

type ListResult struct {
	Items []Item `json:"items"`
}

func List(ctx context.Context, p *ListParams) (*ListResult, error) {
	items := make([]Item, 0)

	userID := auth.AccountID(ctx)

	err := pgstmt.Select(func(b pgstmt.SelectStatement) {
		b.Columns(
			"s.id",
			"s.name",
			"s.address",
			"s.timezone",
			"s.metadata",
			"s.created_at",
		)
		b.From("sites s")
		b.Join("site_members sm").On(func(c pgstmt.Cond) {
			c.EqRaw("sm.site_id", "s.id")
		})
		b.Where(func(c pgstmt.Cond) {
			c.Eq("sm.user_id", userID)
		})
		if p.Search != "" {
			b.Where(func(c pgstmt.Cond) {
				c.Mode().Or()
				c.ILike("s.name", "%"+p.Search+"%")
				c.ILike("s.address", "%"+p.Search+"%")
			})
		}
		b.OrderBy("s.created_at DESC")
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
		var it Item
		err := scan(
			&it.ID,
			&it.Name,
			&it.Address,
			&it.Timezone,
			pgsql.JSON(&it.Metadata),
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
	v.Must(p.Timezone != "", "timezone is required")
	v.Must(utf8.RuneCountInString(p.Address) < 200, "address must be less than 200 characters")
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

	userID := auth.AccountID(ctx)

	id := xid.New().String()
	_, err := pgctx.Exec(ctx, `
		insert into sites (
			id,
			name,
			address,
			timezone
		) values ($1, $2, $3, $4)
	`,
		id,
		p.Name,
		p.Address,
		tz,
	)
	if err != nil {
		return nil, err
	}

	_, err = pgctx.Exec(ctx, `
		insert into site_members (
			site_id,
			user_id,
			role
		) values ($1, $2, '*')
	`,
		id,
		userID,
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
}

func Get(ctx context.Context, p *GetParams) (*GetResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, p.ID); err != nil {
		return nil, err
	}

	var r GetResult
	err := pgctx.QueryRow(ctx, `
		select
			id,
			name,
			address,
			timezone,
			metadata,
			created_at
		from sites
		where id = $1
	`, p.ID).Scan(
		&r.ID,
		&r.Name,
		&r.Address,
		&r.Timezone,
		pgsql.JSON(&r.Metadata),
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

	if err := iam.InSite(ctx, p.ID); err != nil {
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
