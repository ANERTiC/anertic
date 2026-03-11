package ocpp

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/coder/websocket"
)

// Handler returns an HTTP handler for OCPP WebSocket connections.
// Detects OCPP version via WebSocket subprotocol negotiation.
func Handler(hub *Hub) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		chargePointID := r.PathValue("chargePointID")
		if chargePointID == "" {
			http.Error(w, "missing charge point ID", http.StatusBadRequest)
			return
		}

		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			Subprotocols: []string{"ocpp2.0.1", "ocpp1.6"},
		})
		if err != nil {
			slog.ErrorContext(r.Context(), "ocpp ws accept error", "error", err, "chargePointID", chargePointID)
			return
		}
		defer conn.CloseNow()

		version := conn.Subprotocol()
		if version == "" {
			version = "ocpp1.6"
		}

		router := hub.RouterFor(version)
		if router == nil {
			slog.ErrorContext(r.Context(), "unsupported ocpp version", "version", version, "chargePointID", chargePointID)
			conn.Close(websocket.StatusProtocolError, "unsupported ocpp version")
			return
		}

		ctx := NewContext(r.Context(), chargePointID)

		cp := NewChargePoint(chargePointID, conn, version)
		hub.Register(ctx, cp)
		defer hub.Unregister(ctx, chargePointID)

		// subscribe to per-chargepoint Redis channel for external commands
		subCtx, subCancel := context.WithCancel(ctx)
		defer subCancel()
		go hub.SubscribeChargePoint(subCtx, cp)

		slog.InfoContext(ctx, "charger connected", "chargePointID", chargePointID, "protocol", version)

		for {
			_, data, err := conn.Read(ctx)
			if err != nil {
				slog.InfoContext(ctx, "charger disconnected", "chargePointID", chargePointID, "error", err)
				return
			}

			go handleOCPPMessage(ctx, cp, router, data)
		}
	})
}

// handleOCPPMessage parses an inbound OCPP JSON array message [msgType, msgID, ...],
// then routes it: Call → version-specific Router, CallResult/CallError → pending response channel.
func handleOCPPMessage(ctx context.Context, cp *ChargePoint, router Router, data []byte) {
	var msg []json.RawMessage
	if err := json.Unmarshal(data, &msg); err != nil {
		slog.ErrorContext(ctx, "invalid ocpp message", "error", err, "chargePointID", cp.Identity)
		return
	}

	if len(msg) < 3 {
		slog.ErrorContext(ctx, "ocpp message too short", "chargePointID", cp.Identity)
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
		router.HandleCall(ctx, cp, msgID, action, msg[3])

	case MessageTypeCallResult:
		cp.HandleResponse(msgID, msg[2])

	case MessageTypeCallError:
		cp.HandleResponse(msgID, msg[2])
	}
}

// CallAction is a generic helper for unmarshaling a payload, calling a handler, and replying.
func CallAction[P any, R any](ctx context.Context, cp *ChargePoint, msgID string, payload json.RawMessage, fn func(context.Context, *P) (*R, error)) {
	var p P
	if err := json.Unmarshal(payload, &p); err != nil {
		slog.ErrorContext(ctx, "invalid payload", "error", err, "chargePointID", cp.Identity)
		cp.Reply(ctx, msgID, map[string]any{})
		return
	}

	result, err := fn(ctx, &p)
	if err != nil {
		slog.ErrorContext(ctx, "action error", "error", err, "chargePointID", cp.Identity)
		cp.Reply(ctx, msgID, map[string]any{})
		return
	}

	cp.Reply(ctx, msgID, result)
}
