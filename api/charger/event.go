package charger

import (
	"context"
	"encoding/json"
	"time"

	"github.com/acoshift/pgsql"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/moonrhythm/validator"
)

// ListEvents

type ListEventsParams struct {
	ChargerID string `json:"chargerId"`
	Limit     int    `json:"limit"`
}

func (p *ListEventsParams) Valid() error {
	v := validator.New()
	v.Must(p.ChargerID != "", "chargerId is required")
	if p.Limit <= 0 {
		p.Limit = 50
	}
	return v.Error()
}

type EventItem struct {
	ID        string    `json:"id"`
	Action    string    `json:"action"`
	Direction string    `json:"direction"`
	Timestamp time.Time `json:"timestamp"`
	Payload   *string   `json:"payload"`
}

type ListEventsResult struct {
	Items []EventItem `json:"items"`
}

func ListEvents(ctx context.Context, p *ListEventsParams) (*ListEventsResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	items := make([]EventItem, 0)

	err := pgctx.Iter(ctx, func(scan pgsql.Scanner) error {
		var it EventItem
		var rawPayload json.RawMessage
		err := scan(
			&it.ID,
			&it.Action,
			&it.Direction,
			&it.Timestamp,
			pgsql.JSON(&rawPayload),
		)
		if err != nil {
			return err
		}
		if len(rawPayload) > 0 {
			s := string(rawPayload)
			if s != "null" {
				it.Payload = &s
			}
		}
		items = append(items, it)
		return nil
	}, `
		select
			id,
			action,
			direction,
			created_at,
			payload
		from ev_message_log
		where charger_id = $1
		order by created_at desc
		limit $2
	`,
		p.ChargerID,
		p.Limit,
	)
	if err != nil {
		return nil, err
	}

	return &ListEventsResult{Items: items}, nil
}
