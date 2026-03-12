package heartbeat

import (
	"context"
	"time"

	"github.com/acoshift/pgsql/pgctx"

	"github.com/anertic/anertic/ocpp"
)

// Params matches OCPP 1.6 Heartbeat.req (empty)
type Params struct{}

// Result matches OCPP 1.6 Heartbeat.conf
type Result struct {
	CurrentTime string `json:"currentTime"`
}

func Heartbeat(ctx context.Context, p *Params) (*Result, error) {
	chargePointID := ocpp.ChargePointID(ctx)

	_, err := pgctx.Exec(ctx, `
		update ev_chargers
		set last_heartbeat_at = now(),
		    updated_at = now()
		where charge_point_id = $1
	`, chargePointID)
	if err != nil {
		return nil, err
	}

	return &Result{
		CurrentTime: time.Now().UTC().Format(time.RFC3339),
	}, nil
}
