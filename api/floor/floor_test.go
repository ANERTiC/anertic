package floor

import (
	"testing"

	"github.com/acoshift/pgsql/pgctx"
	"github.com/rs/xid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/anertic/anertic/api/auth"
	"github.com/anertic/anertic/api/iam"
	"github.com/anertic/anertic/pkg/tu"
)

func TestList(t *testing.T) {
	t.Run("empty_list", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		r, err := List(ctx, &ListParams{SiteID: siteID})
		require.NoError(t, err)
		require.NotNil(t, r)
		assert.Empty(t, r.Items)
	})

	t.Run("returns_floors_ordered_by_level", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Third Floor", Level: 3})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Ground Floor", Level: 0})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Basement", Level: -1})
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{SiteID: siteID})
		require.NoError(t, err)
		require.Len(t, r.Items, 3)
		assert.Equal(t, -1, r.Items[0].Level)
		assert.Equal(t, "Basement", r.Items[0].Name)
		assert.Equal(t, 0, r.Items[1].Level)
		assert.Equal(t, 3, r.Items[2].Level)
	})

	t.Run("filter_by_search", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Basement Alpha", Level: -1})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Rooftop Beta", Level: 10})
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{SiteID: siteID, Search: "Alpha"})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		assert.Equal(t, "Basement Alpha", r.Items[0].Name)
	})

	t.Run("forbidden_not_site_member", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		_, siteID := seedTestData(t, tc)
		otherUserID := seedUser(t, tc)
		otherCtx := auth.WithAccountID(tc.Ctx(), otherUserID)

		_, err := List(otherCtx, &ListParams{SiteID: siteID})
		require.Error(t, err)
		assert.Equal(t, iam.ErrForbidden, err)
	})

	t.Run("validation_error_missing_site_id", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, _ := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := List(ctx, &ListParams{})
		require.Error(t, err)
	})
}

func TestCreate(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		r, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Ground Floor",
			Level:  0,
		})
		require.NoError(t, err)
		require.NotNil(t, r)
		assert.Equal(t, 0, r.Level)

		got, err := Get(ctx, &GetParams{SiteID: siteID, Level: 0})
		require.NoError(t, err)
		assert.Equal(t, "Ground Floor", got.Name)
		assert.Equal(t, 0, got.Level)
		assert.Equal(t, siteID, got.SiteID)
	})

	t.Run("negative_level", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Basement", Level: -1})
		require.NoError(t, err)

		got, err := Get(ctx, &GetParams{SiteID: siteID, Level: -1})
		require.NoError(t, err)
		assert.Equal(t, -1, got.Level)
	})

	t.Run("validation_error_level_out_of_range", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Too High", Level: 100})
		require.Error(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Too Low", Level: -100})
		require.Error(t, err)
	})

	t.Run("duplicate_level_error", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Floor 1", Level: 1})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Also Floor 1", Level: 1})
		require.Error(t, err)
		assert.Equal(t, ErrDuplicate, err)
	})

	t.Run("validation_error_missing_name", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Level: 1})
		require.Error(t, err)
	})

	t.Run("forbidden_not_site_member", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		_, siteID := seedTestData(t, tc)
		otherUserID := seedUser(t, tc)
		otherCtx := auth.WithAccountID(tc.Ctx(), otherUserID)

		_, err := Create(otherCtx, &CreateParams{
			SiteID: siteID,
			Name:   "Forbidden",
			Level:  1,
		})
		require.Error(t, err)
		assert.Equal(t, iam.ErrForbidden, err)
	})
}

func TestGet(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Level 2", Level: 2})
		require.NoError(t, err)

		r, err := Get(ctx, &GetParams{SiteID: siteID, Level: 2})
		require.NoError(t, err)
		assert.Equal(t, "Level 2", r.Name)
		assert.Equal(t, 2, r.Level)
		assert.Equal(t, siteID, r.SiteID)
	})

	t.Run("not_found", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Get(ctx, &GetParams{SiteID: siteID, Level: 99})
		require.Error(t, err)
		assert.Equal(t, ErrNotFound, err)
	})
}

