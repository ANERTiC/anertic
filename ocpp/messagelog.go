package ocpp

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/acoshift/pgsql"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/rs/xid"
)

// logMessage inserts an OCPP message into ev_message_log.
// direction: "in" (CP→CS) or "out" (CS→CP)
func logMessage(ctx context.Context, chargePointID, messageID string, messageType int, action, direction string, payload json.RawMessage, errorCode, errorDesc string) {
	id := xid.New().String()
	_, err := pgctx.Exec(ctx, `
		insert into ev_message_log (
			id,
			charger_id,
			charge_point_id,
			message_id,
			message_type,
			action,
			direction,
			payload,
			error_code,
			error_desc
		)
		select
			$1,
			ec.id,
			$2,
			$3,
			$4,
			$5,
			$6,
			$7,
			$8,
			$9
		from ev_chargers ec
		where ec.charge_point_id = $2
	`,
		id,
		chargePointID,
		messageID,
		messageType,
		action,
		direction,
		pgsql.JSON(payload),
		errorCode,
		errorDesc,
	)
	if err != nil {
		slog.ErrorContext(ctx, "failed to log ocpp message",
			"error", err,
			"chargePointID", chargePointID,
			"action", action,
			"direction", direction,
		)
	}
}
