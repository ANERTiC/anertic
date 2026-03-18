package room

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

	t.Run("returns_rooms_with_device_aggregation", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Living Room",
			Type:   "living",
		})
		require.NoError(t, err)

		deviceID := seedDevice(t, ctx, siteID, "Smart Meter")
		seedMeter(t, ctx, deviceID, "MTR-ROOM-001", true, ptrTime(time.Now()))

		_, err = AssignDevice(ctx, &AssignDeviceParams{
			SiteID:   siteID,
			RoomID:   cr.ID,
			DeviceID: deviceID,
		})
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{SiteID: siteID})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)

		item := r.Items[0]
		assert.Equal(t, cr.ID, item.ID)
		assert.Equal(t, "Living Room", item.Name)
		assert.Equal(t, "living", item.Type)
		assert.Equal(t, 1, item.DeviceCount)
		assert.Equal(t, "online", item.ConnectionStatus)
	})

	t.Run("excludes_soft_deleted_rooms", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "To Delete",
			Type:   "other",
		})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Still Alive",
			Type:   "office",
		})
		require.NoError(t, err)

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

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Kitchen", Type: "kitchen"})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Office", Type: "office"})
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{SiteID: siteID, Type: "kitchen"})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		assert.Equal(t, "kitchen", r.Items[0].Type)
	})

	t.Run("search_by_name", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Server Room Alpha", Type: "office"})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Kitchen Beta", Type: "kitchen"})
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{SiteID: siteID, Search: "Alpha"})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		assert.Equal(t, "Server Room Alpha", r.Items[0].Name)
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
			Name:   "Living Room",
			Type:   "living",
		})
		require.NoError(t, err)
		require.NotNil(t, r)
		assert.NotEmpty(t, r.ID)

		got, err := Get(ctx, &GetParams{ID: r.ID})
		require.NoError(t, err)
		assert.Equal(t, "Living Room", got.Name)
		assert.Equal(t, "living", got.Type)
		assert.Equal(t, siteID, got.SiteID)
	})

	t.Run("validation_error_missing_name", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Type: "living"})
		require.Error(t, err)
	})

	t.Run("validation_error_missing_type", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Room"})
		require.Error(t, err)
	})

	t.Run("validation_error_invalid_type", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Room", Type: "invalid"})
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
			Name:   "Forbidden Room",
			Type:   "other",
		})
		require.Error(t, err)
		assert.Equal(t, iam.ErrForbidden, err)
	})
}

