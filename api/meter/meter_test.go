package meter

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

func TestCreate(t *testing.T) {
	tc := tu.Setup()
	defer tc.Teardown()

	userID, siteID, deviceID := seedTestData(t, tc)
	ctx := auth.WithAccountID(tc.Ctx(), userID)

	t.Run("success", func(t *testing.T) {
		r, err := Create(ctx, &CreateParams{
			SiteID:       siteID,
			DeviceID:     deviceID,
			SerialNumber: "SN-001",
			Protocol:     "mqtt",
			Vendor:       "Eastron",
			Phase:        1,
			Channel:      "load",
		})
		require.NoError(t, err)
		require.NotNil(t, r)
		assert.NotEmpty(t, r.ID)

		got, err := Get(ctx, &GetParams{ID: r.ID})
		require.NoError(t, err)
		assert.Equal(t, "SN-001", got.SerialNumber)
		assert.Equal(t, "mqtt", got.Protocol)
		assert.Equal(t, "Eastron", got.Vendor)
		assert.Equal(t, 1, got.Phase)
		assert.Equal(t, "load", got.Channel)
		assert.Equal(t, deviceID, got.DeviceID)
	})

	t.Run("validation error missing deviceId", func(t *testing.T) {
		_, err := Create(ctx, &CreateParams{
			SiteID:       siteID,
			SerialNumber: "SN-002",
			Protocol:     "mqtt",
		})
		require.Error(t, err)
	})

	t.Run("validation error missing serialNumber", func(t *testing.T) {
		_, err := Create(ctx, &CreateParams{
			SiteID:   siteID,
			DeviceID: deviceID,
			Protocol: "mqtt",
		})
		require.Error(t, err)
	})

	t.Run("validation error missing protocol", func(t *testing.T) {
		_, err := Create(ctx, &CreateParams{
			SiteID:       siteID,
			DeviceID:     deviceID,
			SerialNumber: "SN-NOPROTO",
		})
		require.Error(t, err)
	})

	t.Run("validation error invalid protocol", func(t *testing.T) {
		_, err := Create(ctx, &CreateParams{
			SiteID:       siteID,
			DeviceID:     deviceID,
			SerialNumber: "SN-003",
			Protocol:     "grpc",
		})
		require.Error(t, err)
	})

	t.Run("duplicate serial number", func(t *testing.T) {
		_, err := Create(ctx, &CreateParams{
			SiteID:       siteID,
			DeviceID:     deviceID,
			SerialNumber: "SN-001",
			Protocol:     "http",
		})
		require.Error(t, err)
		assert.Equal(t, ErrDuplicate, err)
	})

	t.Run("device not found", func(t *testing.T) {
		_, err := Create(ctx, &CreateParams{
			SiteID:       siteID,
			DeviceID:     xid.New().String(),
			SerialNumber: "SN-999",
			Protocol:     "mqtt",
		})
		require.Error(t, err)
		assert.Equal(t, ErrDeviceNotFound, err)
	})

	t.Run("forbidden - not site member", func(t *testing.T) {
		otherUserID := xid.New().String()
		_, err := pgctx.Exec(ctx, `
			insert into users (id, email, name) values ($1, $2, $3)
		`, otherUserID, otherUserID+"@test.com", "Other User")
		require.NoError(t, err)

		otherCtx := auth.WithAccountID(tc.Ctx(), otherUserID)
		_, err = Create(otherCtx, &CreateParams{
			SiteID:       siteID,
			DeviceID:     deviceID,
			SerialNumber: "SN-forbidden",
			Protocol:     "mqtt",
		})
		require.Error(t, err)
		assert.Equal(t, iam.ErrForbidden, err)
	})
}

