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

// ClearCache

type ClearCacheParams struct {
	ID string `json:"id"`
}

func (p *ClearCacheParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

func ClearCache(ctx context.Context, p *ClearCacheParams) (*struct{}, error) {
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

	payload, err := json.Marshal(struct{}{})
	if err != nil {
		return nil, err
	}

	if err := ocpp.SendCommand(ctx, chargePointID, "ClearCache", payload); err != nil {
		return nil, err
	}

	return new(struct{}), nil
}
