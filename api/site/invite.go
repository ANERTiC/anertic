package site

import (
	"context"
	"time"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/pgsql"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/asaskevich/govalidator"
	"github.com/moonrhythm/validator"
	"github.com/rs/xid"

	"github.com/anertic/anertic/api/auth"
	"github.com/anertic/anertic/api/iam"
)

var (
	ErrInviteNotFound    = arpc.NewErrorCode("site/invite-not-found", "invitation not found")
	ErrAlreadyMember     = arpc.NewErrorCode("site/already-member", "user is already a member of this site")
	ErrInviteAlreadySent = arpc.NewErrorCode("site/invite-already-sent", "a pending invitation already exists for this email")
)

// InviteMember

type InviteMemberParams struct {
	SiteID string `json:"siteId"`
	Email  string `json:"email"`
	Role   string `json:"role"`
}

func (p *InviteMemberParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	v.Must(p.Email != "", "email is required")
	v.Must(govalidator.IsEmail(p.Email), "invalid email")
	if p.Role == "" {
		p.Role = "viewer"
	}
	v.Must(p.Role == "*" || p.Role == "editor" || p.Role == "viewer", "invalid role")
	return v.Error()
}

type InviteMemberResult struct {
	ID string `json:"id"`
}

func InviteMember(ctx context.Context, p *InviteMemberParams) (*InviteMemberResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	// check if already a member
	var exists bool
	_ = pgctx.QueryRow(ctx, `
		select exists(
			select 1
			from site_members sm
			join users u on u.id = sm.user_id
			where sm.site_id = $1
			  and u.email = $2
		)
	`,
		p.SiteID,
		p.Email,
	).Scan(&exists)
	if exists {
		return nil, ErrAlreadyMember
	}

	// check if pending invite already exists
	var pendingExists bool
	_ = pgctx.QueryRow(ctx, `
		select exists(
			select 1
			from site_member_invitations
			where site_id = $1
			  and email = $2
			  and status = 'pending'
			  and expires_at > now()
		)
	`,
		p.SiteID,
		p.Email,
	).Scan(&pendingExists)
	if pendingExists {
		return nil, ErrInviteAlreadySent
	}

	id := xid.New().String()
	invitedBy := auth.AccountID(ctx)
	expiresAt := time.Now().Add(7 * 24 * time.Hour)

	_, err := pgctx.Exec(ctx, `
		insert into site_member_invitations (
			id,
			site_id,
			email,
			role,
			invited_by,
			status,
			expires_at
		) values ($1, $2, $3, $4, $5, 'pending', $6)
	`,
		id,
		p.SiteID,
		p.Email,
		p.Role,
		invitedBy,
		expiresAt,
	)
	if err != nil {
		return nil, err
	}

	return &InviteMemberResult{ID: id}, nil
}

// ListInvites

type ListInvitesParams struct {
	SiteID string `json:"siteId"`
}

func (p *ListInvitesParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	return v.Error()
}

