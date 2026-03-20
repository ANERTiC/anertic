package site

import (
	"os"
	"strings"
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

func TestCreate(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		r, err := Create(ctx, &CreateParams{
			Name:     "Test Site",
			Address:  "123 Main St",
			Timezone: "Asia/Bangkok",
		})
		require.NoError(t, err)
		require.NotNil(t, r)
		assert.NotEmpty(t, r.ID)

		// Verify site row in database
		var name, address, timezone, currency string
		err = pgctx.QueryRow(ctx, `
			select
				name,
				address,
				timezone,
				currency
			from sites
			where id = $1
		`, r.ID).Scan(
			&name,
			&address,
			&timezone,
			&currency,
		)
		require.NoError(t, err)
		assert.Equal(t, "Test Site", name)
		assert.Equal(t, "123 Main St", address)
		assert.Equal(t, "Asia/Bangkok", timezone)
		assert.Equal(t, "THB", currency)
	})

	t.Run("creates_site_member_with_wildcard_role", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		r, err := Create(ctx, &CreateParams{
			Name:     "Membership Site",
			Timezone: "UTC",
		})
		require.NoError(t, err)

		var role string
		err = pgctx.QueryRow(ctx, `
			select role
			from site_members
			where site_id = $1
			  and user_id = $2
		`, r.ID, userID).Scan(&role)
		require.NoError(t, err)
		assert.Equal(t, "*", role)
	})

	t.Run("creates_starter_devices_and_meters", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		r, err := Create(ctx, &CreateParams{
			Name:     "Starter Site",
			Timezone: "America/New_York",
		})
		require.NoError(t, err)

		// Verify 4 devices are created
		var deviceCount int
		err = pgctx.QueryRow(ctx, `
			select count(*) from devices where site_id = $1
		`, r.ID).Scan(&deviceCount)
		require.NoError(t, err)
		assert.Equal(t, 4, deviceCount)

		// Verify 4 meters are created
		var meterCount int
		err = pgctx.QueryRow(ctx, `
			select count(*) from meters where site_id = $1
		`, r.ID).Scan(&meterCount)
		require.NoError(t, err)
		assert.Equal(t, 4, meterCount)
	})

	t.Run("starter_device_types_and_channels", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		r, err := Create(ctx, &CreateParams{
			Name:     "Channel Site",
			Timezone: "UTC",
		})
		require.NoError(t, err)

		// Verify device types
		type deviceRow struct {
			Name  string
			Type  string
			Brand string
		}
		devices := make([]deviceRow, 0)
		rows, err := pgctx.Query(ctx, `
			select
				name,
				type,
				brand
			from devices
			where site_id = $1
			order by name
		`, r.ID)
		require.NoError(t, err)
		defer rows.Close()
		for rows.Next() {
			var d deviceRow
			err := rows.Scan(
				&d.Name,
				&d.Type,
				&d.Brand,
			)
			require.NoError(t, err)
			devices = append(devices, d)
		}
		require.NoError(t, rows.Err())
		require.Len(t, devices, 4)

		// Verify meter channels
		type meterRow struct {
			Channel  string
			Protocol string
		}
		meters := make([]meterRow, 0)
		meterRows, err := pgctx.Query(ctx, `
			select
				channel,
				protocol
			from meters
			where site_id = $1
			order by channel
		`, r.ID)
		require.NoError(t, err)
		defer meterRows.Close()
		for meterRows.Next() {
			var m meterRow
			err := meterRows.Scan(
				&m.Channel,
				&m.Protocol,
			)
			require.NoError(t, err)
			meters = append(meters, m)
		}
		require.NoError(t, meterRows.Err())
		require.Len(t, meters, 4)

		// All meters should use mqtt protocol
		for _, m := range meters {
			assert.Equal(t, "mqtt", m.Protocol)
		}

		// Verify expected channels exist
		channels := make([]string, 0, len(meters))
		for _, m := range meters {
			channels = append(channels, m.Channel)
		}
		assert.Contains(t, channels, "grid")
		assert.Contains(t, channels, "pv")
		assert.Contains(t, channels, "load")
		assert.Contains(t, channels, "battery")
	})

	t.Run("starter_meters_have_demo_serial_numbers", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		r, err := Create(ctx, &CreateParams{
			Name:     "Demo Serial Site",
			Timezone: "UTC",
		})
		require.NoError(t, err)

		meterRows, err := pgctx.Query(ctx, `
			select serial_number from meters where site_id = $1
		`, r.ID)
		require.NoError(t, err)
		defer meterRows.Close()

		for meterRows.Next() {
			var sn string
			err := meterRows.Scan(&sn)
			require.NoError(t, err)
			assert.True(t, strings.HasPrefix(sn, "DEMO-"), "serial number should have DEMO- prefix, got: %s", sn)
		}
		require.NoError(t, meterRows.Err())
	})

	t.Run("empty_address_defaults", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		r, err := Create(ctx, &CreateParams{
			Name:     "No Address Site",
			Timezone: "UTC",
		})
		require.NoError(t, err)

		var address string
		err = pgctx.QueryRow(ctx, `
			select address from sites where id = $1
		`, r.ID).Scan(&address)
		require.NoError(t, err)
		assert.Equal(t, "", address)
	})

	t.Run("site_visible_in_list_after_creation", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		r, err := Create(ctx, &CreateParams{
			Name:     "Listed Site",
			Address:  "456 Oak Ave",
			Timezone: "Europe/London",
		})
		require.NoError(t, err)

		listResult, err := List(ctx, &ListParams{})
		require.NoError(t, err)
		require.Len(t, listResult.Items, 1)
		assert.Equal(t, r.ID, listResult.Items[0].ID)
		assert.Equal(t, "Listed Site", listResult.Items[0].Name)
		assert.Equal(t, "456 Oak Ave", listResult.Items[0].Address)
		assert.Equal(t, "Europe/London", listResult.Items[0].Timezone)
	})

	t.Run("validation_error_missing_name", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{
			Timezone: "UTC",
		})
		require.Error(t, err)
	})

	t.Run("validation_error_missing_timezone", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{
			Name: "No TZ Site",
		})
		require.Error(t, err)
	})

	t.Run("validation_error_address_too_long", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		longAddress := strings.Repeat("a", 200)
		_, err := Create(ctx, &CreateParams{
			Name:     "Long Address Site",
			Address:  longAddress,
			Timezone: "UTC",
		})
		require.Error(t, err)
	})

	t.Run("address_at_199_chars_succeeds", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		address := strings.Repeat("b", 199)
		r, err := Create(ctx, &CreateParams{
			Name:     "Boundary Address Site",
			Address:  address,
			Timezone: "UTC",
		})
		require.NoError(t, err)
		assert.NotEmpty(t, r.ID)
	})

	t.Run("invalid_timezone", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{
			Name:     "Bad TZ Site",
			Timezone: "Invalid/Timezone",
		})
		require.Error(t, err)
	})

	t.Run("various_valid_timezones", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		timezones := []string{
			"UTC",
			"America/New_York",
			"Europe/London",
			"Asia/Tokyo",
		}
		for _, tz := range timezones {
			r, err := Create(ctx, &CreateParams{
				Name:     "Site " + tz,
				Timezone: tz,
			})
			require.NoError(t, err, "timezone %s should be valid", tz)
			assert.NotEmpty(t, r.ID)
		}
	})

	t.Run("multiple_sites_same_user", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		r1, err := Create(ctx, &CreateParams{
			Name:     "Site Alpha",
			Timezone: "UTC",
		})
		require.NoError(t, err)

		r2, err := Create(ctx, &CreateParams{
			Name:     "Site Beta",
			Timezone: "UTC",
		})
		require.NoError(t, err)

		assert.NotEqual(t, r1.ID, r2.ID)

		listResult, err := List(ctx, &ListParams{})
		require.NoError(t, err)
		assert.Len(t, listResult.Items, 2)
	})

	t.Run("sites_isolated_between_users", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		user1 := seedUser(t, tc)
		user2 := seedUser(t, tc)
		ctx1 := auth.WithAccountID(tc.Ctx(), user1)
		ctx2 := auth.WithAccountID(tc.Ctx(), user2)

		_, err := Create(ctx1, &CreateParams{
			Name:     "User1 Site",
			Timezone: "UTC",
		})
		require.NoError(t, err)

		_, err = Create(ctx2, &CreateParams{
			Name:     "User2 Site",
			Timezone: "UTC",
		})
		require.NoError(t, err)

		list1, err := List(ctx1, &ListParams{})
		require.NoError(t, err)
		assert.Len(t, list1.Items, 1)
		assert.Equal(t, "User1 Site", list1.Items[0].Name)

		list2, err := List(ctx2, &ListParams{})
		require.NoError(t, err)
		assert.Len(t, list2.Items, 1)
		assert.Equal(t, "User2 Site", list2.Items[0].Name)
	})

	t.Run("all_params_empty", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Create(ctx, &CreateParams{})
		require.Error(t, err)
	})

	t.Run("site_get_after_create", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		r, err := Create(ctx, &CreateParams{
			Name:     "Get After Create",
			Address:  "789 Pine Rd",
			Timezone: "Asia/Bangkok",
		})
		require.NoError(t, err)

		got, err := Get(ctx, &GetParams{ID: r.ID})
		require.NoError(t, err)
		assert.Equal(t, r.ID, got.ID)
		assert.Equal(t, "Get After Create", got.Name)
		assert.Equal(t, "789 Pine Rd", got.Address)
		assert.Equal(t, "Asia/Bangkok", got.Timezone)
		assert.Equal(t, "THB", got.Currency)
		assert.False(t, got.CreatedAt.IsZero())
	})

	t.Run("unicode_name_and_address", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		r, err := Create(ctx, &CreateParams{
			Name:     "สำนักงานใหญ่",
			Address:  "กรุงเทพมหานคร",
			Timezone: "Asia/Bangkok",
		})
		require.NoError(t, err)

		got, err := Get(ctx, &GetParams{ID: r.ID})
		require.NoError(t, err)
		assert.Equal(t, "สำนักงานใหญ่", got.Name)
		assert.Equal(t, "กรุงเทพมหานคร", got.Address)
	})
}

