package ocppv16

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/coder/websocket"

	"github.com/anertic/anertic/ocppv16/authorize"
	"github.com/anertic/anertic/ocppv16/boot"
	"github.com/anertic/anertic/ocppv16/chargepoint"
	"github.com/anertic/anertic/ocppv16/datatransfer"
	"github.com/anertic/anertic/ocppv16/diagnostics"
	"github.com/anertic/anertic/ocppv16/firmware"
	"github.com/anertic/anertic/ocppv16/heartbeat"
	"github.com/anertic/anertic/ocppv16/meter"
	"github.com/anertic/anertic/ocppv16/status"
	"github.com/anertic/anertic/ocppv16/transaction"
)

// Handler returns an HTTP handler for OCPP 1.6 WebSocket connections.
// Chargers connect via ws://<host>/ocpp/{chargePointID}
func Handler(hub *Hub) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		chargePointID := r.PathValue("chargePointID")
		if chargePointID == "" {
			http.Error(w, "missing charge point ID", http.StatusBadRequest)
			return
		}

		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			Subprotocols: []string{"ocpp1.6"},
		})
		if err != nil {
			slog.Error("ocpp ws accept error", "error", err, "chargePointID", chargePointID)
			return
		}
		defer conn.CloseNow()

		version := conn.Subprotocol()
		if version == "" {
			version = "ocpp1.6"
		}

		cp := NewChargePoint(chargePointID, conn, version)
		hub.Register(cp)
		defer hub.Unregister(chargePointID)

		ctx := chargepoint.NewContext(r.Context(), chargePointID)

		slog.Info("charger connected", "chargePointID", chargePointID, "protocol", version)

		for {
			_, data, err := conn.Read(ctx)
			if err != nil {
				slog.Info("charger disconnected", "chargePointID", chargePointID, "error", err)
				return
			}

			go handleOCPPMessage(ctx, cp, data)
		}
	})
}

// handleOCPPMessage parses and routes an OCPP JSON message.
func handleOCPPMessage(ctx context.Context, cp *ChargePoint, data []byte) {
	var msg []json.RawMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		slog.Error("invalid ocpp message", "error", err, "chargePointID", cp.Identity)
		return
	}

	if len(msg) < 3 {
		slog.Error("ocpp message too short", "chargePointID", cp.Identity)
		return
	}

	var msgType int
	json.Unmarshal(msg[0], &msgType)

	var msgID string
	json.Unmarshal(msg[1], &msgID)

	switch msgType {
	case MessageTypeCall:
		if len(msg) < 4 {
			return
		}
		var action string
		json.Unmarshal(msg[2], &action)
		handleCall(ctx, cp, msgID, action, msg[3])

	case MessageTypeCallResult:
		cp.HandleResponse(msgID, msg[2])

	case MessageTypeCallError:
		cp.HandleResponse(msgID, msg[2])
	}
}

// handleCall routes inbound OCPP 1.6 CALL messages to the appropriate handler.
func handleCall(ctx context.Context, cp *ChargePoint, msgID string, action string, payload json.RawMessage) {
	slog.Debug("ocpp call", "chargePointID", cp.Identity, "action", action)

	switch action {
	// Core Profile
	case "Authorize":
		callAction(ctx, cp, msgID, payload, authorize.Authorize)

	case "BootNotification":
		callAction(ctx, cp, msgID, payload, boot.BootNotification)

	case "DataTransfer":
		callAction(ctx, cp, msgID, payload, datatransfer.DataTransfer)

	case "Heartbeat":
		callAction(ctx, cp, msgID, payload, heartbeat.Heartbeat)

	case "MeterValues":
		callAction(ctx, cp, msgID, payload, meter.MeterValues)

	case "StartTransaction":
		callAction(ctx, cp, msgID, payload, transaction.Start)

	case "StatusNotification":
		callAction(ctx, cp, msgID, payload, status.StatusNotification)

	case "StopTransaction":
		callAction(ctx, cp, msgID, payload, transaction.Stop)

	// Firmware Management Profile
	case "DiagnosticsStatusNotification":
		callAction(ctx, cp, msgID, payload, diagnostics.StatusNotification)

	case "FirmwareStatusNotification":
		callAction(ctx, cp, msgID, payload, firmware.StatusNotification)

	default:
		slog.Warn("unhandled ocpp action", "action", action, "chargePointID", cp.Identity)
		cp.Reply(ctx, msgID, map[string]any{})
	}
}

func callAction[P any, R any](ctx context.Context, cp *ChargePoint, msgID string, payload json.RawMessage, fn func(context.Context, *P) (*R, error)) {
	var p P
	if err := json.Unmarshal(payload, &p); err != nil {
		slog.Error("invalid payload", "error", err, "chargePointID", cp.Identity)
		cp.Reply(ctx, msgID, map[string]any{})
		return
	}

	result, err := fn(ctx, &p)
	if err != nil {
		slog.Error("action error", "error", err, "chargePointID", cp.Identity)
		cp.Reply(ctx, msgID, map[string]any{})
		return
	}

	cp.Reply(ctx, msgID, result)
}