func TestUpdate(t *testing.T) {
	t.Run("update_name", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Original", Level: 1})
		require.NoError(t, err)

		name := "Renamed"
		_, err = Update(ctx, &UpdateParams{
			SiteID: siteID,
			Level:  1,
			Name:   &name,
		})
		require.NoError(t, err)

		got, err := Get(ctx, &GetParams{SiteID: siteID, Level: 1})
		require.NoError(t, err)
		assert.Equal(t, "Renamed", got.Name)
	})

	t.Run("not_found", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		name := "X"
		_, err := Update(ctx, &UpdateParams{
			SiteID: siteID,
			Level:  99,
			Name:   &name,
		})
		require.Error(t, err)
		assert.Equal(t, ErrNotFound, err)
	})

	t.Run("forbidden_not_site_member", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		_, siteID := seedTestData(t, tc)
		otherUserID := seedUser(t, tc)
		otherCtx := auth.WithAccountID(tc.Ctx(), otherUserID)

		name := "X"
		_, err := Update(otherCtx, &UpdateParams{
			SiteID: siteID,
			Level:  1,
			Name:   &name,
		})
		require.Error(t, err)
		assert.Equal(t, iam.ErrForbidden, err)
	})
}

func TestDelete(t *testing.T) {
	t.Run("success_resets_rooms_to_level_0", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Floor 3", Level: 3})
		require.NoError(t, err)

		// Create a room on level 3
		roomID := xid.New().String()
		_, err = pgctx.Exec(ctx, `
			insert into rooms (id, site_id, name, type, level) values ($1, $2, $3, $4, $5)
		`, roomID, siteID, "Room A", "office", 3)
		require.NoError(t, err)

		_, err = Delete(ctx, &DeleteParams{SiteID: siteID, Level: 3})
		require.NoError(t, err)

		// Floor should be gone
		_, err = Get(ctx, &GetParams{SiteID: siteID, Level: 3})
		require.Error(t, err)
		assert.Equal(t, ErrNotFound, err)

		// Room should have level = 0
		var level int
		err = pgctx.QueryRow(ctx, `
			select level from rooms where id = $1
		`, roomID).Scan(&level)
		require.NoError(t, err)
		assert.Equal(t, 0, level)
	})

	t.Run("not_found", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Delete(ctx, &DeleteParams{SiteID: siteID, Level: 99})
		require.Error(t, err)
		assert.Equal(t, ErrNotFound, err)
	})

	t.Run("forbidden_not_site_member", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		_, siteID := seedTestData(t, tc)
		otherUserID := seedUser(t, tc)
		otherCtx := auth.WithAccountID(tc.Ctx(), otherUserID)

		_, err := Delete(otherCtx, &DeleteParams{SiteID: siteID, Level: 1})
		require.Error(t, err)
		assert.Equal(t, iam.ErrForbidden, err)
	})
}

// seedTestData creates a user, site, and site membership for testing.
func seedTestData(t *testing.T, tc *tu.Context) (userID, siteID string) {
	t.Helper()
	ctx := tc.Ctx()

	userID = xid.New().String()
	siteID = xid.New().String()

	_, err := pgctx.Exec(ctx, `
		insert into users (id, email, name) values ($1, $2, $3)
	`, userID, userID+"@test.com", "Test User")
	require.NoError(t, err)

	_, err = pgctx.Exec(ctx, `
		insert into sites (id, name) values ($1, $2)
	`, siteID, "Test Site")
	require.NoError(t, err)

	_, err = pgctx.Exec(ctx, `
		insert into site_members (site_id, user_id, role) values ($1, $2, $3)
	`, siteID, userID, "owner")
	require.NoError(t, err)

	return userID, siteID
}

// seedUser creates a standalone user not associated with any site.
func seedUser(t *testing.T, tc *tu.Context) string {
	t.Helper()
	ctx := tc.Ctx()

	userID := xid.New().String()
	_, err := pgctx.Exec(ctx, `
		insert into users (id, email, name) values ($1, $2, $3)
	`, userID, userID+"@test.com", "Other User")
	require.NoError(t, err)

	return userID
}
