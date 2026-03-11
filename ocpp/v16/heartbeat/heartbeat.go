package heartbeat

import (
	"context"
	"time"

	"github.com/anertic/anertic/ocpp"
)

// Params matches OCPP 1.6 Heartbeat.req (empty)
type Params struct{}

// Result matches OCPP 1.6 Heartbeat.conf
type Result struct {
	CurrentTime string `json:"currentTime"`
}

func Heartbeat(ctx context.Context, p *Params) (*Result, error) {
	_ = ocpp.ChargePointID(ctx)

	// TODO: update ev_chargers.last_heartbeat_at

	return &Result{
		CurrentTime: time.Now().UTC().Format(time.RFC3339),
	}, nil
}
