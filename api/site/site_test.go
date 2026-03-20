package site

import (
	"os"
	"testing"
	"time"

	"github.com/acoshift/pgsql/pgctx"
	"github.com/rs/xid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/anertic/anertic/api/auth"
	"github.com/anertic/anertic/pkg/tu"
)

func TestList(t *testing.T) {
	if os.Getenv("TEST_DB_URL") == "" {
		t.Skip("TEST_DB_URL not set, skipping integration test")
	}

	t.Run("empty_when_no_memberships", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		r, err := List(ctx, &ListParams{})
		require.NoError(t, err)
		require.NotNil(t, r)
		assert.Empty(t, r.Items)
	})

	t.Run("empty_account_id_returns_empty", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		seedSiteWithOwner(t, tc)
		ctx := tc.Ctx()

		r, err := List(ctx, &ListParams{})
		require.NoError(t, err)
		require.NotNil(t, r)
		assert.Empty(t, r.Items)
	})

	t.Run("returns_member_sites_newest_first", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		older := xid.New().String()
		newer := xid.New().String()
		tOlder := time.Date(2020, 1, 1, 0, 0, 0, 0, time.UTC)
		tNewer := time.Date(2025, 6, 1, 0, 0, 0, 0, time.UTC)

		_, err := pgctx.Exec(ctx, `
			insert into sites (id, name, address, timezone, created_at)
			values ($1, $2, '', 'Asia/Bangkok', $3)
		`, older, "Older Site", tOlder)
		require.NoError(t, err)
		_, err = pgctx.Exec(ctx, `
			insert into site_members (site_id, user_id, role) values ($1, $2, 'owner')
		`, older, userID)
		require.NoError(t, err)

		_, err = pgctx.Exec(ctx, `
			insert into sites (id, name, address, timezone, created_at)
			values ($1, $2, '', 'Asia/Bangkok', $3)
		`, newer, "Newer Site", tNewer)
		require.NoError(t, err)
		_, err = pgctx.Exec(ctx, `
			insert into site_members (site_id, user_id, role) values ($1, $2, 'owner')
		`, newer, userID)
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{})
		require.NoError(t, err)
		require.Len(t, r.Items, 2)
		assert.Equal(t, newer, r.Items[0].ID)
		assert.Equal(t, "Newer Site", r.Items[0].Name)
		assert.Equal(t, older, r.Items[1].ID)
	})

	t.Run("filter_by_search_name", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		s1 := xid.New().String()
		s2 := xid.New().String()
		_, err := pgctx.Exec(ctx, `insert into sites (id, name) values ($1, $2)`, s1, "Warehouse Alpha")
		require.NoError(t, err)
		_, err = pgctx.Exec(ctx, `insert into site_members (site_id, user_id, role) values ($1, $2, 'owner')`, s1, userID)
		require.NoError(t, err)

		_, err = pgctx.Exec(ctx, `insert into sites (id, name) values ($1, $2)`, s2, "Office Beta")
		require.NoError(t, err)
		_, err = pgctx.Exec(ctx, `insert into site_members (site_id, user_id, role) values ($1, $2, 'owner')`, s2, userID)
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{Search: "alpha"})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		assert.Equal(t, "Warehouse Alpha", r.Items[0].Name)
	})

	t.Run("filter_by_search_address", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		s1 := xid.New().String()
		s2 := xid.New().String()
		_, err := pgctx.Exec(ctx, `insert into sites (id, name, address) values ($1, $2, $3)`, s1, "Site A", "123 Bangkok Road")
		require.NoError(t, err)
		_, err = pgctx.Exec(ctx, `insert into site_members (site_id, user_id, role) values ($1, $2, 'owner')`, s1, userID)
		require.NoError(t, err)

		_, err = pgctx.Exec(ctx, `insert into sites (id, name, address) values ($1, $2, $3)`, s2, "Site B", "456 Chiang Mai Lane")
		require.NoError(t, err)
		_, err = pgctx.Exec(ctx, `insert into site_members (site_id, user_id, role) values ($1, $2, 'owner')`, s2, userID)
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{Search: "bangkok"})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		assert.Equal(t, "123 Bangkok Road", r.Items[0].Address)
	})

	t.Run("excludes_sites_without_membership", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		seedSiteWithOwner(t, tc)

		viewerID := seedUser(t, tc)
		viewerCtx := auth.WithAccountID(tc.Ctx(), viewerID)

		r, err := List(viewerCtx, &ListParams{})
		require.NoError(t, err)
		assert.Empty(t, r.Items)
	})
}

// seedUser creates a user with no site memberships.
func seedUser(t *testing.T, tc *tu.Context) string {
	t.Helper()
	ctx := tc.Ctx()

	userID := xid.New().String()
	_, err := pgctx.Exec(ctx, `
		insert into users (id, email, name) values ($1, $2, $3)
	`, userID, userID+"@test.com", "Test User")
	require.NoError(t, err)

	return userID
}

// seedSiteWithOwner creates a user, a site, and owner membership. Returns userID and siteID.
func seedSiteWithOwner(t *testing.T, tc *tu.Context) (userID, siteID string) {
	t.Helper()
	ctx := tc.Ctx()

	userID = xid.New().String()
	siteID = xid.New().String()

	_, err := pgctx.Exec(ctx, `
		insert into users (id, email, name) values ($1, $2, $3)
	`, userID, userID+"@test.com", "Owner")
	require.NoError(t, err)

	_, err = pgctx.Exec(ctx, `
		insert into sites (id, name) values ($1, $2)
	`, siteID, "Owned Site")
	require.NoError(t, err)

	_, err = pgctx.Exec(ctx, `
		insert into site_members (site_id, user_id, role) values ($1, $2, $3)
	`, siteID, userID, "owner")
	require.NoError(t, err)

	return userID, siteID
}
