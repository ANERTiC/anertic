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

type ChangeConfigurationResult struct {
	CommandID string `json:"commandID"`
}

func ChangeConfiguration(ctx context.Context, p *ChangeConfigurationParams) (*ChangeConfigurationResult, error) {
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

	cmdID := xid.New().String()
	_, err = pgctx.Exec(ctx, `
		insert into ev_charger_commands (id, charger_id, action, status, request_payload)
		values ($1, $2, 'ChangeConfiguration', 'pending', $3)
	`, cmdID, p.ID, payload)
	if err != nil {
		return nil, err
	}

	if err := ocpp.SendCommand(ctx, chargePointID, cmdID, "ChangeConfiguration", payload); err != nil {
		return nil, err
	}

	return &ChangeConfigurationResult{CommandID: cmdID}, nil
}
