package charger

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/acoshift/pgsql/pgctx"
	"github.com/moonrhythm/validator"
	"github.com/rs/xid"

	"github.com/anertic/anertic/api/iam"
	"github.com/anertic/anertic/pkg/ocpp"
)

// UnlockConnector

type UnlockConnectorParams struct {
	ID          string `json:"id"`
	ConnectorID int    `json:"connectorId"`
}

func (p *UnlockConnectorParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	v.Must(p.ConnectorID >= 1, "connectorId must be >= 1")
	return v.Error()
}

type UnlockConnectorResult struct {
	CommandID string `json:"commandID"`
}

func UnlockConnector(ctx context.Context, p *UnlockConnectorParams) (*UnlockConnectorResult, error) {
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

	payload, err := json.Marshal(struct {
		ConnectorID int `json:"connectorId"`
	}{
		ConnectorID: p.ConnectorID,
	})
	if err != nil {
		return nil, err
	}

	cmdID := xid.New().String()
	_, err = pgctx.Exec(ctx, `
		insert into ev_charger_commands (id, charger_id, action, status, request_payload)
		values ($1, $2, 'UnlockConnector', 'pending', $3)
	`, cmdID, p.ID, payload)
	if err != nil {
		return nil, err
	}

	if err := ocpp.SendCommand(ctx, chargePointID, cmdID, "UnlockConnector", payload); err != nil {
		return nil, err
	}

	return &UnlockConnectorResult{CommandID: cmdID}, nil
}
