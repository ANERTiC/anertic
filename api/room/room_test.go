package room

import (
	"context"
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
			Level:  3,
		})
		require.NoError(t, err)

		deviceID := seedDevice(t, ctx, siteID, "Smart Meter")
		seedMeter(t, ctx, siteID, deviceID, "MTR-ROOM-001", true, ptrTime(time.Now()))

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
		assert.Equal(t, 3, item.Level)
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

	t.Run("filter_by_level", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Ground Office", Type: "office", Level: 0})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Floor 1 Bedroom", Type: "bedroom", Level: 1})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Floor 1 Kitchen", Type: "kitchen", Level: 1})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Basement Storage", Type: "storage", Level: -1})
		require.NoError(t, err)

		level1 := 1
		r, err := List(ctx, &ListParams{SiteID: siteID, Level: &level1})
		require.NoError(t, err)
		require.Len(t, r.Items, 2)
		for _, item := range r.Items {
			assert.Equal(t, 1, item.Level)
		}
	})

	t.Run("filter_by_level_zero", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Ground Room", Type: "living", Level: 0})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Upstairs Room", Type: "bedroom", Level: 2})
		require.NoError(t, err)

		level0 := 0
		r, err := List(ctx, &ListParams{SiteID: siteID, Level: &level0})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		assert.Equal(t, "Ground Room", r.Items[0].Name)
		assert.Equal(t, 0, r.Items[0].Level)
	})

	t.Run("filter_by_negative_level", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Basement", Type: "storage", Level: -1})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Ground", Type: "living", Level: 0})
		require.NoError(t, err)

		levelNeg := -1
		r, err := List(ctx, &ListParams{SiteID: siteID, Level: &levelNeg})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		assert.Equal(t, "Basement", r.Items[0].Name)
		assert.Equal(t, -1, r.Items[0].Level)
	})

	t.Run("filter_by_level_returns_empty_when_no_match", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Ground Room", Type: "living", Level: 0})
		require.NoError(t, err)

		level99 := 99
		r, err := List(ctx, &ListParams{SiteID: siteID, Level: &level99})
		require.NoError(t, err)
		assert.Empty(t, r.Items)
	})

	t.Run("nil_level_returns_all_rooms", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Basement", Type: "storage", Level: -1})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Ground", Type: "living", Level: 0})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "First Floor", Type: "bedroom", Level: 1})
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{SiteID: siteID, Level: nil})
		require.NoError(t, err)
		require.Len(t, r.Items, 3)
	})

	t.Run("filter_by_level_combined_with_type", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Floor 1 Office", Type: "office", Level: 1})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Floor 1 Kitchen", Type: "kitchen", Level: 1})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Floor 2 Office", Type: "office", Level: 2})
		require.NoError(t, err)

		level1 := 1
		r, err := List(ctx, &ListParams{SiteID: siteID, Level: &level1, Type: "office"})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		assert.Equal(t, "Floor 1 Office", r.Items[0].Name)
		assert.Equal(t, 1, r.Items[0].Level)
		assert.Equal(t, "office", r.Items[0].Type)
	})

	t.Run("filter_by_level_combined_with_search", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Alpha Office", Type: "office", Level: 1})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Beta Office", Type: "office", Level: 1})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Alpha Kitchen", Type: "kitchen", Level: 2})
		require.NoError(t, err)

		level1 := 1
		r, err := List(ctx, &ListParams{SiteID: siteID, Level: &level1, Search: "Alpha"})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		assert.Equal(t, "Alpha Office", r.Items[0].Name)
		assert.Equal(t, 1, r.Items[0].Level)
	})

	t.Run("filter_by_level_with_device_aggregation", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		// Create rooms on different levels with devices
		cr1, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Floor 2 Office", Type: "office", Level: 2})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Floor 3 Office", Type: "office", Level: 3})
		require.NoError(t, err)

		// Assign a device with online meter to the level 2 room
		deviceID := seedDevice(t, ctx, siteID, "Level 2 Meter")
		seedMeter(t, ctx, siteID, deviceID, "MTR-LVL2-001", true, ptrTime(time.Now()))

		_, err = AssignDevice(ctx, &AssignDeviceParams{
			SiteID:   siteID,
			RoomID:   cr1.ID,
			DeviceID: deviceID,
		})
		require.NoError(t, err)

		// Filter by level 2 — should see the room with device aggregation
		level2 := 2
		r, err := List(ctx, &ListParams{SiteID: siteID, Level: &level2})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		assert.Equal(t, "Floor 2 Office", r.Items[0].Name)
		assert.Equal(t, 2, r.Items[0].Level)
		assert.Equal(t, 1, r.Items[0].DeviceCount)
		assert.Equal(t, "online", r.Items[0].ConnectionStatus)

		// Filter by level 3 — should see the room with no devices
		level3 := 3
		r, err = List(ctx, &ListParams{SiteID: siteID, Level: &level3})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		assert.Equal(t, "Floor 3 Office", r.Items[0].Name)
		assert.Equal(t, 3, r.Items[0].Level)
		assert.Equal(t, 0, r.Items[0].DeviceCount)
		assert.Equal(t, "offline", r.Items[0].ConnectionStatus)
	})

	t.Run("filter_by_level_combined_with_type_and_search", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Alpha Office", Type: "office", Level: 1})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Alpha Kitchen", Type: "kitchen", Level: 1})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Beta Office", Type: "office", Level: 1})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Alpha Office", Type: "office", Level: 2})
		require.NoError(t, err)

		// All three filters combined: level=1, type=office, search=Alpha
		level1 := 1
		r, err := List(ctx, &ListParams{SiteID: siteID, Level: &level1, Type: "office", Search: "Alpha"})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		assert.Equal(t, "Alpha Office", r.Items[0].Name)
		assert.Equal(t, "office", r.Items[0].Type)
		assert.Equal(t, 1, r.Items[0].Level)
	})

	t.Run("cross_site_isolation_by_level", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		// Create a second site for the same user
		siteID2 := xid.New().String()
		_, err := pgctx.Exec(ctx, `
			insert into sites (id, name) values ($1, $2)
		`, siteID2, "Other Site")
		require.NoError(t, err)

		_, err = pgctx.Exec(ctx, `
			insert into site_members (site_id, user_id, role) values ($1, $2, $3)
		`, siteID2, userID, "owner")
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID, Name: "Site1 Room", Type: "office", Level: 1})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{SiteID: siteID2, Name: "Site2 Room", Type: "office", Level: 1})
		require.NoError(t, err)

		level1 := 1
		r, err := List(ctx, &ListParams{SiteID: siteID, Level: &level1})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		assert.Equal(t, "Site1 Room", r.Items[0].Name)
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

	t.Run("creates_room_with_level", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		r, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Upstairs Bedroom",
			Type:   "bedroom",
			Level:  2,
		})
		require.NoError(t, err)
		require.NotNil(t, r)
		assert.NotEmpty(t, r.ID)

		// Verify level is persisted in DB
		var level int
		err = pgctx.QueryRow(ctx, `
			select level from rooms where id = $1
		`, r.ID).Scan(&level)
		require.NoError(t, err)
		assert.Equal(t, 2, level)
	})

	t.Run("creates_room_with_negative_level", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		r, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Basement Storage",
			Type:   "storage",
			Level:  -2,
		})
		require.NoError(t, err)
		require.NotNil(t, r)

		var level int
		err = pgctx.QueryRow(ctx, `
			select level from rooms where id = $1
		`, r.ID).Scan(&level)
		require.NoError(t, err)
		assert.Equal(t, -2, level)
	})

	t.Run("creates_room_with_default_level_zero", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		r, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Default Level Room",
			Type:   "office",
		})
		require.NoError(t, err)
		require.NotNil(t, r)

		// When Level is not provided, Go zero-value (0) is used
		var level int
		err = pgctx.QueryRow(ctx, `
			select level from rooms where id = $1
		`, r.ID).Scan(&level)
		require.NoError(t, err)
		assert.Equal(t, 0, level)
	})

	t.Run("creates_multiple_rooms_on_same_level", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		r1, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Office A",
			Type:   "office",
			Level:  3,
		})
		require.NoError(t, err)

		r2, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Office B",
			Type:   "office",
			Level:  3,
		})
		require.NoError(t, err)

		// Both rooms should exist on same level
		level3 := 3
		list, err := List(ctx, &ListParams{SiteID: siteID, Level: &level3})
		require.NoError(t, err)
		require.Len(t, list.Items, 2)

		ids := []string{list.Items[0].ID, list.Items[1].ID}
		assert.Contains(t, ids, r1.ID)
		assert.Contains(t, ids, r2.ID)
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
		seedMeter(t, ctx, siteID, deviceID, "MTR-GET-001", true, ptrTime(time.Now()))

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

	t.Run("returns_level", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Third Floor Office",
			Type:   "office",
			Level:  3,
		})
		require.NoError(t, err)

		r, err := Get(ctx, &GetParams{ID: cr.ID})
		require.NoError(t, err)
		assert.Equal(t, "Third Floor Office", r.Name)
		assert.Equal(t, 3, r.Level)
	})

	t.Run("returns_negative_level", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Basement Lab",
			Type:   "other",
			Level:  -2,
		})
		require.NoError(t, err)

		r, err := Get(ctx, &GetParams{ID: cr.ID})
		require.NoError(t, err)
		assert.Equal(t, "Basement Lab", r.Name)
		assert.Equal(t, -2, r.Level)
	})

	t.Run("returns_default_level_zero", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Ground Room",
			Type:   "living",
		})
		require.NoError(t, err)

		r, err := Get(ctx, &GetParams{ID: cr.ID})
		require.NoError(t, err)
		assert.Equal(t, "Ground Room", r.Name)
		assert.Equal(t, 0, r.Level)
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

	t.Run("preserves_level_after_name_update", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Floor 5 Office",
			Type:   "office",
			Level:  5,
		})
		require.NoError(t, err)

		name := "Renamed Office"
		_, err = Update(ctx, &UpdateParams{
			ID:     cr.ID,
			SiteID: siteID,
			Name:   &name,
		})
		require.NoError(t, err)

		// Verify level is unchanged in DB after update
		var level int
		err = pgctx.QueryRow(ctx, `
			select level from rooms where id = $1
		`, cr.ID).Scan(&level)
		require.NoError(t, err)
		assert.Equal(t, 5, level)
	})

	t.Run("preserves_level_after_type_update", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Basement Room",
			Type:   "storage",
			Level:  -1,
		})
		require.NoError(t, err)

		typ := "office"
		_, err = Update(ctx, &UpdateParams{
			ID:     cr.ID,
			SiteID: siteID,
			Type:   &typ,
		})
		require.NoError(t, err)

		var level int
		err = pgctx.QueryRow(ctx, `
			select level from rooms where id = $1
		`, cr.ID).Scan(&level)
		require.NoError(t, err)
		assert.Equal(t, -1, level)
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

	t.Run("deleted_room_excluded_from_level_filter", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		cr1, err := Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Room A Level 5",
			Type:   "office",
			Level:  5,
		})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{
			SiteID: siteID,
			Name:   "Room B Level 5",
			Type:   "bedroom",
			Level:  5,
		})
		require.NoError(t, err)

		// Delete one room on level 5
		_, err = Delete(ctx, &DeleteParams{SiteID: siteID, ID: cr1.ID})
		require.NoError(t, err)

		// Only one room should remain on level 5
		level5 := 5
		r, err := List(ctx, &ListParams{SiteID: siteID, Level: &level5})
		require.NoError(t, err)
		require.Len(t, r.Items, 1)
		assert.Equal(t, "Room B Level 5", r.Items[0].Name)
	})

	t.Run("floor_deletion_resets_room_level_to_zero", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		// Create a floor at level 3
		seedFloor(t, ctx, siteID, 3, "Third Floor")

		// Create rooms on level 3
		cr1, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Room A", Type: "office", Level: 3})
		require.NoError(t, err)

		cr2, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Room B", Type: "bedroom", Level: 3})
		require.NoError(t, err)

		// Create a room on a different level to ensure it's unaffected
		cr3, err := Create(ctx, &CreateParams{SiteID: siteID, Name: "Room C", Type: "kitchen", Level: 1})
		require.NoError(t, err)

		// Delete the floor — this should reset rooms on level 3 to level 0
		_, err = pgctx.Exec(ctx, `
			update rooms
			set level = 0,
			    updated_at = now()
			where site_id = $1
			  and level = $2
			  and deleted_at is null
		`, siteID, 3)
		require.NoError(t, err)

		_, err = pgctx.Exec(ctx, `
			delete from floors
			where site_id = $1
			  and level = $2
		`, siteID, 3)
		require.NoError(t, err)

		// Verify rooms that were on level 3 are now on level 0
		var level1, level2 int
		err = pgctx.QueryRow(ctx, `select level from rooms where id = $1`, cr1.ID).Scan(&level1)
		require.NoError(t, err)
		assert.Equal(t, 0, level1)

		err = pgctx.QueryRow(ctx, `select level from rooms where id = $1`, cr2.ID).Scan(&level2)
		require.NoError(t, err)
		assert.Equal(t, 0, level2)

		// Verify room on level 1 is unaffected
		var level3Val int
		err = pgctx.QueryRow(ctx, `select level from rooms where id = $1`, cr3.ID).Scan(&level3Val)
		require.NoError(t, err)
		assert.Equal(t, 1, level3Val)

		// Verify listing by level 0 now includes the reset rooms
		level0 := 0
		r, err := List(ctx, &ListParams{SiteID: siteID, Level: &level0})
		require.NoError(t, err)
		require.Len(t, r.Items, 2)

		// Verify listing by level 3 returns empty
		level3 := 3
		r, err = List(ctx, &ListParams{SiteID: siteID, Level: &level3})
		require.NoError(t, err)
		assert.Empty(t, r.Items)
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

// seedFloor creates a floor entry for a site.
func seedFloor(t *testing.T, ctx context.Context, siteID string, level int, name string) {
	t.Helper()
	_, err := pgctx.Exec(ctx, `
		insert into floors (site_id, level, name)
		values ($1, $2, $3)
		on conflict (site_id, level) do nothing
	`, siteID, level, name)
	require.NoError(t, err)
}

func ptrTime(t time.Time) *time.Time {
	return &t
}
