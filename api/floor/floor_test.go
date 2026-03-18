package floor

import (
	"context"
	"os"
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
	if os.Getenv("TEST_DB_URL") == "" {
		t.Skip("TEST_DB_URL not set, skipping integration test")
	}

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

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "First Floor", Level: 1})
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{SiteID: siteID})
		require.NoError(t, err)
		require.Len(t, r.Items, 3)
		assert.Equal(t, 0, r.Items[0].Level)
		assert.Equal(t, 1, r.Items[1].Level)
		assert.Equal(t, 3, r.Items[2].Level)
	})

	t.Run("with_rooms_inline", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cf, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Floor 1", Level: 1})
		require.NoError(t, err)

		roomID := seedRoom(t, ctx, siteID, cf.ID, "Office", "office")

		r, err := List(ctx, &ListParams{SiteID: siteID})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		require.Len(t, r.Items[0].Rooms, 1)
		assert.Equal(t, roomID, r.Items[0].Rooms[0].ID)
		assert.Equal(t, "Office", r.Items[0].Rooms[0].Name)
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
	if os.Getenv("TEST_DB_URL") == "" {
		t.Skip("TEST_DB_URL not set, skipping integration test")
	}

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
		assert.NotEmpty(t, r.ID)

		got, err := Get(ctx, &GetParams{ID: r.ID})
		require.NoError(t, err)
		assert.Equal(t, "Ground Floor", got.Name)
		assert.Equal(t, 0, got.Level)
		assert.Equal(t, siteID, got.SiteID)
	})

	t.Run("validation_level_out_of_range", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Sky High", Level: 100})
		require.Error(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Deep Down", Level: -100})
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

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Floor 1 Duplicate", Level: 1})
		require.Error(t, err)
		assert.Equal(t, ErrDuplicate, err)
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
			Name:   "Forbidden Floor",
			Level:  1,
		})
		require.Error(t, err)
		assert.Equal(t, iam.ErrForbidden, err)
	})
}

func TestGet(t *testing.T) {
	if os.Getenv("TEST_DB_URL") == "" {
		t.Skip("TEST_DB_URL not set, skipping integration test")
	}

	t.Run("success_with_rooms", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cf, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Level 2", Level: 2})
		require.NoError(t, err)

		roomID := seedRoom(t, ctx, siteID, cf.ID, "Conference Room", "office")

		r, err := Get(ctx, &GetParams{ID: cf.ID})
		require.NoError(t, err)
		require.NotNil(t, r)
		assert.Equal(t, "Level 2", r.Name)
		assert.Equal(t, 2, r.Level)
		assert.Equal(t, siteID, r.SiteID)
		require.Len(t, r.Rooms, 1)
		assert.Equal(t, roomID, r.Rooms[0].ID)
		assert.Equal(t, "Conference Room", r.Rooms[0].Name)
	})

	t.Run("success_no_rooms", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cf, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Empty Floor", Level: 5})
		require.NoError(t, err)

		r, err := Get(ctx, &GetParams{ID: cf.ID})
		require.NoError(t, err)
		assert.Equal(t, "Empty Floor", r.Name)
		assert.Empty(t, r.Rooms)
	})

	t.Run("not_found", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, _ := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Get(ctx, &GetParams{ID: xid.New().String()})
		require.Error(t, err)
		assert.Equal(t, ErrNotFound, err)
	})
}

func TestUpdate(t *testing.T) {
	if os.Getenv("TEST_DB_URL") == "" {
		t.Skip("TEST_DB_URL not set, skipping integration test")
	}

	t.Run("update_name_only", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cf, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Original", Level: 1})
		require.NoError(t, err)

		name := "Renamed"
		_, err = Update(ctx, &UpdateParams{
			SiteID: siteID,
			ID:     cf.ID,
			Name:   &name,
		})
		require.NoError(t, err)

		got, err := Get(ctx, &GetParams{ID: cf.ID})
		require.NoError(t, err)
		assert.Equal(t, "Renamed", got.Name)
		assert.Equal(t, 1, got.Level)
	})

	t.Run("update_level_only", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cf, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Floor", Level: 1})
		require.NoError(t, err)

		level := 2
		_, err = Update(ctx, &UpdateParams{
			SiteID: siteID,
			ID:     cf.ID,
			Level:  &level,
		})
		require.NoError(t, err)

		got, err := Get(ctx, &GetParams{ID: cf.ID})
		require.NoError(t, err)
		assert.Equal(t, "Floor", got.Name)
		assert.Equal(t, 2, got.Level)
	})

	t.Run("duplicate_level_error", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Floor A", Level: 1})
		require.NoError(t, err)

		cfB, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Floor B", Level: 2})
		require.NoError(t, err)

		level := 1
		_, err = Update(ctx, &UpdateParams{
			SiteID: siteID,
			ID:     cfB.ID,
			Level:  &level,
		})
		require.Error(t, err)
		assert.Equal(t, ErrDuplicate, err)
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
			ID:     xid.New().String(),
			Name:   &name,
		})
		require.Error(t, err)
		assert.Equal(t, iam.ErrForbidden, err)
	})
}