func TestGet(t *testing.T) {
	if os.Getenv("TEST_DB_URL") == "" {
		t.Skip("TEST_DB_URL not set, skipping integration test")
	}

	t.Run("success_with_devices", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Office",
			Type:   "office",
		})
		require.NoError(t, err)

		deviceID := seedDevice(t, ctx, siteID, "Air Conditioner")
		seedMeter(t, ctx, deviceID, "MTR-GET-001", true, ptrTime(time.Now()))

		_, err = AssignDevice(ctx, &AssignDeviceParams{
			SiteID:   siteID,
			RoomID:   cr.ID,
			DeviceID: deviceID,
		})
		require.NoError(t, err)

		r, err := Get(ctx, &GetParams{ID: cr.ID})
		require.NoError(t, err)
		require.NotNil(t, r)
		assert.Equal(t, "Office", r.Name)
		assert.Equal(t, "office", r.Type)
		require.Len(t, r.Devices, 1)
		assert.Equal(t, deviceID, r.Devices[0].ID)
		assert.Equal(t, "Air Conditioner", r.Devices[0].Name)
		assert.Equal(t, "online", r.Devices[0].ConnectionStatus)
		assert.Equal(t, 1, r.Devices[0].MeterCount)
	})

	t.Run("success_no_devices", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Empty Room",
			Type:   "storage",
		})
		require.NoError(t, err)

		r, err := Get(ctx, &GetParams{ID: cr.ID})
		require.NoError(t, err)
		assert.Equal(t, "Empty Room", r.Name)
		assert.Empty(t, r.Devices)
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
			Type:   "office",
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
		assert.Equal(t, "office", got.Type)
	})

	t.Run("update_type_only", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Room",
			Type:   "office",
		})
		require.NoError(t, err)

		typ := "bedroom"
		_, err = Update(ctx, &UpdateParams{
			ID:     cr.ID,
			SiteID: siteID,
			Type:   &typ,
		})
		require.NoError(t, err)

		got, err := Get(ctx, &GetParams{ID: cr.ID})
		require.NoError(t, err)
		assert.Equal(t, "Room", got.Name)
		assert.Equal(t, "bedroom", got.Type)
	})

	t.Run("update_multiple_fields", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Old Name",
			Type:   "office",
		})
		require.NoError(t, err)

		name := "New Name"
		typ := "kitchen"
		_, err = Update(ctx, &UpdateParams{
			ID:     cr.ID,
			SiteID: siteID,
			Name:   &name,
			Type:   &typ,
		})
		require.NoError(t, err)

		got, err := Get(ctx, &GetParams{ID: cr.ID})
		require.NoError(t, err)
		assert.Equal(t, "New Name", got.Name)
		assert.Equal(t, "kitchen", got.Type)
	})

	t.Run("validation_error_invalid_type", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		typ := "invalid"
		_, err := Update(ctx, &UpdateParams{
			ID:     xid.New().String(),
			SiteID: siteID,
			Type:   &typ,
		})
		require.Error(t, err)
	})

	t.Run("validation_error_missing_id", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		name := "X"
		_, err := Update(ctx, &UpdateParams{SiteID: siteID, Name: &name})
		require.Error(t, err)
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
			ID:     xid.New().String(),
			SiteID: siteID,
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

	t.Run("success", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "To Delete",
			Type:   "other",
		})
		require.NoError(t, err)

		// Assign a device to verify room_devices cleanup
		deviceID := seedDevice(t, ctx, siteID, "Device")
		_, err = AssignDevice(ctx, &AssignDeviceParams{
			SiteID:   siteID,
			RoomID:   cr.ID,
			DeviceID: deviceID,
		})
		require.NoError(t, err)

		_, err = Delete(ctx, &DeleteParams{SiteID: siteID, ID: cr.ID})
		require.NoError(t, err)

		// Verify room is soft-deleted
		_, err = Get(ctx, &GetParams{ID: cr.ID})
		require.Error(t, err)
		assert.Equal(t, ErrNotFound, err)

		// Verify room_devices rows are removed
		var count int
		err = pgctx.QueryRow(ctx, `
			select count(*) from room_devices where room_id = $1
		`, cr.ID).Scan(&count)
		require.NoError(t, err)
		assert.Equal(t, 0, count)
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
			Type:   "other",
		})
		require.NoError(t, err)

		_, err = Delete(ctx, &DeleteParams{SiteID: siteID, ID: cr.ID})
		require.NoError(t, err)

		_, err = Delete(ctx, &DeleteParams{SiteID: siteID, ID: cr.ID})
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
}

