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
	ID          string `json:"id"`
	ConnectorID int    `json:"connectorId"`
	IdTag       string `json:"idTag"`
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

	type remoteStartPayload struct {
		ConnectorID int    `json:"connectorId"`
		IdTag       string `json:"idTag"`
	}
	payload, err := json.Marshal(remoteStartPayload{
		ConnectorID: p.ConnectorID,
		IdTag:       p.IdTag,
	})
	if err != nil {
		return nil, err
	}

	if err := ocpp.SendCommand(ctx, chargePointID, "RemoteStartTransaction", payload); err != nil {
		return nil, err
	}

	return &RemoteStartResult{}, nil
}
