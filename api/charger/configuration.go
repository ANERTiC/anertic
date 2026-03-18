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

// ChangeConfiguration

type ChangeConfigurationParams struct {
	ID    string `json:"id"`
	Key   string `json:"key"`
	Value string `json:"value"`
}

func (p *ChangeConfigurationParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	v.Must(p.Key != "", "key is required")
	v.Must(p.Value != "", "value is required")
	return v.Error()
}

func ChangeConfiguration(ctx context.Context, p *ChangeConfigurationParams) (*struct{}, error) {
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
	`,
		p.ID,
	).Scan(
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
		Key   string `json:"key"`
		Value string `json:"value"`
	}{
		Key:   p.Key,
		Value: p.Value,
	})
	if err != nil {
		return nil, err
	}

	if err := ocpp.SendCommand(ctx, chargePointID, "ChangeConfiguration", payload); err != nil {
		return nil, err
	}

	return new(struct{}), nil
}
