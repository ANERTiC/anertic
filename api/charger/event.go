package charger

import (
	"context"
	"encoding/json"
	"time"

	"github.com/acoshift/pgsql"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/moonrhythm/validator"
)

// ListEvents returns OCPP messages grouped by message_id,
// pairing each Call with its CallResult/CallError response.

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
	MessageID    string     `json:"messageId"`
	Action       string     `json:"action"`
	Direction    string     `json:"direction"`
	RequestAt    time.Time  `json:"requestAt"`
	ResponseAt   *time.Time `json:"responseAt"`
	DurationMs   *int64     `json:"durationMs"`
	Request      *string    `json:"request"`
	Response     *string    `json:"response"`
	ResponseType *int       `json:"responseType"`
	ErrorCode    *string    `json:"errorCode"`
	ErrorDesc    *string    `json:"errorDesc"`
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
		var reqPayload json.RawMessage
		var respPayload *string
		err := scan(
			&it.MessageID,
			&it.Action,
			&it.Direction,
			&it.RequestAt,
			pgsql.JSON(&reqPayload),
			&it.ResponseAt,
			&respPayload,
			&it.ResponseType,
			&it.ErrorCode,
			&it.ErrorDesc,
		)
		if err != nil {
			return err
		}
		if len(reqPayload) > 0 && string(reqPayload) != "null" {
			s := string(reqPayload)
			it.Request = &s
		}
		it.Response = respPayload
		if it.ResponseAt != nil {
			ms := it.ResponseAt.Sub(it.RequestAt).Milliseconds()
			it.DurationMs = &ms
		}
		items = append(items, it)
		return nil
	}, `
		select
			call.message_id,
			call.action,
			call.direction,
			call.created_at,
			call.payload,
			resp.created_at,
			resp.payload::text,
			resp.message_type,
			resp.error_code,
			resp.error_desc
		from ev_message_log call
		left join ev_message_log resp
			on resp.charger_id = call.charger_id
			and resp.charge_point_id = call.charge_point_id
			and resp.message_id = call.message_id
			and resp.message_type in (3, 4)
		where call.charger_id = $1
			and call.message_type = 2
		order by call.created_at desc
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
