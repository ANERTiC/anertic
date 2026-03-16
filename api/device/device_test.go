package device

import (
	"testing"
	"time"

	"github.com/acoshift/pgsql/pgctx"
	"github.com/rs/xid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/anertic/anertic/api/auth"
	"github.com/anertic/anertic/api/iam"
	"github.com/anertic/anertic/pkg/tu"
)

func TestList(t *testing.T) {
	tc := tu.Setup()
	defer tc.Teardown()

	userID, siteID := seedTestData(t, tc)
	ctx := auth.WithAccountID(tc.Ctx(), userID)

	t.Run("empty list", func(t *testing.T) {
		r, err := List(ctx, &ListParams{SiteID: siteID})
		require.NoError(t, err)
		require.NotNil(t, r)
		assert.Empty(t, r.Items)
	})

	t.Run("returns devices with meter aggregation", func(t *testing.T) {
		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Inverter A",
			Type:   "inverter",
			Brand:  "Huawei",
			Model:  "SUN2000",
		})
		require.NoError(t, err)

		// add meters to the device
		_, err = pgctx.Exec(ctx, `
			insert into meters (id, device_id, serial_number, protocol, is_online, last_seen_at)
			values ($1, $2, $3, $4, $5, $6)
		`,
			xid.New().String(),
			cr.ID,
			"MTR-001",
			"mqtt",
			true,
			time.Now(),
		)
		require.NoError(t, err)

		_, err = pgctx.Exec(ctx, `
			insert into meters (id, device_id, serial_number, protocol, is_online)
			values ($1, $2, $3, $4, $5)
		`,
			xid.New().String(),
			cr.ID,
			"MTR-002",
			"http",
			false,
		)
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{SiteID: siteID})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)

		item := r.Items[0]
		assert.Equal(t, cr.ID, item.ID)
		assert.Equal(t, 2, item.MeterCount)
		assert.Equal(t, "online", item.ConnectionStatus)
		assert.NotNil(t, item.LastSeenAt)
	})

	t.Run("device with no meters is offline", func(t *testing.T) {
		_, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Empty Device",
			Type:   "meter",
		})
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{SiteID: siteID})
		require.NoError(t, err)

		var found bool
		for _, it := range r.Items {
			if it.Name == "Empty Device" {
				found = true
				assert.Equal(t, 0, it.MeterCount)
				assert.Equal(t, "offline", it.ConnectionStatus)
				assert.Nil(t, it.LastSeenAt)
			}
		}
		assert.True(t, found)
	})

	t.Run("filter by type", func(t *testing.T) {
		r, err := List(ctx, &ListParams{SiteID: siteID, Type: "inverter"})
		require.NoError(t, err)
		for _, it := range r.Items {
			assert.Equal(t, "inverter", it.Type)
		}
	})

	t.Run("search by name", func(t *testing.T) {
		r, err := List(ctx, &ListParams{SiteID: siteID, Search: "Inverter"})
		require.NoError(t, err)
		require.NotEmpty(t, r.Items)
		assert.Equal(t, "Inverter A", r.Items[0].Name)
	})

	t.Run("search by brand", func(t *testing.T) {
		r, err := List(ctx, &ListParams{SiteID: siteID, Search: "huawei"})
		require.NoError(t, err)
		require.NotEmpty(t, r.Items)
		assert.Equal(t, "Huawei", r.Items[0].Brand)
	})

	t.Run("search no match", func(t *testing.T) {
		r, err := List(ctx, &ListParams{SiteID: siteID, Search: "nonexistent"})
		require.NoError(t, err)
		assert.Empty(t, r.Items)
	})

	t.Run("validation error missing siteId", func(t *testing.T) {
		_, err := List(ctx, &ListParams{})
		require.Error(t, err)
	})

	t.Run("forbidden - not site member", func(t *testing.T) {
		otherUserID := xid.New().String()
		_, err := pgctx.Exec(ctx, `
			insert into users (id, email, name) values ($1, $2, $3)
		`, otherUserID, otherUserID+"@test.com", "Other User")
		require.NoError(t, err)

		otherCtx := auth.WithAccountID(tc.Ctx(), otherUserID)
		_, err = List(otherCtx, &ListParams{SiteID: siteID})
		require.Error(t, err)
		assert.Equal(t, iam.ErrForbidden, err)
	})
}

