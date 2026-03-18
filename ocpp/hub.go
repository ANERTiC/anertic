package ocpp

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"

	"github.com/acoshift/pgsql/pgctx"
	"github.com/redis/go-redis/v9"
)

// Hub manages OCPP charge point connections and inbound message routing.
// Each charge point subscribes to its own Redis pub/sub channel for external commands.
type Hub struct {
	mu          sync.RWMutex
	connections map[string]*ChargePoint // chargePointID → connection

	rdb redis.UniversalClient

	routers map[string]Router // ocpp version → router
}

func NewHub(rdb redis.UniversalClient) *Hub {
	return &Hub{
		connections: make(map[string]*ChargePoint),
		rdb:         rdb,
		routers:     make(map[string]Router),
	}
}

// RegisterRouter registers a version-specific router.
func (h *Hub) RegisterRouter(version string, router Router) {
	h.routers[version] = router
}

// RouterFor returns the router for the given OCPP version.
func (h *Hub) RouterFor(version string) Router {
	return h.routers[version]
}

// Register adds a charge point connection to this replica.
func (h *Hub) Register(ctx context.Context, cp *ChargePoint) {
	h.mu.Lock()
	h.connections[cp.Identity] = cp
	h.mu.Unlock()

	slog.InfoContext(ctx, "charger registered", "chargePointID", cp.Identity)
}

// Unregister removes a charge point connection from this replica.
func (h *Hub) Unregister(ctx context.Context, chargePointID string) {
	h.mu.Lock()
	delete(h.connections, chargePointID)
	h.mu.Unlock()

	slog.InfoContext(ctx, "charger unregistered", "chargePointID", chargePointID)
}

// GetLocal returns a locally connected charge point, or nil.
func (h *Hub) GetLocal(chargePointID string) *ChargePoint {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.connections[chargePointID]
}

// ListLocal returns all locally connected charge point IDs.
func (h *Hub) ListLocal() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()

	ids := make([]string, 0, len(h.connections))
	for id := range h.connections {
		ids = append(ids, id)
	}
	return ids
}