func TestList(t *testing.T) {
	tc := tu.Setup()
	defer tc.Teardown()

	userID, siteID, deviceID := seedTestData(t, tc)
	ctx := auth.WithAccountID(tc.Ctx(), userID)

	t.Run("empty list", func(t *testing.T) {
		r, err := List(ctx, &ListParams{SiteID: siteID, DeviceID: deviceID})
		require.NoError(t, err)
		require.NotNil(t, r)
		assert.Empty(t, r.Items)
	})

	t.Run("returns created meters", func(t *testing.T) {
		_, err := Create(ctx, &CreateParams{
			SiteID:       siteID,
			DeviceID:     deviceID,
			SerialNumber: "LIST-SN-001",
			Protocol:     "mqtt",
			Channel:      "pv",
		})
		require.NoError(t, err)

		_, err = Create(ctx, &CreateParams{
			SiteID:       siteID,
			DeviceID:     deviceID,
			SerialNumber: "LIST-SN-002",
			Protocol:     "http",
			Channel:      "grid",
		})
		require.NoError(t, err)

		r, err := List(ctx, &ListParams{SiteID: siteID, DeviceID: deviceID})
		require.NoError(t, err)
		assert.Len(t, r.Items, 2)
	})

	t.Run("validation error missing deviceId", func(t *testing.T) {
		_, err := List(ctx, &ListParams{SiteID: siteID})
		require.Error(t, err)
	})

	t.Run("validation error missing siteId", func(t *testing.T) {
		_, err := List(ctx, &ListParams{DeviceID: deviceID})
		require.Error(t, err)
	})

	t.Run("device not found", func(t *testing.T) {
		_, err := List(ctx, &ListParams{SiteID: siteID, DeviceID: xid.New().String()})
		require.Error(t, err)
		assert.Equal(t, ErrDeviceNotFound, err)
	})

	t.Run("forbidden - not site member", func(t *testing.T) {
		otherUserID := xid.New().String()
		_, err := pgctx.Exec(ctx, `
			insert into users (id, email, name) values ($1, $2, $3)
		`, otherUserID, otherUserID+"@test.com", "Other")
		require.NoError(t, err)

		otherCtx := auth.WithAccountID(tc.Ctx(), otherUserID)
		_, err = List(otherCtx, &ListParams{SiteID: siteID, DeviceID: deviceID})
		require.Error(t, err)
		assert.Equal(t, iam.ErrForbidden, err)
	})
}

