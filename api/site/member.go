package site

import (
	"context"
	"time"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/asaskevich/govalidator"
	"github.com/moonrhythm/validator"

	"github.com/anertic/anertic/api/iam"
)

var (
	ErrMemberNotFound = arpc.NewErrorCode("site/member-not-found", "member not found")
	ErrDuplicate      = arpc.NewErrorCode("site/duplicate", "member already exists")
)

// ListMembers

type ListMembersParams struct {
	SiteID string `json:"siteId"`
}

func (p *ListMembersParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	return v.Error()
}

type Member struct {
	UserID    string    `json:"userId"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Picture   string    `json:"picture"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"createdAt"`
}

type ListMembersResult struct {
	Items []Member `json:"items"`
}

func ListMembers(ctx context.Context, p *ListMembersParams) (*ListMembersResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	items := make([]Member, 0)

	rows, err := pgctx.Query(ctx, `
		select
			sm.user_id,
			u.email,
			u.name,
			u.picture,
			sm.role,
			sm.created_at
		from site_members sm
		join users u on u.id = sm.user_id
		where sm.site_id = $1
		order by sm.created_at
	`,
		p.SiteID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var it Member
		err := rows.Scan(
			&it.UserID,
			&it.Email,
			&it.Name,
			&it.Picture,
			&it.Role,
			&it.CreatedAt,
		)
		if err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &ListMembersResult{Items: items}, nil
}

// AddMember

type AddMemberParams struct {
	SiteID string `json:"siteId"`
	Email  string `json:"email"`
}

func (p *AddMemberParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	v.Must(p.Email != "", "email is required")
	v.Must(govalidator.IsEmail(p.Email), "invalid email")
	return v.Error()
}

type AddMemberResult struct {
	UserID string `json:"userId"`
}

func AddMember(ctx context.Context, p *AddMemberParams) (*AddMemberResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	var userID string
	err := pgctx.QueryRow(ctx, `
		select id
		from users
		where email = $1
	`,
		p.Email,
	).Scan(&userID)
	if err != nil {
		return nil, ErrMemberNotFound
	}

	_, err = pgctx.Exec(ctx, `
		insert into site_members (
			site_id,
			user_id
		) values ($1, $2)
		on conflict (site_id, user_id) do nothing
	`,
		p.SiteID,
		userID,
	)
	if err != nil {
		return nil, err
	}

	return &AddMemberResult{UserID: userID}, nil
}

// UpdateMemberRole

type UpdateMemberRoleParams struct {
	SiteID string `json:"siteId"`
	UserID string `json:"userId"`
	Role   string `json:"role"`
}

func (p *UpdateMemberRoleParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	v.Must(p.UserID != "", "userId is required")
	v.Must(p.Role != "", "role is required")
	v.Must(p.Role == "*" || p.Role == "editor" || p.Role == "viewer", "invalid role")
	return v.Error()
}

func UpdateMemberRole(ctx context.Context, p *UpdateMemberRoleParams) (*struct{}, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	result, err := pgctx.Exec(ctx, `
		update site_members
		set role = $1
		where site_id = $2
		  and user_id = $3
	`,
		p.Role,
		p.SiteID,
		p.UserID,
	)
	if err != nil {
		return nil, err
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return nil, ErrMemberNotFound
	}

	return new(struct{}), nil
}

// RemoveMember

type RemoveMemberParams struct {
	SiteID string `json:"siteId"`
	UserID string `json:"userId"`
}

func (p *RemoveMemberParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	v.Must(p.UserID != "", "userId is required")
	return v.Error()
}

func RemoveMember(ctx context.Context, p *RemoveMemberParams) (*struct{}, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	_, err := pgctx.Exec(ctx, `
		delete from site_members
		where site_id = $1
		  and user_id = $2
	`,
		p.SiteID,
		p.UserID,
	)
	if err != nil {
		return nil, err
	}

	return new(struct{}), nil
}
