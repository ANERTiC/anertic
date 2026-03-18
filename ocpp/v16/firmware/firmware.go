package firmware

import (
	"context"
	"log/slog"

	"github.com/acoshift/pgsql/pgctx"

	"github.com/anertic/anertic/ocpp"
)

// StatusParams matches OCPP 1.6 FirmwareStatusNotification.req
type StatusParams struct {
	Status string `json:"status"` // Downloaded, DownloadFailed, Downloading, Idle, InstallationFailed, Installing, Installed
}

// StatusResult matches OCPP 1.6 FirmwareStatusNotification.conf
type StatusResult struct{}

func StatusNotification(ctx context.Context, p *StatusParams) (*StatusResult, error) {
	chargePointID := ocpp.ChargePointID(ctx)

	_, err := pgctx.Exec(ctx, `
		update ev_chargers
		set firmware_status = $1,
		    updated_at = now()
		where charge_point_id = $2
	`,
		p.Status,
		chargePointID,
	)
	if err != nil {
		slog.ErrorContext(ctx, "failed to update firmware status",
			"error", err,
			"chargePointID", chargePointID,
		)
	}

	return &StatusResult{}, nil
}