// handleCommandResponse processes the charger's response to a CSMS-initiated command
// and persists relevant data back to the database.
func (h *Hub) handleCommandResponse(ctx context.Context, chargePointID string, commandID string, action string, requestPayload json.RawMessage, responsePayload json.RawMessage) {
	// Determine success/failure from the response status field.
	status := "success"
	var resp struct {
		Status string `json:"status"`
	}
	if err := json.Unmarshal(responsePayload, &resp); err == nil {
		switch resp.Status {
		case "Failed", "Rejected", "UnlockFailed", "NotSupported", "VersionMismatch":
			status = "failed"
		}
	}

	// Persist response back to the command record (best-effort; log on error).
	if commandID != "" {
		_, err := pgctx.Exec(ctx, `
			update ev_charger_commands
			set status = $2,
			    response_payload = $3,
			    updated_at = now()
			where id = $1
		`, commandID, status, responsePayload)
		if err != nil {
			slog.ErrorContext(ctx, "failed to update command status", "error", err, "commandID", commandID, "action", action)
		}
	}

	switch action {
	case "GetLocalListVersion":
		var resp struct {
			ListVersion int `json:"listVersion"`
		}
		if err := json.Unmarshal(responsePayload, &resp); err != nil {
			slog.ErrorContext(ctx, "failed to parse GetLocalListVersion response", "error", err, "chargePointID", chargePointID)
			return
		}
		_, err := pgctx.Exec(ctx, `
			update ev_chargers
			set local_list_version = $2,
			    updated_at = now()
			where charge_point_id = $1
		`, chargePointID, resp.ListVersion)
		if err != nil {
			slog.ErrorContext(ctx, "failed to update local_list_version", "error", err, "chargePointID", chargePointID)
			return
		}
		slog.InfoContext(ctx, "updated local_list_version from charger", "chargePointID", chargePointID, "listVersion", resp.ListVersion)

	case "UnlockConnector":
		var resp struct {
			Status string `json:"status"`
		}
		if err := json.Unmarshal(responsePayload, &resp); err != nil {
			slog.ErrorContext(ctx, "failed to parse UnlockConnector response", "error", err, "chargePointID", chargePointID)
			return
		}
		slog.InfoContext(ctx, "UnlockConnector response", "chargePointID", chargePointID, "status", resp.Status)

	case "ChangeAvailability":
		var resp struct {
			Status string `json:"status"`
		}
		if err := json.Unmarshal(responsePayload, &resp); err != nil {
			slog.ErrorContext(ctx, "failed to parse ChangeAvailability response", "error", err, "chargePointID", chargePointID)
			return
		}
		slog.InfoContext(ctx, "ChangeAvailability response", "chargePointID", chargePointID, "status", resp.Status)

	case "ClearCache":
		var resp struct {
			Status string `json:"status"`
		}
		if err := json.Unmarshal(responsePayload, &resp); err != nil {
			slog.ErrorContext(ctx, "failed to parse ClearCache response", "error", err, "chargePointID", chargePointID)
			return
		}
		slog.InfoContext(ctx, "ClearCache response", "chargePointID", chargePointID, "status", resp.Status)

	case "ChangeConfiguration":
		var resp struct {
			Status string `json:"status"`
		}
		if err := json.Unmarshal(responsePayload, &resp); err != nil {
			slog.ErrorContext(ctx, "failed to parse ChangeConfiguration response", "error", err, "chargePointID", chargePointID)
			return
		}
		if resp.Status == "RebootRequired" {
			slog.WarnContext(ctx, "ChangeConfiguration requires reboot", "chargePointID", chargePointID, "status", resp.Status)
			return
		}
		slog.InfoContext(ctx, "ChangeConfiguration response", "chargePointID", chargePointID, "status", resp.Status)

	case "SendLocalList":
		var resp struct {
			Status string `json:"status"`
		}
		if err := json.Unmarshal(responsePayload, &resp); err != nil {
			slog.ErrorContext(ctx, "failed to parse SendLocalList response", "error", err, "chargePointID", chargePointID)
			return
		}
		if resp.Status != "Accepted" {
			slog.WarnContext(ctx, "SendLocalList not accepted by charger", "chargePointID", chargePointID, "status", resp.Status)
			return
		}
		var req struct {
			ListVersion int `json:"listVersion"`
		}
		if err := json.Unmarshal(requestPayload, &req); err != nil {
			slog.ErrorContext(ctx, "failed to parse SendLocalList request payload", "error", err, "chargePointID", chargePointID)
			return
		}
		_, err := pgctx.Exec(ctx, `
			update ev_chargers
			set local_list_version = $2,
			    updated_at = now()
			where charge_point_id = $1
		`, chargePointID, req.ListVersion)
		if err != nil {
			slog.ErrorContext(ctx, "failed to update local_list_version after SendLocalList", "error", err, "chargePointID", chargePointID)
			return
		}
		slog.InfoContext(ctx, "updated local_list_version after SendLocalList accepted", "chargePointID", chargePointID, "listVersion", req.ListVersion)
	}
}

// command is a message received from Redis pub/sub to execute on a charge point.
type command struct {
	ID      string          `json:"id"`
	Action  string          `json:"action"`
	Payload json.RawMessage `json:"payload"`
}

// SubscribeChargePoint subscribes to the Redis channel for a specific charge point
// and forwards incoming commands to the charger via ChargePoint.Call.
// Blocks until ctx is cancelled.
func (h *Hub) SubscribeChargePoint(ctx context.Context, cp *ChargePoint) {
	channel := "ocpp:cp:" + cp.Identity
	sub := h.rdb.Subscribe(ctx, channel)
	defer sub.Close()

	slog.InfoContext(ctx, "subscribed to chargepoint channel", "chargePointID", cp.Identity, "channel", channel)

	for msg := range sub.Channel() {
		var cmd command
		if err := json.Unmarshal([]byte(msg.Payload), &cmd); err != nil {
			slog.ErrorContext(ctx, "invalid command on chargepoint channel", "error", err, "chargePointID", cp.Identity)
			continue
		}

		go func() {
			raw, err := cp.Call(ctx, cmd.Action, cmd.Payload)
			if err != nil {
				slog.ErrorContext(ctx, "command failed", "error", err, "chargePointID", cp.Identity, "action", cmd.Action)
				return
			}
			slog.InfoContext(ctx, "command executed", "chargePointID", cp.Identity, "action", cmd.Action, "response", string(raw))

			h.handleCommandResponse(ctx, cp.Identity, cmd.ID, cmd.Action, cmd.Payload, raw)
		}()
	}
}
