package iam

import (
	"context"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/pgsql/pgctx"

	"github.com/anertic/anertic/api/auth"
)

var (
	ErrForbidden = arpc.NewErrorCode("iam/forbidden", "you do not have access to this site")
)

// InSiteOwner checks if the current authenticated user is an owner (role = '*') of the given site.
func InSiteOwner(ctx context.Context, siteID string) error {
	userID := auth.AccountID(ctx)

	var b bool
	err := pgctx.QueryRow(ctx, `
		select exists (
			select 1
			from site_members
			where site_id = $1
			  and user_id = $2
			  and role = '*'
		)
	`,
		siteID,
		userID,
	).Scan(&b)
	if err != nil {
		return err
	}
	if !b {
		return ErrForbidden
	}
	return nil
}

// InSite checks if the current authenticated user is a member of the given site.
func InSite(ctx context.Context, siteID string) error {
	userID := auth.AccountID(ctx)

	var b bool
	err := pgctx.QueryRow(ctx, `
		select exists (
			select 1
			from site_members
			where site_id = $1
			  and user_id = $2
		)
	`,
		siteID,
		userID,
	).Scan(&b)
	if err != nil {
		return err
	}
	if !b {
		return ErrForbidden
	}
	return nil
}
