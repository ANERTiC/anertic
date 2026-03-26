package status

import (
	"context"
	"time"

	"github.com/acoshift/pgsql/pgctx"

	"github.com/anertic/anertic/ocpp"
)

// Params matches OCPP 1.6 StatusNotification.req
type Params struct {
	ConnectorID     int    `json:"connectorId"`
	ErrorCode       string `json:"errorCode"`
	Status          string `json:"status"`
	Info            string `json:"info"`
	Timestamp       string `json:"timestamp"`
	VendorID        string `json:"vendorId"`
	VendorErrorCode string `json:"vendorErrorCode"`
}

// Result matches OCPP 1.6 StatusNotification.conf
type Result struct{}

func StatusNotification(ctx context.Context, p *Params) (*Result, error) {
	chargePointID := ocpp.ChargePointID(ctx)

	ts := time.Now()
	if p.Timestamp != "" {
		if parsed, err := time.Parse(time.RFC3339, p.Timestamp); err == nil {
			ts = parsed
		}
	}

	// connectorId 0 = charge point itself, update ev_chargers.status
	if p.ConnectorID == 0 {
		if err := updateChargerStatus(ctx, chargePointID, p.Status); err != nil {
			return nil, err
		}
	} else {
		if err := upsertConnectorStatus(ctx, chargePointID, p.ConnectorID, p.Status, p.ErrorCode, p.Info, ts); err != nil {
			return nil, err
		}
	}

	return &Result{}, nil
}

func upsertConnectorStatus(ctx context.Context, chargePointID string, connectorID int, status, errorCode, info string, ts time.Time) error {
	_, err := pgctx.Exec(ctx, `
		insert into ev_connectors (id, charger_id, connector_id, status, error_code, info, last_status_at)
		select
			substr(md5(ec.id || '-' || $2::text), 1, 20),
			ec.id,
			$2::int,
			$3,
			$4,
			$5,
			$6
		from ev_chargers ec
		where ec.charge_point_id = $1
		on conflict (charger_id, connector_id)
		do update set
			status         = excluded.status,
			error_code     = excluded.error_code,
			info           = excluded.info,
			last_status_at = excluded.last_status_at,
			updated_at     = now()
	`, chargePointID, connectorID, status, errorCode, info, ts)
	return err
}

func updateChargerStatus(ctx context.Context, chargePointID string, status string) error {
	_, err := pgctx.Exec(ctx, `
		update ev_chargers
		set status = $2, updated_at = now()
		where charge_point_id = $1
	`, chargePointID, status)
	return err
}
