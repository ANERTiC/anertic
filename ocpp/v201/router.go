package v201

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/anertic/anertic/ocpp"
)

// Router implements ocpp.Router for OCPP 2.0.1.
type Router struct{}

// NewRouter returns a new OCPP 2.0.1 router.
func NewRouter() *Router {
	return &Router{}
}

// HandleCall dispatches an inbound OCPP 2.0.1 Call to the appropriate handler.
func (rt *Router) HandleCall(ctx context.Context, cp *ocpp.ChargePoint, msgID string, action string, payload json.RawMessage) {
	slog.DebugContext(ctx, "ocpp 2.0.1 call", "chargePointID", cp.Identity, "action", action)

	switch action {
	// TODO: implement OCPP 2.0.1 handlers
	// case "BootNotification":
	// case "Heartbeat":
	// case "StatusNotification":
	// case "TransactionEvent":
	// case "MeterValues":
	// case "Authorize":

	default:
		slog.WarnContext(ctx, "unhandled ocpp 2.0.1 action", "action", action, "chargePointID", cp.Identity)
		cp.Reply(ctx, msgID, map[string]any{})
	}
}
