package charger

import (
	"context"
	"time"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/pgsql"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/acoshift/pgsql/pgstmt"
	"github.com/moonrhythm/validator"
	"github.com/rs/xid"

	"github.com/anertic/anertic/api/iam"
)

var (
	ErrNotFound = arpc.NewErrorCode("charger/not-found", "charger not found")
)

// List

type ListParams struct {
	SiteID string `json:"siteId"`
}

func (p *ListParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	return v.Error()
}

type Item struct {
	ID                 string     `json:"id"`
	SiteID             string     `json:"siteId"`
	ChargePointID      string     `json:"chargePointId"`
	OcppVersion        string     `json:"ocppVersion"`
	Status             string     `json:"status"`
	RegistrationStatus string     `json:"registrationStatus"`
	ConnectorCount     int        `json:"connectorCount"`
	MaxPowerKW         float64    `json:"maxPowerKw"`
	Vendor             string     `json:"vendor"`
	Model              string     `json:"model"`
	SerialNumber       string     `json:"serialNumber"`
	FirmwareVersion    string     `json:"firmwareVersion"`
	LastHeartbeatAt    *time.Time `json:"lastHeartbeatAt"`
	CreatedAt          time.Time  `json:"createdAt"`
}

type ListResult struct {
	Items []Item `json:"items"`
}

func List(ctx context.Context, p *ListParams) (*ListResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	var items []Item

	err := pgstmt.Select(func(b pgstmt.SelectStatement) {
		b.Columns(
			"id",
			"site_id",
			"charge_point_id",
			"ocpp_version",
			"status",
			"registration_status",
			"connector_count",
			"max_power_kw",
			"vendor",
			"model",
			"serial_number",
			"firmware_version",
			"last_heartbeat_at",
			"created_at",
		)
		b.From("ev_chargers")
		b.Where(func(c pgstmt.Cond) {
			c.Eq("site_id", p.SiteID)
		})
		b.OrderBy("created_at DESC")
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
		var it Item
		err := scan(
			&it.ID,
			&it.SiteID,
			&it.ChargePointID,
			&it.OcppVersion,
			&it.Status,
			&it.RegistrationStatus,
			&it.ConnectorCount,
			&it.MaxPowerKW,
			&it.Vendor,
			&it.Model,
			&it.SerialNumber,
			&it.FirmwareVersion,
			&it.LastHeartbeatAt,
			&it.CreatedAt,
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

// Create

type CreateParams struct {
	SiteID         string  `json:"siteId"`
	ChargePointID  string  `json:"chargePointId"`
	OcppVersion    string  `json:"ocppVersion"`
	ConnectorCount int     `json:"connectorCount"`
	MaxPowerKW     float64 `json:"maxPowerKw"`
}

func (p *CreateParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	v.Must(p.ChargePointID != "", "chargePointId is required")
	return v.Error()
}

type CreateResult struct {
	ID string `json:"id"`
}

func Create(ctx context.Context, p *CreateParams) (*CreateResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	ocppVersion := p.OcppVersion
	if ocppVersion == "" {
		ocppVersion = "1.6"
	}
	connectorCount := p.ConnectorCount
	if connectorCount <= 0 {
		connectorCount = 1
	}

	id := xid.New().String()
	_, err := pgctx.Exec(ctx, `
		insert into ev_chargers (
			id,
			site_id,
			charge_point_id,
			ocpp_version,
			connector_count,
			max_power_kw
		) values ($1, $2, $3, $4, $5, $6)
	`,
		id,
		p.SiteID,
		p.ChargePointID,
		ocppVersion,
		connectorCount,
		p.MaxPowerKW,
	)
	if err != nil {
		return nil, err
	}

	return &CreateResult{ID: id}, nil
}

// Get

type GetParams struct {
	ID string `json:"id"`
}

func (p *GetParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

type GetResult struct {
	Item
	ChargeBoxSerialNumber string `json:"chargeBoxSerialNumber"`
	FirmwareStatus        string `json:"firmwareStatus"`
	DiagnosticsStatus     string `json:"diagnosticsStatus"`
	HeartbeatInterval     int    `json:"heartbeatInterval"`
}

func Get(ctx context.Context, p *GetParams) (*GetResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var r GetResult
	err := pgctx.QueryRow(ctx, `
		select
			id,
			site_id,
			charge_point_id,
			ocpp_version,
			status,
			registration_status,
			connector_count,
			max_power_kw,
			vendor,
			model,
			serial_number,
			firmware_version,
			last_heartbeat_at,
			created_at,
			charge_box_serial_number,
			firmware_status,
			diagnostics_status,
			heartbeat_interval
		from ev_chargers
		where id = $1
	`, p.ID).Scan(
		&r.ID,
		&r.SiteID,
		&r.ChargePointID,
		&r.OcppVersion,
		&r.Status,
		&r.RegistrationStatus,
		&r.ConnectorCount,
		&r.MaxPowerKW,
		&r.Vendor,
		&r.Model,
		&r.SerialNumber,
		&r.FirmwareVersion,
		&r.LastHeartbeatAt,
		&r.CreatedAt,
		&r.ChargeBoxSerialNumber,
		&r.FirmwareStatus,
		&r.DiagnosticsStatus,
		&r.HeartbeatInterval,
	)
	if err != nil {
		return nil, ErrNotFound
	}

	return &r, nil
}

// Update

type UpdateParams struct {
	ID             string   `json:"id"`
	ConnectorCount *int     `json:"connectorCount"`
	MaxPowerKW     *float64 `json:"maxPowerKw"`
}

func (p *UpdateParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

func Update(ctx context.Context, p *UpdateParams) (*struct{}, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	_, err := pgstmt.Update(func(b pgstmt.UpdateStatement) {
		b.Table("ev_chargers")
		if p.ConnectorCount != nil {
			b.Set("connector_count").To(*p.ConnectorCount)
		}
		if p.MaxPowerKW != nil {
			b.Set("max_power_kw").To(*p.MaxPowerKW)
		}
		b.Set("updated_at").ToRaw("now()")
		b.Where(func(c pgstmt.Cond) {
			c.Eq("id", p.ID)
		})
	}).ExecWith(ctx)
	if err != nil {
		return nil, err
	}

	return new(struct{}), nil
}

// Delete

type DeleteParams struct {
	ID string `json:"id"`
}

func (p *DeleteParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

func Delete(ctx context.Context, p *DeleteParams) (*struct{}, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	_, err := pgctx.Exec(ctx, `
		delete from ev_chargers
		where id = $1
	`, p.ID)
	if err != nil {
		return nil, err
	}

	return new(struct{}), nil
}
