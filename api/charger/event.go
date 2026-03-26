package charger

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"github.com/acoshift/pgsql"
	"github.com/acoshift/pgsql/pgstmt"
	"github.com/moonrhythm/validator"
)

// ListEvents returns OCPP messages grouped by message_id,
// pairing each Call with its CallResult/CallError response.

type ListEventsParams struct {
	ChargerID string `json:"chargerId"`
	Search    string `json:"search"`
	Direction string `json:"direction"`
	Limit     int    `json:"limit"`
}

func (p *ListEventsParams) Valid() error {
	v := validator.New()
	v.Must(p.ChargerID != "", "chargerId is required")
	if p.Limit <= 0 {
		p.Limit = 50
	}
	p.Search = strings.TrimSpace(p.Search)
	p.Direction = strings.TrimSpace(p.Direction)
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

	err := pgstmt.Select(func(b pgstmt.SelectStatement) {
		b.Columns(
			"call.message_id",
			"call.action",
			"call.direction",
			"call.created_at",
			"call.payload",
			pgstmt.Raw("resp.created_at"),
			pgstmt.Raw("resp.payload::text"),
			pgstmt.Raw("resp.message_type"),
			pgstmt.Raw("resp.error_code"),
			pgstmt.Raw("resp.error_desc"),
		)
		b.From("ev_message_log call")
		b.LeftJoin("ev_message_log resp").On(func(c pgstmt.Cond) {
			c.EqRaw("resp.charger_id", "call.charger_id")
			c.EqRaw("resp.charge_point_id", "call.charge_point_id")
			c.EqRaw("resp.message_id", "call.message_id")
			c.Raw("resp.message_type in (3, 4)")
		})
		b.Where(func(c pgstmt.Cond) {
			c.Mode().And()
			c.Eq("call.charger_id", p.ChargerID)
			c.Eq("call.message_type", 2)
			if p.Search != "" {
				search := "%" + p.Search + "%"
				c.And(func(b pgstmt.Cond) {
					b.Mode().Or()
					b.ILike("call.action", search)
					b.ILike("call.payload::text", search)
				})
			}
			if p.Direction != "" {
				c.Eq("call.direction", p.Direction)
			}
		})
		b.OrderBy("call.created_at DESC")
		b.Limit(int64(p.Limit))
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
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
	})
	if err != nil {
		return nil, err
	}

	return &ListEventsResult{Items: items}, nil
}
