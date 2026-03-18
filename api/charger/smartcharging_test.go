package charger

import (
	"context"
	"testing"

	"github.com/acoshift/pgsql/pgctx"
	"github.com/rs/xid"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/anertic/anertic/api/auth"
	"github.com/anertic/anertic/api/iam"
	"github.com/anertic/anertic/pkg/tu"
)

func TestSetChargingProfile(t *testing.T) {
	t.Run("success_upserts_profile", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedChargerTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		chargerID := seedCharger(t, ctx, siteID, "CP-SC-001")

		profile := &ChargingProfile{
			ChargingProfileId:      100,
			StackLevel:             0,
			ChargingProfilePurpose: "ChargePointMaxProfile",
			ChargingProfileKind:    "Absolute",
			ChargingSchedule: &ChargingSchedule{
				ChargingRateUnit: "W",
				ChargingSchedulePeriod: []ChargingSchedulePeriod{
					{StartPeriod: 0, Limit: decimal.NewFromInt(11000)},
				},
			},
		}

		r, err := SetChargingProfile(ctx, &SetChargingProfileParams{
			ID:                 chargerID,
			ConnectorId:        0,
			CsChargingProfiles: profile,
		})
		require.NoError(t, err)
		require.NotNil(t, r)
		assert.Equal(t, "Accepted", r.Status)

		// Verify profile record was inserted into ev_charging_profiles
		var count int
		err = pgctx.QueryRow(ctx, `
			select count(*)
			from ev_charging_profiles
			where charger_id = $1
			  and charging_profile_id = $2
		`, chargerID, 100).Scan(&count)
		require.NoError(t, err)
		assert.Equal(t, 1, count)
	})

	t.Run("upsert_updates_existing_profile", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedChargerTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		chargerID := seedCharger(t, ctx, siteID, "CP-SC-002")

		profile := &ChargingProfile{
			ChargingProfileId:      200,
			StackLevel:             0,
			ChargingProfilePurpose: "TxDefaultProfile",
			ChargingProfileKind:    "Recurring",
			RecurrencyKind:         "Daily",
			ChargingSchedule: &ChargingSchedule{
				ChargingRateUnit: "A",
				ChargingSchedulePeriod: []ChargingSchedulePeriod{
					{StartPeriod: 0, Limit: decimal.NewFromInt(16)},
				},
			},
		}

		_, err := SetChargingProfile(ctx, &SetChargingProfileParams{
			ID:                 chargerID,
			ConnectorId:        1,
			CsChargingProfiles: profile,
		})
		require.NoError(t, err)

		// Upsert same profile ID with different stack level
		profile.StackLevel = 5
		_, err = SetChargingProfile(ctx, &SetChargingProfileParams{
			ID:                 chargerID,
			ConnectorId:        1,
			CsChargingProfiles: profile,
		})
		require.NoError(t, err)

		// Should still be only one record
		var count int
		err = pgctx.QueryRow(ctx, `
			select count(*)
			from ev_charging_profiles
			where charger_id = $1
			  and charging_profile_id = $2
		`, chargerID, 200).Scan(&count)
		require.NoError(t, err)
		assert.Equal(t, 1, count)

		// Verify stack_level was updated
		var stackLevel int
		err = pgctx.QueryRow(ctx, `
			select stack_level
			from ev_charging_profiles
			where charger_id = $1
			  and charging_profile_id = $2
		`, chargerID, 200).Scan(&stackLevel)
		require.NoError(t, err)
		assert.Equal(t, 5, stackLevel)
	})

	t.Run("validation_error_missing_id", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, _ := seedChargerTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := SetChargingProfile(ctx, &SetChargingProfileParams{
			CsChargingProfiles: &ChargingProfile{
				ChargingProfilePurpose: "TxDefaultProfile",
				ChargingProfileKind:    "Absolute",
				ChargingSchedule: &ChargingSchedule{
					ChargingRateUnit: "W",
				},
			},
		})
		require.Error(t, err)
	})

	t.Run("validation_error_nil_profile", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, _ := seedChargerTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := SetChargingProfile(ctx, &SetChargingProfileParams{
			ID: xid.New().String(),
		})
		require.Error(t, err)
	})

	t.Run("validation_error_invalid_purpose", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, _ := seedChargerTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := SetChargingProfile(ctx, &SetChargingProfileParams{
			ID: xid.New().String(),
			CsChargingProfiles: &ChargingProfile{
				ChargingProfilePurpose: "InvalidPurpose",
				ChargingProfileKind:    "Absolute",
				ChargingSchedule: &ChargingSchedule{
					ChargingRateUnit: "W",
				},
			},
		})
		require.Error(t, err)
	})

	t.Run("validation_error_invalid_kind", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, _ := seedChargerTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := SetChargingProfile(ctx, &SetChargingProfileParams{
			ID: xid.New().String(),
			CsChargingProfiles: &ChargingProfile{
				ChargingProfilePurpose: "TxDefaultProfile",
				ChargingProfileKind:    "InvalidKind",
				ChargingSchedule: &ChargingSchedule{
					ChargingRateUnit: "W",
				},
			},
		})
		require.Error(t, err)
	})

	t.Run("validation_error_invalid_rate_unit", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, _ := seedChargerTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := SetChargingProfile(ctx, &SetChargingProfileParams{
			ID: xid.New().String(),
			CsChargingProfiles: &ChargingProfile{
				ChargingProfilePurpose: "TxDefaultProfile",
				ChargingProfileKind:    "Absolute",
				ChargingSchedule: &ChargingSchedule{
					ChargingRateUnit: "kW",
				},
			},
		})
		require.Error(t, err)
	})

	t.Run("not_found", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, _ := seedChargerTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := SetChargingProfile(ctx, &SetChargingProfileParams{
			ID: xid.New().String(),
			CsChargingProfiles: &ChargingProfile{
				ChargingProfilePurpose: "TxDefaultProfile",
				ChargingProfileKind:    "Absolute",
				ChargingSchedule: &ChargingSchedule{
					ChargingRateUnit: "W",
				},
			},
		})
		require.Error(t, err)
		assert.Equal(t, ErrNotFound, err)
	})

	t.Run("forbidden_not_site_member", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		_, siteID := seedChargerTestData(t, tc)
		chargerID := seedCharger(t, tc.Ctx(), siteID, "CP-SC-FORBIDDEN")

		otherUserID := seedChargerUser(t, tc)
		otherCtx := auth.WithAccountID(tc.Ctx(), otherUserID)

		_, err := SetChargingProfile(otherCtx, &SetChargingProfileParams{
			ID: chargerID,
			CsChargingProfiles: &ChargingProfile{
				ChargingProfilePurpose: "TxDefaultProfile",
				ChargingProfileKind:    "Absolute",
				ChargingSchedule: &ChargingSchedule{
					ChargingRateUnit: "W",
				},
			},
		})
		require.Error(t, err)
		assert.Equal(t, iam.ErrForbidden, err)
	})
}

