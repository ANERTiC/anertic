package charger

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strconv"

	"github.com/acoshift/pgsql/pgctx"
	"github.com/moonrhythm/validator"
	"github.com/rs/xid"
	"github.com/shopspring/decimal"

	"github.com/anertic/anertic/api/iam"
	"github.com/anertic/anertic/pkg/ocpp"
)

// SetChargingProfile

type ChargingSchedulePeriod struct {
	StartPeriod  int             `json:"startPeriod"`
	Limit        decimal.Decimal `json:"limit"`
	NumberPhases *int            `json:"numberPhases"`
}

type ChargingSchedule struct {
	Duration               *int                     `json:"duration"`
	StartSchedule          string                   `json:"startSchedule"`
	ChargingRateUnit       string                   `json:"chargingRateUnit"`
	ChargingSchedulePeriod []ChargingSchedulePeriod `json:"chargingSchedulePeriod"`
	MinChargingRate        *decimal.Decimal          `json:"minChargingRate"`
}

type ChargingProfile struct {
	ChargingProfileId      int               `json:"chargingProfileId"`
	StackLevel             int               `json:"stackLevel"`
	ChargingProfilePurpose string            `json:"chargingProfilePurpose"`
	ChargingProfileKind    string            `json:"chargingProfileKind"`
	RecurrencyKind         string            `json:"recurrencyKind"`
	ValidFrom              string            `json:"validFrom"`
	ValidTo                string            `json:"validTo"`
	TransactionId          *int              `json:"transactionId"`
	ChargingSchedule       *ChargingSchedule `json:"chargingSchedule"`
}

type SetChargingProfileParams struct {
	ID                 string           `json:"id"`
	ConnectorId        int              `json:"connectorId"`
	CsChargingProfiles *ChargingProfile `json:"csChargingProfiles"`
}

func (p *SetChargingProfileParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	v.Must(p.CsChargingProfiles != nil, "csChargingProfiles is required")
	if p.CsChargingProfiles != nil {
		purpose := p.CsChargingProfiles.ChargingProfilePurpose
		v.Must(
			purpose == "ChargePointMaxProfile" || purpose == "TxDefaultProfile" || purpose == "TxProfile",
			"chargingProfilePurpose must be ChargePointMaxProfile, TxDefaultProfile, or TxProfile",
		)
		kind := p.CsChargingProfiles.ChargingProfileKind
		v.Must(
			kind == "Absolute" || kind == "Recurring" || kind == "Relative",
			"chargingProfileKind must be Absolute, Recurring, or Relative",
		)
		v.Must(p.CsChargingProfiles.ChargingSchedule != nil, "chargingSchedule is required")
		if p.CsChargingProfiles.ChargingSchedule != nil {
			unit := p.CsChargingProfiles.ChargingSchedule.ChargingRateUnit
			v.Must(unit == "W" || unit == "A", "chargingRateUnit must be W or A")
		}
	}
	return v.Error()
}

type SetChargingProfileResult struct {
	Status string `json:"status"`
}

func SetChargingProfile(ctx context.Context, p *SetChargingProfileParams) (*SetChargingProfileResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var chargePointID, siteID string
	err := pgctx.QueryRow(ctx, `
		select
			charge_point_id,
			site_id
		from ev_chargers
		where id = $1
	`, p.ID).Scan(
		&chargePointID,
		&siteID,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, siteID); err != nil {
		return nil, err
	}

	scheduleJSON, err := json.Marshal(p.CsChargingProfiles.ChargingSchedule)
	if err != nil {
		return nil, err
	}

	profileID := xid.New().String()
	_, err = pgctx.Exec(ctx, `
		insert into ev_charging_profiles (
			id,
			charger_id,
			connector_id,
			charging_profile_id,
			stack_level,
			charging_profile_purpose,
			charging_profile_kind,
			recurrency_kind,
			valid_from,
			valid_to,
			transaction_id,
			schedule
		) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		on conflict (charger_id, charging_profile_id) do update set
			connector_id = excluded.connector_id,
			stack_level = excluded.stack_level,
			charging_profile_purpose = excluded.charging_profile_purpose,
			charging_profile_kind = excluded.charging_profile_kind,
			recurrency_kind = excluded.recurrency_kind,
			valid_from = excluded.valid_from,
			valid_to = excluded.valid_to,
			transaction_id = excluded.transaction_id,
			schedule = excluded.schedule,
			updated_at = now()
	`,
		profileID,
		p.ID,
		p.ConnectorId,
		p.CsChargingProfiles.ChargingProfileId,
		p.CsChargingProfiles.StackLevel,
		p.CsChargingProfiles.ChargingProfilePurpose,
		p.CsChargingProfiles.ChargingProfileKind,
		p.CsChargingProfiles.RecurrencyKind,
		nullableString(p.CsChargingProfiles.ValidFrom),
		nullableString(p.CsChargingProfiles.ValidTo),
		p.CsChargingProfiles.TransactionId,
		scheduleJSON,
	)
	if err != nil {
		return nil, err
	}

	_, err = pgctx.Exec(ctx, `
		update ev_chargers
		set set_charging_profile_status = 0,
		    updated_at = now()
		where id = $1
	`, p.ID)
	if err != nil {
		return nil, err
	}

	payload, err := json.Marshal(struct {
		ConnectorId        int              `json:"connectorId"`
		CsChargingProfiles *ChargingProfile `json:"csChargingProfiles"`
	}{
		ConnectorId:        p.ConnectorId,
		CsChargingProfiles: p.CsChargingProfiles,
	})
	if err != nil {
		return nil, err
	}

	if err := ocpp.SendCommand(ctx, chargePointID, "SetChargingProfile", payload); err != nil {
		return nil, err
	}

	return &SetChargingProfileResult{Status: "Accepted"}, nil
}

