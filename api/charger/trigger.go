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

// TriggerMessage

type TriggerMessageParams struct {
	ID               string `json:"id"`
	RequestedMessage string `json:"requestedMessage"`
	ConnectorID      int    `json:"connectorId"`
}

func (p *TriggerMessageParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	v.Must(p.RequestedMessage == "BootNotification" ||
		p.RequestedMessage == "DiagnosticsStatusNotification" ||
		p.RequestedMessage == "FirmwareStatusNotification" ||
		p.RequestedMessage == "Heartbeat" ||
		p.RequestedMessage == "MeterValues" ||
		p.RequestedMessage == "StatusNotification",
		"requestedMessage must be one of: BootNotification, DiagnosticsStatusNotification, FirmwareStatusNotification, Heartbeat, MeterValues, StatusNotification")
	v.Must(p.ConnectorID >= 0, "connectorId must be >= 0")
	return v.Error()
}

type TriggerMessageResult struct{}

func TriggerMessage(ctx context.Context, p *TriggerMessageParams) (*TriggerMessageResult, error) {
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

	// OCPP 1.6 TriggerMessage.req: connectorId is optional per spec.
	// Omit it when 0 so chargers that strictly validate don't reject the request.
	type triggerPayload struct {
		RequestedMessage string `json:"requestedMessage"`
		ConnectorID      *int   `json:"connectorId,omitempty"`
	}
	tp := triggerPayload{RequestedMessage: p.RequestedMessage}
	if p.ConnectorID > 0 {
		tp.ConnectorID = &p.ConnectorID
	}
	payload, err := json.Marshal(tp)
	if err != nil {
		return nil, err
	}

	_, err = pgctx.Exec(ctx, `
		update ev_chargers
		set trigger_message_status = 0,
		    updated_at = now()
		where id = $1
	`, p.ID)
	if err != nil {
		return nil, err
	}

	if err := ocpp.SendCommand(ctx, chargePointID, "TriggerMessage", payload); err != nil {
		return nil, err
	}

	return &TriggerMessageResult{}, nil
}
