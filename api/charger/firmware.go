package charger

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/acoshift/pgsql/pgctx"
	"github.com/asaskevich/govalidator"
	"github.com/moonrhythm/validator"
	"github.com/rs/xid"

	"github.com/anertic/anertic/api/iam"
	"github.com/anertic/anertic/pkg/ocpp"
)

// UpdateFirmware

type UpdateFirmwareParams struct {
	ID            string     `json:"id"`
	Location      string     `json:"location"`
	RetrieveDate  *time.Time `json:"retrieveDate"`
	Retries       int        `json:"retries"`
	RetryInterval int        `json:"retryInterval"`
}

func (p *UpdateFirmwareParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	v.Must(p.Location != "", "location is required")
	v.Must(govalidator.IsURL(p.Location), "location must be a valid URL")
	return v.Error()
}

type UpdateFirmwareResult struct {
	ID string `json:"id"`
}

func UpdateFirmware(ctx context.Context, p *UpdateFirmwareParams) (*UpdateFirmwareResult, error) {
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
	`, p.ID).Scan(
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

	retrieveDate := time.Now()
	if p.RetrieveDate != nil {
		retrieveDate = *p.RetrieveDate
	}

	recordID := xid.New().String()
	_, err = pgctx.Exec(ctx, `
		insert into ev_firmware_updates (
			id,
			charger_id,
			type,
			location,
			retrieve_date,
			retries,
			retry_interval
		) values ($1, $2, 'firmware', $3, $4, $5, $6)
	`,
		recordID,
		p.ID,
		p.Location,
		retrieveDate,
		p.Retries,
		p.RetryInterval,
	)
	if err != nil {
		return nil, err
	}

	payload, err := json.Marshal(struct {
		Location      string `json:"location"`
		RetrieveDate  string `json:"retrieveDate"`
		Retries       int    `json:"retries"`
		RetryInterval int    `json:"retryInterval"`
	}{
		Location:      p.Location,
		RetrieveDate:  retrieveDate.Format(time.RFC3339),
		Retries:       p.Retries,
		RetryInterval: p.RetryInterval,
	})
	if err != nil {
		return nil, err
	}

	if err := ocpp.SendCommand(ctx, chargePointID, "UpdateFirmware", payload); err != nil {
		return nil, err
	}

	return &UpdateFirmwareResult{ID: recordID}, nil
}

// GetDiagnostics

type GetDiagnosticsParams struct {
	ID            string     `json:"id"`
	Location      string     `json:"location"`
	StartTime     *time.Time `json:"startTime"`
	StopTime      *time.Time `json:"stopTime"`
	Retries       int        `json:"retries"`
	RetryInterval int        `json:"retryInterval"`
}

func (p *GetDiagnosticsParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	v.Must(p.Location != "", "location is required")
	v.Must(govalidator.IsURL(p.Location), "location must be a valid URL")
	return v.Error()
}

type GetDiagnosticsResult struct {
	ID string `json:"id"`
}

func GetDiagnostics(ctx context.Context, p *GetDiagnosticsParams) (*GetDiagnosticsResult, error) {
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
	`, p.ID).Scan(
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

	recordID := xid.New().String()
	_, err = pgctx.Exec(ctx, `
		insert into ev_firmware_updates (
			id,
			charger_id,
			type,
			location,
			start_time,
			stop_time,
			retries,
			retry_interval
		) values ($1, $2, 'diagnostics', $3, $4, $5, $6, $7)
	`,
		recordID,
		p.ID,
		p.Location,
		p.StartTime,
		p.StopTime,
		p.Retries,
		p.RetryInterval,
	)
	if err != nil {
		return nil, err
	}

	type getDiagPayload struct {
		Location      string `json:"location"`
		Retries       int    `json:"retries"`
		RetryInterval int    `json:"retryInterval"`
		StartTime     string `json:"startTime"`
		StopTime      string `json:"stopTime"`
	}
	pl := getDiagPayload{
		Location:      p.Location,
		Retries:       p.Retries,
		RetryInterval: p.RetryInterval,
	}
	if p.StartTime != nil {
		pl.StartTime = p.StartTime.Format(time.RFC3339)
	}
	if p.StopTime != nil {
		pl.StopTime = p.StopTime.Format(time.RFC3339)
	}

	payload, err := json.Marshal(pl)
	if err != nil {
		return nil, err
	}

	if err := ocpp.SendCommand(ctx, chargePointID, "GetDiagnostics", payload); err != nil {
		return nil, err
	}

	return &GetDiagnosticsResult{ID: recordID}, nil
}
