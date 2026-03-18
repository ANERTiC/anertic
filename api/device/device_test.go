package device

import (
	"context"
	"os"
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

	t.Run("returns_devices_with_meter_aggregation", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Inverter A",
			Type:   "inverter",
			Brand:  "Huawei",
			Model:  "SUN2000",
		})
		require.NoError(t, err)

		seedMeter(t, ctx, siteID, cr.ID, "MTR-001", true, ptrTime(time.Now()))
		seedMeter(t, ctx, siteID, cr.ID, "MTR-002", false, nil)

		r, err := List(ctx, &ListParams{SiteID: siteID})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)

		item := r.Items[0]
		assert.Equal(t, cr.ID, item.ID)
		assert.Equal(t, 2, item.MeterCount)
		assert.Equal(t, "online", item.ConnectionStatus)
		assert.NotNil(t, item.LastSeenAt)
	})

	t.Run("device_with_no_meters_is_offline", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Empty Device",
			Type:   "meter",
		})
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{SiteID: siteID})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)

		assert.Equal(t, "Empty Device", r.Items[0].Name)
		assert.Equal(t, 0, r.Items[0].MeterCount)
		assert.Equal(t, "offline", r.Items[0].ConnectionStatus)
		assert.Nil(t, r.Items[0].LastSeenAt)
	})

	t.Run("connection_status_degraded", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Degraded Device",
			Type:   "meter",
		})
		require.NoError(t, err)

		// Meters with recent last_seen_at but is_online=false -> degraded
		recentTime := time.Now().Add(-10 * time.Minute)
		seedMeter(t, ctx, siteID, cr.ID, "MTR-DEG-001", false, &recentTime)
		seedMeter(t, ctx, siteID, cr.ID, "MTR-DEG-002", false, &recentTime)

		r, err := List(ctx, &ListParams{SiteID: siteID})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)

		assert.Equal(t, "degraded", r.Items[0].ConnectionStatus)
		assert.NotNil(t, r.Items[0].LastSeenAt)
	})

	t.Run("connection_status_offline_stale_last_seen", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Stale Device",
			Type:   "meter",
		})
		require.NoError(t, err)

		// Meters with old last_seen_at and is_online=false -> offline
		staleTime := time.Now().Add(-2 * time.Hour)
		seedMeter(t, ctx, siteID, cr.ID, "MTR-STALE-001", false, &staleTime)

		r, err := List(ctx, &ListParams{SiteID: siteID})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)

		assert.Equal(t, "offline", r.Items[0].ConnectionStatus)
	})

	t.Run("excludes_soft_deleted_devices", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "To Be Deleted",
			Type:   "meter",
		})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Still Alive",
			Type:   "meter",
		})
		require.NoError(t, err)

		// Soft delete the first device
		_, err = Delete(ctx, &DeleteParams{SiteID: siteID, ID: cr.ID})
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{SiteID: siteID})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		assert.Equal(t, "Still Alive", r.Items[0].Name)
	})

	t.Run("filter_by_type", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Inverter",
			Type:   "inverter",
		})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Meter",
			Type:   "meter",
		})
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{SiteID: siteID, Type: "inverter"})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		assert.Equal(t, "inverter", r.Items[0].Type)
	})

	t.Run("search_by_name", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Solar Panel Alpha",
			Type:   "solar_panel",
		})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Meter Beta",
			Type:   "meter",
		})
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{SiteID: siteID, Search: "Alpha"})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		assert.Equal(t, "Solar Panel Alpha", r.Items[0].Name)
	})

	t.Run("search_by_brand", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Device X",
			Type:   "meter",
			Brand:  "Eastron",
		})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Device Y",
			Type:   "meter",
			Brand:  "Schneider",
		})
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{SiteID: siteID, Search: "eastron"})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		assert.Equal(t, "Eastron", r.Items[0].Brand)
	})

	t.Run("search_by_model", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Device Z",
			Type:   "meter",
			Model:  "SDM630",
		})
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{SiteID: siteID, Search: "sdm630"})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		assert.Equal(t, "SDM630", r.Items[0].Model)
	})

	t.Run("search_no_match", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		r, err := List(ctx, &ListParams{SiteID: siteID, Search: "nonexistent"})
		require.NoError(t, err)
		assert.Empty(t, r.Items)
	})

	t.Run("ordered_by_created_at_desc", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "First Created",
			Type:   "meter",
		})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Second Created",
			Type:   "meter",
		})
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{SiteID: siteID})
		require.NoError(t, err)
		require.Len(t, r.Items, 2)
		// Most recent first
		assert.Equal(t, "Second Created", r.Items[0].Name)
		assert.Equal(t, "First Created", r.Items[1].Name)
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

	t.Run("does_not_return_devices_from_other_sites", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		// Create a second site for the same user
		otherSiteID := xid.New().String()
		_, err := pgctx.Exec(tc.Ctx(), `
			insert into sites (id, name) values ($1, $2)
		`, otherSiteID, "Other Site")
		require.NoError(t, err)
		_, err = pgctx.Exec(tc.Ctx(), `
			insert into site_members (site_id, user_id, role) values ($1, $2, $3)
		`, otherSiteID, userID, "owner")
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Site 1 Device",
			Type:   "meter",
		})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{
			SiteID: otherSiteID,
			Name:   "Site 2 Device",
			Type:   "meter",
		})
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{SiteID: siteID})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		assert.Equal(t, "Site 1 Device", r.Items[0].Name)
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
		assert.Equal(t, siteID, got.SiteID)
	})

	t.Run("minimal_fields", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		r, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Minimal",
			Type:   "inverter",
		})
		require.NoError(t, err)

		got, err := Get(ctx, &GetParams{ID: r.ID})
		require.NoError(t, err)
		assert.Equal(t, "Minimal", got.Name)
		assert.Equal(t, "inverter", got.Type)
		assert.Equal(t, "", got.Tag)
		assert.Equal(t, "", got.Brand)
		assert.Equal(t, "", got.Model)
	})

	t.Run("validation_error_missing_name", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Type:   "meter",
		})
		require.Error(t, err)
	})

	t.Run("validation_error_missing_type", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "No Type",
		})
		require.Error(t, err)
	})

	t.Run("validation_error_missing_site_id", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, _ := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{
			Name: "No Site",
			Type: "meter",
		})
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
			Name:   "Forbidden Device",
			Type:   "meter",
		})
		require.Error(t, err)
		assert.Equal(t, iam.ErrForbidden, err)
	})
}

