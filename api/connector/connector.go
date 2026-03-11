package connector

import (
	"context"
	"time"

	"github.com/acoshift/pgsql"
	"github.com/acoshift/pgsql/pgstmt"
	"github.com/moonrhythm/validator"
)

// List

type ListParams struct {
	ChargerID string `json:"chargerId"`
}

func (p *ListParams) Valid() error {
	v := validator.New()
	v.Must(p.ChargerID != "", "chargerId is required")
	return v.Error()
}

type Item struct {
	ID            string     `json:"id"`
	ChargerID     string     `json:"chargerId"`
	ConnectorID   int        `json:"connectorId"`
	Status        string     `json:"status"`
	ErrorCode     string     `json:"errorCode"`
	ConnectorType string     `json:"connectorType"`
	MaxPowerKW    float64    `json:"maxPowerKw"`
	Info          string     `json:"info"`
	VendorID      string     `json:"vendorId"`
	LastStatusAt  *time.Time `json:"lastStatusAt"`
}

type ListResult struct {
	Items []Item `json:"items"`
}

func List(ctx context.Context, p *ListParams) (*ListResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var items []Item

	err := pgstmt.Select(func(b pgstmt.SelectStatement) {
		b.Columns(
			"id",
			"charger_id",
			"connector_id",
			"status",
			"error_code",
			"connector_type",
			"max_power_kw",
			"info",
			"vendor_id",
			"last_status_at",
		)
		b.From("ev_connectors")
		b.Where(func(c pgstmt.Cond) {
			c.Eq("charger_id", p.ChargerID)
		})
		b.OrderBy("connector_id ASC")
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
		var it Item
		err := scan(
			&it.ID,
			&it.ChargerID,
			&it.ConnectorID,
			&it.Status,
			&it.ErrorCode,
			&it.ConnectorType,
			&it.MaxPowerKW,
			&it.Info,
			&it.VendorID,
			&it.LastStatusAt,
		)
		if err != nil {
			return err
		}
		items = append(items, it)
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &ListResult{Items: items}, nil
}