func TestClearChargingProfile(t *testing.T) {
	t.Run("success_clears_all_profiles", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedChargerTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		chargerID := seedCharger(t, ctx, siteID, "CP-CLR-001")

		// Seed two profiles
		seedChargingProfile(t, ctx, chargerID, 301, "ChargePointMaxProfile")
		seedChargingProfile(t, ctx, chargerID, 302, "TxDefaultProfile")

		r, err := ClearChargingProfile(ctx, &ClearChargingProfileParams{
			ID: chargerID,
		})
		require.NoError(t, err)
		require.NotNil(t, r)
		assert.Equal(t, "Accepted", r.Status)

		// All profiles should be deleted
		var count int
		err = pgctx.QueryRow(ctx, `
			select count(*)
			from ev_charging_profiles
			where charger_id = $1
		`, chargerID).Scan(&count)
		require.NoError(t, err)
		assert.Equal(t, 0, count)
	})

	t.Run("success_clears_by_profile_id", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedChargerTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		chargerID := seedCharger(t, ctx, siteID, "CP-CLR-002")

		seedChargingProfile(t, ctx, chargerID, 401, "ChargePointMaxProfile")
		seedChargingProfile(t, ctx, chargerID, 402, "TxDefaultProfile")

		profileID := 401
		r, err := ClearChargingProfile(ctx, &ClearChargingProfileParams{
			ID:                chargerID,
			ChargingProfileId: &profileID,
		})
		require.NoError(t, err)
		assert.Equal(t, "Accepted", r.Status)

		// Only profile 401 should be gone
		var count int
		err = pgctx.QueryRow(ctx, `
			select count(*)
			from ev_charging_profiles
			where charger_id = $1
		`, chargerID).Scan(&count)
		require.NoError(t, err)
		assert.Equal(t, 1, count)

		var remainingID int
		err = pgctx.QueryRow(ctx, `
			select charging_profile_id
			from ev_charging_profiles
			where charger_id = $1
		`, chargerID).Scan(&remainingID)
		require.NoError(t, err)
		assert.Equal(t, 402, remainingID)
	})

	t.Run("success_clears_by_purpose", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedChargerTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		chargerID := seedCharger(t, ctx, siteID, "CP-CLR-003")

		seedChargingProfile(t, ctx, chargerID, 501, "ChargePointMaxProfile")
		seedChargingProfile(t, ctx, chargerID, 502, "TxDefaultProfile")

		purpose := "ChargePointMaxProfile"
		_, err := ClearChargingProfile(ctx, &ClearChargingProfileParams{
			ID:                     chargerID,
			ChargingProfilePurpose: &purpose,
		})
		require.NoError(t, err)

		var count int
		err = pgctx.QueryRow(ctx, `
			select count(*)
			from ev_charging_profiles
			where charger_id = $1
		`, chargerID).Scan(&count)
		require.NoError(t, err)
		assert.Equal(t, 1, count)
	})

	t.Run("validation_error_missing_id", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, _ := seedChargerTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := ClearChargingProfile(ctx, &ClearChargingProfileParams{})
		require.Error(t, err)
	})

	t.Run("not_found", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, _ := seedChargerTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := ClearChargingProfile(ctx, &ClearChargingProfileParams{
			ID: xid.New().String(),
		})
		require.Error(t, err)
		assert.Equal(t, ErrNotFound, err)
	})
}