func TestCreate(t *testing.T) {
	tc := tu.Setup()
	defer tc.Teardown()

	userID, siteID := seedTestData(t, tc)
	ctx := auth.WithAccountID(tc.Ctx(), userID)

	t.Run("success", func(t *testing.T) {
		r, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Test Device",
			Type:   "meter",
			Tag:    "Main DB",
			Brand:  "Eastron",
			Model:  "SDM630",
		})
		require.NoError(t, err)
		require.NotNil(t, r)
		assert.NotEmpty(t, r.ID)

		got, err := Get(ctx, &GetParams{ID: r.ID})
		require.NoError(t, err)
		assert.Equal(t, "Test Device", got.Name)
		assert.Equal(t, "meter", got.Type)
		assert.Equal(t, "Main DB", got.Tag)
		assert.Equal(t, "Eastron", got.Brand)
		assert.Equal(t, "SDM630", got.Model)
		assert.True(t, got.IsActive)
	})

	t.Run("validation error missing name", func(t *testing.T) {
		_, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Type:   "meter",
		})
		require.Error(t, err)
	})

	t.Run("validation error missing type", func(t *testing.T) {
		_, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "No Type",
		})
		require.Error(t, err)
	})

	t.Run("validation error missing siteId", func(t *testing.T) {
		_, err := Create(ctx, &CreateParams{
			Name: "No Site",
			Type: "meter",
		})
		require.Error(t, err)
	})

	t.Run("forbidden - not site member", func(t *testing.T) {
		otherUserID := xid.New().String()
		_, err := pgctx.Exec(ctx, `
			insert into users (id, email, name) values ($1, $2, $3)
		`, otherUserID, otherUserID+"@test.com", "Other")
		require.NoError(t, err)

		otherCtx := auth.WithAccountID(tc.Ctx(), otherUserID)
		_, err = Create(otherCtx, &CreateParams{
			SiteID: siteID,
			Name:   "Forbidden Device",
			Type:   "meter",
		})
		require.Error(t, err)
		assert.Equal(t, iam.ErrForbidden, err)
	})
}

func TestGet(t *testing.T) {
	tc := tu.Setup()
	defer tc.Teardown()

	userID, siteID := seedTestData(t, tc)
	ctx := auth.WithAccountID(tc.Ctx(), userID)

	t.Run("success", func(t *testing.T) {
		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Get Device",
			Type:   "inverter",
			Brand:  "SMA",
			Model:  "Sunny Boy",
		})
		require.NoError(t, err)

		r, err := Get(ctx, &GetParams{ID: cr.ID})
		require.NoError(t, err)
		require.NotNil(t, r)
		assert.Equal(t, cr.ID, r.ID)
		assert.Equal(t, "Get Device", r.Name)
		assert.Equal(t, "inverter", r.Type)
		assert.Equal(t, "SMA", r.Brand)
	})

	t.Run("not found", func(t *testing.T) {
		_, err := Get(ctx, &GetParams{ID: xid.New().String()})
		require.Error(t, err)
		assert.Equal(t, ErrNotFound, err)
	})

	t.Run("validation error missing id", func(t *testing.T) {
		_, err := Get(ctx, &GetParams{})
		require.Error(t, err)
	})
}

func TestUpdate(t *testing.T) {
	tc := tu.Setup()
	defer tc.Teardown()

	userID, siteID := seedTestData(t, tc)
	ctx := auth.WithAccountID(tc.Ctx(), userID)

	t.Run("update name only", func(t *testing.T) {
		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Original",
			Type:   "meter",
			Brand:  "Eastron",
		})
		require.NoError(t, err)

		name := "Updated"
		_, err = Update(ctx, &UpdateParams{
			ID:   cr.ID,
			Name: &name,
		})
		require.NoError(t, err)

		got, err := Get(ctx, &GetParams{ID: cr.ID})
		require.NoError(t, err)
		assert.Equal(t, "Updated", got.Name)
		assert.Equal(t, "Eastron", got.Brand)
	})

	t.Run("update multiple fields", func(t *testing.T) {
		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Multi Update",
			Type:   "meter",
			Brand:  "ABB",
			Model:  "M100",
		})
		require.NoError(t, err)

		name := "New Name"
		brand := "Siemens"
		model := "PAC2200"
		_, err = Update(ctx, &UpdateParams{
			ID:    cr.ID,
			Name:  &name,
			Brand: &brand,
			Model: &model,
		})
		require.NoError(t, err)

		got, err := Get(ctx, &GetParams{ID: cr.ID})
		require.NoError(t, err)
		assert.Equal(t, "New Name", got.Name)
		assert.Equal(t, "Siemens", got.Brand)
		assert.Equal(t, "PAC2200", got.Model)
	})

	t.Run("validation error missing id", func(t *testing.T) {
		name := "X"
		_, err := Update(ctx, &UpdateParams{Name: &name})
		require.Error(t, err)
	})
}

func TestDeriveConnectionStatus(t *testing.T) {
	now := time.Now()
	old := now.Add(-1 * time.Hour)

	t.Run("no meters = offline", func(t *testing.T) {
		assert.Equal(t, "offline", deriveConnectionStatus(0, 0, nil))
	})

	t.Run("some online = online", func(t *testing.T) {
		assert.Equal(t, "online", deriveConnectionStatus(3, 1, &now))
	})

	t.Run("all online = online", func(t *testing.T) {
		assert.Equal(t, "online", deriveConnectionStatus(2, 2, &now))
	})

	t.Run("none online but recent = degraded", func(t *testing.T) {
		recent := time.Now().Add(-10 * time.Minute)
		assert.Equal(t, "degraded", deriveConnectionStatus(2, 0, &recent))
	})

	t.Run("none online and stale = offline", func(t *testing.T) {
		assert.Equal(t, "offline", deriveConnectionStatus(2, 0, &old))
	})

	t.Run("none online and nil lastSeen = offline", func(t *testing.T) {
		assert.Equal(t, "offline", deriveConnectionStatus(1, 0, nil))
	})
}

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