// ClearChargingProfile

type ClearChargingProfileParams struct {
	ID                     string  `json:"id"`
	ChargingProfileId      *int    `json:"chargingProfileId"`
	ConnectorId            *int    `json:"connectorId"`
	ChargingProfilePurpose *string `json:"chargingProfilePurpose"`
	StackLevel             *int    `json:"stackLevel"`
}

func (p *ClearChargingProfileParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

type ClearChargingProfileResult struct {
	Status string `json:"status"`
}

func ClearChargingProfile(ctx context.Context, p *ClearChargingProfileParams) (*ClearChargingProfileResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var chargePointID, siteID string
	err := pgctx.QueryRow(ctx, `
		select
			charge_point_id,
			site_id
		from ev_chargers
		where id = $1
	`, p.ID).Scan(
		&chargePointID,
		&siteID,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, siteID); err != nil {
		return nil, err
	}

	// Build dynamic delete query based on provided filters
	query := `delete from ev_charging_profiles where charger_id = $1`
	args := []any{p.ID}
	idx := 2

	if p.ChargingProfileId != nil {
		query += ` and charging_profile_id = $` + strconv.Itoa(idx)
		args = append(args, *p.ChargingProfileId)
		idx++
	}
	if p.ConnectorId != nil {
		query += ` and connector_id = $` + strconv.Itoa(idx)
		args = append(args, *p.ConnectorId)
		idx++
	}
	if p.ChargingProfilePurpose != nil {
		query += ` and charging_profile_purpose = $` + strconv.Itoa(idx)
		args = append(args, *p.ChargingProfilePurpose)
		idx++
	}
	if p.StackLevel != nil {
		query += ` and stack_level = $` + strconv.Itoa(idx)
		args = append(args, *p.StackLevel)
		idx++
	}
	_ = idx

	_, err = pgctx.Exec(ctx, query, args...)
	if err != nil {
		return nil, err
	}

	_, err = pgctx.Exec(ctx, `
		update ev_chargers
		set clear_charging_profile_status = 0,
		    updated_at = now()
		where id = $1
	`, p.ID)
	if err != nil {
		return nil, err
	}

	type clearPayload struct {
		ChargingProfileId      *int    `json:"chargingProfileId"`
		ConnectorId            *int    `json:"connectorId"`
		ChargingProfilePurpose *string `json:"chargingProfilePurpose"`
		StackLevel             *int    `json:"stackLevel"`
	}
	payload, err := json.Marshal(clearPayload{
		ChargingProfileId:      p.ChargingProfileId,
		ConnectorId:            p.ConnectorId,
		ChargingProfilePurpose: p.ChargingProfilePurpose,
		StackLevel:             p.StackLevel,
	})
	if err != nil {
		return nil, err
	}

	if err := ocpp.SendCommand(ctx, chargePointID, "ClearChargingProfile", payload); err != nil {
		return nil, err
	}

	return &ClearChargingProfileResult{Status: "Accepted"}, nil
}

// GetCompositeSchedule

type GetCompositeScheduleParams struct {
	ID               string  `json:"id"`
	ConnectorId      int     `json:"connectorId"`
	Duration         int     `json:"duration"`
	ChargingRateUnit *string `json:"chargingRateUnit"`
}

func (p *GetCompositeScheduleParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	v.Must(p.Duration > 0, "duration must be > 0")
	return v.Error()
}

type GetCompositeScheduleResult struct {
	Status string `json:"status"`
}

func GetCompositeSchedule(ctx context.Context, p *GetCompositeScheduleParams) (*GetCompositeScheduleResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var chargePointID, siteID string
	err := pgctx.QueryRow(ctx, `
		select
			charge_point_id,
			site_id
		from ev_chargers
		where id = $1
	`, p.ID).Scan(
		&chargePointID,
		&siteID,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, siteID); err != nil {
		return nil, err
	}

	_, err = pgctx.Exec(ctx, `
		update ev_chargers
		set get_composite_schedule_status = 0,
		    updated_at = now()
		where id = $1
	`, p.ID)
	if err != nil {
		return nil, err
	}

	type compositePayload struct {
		ConnectorId      int     `json:"connectorId"`
		Duration         int     `json:"duration"`
		ChargingRateUnit *string `json:"chargingRateUnit"`
	}
	payload, err := json.Marshal(compositePayload{
		ConnectorId:      p.ConnectorId,
		Duration:         p.Duration,
		ChargingRateUnit: p.ChargingRateUnit,
	})
	if err != nil {
		return nil, err
	}

	if err := ocpp.SendCommand(ctx, chargePointID, "GetCompositeSchedule", payload); err != nil {
		return nil, err
	}

	return &GetCompositeScheduleResult{Status: "Accepted"}, nil
}

// nullableString returns nil if s is empty, otherwise returns a pointer to s.
// Used for optional string fields stored as nullable in the database.
func nullableString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