func TestGet(t *testing.T) {
	if os.Getenv("TEST_DB_URL") == "" {
		t.Skip("TEST_DB_URL not set, skipping integration test")
	}

	t.Run("success", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

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
		assert.Equal(t, "Sunny Boy", r.Model)
		assert.Equal(t, siteID, r.SiteID)
		assert.True(t, r.IsActive)
		assert.False(t, r.CreatedAt.IsZero())
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

	t.Run("validation_error_missing_id", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, _ := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Get(ctx, &GetParams{})
		require.Error(t, err)
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

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Original",
			Type:   "meter",
			Brand:  "Eastron",
			Model:  "SDM630",
		})
		require.NoError(t, err)

		name := "Updated"
		_, err = Update(ctx, &UpdateParams{
			ID:     cr.ID,
			SiteID: siteID,
			Name:   &name,
		})
		require.NoError(t, err)

		got, err := Get(ctx, &GetParams{ID: cr.ID})
		require.NoError(t, err)
		assert.Equal(t, "Updated", got.Name)
		assert.Equal(t, "Eastron", got.Brand)
		assert.Equal(t, "SDM630", got.Model)
	})

	t.Run("update_brand_only", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Brand Test",
			Type:   "meter",
			Brand:  "ABB",
		})
		require.NoError(t, err)

		brand := "Siemens"
		_, err = Update(ctx, &UpdateParams{
			ID:     cr.ID,
			SiteID: siteID,
			Brand:  &brand,
		})
		require.NoError(t, err)

		got, err := Get(ctx, &GetParams{ID: cr.ID})
		require.NoError(t, err)
		assert.Equal(t, "Brand Test", got.Name)
		assert.Equal(t, "Siemens", got.Brand)
	})

	t.Run("update_multiple_fields", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

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
			ID:     cr.ID,
			SiteID: siteID,
			Name:   &name,
			Brand:  &brand,
			Model:  &model,
		})
		require.NoError(t, err)

		got, err := Get(ctx, &GetParams{ID: cr.ID})
		require.NoError(t, err)
		assert.Equal(t, "New Name", got.Name)
		assert.Equal(t, "Siemens", got.Brand)
		assert.Equal(t, "PAC2200", got.Model)
	})

	t.Run("update_with_no_fields_is_noop", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "No Change",
			Type:   "meter",
			Brand:  "Eastron",
		})
		require.NoError(t, err)

		_, err = Update(ctx, &UpdateParams{ID: cr.ID, SiteID: siteID})
		require.NoError(t, err)

		got, err := Get(ctx, &GetParams{ID: cr.ID})
		require.NoError(t, err)
		assert.Equal(t, "No Change", got.Name)
		assert.Equal(t, "Eastron", got.Brand)
	})

	t.Run("validation_error_missing_id", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, _ := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		name := "X"
		_, err := Update(ctx, &UpdateParams{Name: &name})
		require.Error(t, err)
	})
}