type Invite struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Role      string    `json:"role"`
	InvitedBy string    `json:"invitedBy"`
	Status    string    `json:"status"`
	ExpiresAt time.Time `json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
}

type ListInvitesResult struct {
	Items []Invite `json:"items"`
}

func ListInvites(ctx context.Context, p *ListInvitesParams) (*ListInvitesResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	items := make([]Invite, 0)

	rows, err := pgctx.Query(ctx, `
		select
			id,
			email,
			role,
			invited_by,
			status,
			expires_at,
			created_at
		from site_member_invitations
		where site_id = $1
		  and status = 'pending'
		  and expires_at > now()
		order by created_at desc
	`,
		p.SiteID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var it Invite
		err := rows.Scan(
			&it.ID,
			&it.Email,
			&it.Role,
			&it.InvitedBy,
			&it.Status,
			&it.ExpiresAt,
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

	return &ListInvitesResult{Items: items}, nil
}

// RevokeInvite

type RevokeInviteParams struct {
	ID string `json:"id"`
}

func (p *RevokeInviteParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

func RevokeInvite(ctx context.Context, p *RevokeInviteParams) (*struct{}, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	// get site_id for IAM check
	var siteID string
	err := pgctx.QueryRow(ctx, `
		select site_id
		from site_member_invitations
		where id = $1
		  and status = 'pending'
	`,
		p.ID,
	).Scan(&siteID)
	if err != nil {
		return nil, ErrInviteNotFound
	}

	if err := iam.InSite(ctx, siteID); err != nil {
		return nil, err
	}

	_, err = pgctx.Exec(ctx, `
		update site_member_invitations
		set status = 'revoked'
		where id = $1
		  and status = 'pending'
	`,
		p.ID,
	)
	if err != nil {
		return nil, err
	}

	return new(struct{}), nil
}

// AcceptInvite

type AcceptInviteParams struct {
	ID string `json:"id"`
}

func (p *AcceptInviteParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

func AcceptInvite(ctx context.Context, p *AcceptInviteParams) (*struct{}, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	userID := auth.AccountID(ctx)

	// get invite and validate
	var siteID, email, role string
	err := pgctx.QueryRow(ctx, `
		select
			i.site_id,
			i.email,
			i.role
		from site_member_invitations i
		join sites s on s.id = i.site_id
		where i.id = $1
		  and i.status = 'pending'
		  and i.expires_at > now()
		  and s.deleted_at is null
	`,
		p.ID,
	).Scan(
		&siteID,
		&email,
		&role,
	)
	if err != nil {
		return nil, ErrInviteNotFound
	}

	// verify the current user's email matches the invite
	var userEmail string
	err = pgctx.QueryRow(ctx, `
		select email from users where id = $1
	`,
		userID,
	).Scan(&userEmail)
	if err != nil {
		return nil, err
	}

	if userEmail != email {
		return nil, ErrInviteNotFound
	}

	// insert member
	_, err = pgctx.Exec(ctx, `
		insert into site_members (
			site_id,
			user_id,
			role
		) values ($1, $2, $3)
		on conflict (site_id, user_id) do nothing
	`,
		siteID,
		userID,
		role,
	)
	if err != nil {
		if pgsql.IsUniqueViolation(err) {
			return nil, ErrAlreadyMember
		}
		return nil, err
	}

	// mark invite as accepted
	_, err = pgctx.Exec(ctx, `
		update site_member_invitations
		set status = 'accepted'
		where id = $1
	`,
		p.ID,
	)
	if err != nil {
		return nil, err
	}

	return new(struct{}), nil
}

// MyInvites lists all pending invitations for the current user

type MyInvite struct {
	ID        string    `json:"id"`
	SiteID    string    `json:"siteId"`
	SiteName  string    `json:"siteName"`
	Role      string    `json:"role"`
	InvitedBy string    `json:"invitedBy"`
	ExpiresAt time.Time `json:"expiresAt"`
	CreatedAt time.Time `json:"createdAt"`
}

type MyInvitesResult struct {
	Items []MyInvite `json:"items"`
}

func MyInvites(ctx context.Context, _ *struct{}) (*MyInvitesResult, error) {
	userID := auth.AccountID(ctx)

	// get user email
	var email string
	err := pgctx.QueryRow(ctx, `
		select email from users where id = $1
	`,
		userID,
	).Scan(&email)
	if err != nil {
		return nil, err
	}

	items := make([]MyInvite, 0)

	rows, err := pgctx.Query(ctx, `
		select
			i.id,
			i.site_id,
			s.name,
			i.role,
			u.name,
			i.expires_at,
			i.created_at
		from site_member_invitations i
		join sites s on s.id = i.site_id
		join users u on u.id = i.invited_by
		where i.email = $1
		  and i.status = 'pending'
		  and i.expires_at > now()
		  and s.deleted_at is null
		order by i.created_at desc
	`,
		email,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var it MyInvite
		err := rows.Scan(
			&it.ID,
			&it.SiteID,
			&it.SiteName,
			&it.Role,
			&it.InvitedBy,
			&it.ExpiresAt,
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

	return &MyInvitesResult{Items: items}, nil
}

// DeclineInvite

type DeclineInviteParams struct {
	ID string `json:"id"`
}

func (p *DeclineInviteParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

func DeclineInvite(ctx context.Context, p *DeclineInviteParams) (*struct{}, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	userID := auth.AccountID(ctx)

	// get user email
	var email string
	err := pgctx.QueryRow(ctx, `
		select email from users where id = $1
	`,
		userID,
	).Scan(&email)
	if err != nil {
		return nil, err
	}

	// only decline if the invite belongs to the current user
	result, err := pgctx.Exec(ctx, `
		update site_member_invitations
		set status = 'declined'
		where id = $1
		  and email = $2
		  and status = 'pending'
	`,
		p.ID,
		email,
	)
	if err != nil {
		return nil, err
	}

	rows, _ := result.RowsAffected()
	if rows == 0 {
		return nil, ErrInviteNotFound
	}

	return new(struct{}), nil
}
