package ocpp

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/coder/websocket"
)

// Handler returns an HTTP handler for OCPP WebSocket connections.
// Chargers connect via ws://<host>/ocpp/{chargePointID}
func Handler(hub *Hub) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		chargePointID := r.PathValue("chargePointID")
		if chargePointID == "" {
			http.Error(w, "missing charge point ID", http.StatusBadRequest)
			return
		}

		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			Subprotocols: []string{"ocpp1.6", "ocpp2.0.1"},
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

		slog.Info("charger connected", "chargePointID", chargePointID, "protocol", version)

		// OCPP message loop
		for {
			_, data, err := conn.Read(r.Context())
			if err != nil {
				slog.Info("charger disconnected", "chargePointID", chargePointID, "error", err)
				return
			}

			go handleOCPPMessage(r.Context(), hub, cp, data)
		}
	})
}

// handleOCPPMessage parses and routes an OCPP JSON message.
// OCPP message format:
//   [2, "messageId", "action", {payload}]    — Call (from charger)
//   [3, "messageId", {payload}]              — CallResult (response to our call)
//   [4, "messageId", "errorCode", "desc", {}] — CallError
func handleOCPPMessage(ctx context.Context, hub *Hub, cp *ChargePoint, data []byte) {
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
		// charger → server
		if len(msg) < 4 {
			return
		}
		var action string
		json.Unmarshal(msg[2], &action)
		handleCall(ctx, hub, cp, msgID, action, msg[3])

	case MessageTypeCallResult:
		// response to our outgoing call
		cp.HandleResponse(msgID, msg[2])

	case MessageTypeCallError:
		// error response to our outgoing call
		cp.HandleResponse(msgID, msg[2])
	}
}

func handleCall(ctx context.Context, hub *Hub, cp *ChargePoint, msgID string, action string, payload json.RawMessage) {
	slog.Debug("ocpp call", "chargePointID", cp.Identity, "action", action)

	switch action {
	case "BootNotification":
		cp.Reply(ctx, msgID, map[string]any{
			"status":      "Accepted",
			"currentTime": "",
			"interval":    60,
		})

	case "Heartbeat":
		cp.Reply(ctx, msgID, map[string]any{
			"currentTime": "",
		})

	case "StatusNotification":
		// TODO: update charger status in DB
		cp.Reply(ctx, msgID, map[string]any{})

	case "MeterValues":
		// TODO: parse meter values, insert into readings via Redis publish
		cp.Reply(ctx, msgID, map[string]any{})

	case "StartTransaction":
		// TODO: create charging session, return transactionId
		cp.Reply(ctx, msgID, map[string]any{
			"transactionId": 1,
			"idTagInfo": map[string]any{
				"status": "Accepted",
			},
		})

	case "StopTransaction":
		// TODO: close charging session
		cp.Reply(ctx, msgID, map[string]any{
			"idTagInfo": map[string]any{
				"status": "Accepted",
			},
		})

	default:
		slog.Warn("unhandled ocpp action", "action", action, "chargePointID", cp.Identity)
		cp.Reply(ctx, msgID, map[string]any{})
	}
}
