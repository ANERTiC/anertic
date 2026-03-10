package core

import (
	"context"
	"time"

	"github.com/acoshift/pgsql/pgctx"
)

// UpsertConnectorStatus inserts or updates a connector's status.
// chargePointID is the OCPP identity, connectorID is the OCPP connector number.
func UpsertConnectorStatus(ctx context.Context, chargePointID string, connectorID int, status, errorCode, info string, ts time.Time) error {
	_, err := pgctx.Exec(ctx, `
		insert into ev_connectors (id, ev_charger_id, connector_id, status, error_code, info, last_status_at)
		select
			substr(md5(ec.id || '-' || $2::text), 1, 20),
			ec.id,
			$2,
			$3,
			$4,
			$5,
			$6
		from ev_chargers ec
		where ec.charge_point_id = $1
		on conflict (ev_charger_id, connector_id)
		do update set
			status         = excluded.status,
			error_code     = excluded.error_code,
			info           = excluded.info,
			last_status_at = excluded.last_status_at,
			updated_at     = now()
	`, chargePointID, connectorID, status, errorCode, info, ts)
	return err
}

// UpdateChargerStatus updates the ev_chargers.status field.
// connectorID 0 means the charge point itself.
func UpdateChargerStatus(ctx context.Context, chargePointID string, status string) error {
	_, err := pgctx.Exec(ctx, `
		update ev_chargers
		set status = $2, updated_at = now()
		where charge_point_id = $1
	`, chargePointID, status)
	return err
}
