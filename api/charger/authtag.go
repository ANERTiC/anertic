package charger

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

var ErrDuplicate = arpc.NewErrorCode("charger/duplicate", "auth tag already exists")

// ListAuthTags

type ListAuthTagsParams struct {
	ID string `json:"id"`
}

func (p *ListAuthTagsParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

type AuthTagItem struct {
	ID          string     `json:"id"`
	IdTag       string     `json:"idTag"`
	ParentIdTag string     `json:"parentIdTag"`
	Status      string     `json:"status"`
	ExpiryDate  *time.Time `json:"expiryDate"`
	InLocalList bool       `json:"inLocalList"`
	CreatedAt   time.Time  `json:"createdAt"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

type ListAuthTagsResult struct {
	Items []AuthTagItem `json:"items"`
}

func ListAuthTags(ctx context.Context, p *ListAuthTagsParams) (*ListAuthTagsResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var siteID string
	err := pgctx.QueryRow(ctx, `
		select site_id
		from ev_chargers
		where id = $1
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

	items := make([]AuthTagItem, 0)
	err = pgstmt.Select(func(b pgstmt.SelectStatement) {
		b.Columns(
			"id",
			"id_tag",
			"parent_id_tag",
			"status",
			"expiry_date",
			"in_local_list",
			"created_at",
			"updated_at",
		)
		b.From("ev_authorization_tags")
		b.Where(func(c pgstmt.Cond) {
			c.Eq("charger_id", p.ID)
		})
		b.OrderBy("created_at DESC")
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
		var it AuthTagItem
		if err := scan(
			&it.ID,
			&it.IdTag,
			pgsql.NullString(&it.ParentIdTag),
			&it.Status,
			pgsql.Null(&it.ExpiryDate),
			&it.InLocalList,
			&it.CreatedAt,
			&it.UpdatedAt,
		); err != nil {
			return err
		}
		items = append(items, it)
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &ListAuthTagsResult{Items: items}, nil
}

// AddAuthTag

type AddAuthTagParams struct {
	ID          string     `json:"id"`
	IdTag       string     `json:"idTag"`
	ParentIdTag string     `json:"parentIdTag"`
	Status      string     `json:"status"`
	ExpiryDate  *time.Time `json:"expiryDate"`
}

func (p *AddAuthTagParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	v.Must(p.IdTag != "", "idTag is required")
	if p.Status == "" {
		p.Status = "Accepted"
	}
	v.Must(
		p.Status == "Accepted" || p.Status == "Blocked" || p.Status == "Expired" || p.Status == "Invalid",
		"status must be one of Accepted, Blocked, Expired, Invalid",
	)
	return v.Error()
}

type AddAuthTagResult struct {
	ID string `json:"id"`
}

func AddAuthTag(ctx context.Context, p *AddAuthTagParams) (*AddAuthTagResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var siteID, chargerID string
	err := pgctx.QueryRow(ctx, `
		select
			site_id,
			id
		from ev_chargers
		where id = $1
	`, p.ID).Scan(
		&siteID,
		&chargerID,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, siteID); err != nil {
		return nil, err
	}

	id := xid.New().String()
	_, err = pgctx.Exec(ctx, `
		insert into ev_authorization_tags (
			id,
			charger_id,
			id_tag,
			parent_id_tag,
			status,
			expiry_date
		) values ($1, $2, $3, $4, $5, $6)
	`,
		id,
		chargerID,
		p.IdTag,
		nullableString(p.ParentIdTag),
		p.Status,
		p.ExpiryDate,
	)
	if err != nil {
		if pgsql.IsUniqueViolation(err) {
			return nil, ErrDuplicate
		}
		return nil, err
	}

	return &AddAuthTagResult{ID: id}, nil
}

// RemoveAuthTag

type RemoveAuthTagParams struct {
	ID        string `json:"id"`
	AuthTagID string `json:"authTagId"`
}

func (p *RemoveAuthTagParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	v.Must(p.AuthTagID != "", "authTagId is required")
	return v.Error()
}

func RemoveAuthTag(ctx context.Context, p *RemoveAuthTagParams) (*struct{}, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var siteID string
	err := pgctx.QueryRow(ctx, `
		select site_id
		from ev_chargers
		where id = $1
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

	res, err := pgctx.Exec(ctx, `
		delete from ev_authorization_tags
		where id = $1
		  and charger_id = $2
	`, p.AuthTagID, p.ID)
	if err != nil {
		return nil, err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return nil, ErrNotFound
	}

	return new(struct{}), nil
}
