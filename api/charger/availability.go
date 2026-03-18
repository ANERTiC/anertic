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

// ChangeAvailability

type ChangeAvailabilityParams struct {
	ID          string `json:"id"`
	ConnectorID int    `json:"connectorId"`
	Type        string `json:"type"`
}

func (p *ChangeAvailabilityParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	v.Must(p.Type == "Operative" || p.Type == "Inoperative", "type must be Operative or Inoperative")
	return v.Error()
}

type ChangeAvailabilityResult struct{}

func ChangeAvailability(ctx context.Context, p *ChangeAvailabilityParams) (*ChangeAvailabilityResult, error) {
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
		ConnectorID int    `json:"connectorId"`
		Type        string `json:"type"`
	}{
		ConnectorID: p.ConnectorID,
		Type:        p.Type,
	})
	if err != nil {
		return nil, err
	}

	_, err = pgctx.Exec(ctx, `
		update ev_chargers
		set change_availability_status = 0,
		    updated_at = now()
		where id = $1
	`, p.ID)
	if err != nil {
		return nil, err
	}

	if err := ocpp.SendCommand(ctx, chargePointID, "ChangeAvailability", payload); err != nil {
		return nil, err
	}

	return &ChangeAvailabilityResult{}, nil
}
