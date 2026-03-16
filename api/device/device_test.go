package device

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

func seedUser(t *testing.T, tc *tu.Context) string {
	t.Helper()
	ctx := tc.Ctx()
	id := xid.New().String()
	_, err := pgctx.Exec(ctx, `
		insert into users (id, email, name, provider, provider_id)
		values ($1, $2, $3, 'google', 'g-test')
		on conflict (email) do nothing
	`,
		id,
		id+"@test.com",
		"Test User",
	)
	require.NoError(t, err)
	return id
}

func seedSite(t *testing.T, tc *tu.Context, ownerID string) string {
	t.Helper()
	ctx := tc.Ctx()
	id := xid.New().String()
	_, err := pgctx.Exec(ctx, `
		insert into sites (id, name) values ($1, $2)
	`,
		id,
		"Test Site",
	)
	require.NoError(t, err)

	_, err = pgctx.Exec(ctx, `
		insert into site_members (site_id, user_id, role) values ($1, $2, 'owner')
	`,
		id,
		ownerID,
	)
	require.NoError(t, err)
	return id
}

func seedDevice(t *testing.T, tc *tu.Context, siteID string) string {
	t.Helper()
	ctx := tc.Ctx()
	id := xid.New().String()
	_, err := pgctx.Exec(ctx, `
		insert into devices (id, site_id, name, type) values ($1, $2, $3, $4)
	`,
		id,
		siteID,
		"Test Device",
		"meter",
	)
	require.NoError(t, err)
	return id
}

func TestGet(t *testing.T) {
	tc := tu.Setup()
	defer tc.Teardown()

	userID := seedUser(t, tc)
	otherUserID := seedUser(t, tc)
	siteID := seedSite(t, tc, userID)
	deviceID := seedDevice(t, tc, siteID)

	t.Run("member can get device", func(t *testing.T) {
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		r, err := Get(ctx, &GetParams{ID: deviceID})
		require.NoError(t, err)
		assert.Equal(t, deviceID, r.ID)
		assert.Equal(t, siteID, r.SiteID)
		assert.Equal(t, "Test Device", r.Name)
		assert.Equal(t, "meter", r.Type)
	})

	t.Run("non-member gets forbidden", func(t *testing.T) {
		ctx := auth.WithAccountID(tc.Ctx(), otherUserID)

		_, err := Get(ctx, &GetParams{ID: deviceID})
		require.Error(t, err)
		assert.ErrorIs(t, err, iam.ErrForbidden)
	})

	t.Run("missing id returns validation error", func(t *testing.T) {
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Get(ctx, &GetParams{ID: ""})
		require.Error(t, err)
	})

	t.Run("unknown id returns not found", func(t *testing.T) {
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Get(ctx, &GetParams{ID: "nonexistent"})
		require.Error(t, err)
		assert.ErrorIs(t, err, ErrNotFound)
	})
}

func TestUpdate(t *testing.T) {
	tc := tu.Setup()
	defer tc.Teardown()

	userID := seedUser(t, tc)
	otherUserID := seedUser(t, tc)
	siteID := seedSite(t, tc, userID)
	deviceID := seedDevice(t, tc, siteID)

	t.Run("member can update name", func(t *testing.T) {
		ctx := auth.WithAccountID(tc.Ctx(), userID)
		name := "Updated Device"

		_, err := Update(ctx, &UpdateParams{
			ID:     deviceID,
			SiteID: siteID,
			Name:   &name,
		})
		require.NoError(t, err)

		r, err := Get(ctx, &GetParams{ID: deviceID})
		require.NoError(t, err)
		assert.Equal(t, "Updated Device", r.Name)
	})

	t.Run("member can update tag", func(t *testing.T) {
		ctx := auth.WithAccountID(tc.Ctx(), userID)
		tag := "floor-2"

		_, err := Update(ctx, &UpdateParams{
			ID:     deviceID,
			SiteID: siteID,
			Tag:    &tag,
		})
		require.NoError(t, err)

		r, err := Get(ctx, &GetParams{ID: deviceID})
		require.NoError(t, err)
		assert.Equal(t, "floor-2", r.Tag)
	})

	t.Run("member can update isActive", func(t *testing.T) {
		ctx := auth.WithAccountID(tc.Ctx(), userID)
		isActive := false

		_, err := Update(ctx, &UpdateParams{
			ID:       deviceID,
			SiteID:   siteID,
			IsActive: &isActive,
		})
		require.NoError(t, err)

		r, err := Get(ctx, &GetParams{ID: deviceID})
		require.NoError(t, err)
		assert.Equal(t, false, r.IsActive)
	})

	t.Run("partial update does not affect other fields", func(t *testing.T) {
		ctx := auth.WithAccountID(tc.Ctx(), userID)
		brand := "ABB"

		_, err := Update(ctx, &UpdateParams{
			ID:     deviceID,
			SiteID: siteID,
			Brand:  &brand,
		})
		require.NoError(t, err)

		r, err := Get(ctx, &GetParams{ID: deviceID})
		require.NoError(t, err)
		assert.Equal(t, "ABB", r.Brand)
		assert.Equal(t, "Updated Device", r.Name)
		assert.Equal(t, "floor-2", r.Tag)
	})

	t.Run("non-member gets forbidden", func(t *testing.T) {
		ctx := auth.WithAccountID(tc.Ctx(), otherUserID)
		name := "Hacked"

		_, err := Update(ctx, &UpdateParams{
			ID:     deviceID,
			SiteID: siteID,
			Name:   &name,
		})
		require.Error(t, err)
		assert.ErrorIs(t, err, iam.ErrForbidden)
	})

	t.Run("missing siteId returns validation error", func(t *testing.T) {
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Update(ctx, &UpdateParams{
			ID: deviceID,
		})
		require.Error(t, err)
	})
}
