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

type Item struct {
	SiteID    string    `json:"siteId"`
	Name      string    `json:"name"`
	Level     int       `json:"level"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
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

type GetResult struct {
	Item
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
			created_at,
			updated_at
		from floors
		where site_id = $1
		  and level = $2
	`, p.SiteID, p.Level).Scan(
		&r.SiteID,
		&r.Level,
		&r.Name,
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

	return new(struct{}), nil
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
