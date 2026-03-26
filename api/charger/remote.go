package charger

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/acoshift/pgsql/pgctx"
	"github.com/moonrhythm/validator"

	"github.com/anertic/anertic/api/iam"
	"github.com/anertic/anertic/pkg/ocpp"
)

// RemoteStart

type RemoteStartParams struct {
	ID           string  `json:"id"`
	ConnectorID  int     `json:"connectorId"`
	IdTag        string  `json:"idTag"`
	PowerLimitKw float64 `json:"powerLimitKw"`
}

func (p *RemoteStartParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	v.Must(p.ConnectorID >= 1, "connectorId must be >= 1")
	v.Must(p.IdTag != "", "idTag is required")
	return v.Error()
}

type RemoteStartResult struct{}

func RemoteStart(ctx context.Context, p *RemoteStartParams) (*RemoteStartResult, error) {
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

	type chargingSchedulePeriod struct {
		StartPeriod  int     `json:"startPeriod"`
		Limit        float64 `json:"limit"`
		NumberPhases int     `json:"numberPhases"`
	}
	type chargingSchedule struct {
		ChargingRateUnit          string                    `json:"chargingRateUnit"`
		ChargingSchedulePeriod    []chargingSchedulePeriod  `json:"chargingSchedulePeriod"`
	}
	type chargingProfile struct {
		ChargingProfileId      int              `json:"chargingProfileId"`
		StackLevel             int              `json:"stackLevel"`
		ChargingProfilePurpose string           `json:"chargingProfilePurpose"`
		ChargingProfileKind    string           `json:"chargingProfileKind"`
		ChargingSchedule       chargingSchedule `json:"chargingSchedule"`
	}
	type remoteStartPayload struct {
		ConnectorID     int              `json:"connectorId"`
		IdTag           string           `json:"idTag"`
		ChargingProfile *chargingProfile `json:"chargingProfile,omitempty"`
	}

	rsp := remoteStartPayload{
		ConnectorID: p.ConnectorID,
		IdTag:       p.IdTag,
	}
	if p.PowerLimitKw > 0 {
		rsp.ChargingProfile = &chargingProfile{
			ChargingProfileId:      1,
			StackLevel:             0,
			ChargingProfilePurpose: "TxProfile",
			ChargingProfileKind:    "Relative",
			ChargingSchedule: chargingSchedule{
				ChargingRateUnit: "W",
				ChargingSchedulePeriod: []chargingSchedulePeriod{
					{StartPeriod: 0, Limit: p.PowerLimitKw * 1000, NumberPhases: 3},
				},
			},
		}
	}

	payload, err := json.Marshal(rsp)
	if err != nil {
		return nil, err
	}

	if err := ocpp.SendCommand(ctx, chargePointID, "RemoteStartTransaction", payload); err != nil {
		return nil, err
	}

	return &RemoteStartResult{}, nil
}

// RemoteStop

type RemoteStopParams struct {
	ID            string `json:"id"`
	TransactionID int    `json:"transactionId"`
}

func (p *RemoteStopParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	v.Must(p.TransactionID > 0, "transactionId is required")
	return v.Error()
}

type RemoteStopResult struct{}

func RemoteStop(ctx context.Context, p *RemoteStopParams) (*RemoteStopResult, error) {
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

	type remoteStopPayload struct {
		TransactionID int `json:"transactionId"`
	}
	payload, err := json.Marshal(remoteStopPayload{
		TransactionID: p.TransactionID,
	})
	if err != nil {
		return nil, err
	}

	if err := ocpp.SendCommand(ctx, chargePointID, "RemoteStopTransaction", payload); err != nil {
		return nil, err
	}

	return &RemoteStopResult{}, nil
}