func TestAssignDevice(t *testing.T) {
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
			Name:   "Room",
			Type:   "office",
		})
		require.NoError(t, err)

		deviceID := seedDevice(t, ctx, siteID, "Device A")

		_, err = AssignDevice(ctx, &AssignDeviceParams{
			SiteID:   siteID,
			RoomID:   cr.ID,
			DeviceID: deviceID,
		})
		require.NoError(t, err)

		got, err := Get(ctx, &GetParams{ID: cr.ID})
		require.NoError(t, err)
		require.Len(t, got.Devices, 1)
		assert.Equal(t, deviceID, got.Devices[0].ID)
	})

	t.Run("duplicate_assignment_is_noop", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Room",
			Type:   "office",
		})
		require.NoError(t, err)

		deviceID := seedDevice(t, ctx, siteID, "Device B")

		_, err = AssignDevice(ctx, &AssignDeviceParams{
			SiteID:   siteID,
			RoomID:   cr.ID,
			DeviceID: deviceID,
		})
		require.NoError(t, err)

		// Assign again - should not error
		_, err = AssignDevice(ctx, &AssignDeviceParams{
			SiteID:   siteID,
			RoomID:   cr.ID,
			DeviceID: deviceID,
		})
		require.NoError(t, err)

		got, err := Get(ctx, &GetParams{ID: cr.ID})
		require.NoError(t, err)
		require.Len(t, got.Devices, 1)
	})

	t.Run("room_not_found", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		deviceID := seedDevice(t, ctx, siteID, "Device")

		_, err := AssignDevice(ctx, &AssignDeviceParams{
			SiteID:   siteID,
			RoomID:   xid.New().String(),
			DeviceID: deviceID,
		})
		require.Error(t, err)
		assert.Equal(t, ErrNotFound, err)
	})

	t.Run("device_not_found", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Room",
			Type:   "office",
		})
		require.NoError(t, err)

		_, err = AssignDevice(ctx, &AssignDeviceParams{
			SiteID:   siteID,
			RoomID:   cr.ID,
			DeviceID: xid.New().String(),
		})
		require.Error(t, err)
		assert.Equal(t, ErrDeviceNotFound, err)
	})

	t.Run("forbidden_not_site_member", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		_, siteID := seedTestData(t, tc)
		otherUserID := seedUser(t, tc)
		otherCtx := auth.WithAccountID(tc.Ctx(), otherUserID)

		_, err := AssignDevice(otherCtx, &AssignDeviceParams{
			SiteID:   siteID,
			RoomID:   xid.New().String(),
			DeviceID: xid.New().String(),
		})
		require.Error(t, err)
		assert.Equal(t, iam.ErrForbidden, err)
	})

	t.Run("validation_error_missing_fields", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, _ := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := AssignDevice(ctx, &AssignDeviceParams{})
		require.Error(t, err)
	})
}

func TestUnassignDevice(t *testing.T) {
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
			Name:   "Room",
			Type:   "office",
		})
		require.NoError(t, err)

		deviceID := seedDevice(t, ctx, siteID, "Device")
		_, err = AssignDevice(ctx, &AssignDeviceParams{
			SiteID:   siteID,
			RoomID:   cr.ID,
			DeviceID: deviceID,
		})
		require.NoError(t, err)

		_, err = UnassignDevice(ctx, &UnassignDeviceParams{
			SiteID:   siteID,
			RoomID:   cr.ID,
			DeviceID: deviceID,
		})
		require.NoError(t, err)

		got, err := Get(ctx, &GetParams{ID: cr.ID})
		require.NoError(t, err)
		assert.Empty(t, got.Devices)
	})

	t.Run("unassign_nonexistent_is_noop", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := UnassignDevice(ctx, &UnassignDeviceParams{
			SiteID:   siteID,
			RoomID:   xid.New().String(),
			DeviceID: xid.New().String(),
		})
		require.NoError(t, err)
	})

	t.Run("forbidden_not_site_member", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		_, siteID := seedTestData(t, tc)
		otherUserID := seedUser(t, tc)
		otherCtx := auth.WithAccountID(tc.Ctx(), otherUserID)

		_, err := UnassignDevice(otherCtx, &UnassignDeviceParams{
			SiteID:   siteID,
			RoomID:   xid.New().String(),
			DeviceID: xid.New().String(),
		})
		require.Error(t, err)
		assert.Equal(t, iam.ErrForbidden, err)
	})

	t.Run("validation_error_missing_fields", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, _ := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := UnassignDevice(ctx, &UnassignDeviceParams{})
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

// seedDevice creates a device and returns its ID.
func seedDevice(t *testing.T, ctx context.Context, siteID, name string) string {
	t.Helper()
	id := xid.New().String()
	_, err := pgctx.Exec(ctx, `
		insert into devices (id, site_id, name, type) values ($1, $2, $3, $4)
	`, id, siteID, name, "meter")
	require.NoError(t, err)
	return id
}

// seedMeter inserts a meter attached to a device.
func seedMeter(t *testing.T, ctx context.Context, deviceID, serialNumber string, isOnline bool, lastSeenAt *time.Time) {
	t.Helper()

	_, err := pgctx.Exec(ctx, `
		insert into meters (id, device_id, serial_number, protocol, is_online, last_seen_at)
		values ($1, $2, $3, $4, $5, $6)
		on conflict (serial_number) do nothing
	`,
		xid.New().String(),
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
