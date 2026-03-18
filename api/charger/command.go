package charger

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/acoshift/pgsql/pgctx"
	"github.com/moonrhythm/validator"

	"github.com/anertic/anertic/api/iam"
)

// GetCommand

type GetCommandParams struct {
	ID string `json:"id"`
}

func (p *GetCommandParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

type GetCommandResult struct {
	ID              string          `json:"id"`
	ChargerID       string          `json:"chargerID"`
	Action          string          `json:"action"`
	Status          string          `json:"status"`
	RequestPayload  json.RawMessage `json:"requestPayload"`
	ResponsePayload json.RawMessage `json:"responsePayload"`
	CreatedAt       time.Time       `json:"createdAt"`
	UpdatedAt       time.Time       `json:"updatedAt"`
}

func GetCommand(ctx context.Context, p *GetCommandParams) (*GetCommandResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var r GetCommandResult
	var siteID string
	var responsePayload sql.NullString
	err := pgctx.QueryRow(ctx, `
		select
			c.id,
			c.charger_id,
			c.action,
			c.status,
			c.request_payload,
			c.response_payload,
			c.created_at,
			c.updated_at,
			ec.site_id
		from ev_charger_commands c
		join ev_chargers ec on ec.id = c.charger_id
		where c.id = $1
	`, p.ID).Scan(
		&r.ID,
		&r.ChargerID,
		&r.Action,
		&r.Status,
		&r.RequestPayload,
		&responsePayload,
		&r.CreatedAt,
		&r.UpdatedAt,
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

	if responsePayload.Valid {
		r.ResponsePayload = json.RawMessage(responsePayload.String)
	}

	return &r, nil
}
