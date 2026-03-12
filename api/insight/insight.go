package insight

import (
	"context"
	"time"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/pgsql"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/acoshift/pgsql/pgstmt"
	"github.com/moonrhythm/validator"

	"github.com/anertic/anertic/api/iam"
)

var (
	ErrNotFound = arpc.NewErrorCode("insight/not-found", "insight not found")
)

// List

type ListParams struct {
	SiteID string `json:"siteId"`
	Type   string `json:"type"`
}

func (p *ListParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	return v.Error()
}

type Item struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	Title     string    `json:"title"`
	Body      string    `json:"body"`
	IsRead    bool      `json:"isRead"`
	CreatedAt time.Time `json:"createdAt"`
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
			"id",
			"type",
			"title",
			"body",
			"is_read",
			"created_at",
		)
		b.From("insights")
		b.Where(func(c pgstmt.Cond) {
			c.Mode().And()
			c.Eq("site_id", p.SiteID)
			if p.Type != "" {
				c.Eq("type", p.Type)
			}
		})
		b.OrderBy("created_at DESC")
		b.Limit(50)
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
		var it Item
		err := scan(
			&it.ID,
			&it.Type,
			&it.Title,
			&it.Body,
			&it.IsRead,
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
	Data map[string]any `json:"data"`
}

func Get(ctx context.Context, p *GetParams) (*GetResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var r GetResult
	err := pgctx.QueryRow(ctx, `
		SELECT
			id,
			type,
			title,
			body,
			is_read,
			created_at
		FROM insights
		WHERE id = $1
	`, p.ID).Scan(
		&r.ID,
		&r.Type,
		&r.Title,
		&r.Body,
		&r.IsRead,
		&r.CreatedAt,
	)
	if err != nil {
		return nil, ErrNotFound
	}

	// Mark as read
	pgctx.Exec(ctx, `UPDATE insights SET is_read = true WHERE id = $1`, p.ID)

	return &r, nil
}
