package charger

import (
	"context"
	"time"

	"github.com/acoshift/pgsql"
	"github.com/acoshift/pgsql/pgstmt"
	"github.com/moonrhythm/validator"
	"github.com/shopspring/decimal"
)

// ListSessions

type ListSessionsParams struct {
	ChargerID string `json:"chargerId"`
	Status    string `json:"status"`
}

func (p *ListSessionsParams) Valid() error {
	v := validator.New()
	v.Must(p.ChargerID != "", "chargerId is required")
	if p.Status != "" {
		v.Must(p.Status == "Active" || p.Status == "Completed", "status must be Active or Completed")
	}
	return v.Error()
}

type SessionItem struct {
	ID            string          `json:"id"`
	ConnectorID   int             `json:"connectorId"`
	TransactionID int             `json:"transactionId"`
	IDTag         string          `json:"idTag"`
	StartedAt     time.Time       `json:"startedAt"`
	EndedAt       *time.Time      `json:"endedAt"`
	EnergyKWH     decimal.Decimal `json:"energyKwh"`
	MaxPowerKW    decimal.Decimal `json:"maxPowerKw"`
	MeterStart    int             `json:"meterStart"`
	MeterStop     *int            `json:"meterStop"`
	StopReason    *string         `json:"stopReason"`
	Status        string          `json:"status"`
}

type ListSessionsResult struct {
	Items []SessionItem `json:"items"`
}

func ListSessions(ctx context.Context, p *ListSessionsParams) (*ListSessionsResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	items := make([]SessionItem, 0)

	err := pgstmt.Select(func(b pgstmt.SelectStatement) {
		b.Columns(
			"id",
			"connector_id",
			"transaction_id",
			"id_tag",
			"start_time",
			"end_time",
			"energy_kwh",
			"max_power_kw",
			"meter_start",
			"meter_stop",
			"stop_reason",
		)
		b.From("ev_charging_sessions")
		b.Where(func(c pgstmt.Cond) {
			c.Eq("charger_id", p.ChargerID)
			if p.Status == "Active" {
				c.IsNull("end_time")
			}
			if p.Status == "Completed" {
				c.IsNotNull("end_time")
			}
		})
		b.OrderBy("start_time desc")
		b.Limit(50)
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
		var it SessionItem
		err := scan(
			&it.ID,
			&it.ConnectorID,
			&it.TransactionID,
			&it.IDTag,
			&it.StartedAt,
			pgsql.Null(&it.EndedAt),
			&it.EnergyKWH,
			&it.MaxPowerKW,
			&it.MeterStart,
			pgsql.Null(&it.MeterStop),
			pgsql.Null(&it.StopReason),
		)
		if err != nil {
			return err
		}
		if it.EndedAt == nil {
			it.Status = "Active"
		} else {
			it.Status = "Completed"
		}
		items = append(items, it)
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &ListSessionsResult{Items: items}, nil
}
