package v16

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/anertic/anertic/ocpp"
	"github.com/anertic/anertic/ocpp/v16/authorize"
	"github.com/anertic/anertic/ocpp/v16/boot"
	"github.com/anertic/anertic/ocpp/v16/datatransfer"
	"github.com/anertic/anertic/ocpp/v16/diagnostics"
	"github.com/anertic/anertic/ocpp/v16/firmware"
	"github.com/anertic/anertic/ocpp/v16/heartbeat"
	"github.com/anertic/anertic/ocpp/v16/meter"
	"github.com/anertic/anertic/ocpp/v16/status"
	"github.com/anertic/anertic/ocpp/v16/transaction"
)

// Router implements ocpp.Router for OCPP 1.6.
type Router struct{}

// NewRouter returns a new OCPP 1.6 router.
func NewRouter() *Router {
	return &Router{}
}

// HandleCall dispatches an inbound OCPP 1.6 Call to the appropriate handler.
func (rt *Router) HandleCall(ctx context.Context, cp *ocpp.ChargePoint, msgID string, action string, payload json.RawMessage) {
	slog.DebugContext(ctx, "ocpp 1.6 call", "chargePointID", cp.Identity, "action", action)

	switch action {
	// Core Profile
	case "Authorize":
		ocpp.CallAction(ctx, cp, msgID, payload, authorize.Authorize)

	case "BootNotification":
		ocpp.CallAction(ctx, cp, msgID, payload, boot.BootNotification)

	case "DataTransfer":
		ocpp.CallAction(ctx, cp, msgID, payload, datatransfer.DataTransfer)

	case "Heartbeat":
		ocpp.CallAction(ctx, cp, msgID, payload, heartbeat.Heartbeat)

	case "MeterValues":
		ocpp.CallAction(ctx, cp, msgID, payload, meter.MeterValues)

	case "StartTransaction":
		ocpp.CallAction(ctx, cp, msgID, payload, transaction.Start)

	case "StatusNotification":
		ocpp.CallAction(ctx, cp, msgID, payload, status.StatusNotification)

	case "StopTransaction":
		ocpp.CallAction(ctx, cp, msgID, payload, transaction.Stop)

	// Firmware Management Profile
	case "DiagnosticsStatusNotification":
		ocpp.CallAction(ctx, cp, msgID, payload, diagnostics.StatusNotification)

	case "FirmwareStatusNotification":
		ocpp.CallAction(ctx, cp, msgID, payload, firmware.StatusNotification)

	default:
		slog.WarnContext(ctx, "unhandled ocpp 1.6 action", "action", action, "chargePointID", cp.Identity)
		cp.Reply(ctx, msgID, map[string]any{})
	}
}