func TestDelete(t *testing.T) {
	if os.Getenv("TEST_DB_URL") == "" {
		t.Skip("TEST_DB_URL not set, skipping integration test")
	}

	t.Run("success", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "To Delete",
			Type:   "meter",
		})
		require.NoError(t, err)

		_, err = Delete(ctx, &DeleteParams{SiteID: siteID, ID: cr.ID})
		require.NoError(t, err)

		// Verify deleted_at is set in DB
		var deletedAt *time.Time
		err = pgctx.QueryRow(ctx, `
			select deleted_at from devices where id = $1
		`, cr.ID).Scan(&deletedAt)
		require.NoError(t, err)
		assert.NotNil(t, deletedAt)
	})

	t.Run("not_found_nonexistent_id", func(t *testing.T) {
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

	t.Run("not_found_already_deleted", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Delete Twice",
			Type:   "meter",
		})
		require.NoError(t, err)

		_, err = Delete(ctx, &DeleteParams{SiteID: siteID, ID: cr.ID})
		require.NoError(t, err)

		// Second delete should return not found
		_, err = Delete(ctx, &DeleteParams{SiteID: siteID, ID: cr.ID})
		require.Error(t, err)
		assert.Equal(t, ErrNotFound, err)
	})

	t.Run("not_found_wrong_site_id", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		// Create second site for same user
		otherSiteID := xid.New().String()
		_, err := pgctx.Exec(tc.Ctx(), `
			insert into sites (id, name) values ($1, $2)
		`, otherSiteID, "Other Site")
		require.NoError(t, err)
		_, err = pgctx.Exec(tc.Ctx(), `
			insert into site_members (site_id, user_id, role) values ($1, $2, $3)
		`, otherSiteID, userID, "owner")
		require.NoError(t, err)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Wrong Site Device",
			Type:   "meter",
		})
		require.NoError(t, err)

		// Try to delete with wrong siteID
		_, err = Delete(ctx, &DeleteParams{SiteID: otherSiteID, ID: cr.ID})
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

	t.Run("validation_error_missing_site_id", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, _ := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Delete(ctx, &DeleteParams{ID: xid.New().String()})
		require.Error(t, err)
	})

	t.Run("validation_error_missing_id", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Delete(ctx, &DeleteParams{SiteID: siteID})
		require.Error(t, err)
	})

	t.Run("deleted_device_excluded_from_list", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr1, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Device A",
			Type:   "meter",
		})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Device B",
			Type:   "meter",
		})
		require.NoError(t, err)

		_, err = Delete(ctx, &DeleteParams{SiteID: siteID, ID: cr1.ID})
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{SiteID: siteID})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		assert.Equal(t, "Device B", r.Items[0].Name)
	})

	t.Run("get_still_returns_soft_deleted_device", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Soft Deleted",
			Type:   "meter",
		})
		require.NoError(t, err)

		_, err = Delete(ctx, &DeleteParams{SiteID: siteID, ID: cr.ID})
		require.NoError(t, err)

		// Get does not filter by deleted_at, so it still returns the device
		got, err := Get(ctx, &GetParams{ID: cr.ID})
		require.NoError(t, err)
		assert.Equal(t, "Soft Deleted", got.Name)
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

// seedMeter inserts a meter attached to a device.
func seedMeter(t *testing.T, ctx context.Context, siteID, deviceID, serialNumber string, isOnline bool, lastSeenAt *time.Time) {
	t.Helper()

	_, err := pgctx.Exec(ctx, `
		insert into meters (id, site_id, device_id, serial_number, protocol, is_online, last_seen_at)
		values ($1, $2, $3, $4, $5, $6, $7)
		on conflict (site_id, serial_number) do nothing
	`,
		xid.New().String(),
		siteID,
		deviceID,
		serialNumber,
		"mqtt",
		isOnline,
		lastSeenAt,
	)
	require.NoError(t, err)
}

func ptrTime(t time.Time) *time.Time {
	return &t
}