func TestGet(t *testing.T) {
	tc := tu.Setup()
	defer tc.Teardown()

	userID, siteID, deviceID := seedTestData(t, tc)
	ctx := auth.WithAccountID(tc.Ctx(), userID)

	t.Run("success", func(t *testing.T) {
		cr, err := Create(ctx, &CreateParams{
			SiteID:       siteID,
			DeviceID:     deviceID,
			SerialNumber: "GET-SN-001",
			Protocol:     "mqtt",
			Vendor:       "Schneider",
			Phase:        3,
			Channel:      "grid",
		})
		require.NoError(t, err)

		r, err := Get(ctx, &GetParams{ID: cr.ID})
		require.NoError(t, err)
		require.NotNil(t, r)
		assert.Equal(t, cr.ID, r.ID)
		assert.Equal(t, "GET-SN-001", r.SerialNumber)
		assert.Equal(t, "Schneider", r.Vendor)
		assert.Equal(t, 3, r.Phase)
		assert.Equal(t, "grid", r.Channel)
		assert.False(t, r.IsOnline)
		assert.Nil(t, r.LastSeenAt)
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

	userID, siteID, deviceID := seedTestData(t, tc)
	ctx := auth.WithAccountID(tc.Ctx(), userID)

	t.Run("update vendor only", func(t *testing.T) {
		cr, err := Create(ctx, &CreateParams{
			SiteID:       siteID,
			DeviceID:     deviceID,
			SerialNumber: "UPD-SN-001",
			Protocol:     "mqtt",
			Vendor:       "Eastron",
			Phase:        1,
			Channel:      "load",
		})
		require.NoError(t, err)

		vendor := "Schneider"
		_, err = Update(ctx, &UpdateParams{
			SiteID: siteID,
			ID:     cr.ID,
			Vendor: &vendor,
		})
		require.NoError(t, err)

		got, err := Get(ctx, &GetParams{ID: cr.ID})
		require.NoError(t, err)
		assert.Equal(t, "Schneider", got.Vendor)
		assert.Equal(t, 1, got.Phase)
		assert.Equal(t, "load", got.Channel)
	})

	t.Run("update multiple fields", func(t *testing.T) {
		cr, err := Create(ctx, &CreateParams{
			SiteID:       siteID,
			DeviceID:     deviceID,
			SerialNumber: "UPD-SN-002",
			Protocol:     "http",
			Vendor:       "ABB",
			Phase:        1,
			Channel:      "pv",
		})
		require.NoError(t, err)

		vendor := "Siemens"
		phase := 3
		channel := "grid"
		_, err = Update(ctx, &UpdateParams{
			SiteID:  siteID,
			ID:      cr.ID,
			Vendor:  &vendor,
			Phase:   &phase,
			Channel: &channel,
		})
		require.NoError(t, err)

		got, err := Get(ctx, &GetParams{ID: cr.ID})
		require.NoError(t, err)
		assert.Equal(t, "Siemens", got.Vendor)
		assert.Equal(t, 3, got.Phase)
		assert.Equal(t, "grid", got.Channel)
	})

	t.Run("validation error missing id", func(t *testing.T) {
		vendor := "X"
		_, err := Update(ctx, &UpdateParams{SiteID: siteID, Vendor: &vendor})
		require.Error(t, err)
	})

	t.Run("validation error missing siteId", func(t *testing.T) {
		vendor := "X"
		_, err := Update(ctx, &UpdateParams{ID: "some-id", Vendor: &vendor})
		require.Error(t, err)
	})
}

func TestDelete(t *testing.T) {
	tc := tu.Setup()
	defer tc.Teardown()

	userID, siteID, deviceID := seedTestData(t, tc)
	ctx := auth.WithAccountID(tc.Ctx(), userID)

	t.Run("success", func(t *testing.T) {
		cr, err := Create(ctx, &CreateParams{
			SiteID:       siteID,
			DeviceID:     deviceID,
			SerialNumber: "DEL-SN-001",
			Protocol:     "mqtt",
		})
		require.NoError(t, err)

		_, err = Delete(ctx, &DeleteParams{SiteID: siteID, ID: cr.ID})
		require.NoError(t, err)

		_, err = Get(ctx, &GetParams{ID: cr.ID})
		require.Error(t, err)
		assert.Equal(t, ErrNotFound, err)
	})

	t.Run("not found", func(t *testing.T) {
		_, err := Delete(ctx, &DeleteParams{SiteID: siteID, ID: xid.New().String()})
		require.NoError(t, err) // delete of non-existent row is not an error
	})

	t.Run("validation error missing id", func(t *testing.T) {
		_, err := Delete(ctx, &DeleteParams{SiteID: siteID})
		require.Error(t, err)
	})

	t.Run("validation error missing siteId", func(t *testing.T) {
		_, err := Delete(ctx, &DeleteParams{ID: "some-id"})
		require.Error(t, err)
	})

	t.Run("forbidden - not site member", func(t *testing.T) {
		cr, err := Create(ctx, &CreateParams{
			SiteID:       siteID,
			DeviceID:     deviceID,
			SerialNumber: "DEL-SN-002",
			Protocol:     "http",
		})
		require.NoError(t, err)

		otherUserID := xid.New().String()
		_, err = pgctx.Exec(ctx, `
			insert into users (id, email, name) values ($1, $2, $3)
		`, otherUserID, otherUserID+"@test.com", "Other")
		require.NoError(t, err)

		otherCtx := auth.WithAccountID(tc.Ctx(), otherUserID)
		_, err = Delete(otherCtx, &DeleteParams{SiteID: siteID, ID: cr.ID})
		require.Error(t, err)
		assert.Equal(t, iam.ErrForbidden, err)
	})
}

// seedTestData inserts a user, site, site_member, and device and returns their IDs.
func seedTestData(t *testing.T, tc *tu.Context) (userID, siteID, deviceID string) {
	t.Helper()
	ctx := tc.Ctx()

	userID = xid.New().String()
	siteID = xid.New().String()
	deviceID = xid.New().String()

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

	_, err = pgctx.Exec(ctx, `
		insert into devices (id, site_id, name, type) values ($1, $2, $3, $4)
	`, deviceID, siteID, "Test Device", "meter")
	require.NoError(t, err)

	return userID, siteID, deviceID
}