func TestGetCompositeSchedule(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedChargerTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		chargerID := seedCharger(t, ctx, siteID, "CP-GCS-001")

		r, err := GetCompositeSchedule(ctx, &GetCompositeScheduleParams{
			ID:          chargerID,
			ConnectorId: 1,
			Duration:    3600,
		})
		require.NoError(t, err)
		require.NotNil(t, r)
		assert.Equal(t, "Accepted", r.Status)
	})

	t.Run("success_with_charging_rate_unit", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, siteID := seedChargerTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		chargerID := seedCharger(t, ctx, siteID, "CP-GCS-002")

		unit := "W"
		r, err := GetCompositeSchedule(ctx, &GetCompositeScheduleParams{
			ID:               chargerID,
			ConnectorId:      0,
			Duration:         7200,
			ChargingRateUnit: &unit,
		})
		require.NoError(t, err)
		assert.Equal(t, "Accepted", r.Status)
	})

	t.Run("validation_error_missing_id", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, _ := seedChargerTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := GetCompositeSchedule(ctx, &GetCompositeScheduleParams{
			Duration: 3600,
		})
		require.Error(t, err)
	})

	t.Run("validation_error_zero_duration", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, _ := seedChargerTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := GetCompositeSchedule(ctx, &GetCompositeScheduleParams{
			ID:       xid.New().String(),
			Duration: 0,
		})
		require.Error(t, err)
	})

	t.Run("validation_error_negative_duration", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, _ := seedChargerTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := GetCompositeSchedule(ctx, &GetCompositeScheduleParams{
			ID:       xid.New().String(),
			Duration: -1,
		})
		require.Error(t, err)
	})

	t.Run("not_found", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		userID, _ := seedChargerTestData(t, tc)
		ctx := auth.WithAccountID(tc.Ctx(), userID)

		_, err := GetCompositeSchedule(ctx, &GetCompositeScheduleParams{
			ID:       xid.New().String(),
			Duration: 3600,
		})
		require.Error(t, err)
		assert.Equal(t, ErrNotFound, err)
	})

	t.Run("forbidden_not_site_member", func(t *testing.T) {
		t.Parallel()
		tc := tu.Setup()
		defer tc.Teardown()

		_, siteID := seedChargerTestData(t, tc)
		chargerID := seedCharger(t, tc.Ctx(), siteID, "CP-GCS-FORBIDDEN")

		otherUserID := seedChargerUser(t, tc)
		otherCtx := auth.WithAccountID(tc.Ctx(), otherUserID)

		_, err := GetCompositeSchedule(otherCtx, &GetCompositeScheduleParams{
			ID:       chargerID,
			Duration: 3600,
		})
		require.Error(t, err)
		assert.Equal(t, iam.ErrForbidden, err)
	})
}

// seedChargerTestData creates a user, site, and site membership.
func seedChargerTestData(t *testing.T, tc *tu.Context) (userID, siteID string) {
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

// seedChargerUser creates a standalone user not associated with any site.
func seedChargerUser(t *testing.T, tc *tu.Context) string {
	t.Helper()
	ctx := tc.Ctx()

	userID := xid.New().String()
	_, err := pgctx.Exec(ctx, `
		insert into users (id, email, name) values ($1, $2, $3)
	`, userID, userID+"@test.com", "Other User")
	require.NoError(t, err)

	return userID
}

// seedCharger inserts an EV charger record for the given site.
func seedCharger(t *testing.T, ctx context.Context, siteID, chargePointID string) string {
	t.Helper()

	id := xid.New().String()
	_, err := pgctx.Exec(ctx, `
		insert into ev_chargers (
			id,
			site_id,
			charge_point_id,
			ocpp_version,
			connector_count,
			max_power_kw
		) values ($1, $2, $3, '1.6', 1, 22)
	`, id, siteID, chargePointID)
	require.NoError(t, err)

	return id
}

// seedChargingProfile inserts a charging profile record for the given charger.
func seedChargingProfile(t *testing.T, ctx context.Context, chargerID string, profileID int, purpose string) {
	t.Helper()

	_, err := pgctx.Exec(ctx, `
		insert into ev_charging_profiles (
			id,
			charger_id,
			connector_id,
			charging_profile_id,
			stack_level,
			charging_profile_purpose,
			charging_profile_kind,
			schedule
		) values ($1, $2, 0, $3, 0, $4, 'Absolute', '{}')
	`,
		xid.New().String(),
		chargerID,
		profileID,
		purpose,
	)
	require.NoError(t, err)
}
