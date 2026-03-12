package ocpp

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"

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

// command is a message received from Redis pub/sub to execute on a charge point.
type command struct {
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
		}()
	}
}