func TestDelete(t *testing.T) {
	if os.Getenv("TEST_DB_URL") == "" {
		t.Skip("TEST_DB_URL not set, skipping integration test")
	}

	t.Run("success_unassigns_rooms", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cf, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Floor 1", Level: 1})
		require.NoError(t, err)

		roomID := seedRoom(t, ctx, siteID, cf.ID, "Room A", "office")

		_, err = Delete(ctx, &DeleteParams{SiteID: siteID, ID: cf.ID})
		require.NoError(t, err)

		// Floor should be gone
		_, err = Get(ctx, &GetParams{ID: cf.ID})
		require.Error(t, err)
		assert.Equal(t, ErrNotFound, err)

		// Room should have floor_id = null
		var floorID *string
		err = pgctx.QueryRow(ctx, `
			select floor_id from rooms where id = $1
		`, roomID).Scan(&floorID)
		require.NoError(t, err)
		assert.Nil(t, floorID)
	})

	t.Run("not_found", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Delete(ctx, &DeleteParams{
			SiteID: siteID,
			ID:     xid.New().String(),
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

		_, err := Delete(otherCtx, &DeleteParams{
			SiteID: siteID,
			ID:     xid.New().String(),
		})
		require.Error(t, err)
		assert.Equal(t, iam.ErrForbidden, err)
	})
}

func TestReorder(t *testing.T) {
	if os.Getenv("TEST_DB_URL") == "" {
		t.Skip("TEST_DB_URL not set, skipping integration test")
	}

	t.Run("success", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cfA, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Floor A", Level: 1})
		require.NoError(t, err)

		cfB, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Floor B", Level: 2})
		require.NoError(t, err)

		cfC, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Floor C", Level: 3})
		require.NoError(t, err)

		_, err = Reorder(ctx, &ReorderParams{
			SiteID: siteID,
			Floors: []ReorderItem{
				{ID: cfA.ID, Level: 3},
				{ID: cfB.ID, Level: 1},
				{ID: cfC.ID, Level: 2},
			},
		})
		require.NoError(t, err)

		gotA, err := Get(ctx, &GetParams{ID: cfA.ID})
		require.NoError(t, err)
		assert.Equal(t, 3, gotA.Level)

		gotB, err := Get(ctx, &GetParams{ID: cfB.ID})
		require.NoError(t, err)
		assert.Equal(t, 1, gotB.Level)

		gotC, err := Get(ctx, &GetParams{ID: cfC.ID})
		require.NoError(t, err)
		assert.Equal(t, 2, gotC.Level)
	})

	t.Run("validation_error_duplicate_levels_in_request", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Reorder(ctx, &ReorderParams{
			SiteID: siteID,
			Floors: []ReorderItem{
				{ID: xid.New().String(), Level: 1},
				{ID: xid.New().String(), Level: 1},
			},
		})
		require.Error(t, err)
	})

	t.Run("validation_error_missing_site_id", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, _ := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Reorder(ctx, &ReorderParams{
			Floors: []ReorderItem{{ID: xid.New().String(), Level: 1}},
		})
		require.Error(t, err)
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

// seedRoom creates a room assigned to a floor and returns its ID.
func seedRoom(t *testing.T, ctx context.Context, siteID, floorID, name, roomType string) string {
	t.Helper()
	id := xid.New().String()
	_, err := pgctx.Exec(ctx, `
		insert into rooms (id, site_id, name, type, floor_id)
		values ($1, $2, $3, $4, $5)
	`, id, siteID, name, roomType, floorID)
	require.NoError(t, err)
	return id
}
