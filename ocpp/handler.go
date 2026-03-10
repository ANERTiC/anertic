package ocpp

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"
)

// statusNotificationPayload matches OCPP 1.6 StatusNotification.req
type statusNotificationPayload struct {
	ConnectorID int    `json:"connectorId"`
	ErrorCode   string `json:"errorCode"`
	Status      string `json:"status"`
	Info        string `json:"info"`
	Timestamp   string `json:"timestamp"`
}

func handleStatusNotification(ctx context.Context, hub *Hub, cp *ChargePoint, msgID string, payload json.RawMessage) {
	var p statusNotificationPayload
	if err := json.Unmarshal(payload, &p); err != nil {
		slog.Error("invalid StatusNotification payload", "error", err, "chargePointID", cp.Identity)
		cp.Reply(ctx, msgID, map[string]any{})
		return
	}

	ts := time.Now()
	if p.Timestamp != "" {
		if parsed, err := time.Parse(time.RFC3339, p.Timestamp); err == nil {
			ts = parsed
		}
	}

	// connectorId 0 = charge point itself, update ev_chargers.status
	if p.ConnectorID == 0 {
		if err := UpdateChargerStatus(ctx, cp.Identity, p.Status); err != nil {
			slog.Error("failed to update charger status", "error", err, "chargePointID", cp.Identity)
		}
	} else {
		if err := UpsertConnectorStatus(ctx, cp.Identity, p.ConnectorID, p.Status, p.ErrorCode, p.Info, ts); err != nil {
			slog.Error("failed to upsert connector status", "error", err, "chargePointID", cp.Identity, "connectorID", p.ConnectorID)
		}
	}

	cp.Reply(ctx, msgID, map[string]any{})
}