func TestDelete(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedSiteWithWildcardOwner(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Delete(ctx, &DeleteParams{ID: siteID})
		require.NoError(t, err)

		// Verify deleted_at is set in the database
		var deletedAt *time.Time
		err = pgctx.QueryRow(ctx, `
			select deleted_at
			from sites
			where id = $1
		`, siteID).Scan(
			&deletedAt,
		)
		require.NoError(t, err)
		assert.NotNil(t, deletedAt)
	})

	t.Run("deleted_site_not_in_list", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedSiteWithWildcardOwner(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		// Verify site appears in list before delete
		listBefore, err := List(ctx, &ListParams{})
		require.NoError(t, err)
		require.Len(t, listBefore.Items, 1)
		assert.Equal(t, siteID, listBefore.Items[0].ID)

		_, err = Delete(ctx, &DeleteParams{ID: siteID})
		require.NoError(t, err)

		// Verify site is excluded from list after delete
		listAfter, err := List(ctx, &ListParams{})
		require.NoError(t, err)
		assert.Empty(t, listAfter.Items)
	})

	t.Run("deleted_site_not_in_get", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedSiteWithWildcardOwner(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		// Verify get works before delete
		_, err := Get(ctx, &GetParams{ID: siteID})
		require.NoError(t, err)

		_, err = Delete(ctx, &DeleteParams{ID: siteID})
		require.NoError(t, err)

		// Verify get returns not found after delete
		_, err = Get(ctx, &GetParams{ID: siteID})
		require.Error(t, err)
		assert.Equal(t, ErrNotFound, err)
	})

	t.Run("double_delete_returns_not_found", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedSiteWithWildcardOwner(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Delete(ctx, &DeleteParams{ID: siteID})
		require.NoError(t, err)

		_, err = Delete(ctx, &DeleteParams{ID: siteID})
		require.Error(t, err)
		assert.Equal(t, ErrNotFound, err)
	})

	t.Run("forbidden_for_non_owner", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		_, siteID := seedSiteWithWildcardOwner(t, tc)

		viewerID := seedUser(t, tc)
		_, err := pgctx.Exec(tc.Ctx(), `
			insert into site_members (site_id, user_id, role) values ($1, $2, $3)
		`, siteID, viewerID, "viewer")
		require.NoError(t, err)

		viewerCtx := auth.WithAccountID(tc.Ctx(), viewerID)
		_, err = Delete(viewerCtx, &DeleteParams{ID: siteID})
		require.Error(t, err)
		assert.Equal(t, iam.ErrForbidden, err)
	})

	t.Run("forbidden_for_editor", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		_, siteID := seedSiteWithWildcardOwner(t, tc)

		editorID := seedUser(t, tc)
		_, err := pgctx.Exec(tc.Ctx(), `
			insert into site_members (site_id, user_id, role) values ($1, $2, $3)
		`, siteID, editorID, "editor")
		require.NoError(t, err)

		editorCtx := auth.WithAccountID(tc.Ctx(), editorID)
		_, err = Delete(editorCtx, &DeleteParams{ID: siteID})
		require.Error(t, err)
		assert.Equal(t, iam.ErrForbidden, err)
	})

	t.Run("validation_error_empty_id", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID := seedUser(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := Delete(ctx, &DeleteParams{ID: ""})
		require.Error(t, err)
	})

	t.Run("forbidden_for_non_member", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		_, siteID := seedSiteWithWildcardOwner(t, tc)

		nonMemberID := seedUser(t, tc)
		nonMemberCtx := auth.WithAccountID(tc.Ctx(), nonMemberID)

		_, err := Delete(nonMemberCtx, &DeleteParams{ID: siteID})
		require.Error(t, err)
		assert.Equal(t, iam.ErrForbidden, err)
	})
}

// seedSiteWithWildcardOwner creates a user, a site, and membership with role '*'. Returns userID and siteID.
func seedSiteWithWildcardOwner(t *testing.T, tc *tu.Context) (userID, siteID string) {
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
	`, siteID, "Test Site")
	require.NoError(t, err)

	_, err = pgctx.Exec(ctx, `
		insert into site_members (site_id, user_id, role) values ($1, $2, $3)
	`, siteID, userID, "*")
	require.NoError(t, err)

	return userID, siteID
}

// seedUser creates a standalone user for testing and returns their ID.
func seedUser(t *testing.T, tc *tu.Context) string {
	t.Helper()
	ctx := tc.Ctx()

	userID := xid.New().String()
	_, err := pgctx.Exec(ctx, `
		insert into users (id, email, name) values ($1, $2, $3)
		on conflict (email) do nothing
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
