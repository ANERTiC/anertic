package ocpp

import (
	"context"
	"log/slog"
	"sync"
)

// Hub manages OCPP charge point connections and inbound message routing.
// Supports multiple OCPP versions via registered routers.
type Hub struct {
	mu          sync.RWMutex
	connections map[string]*ChargePoint // chargePointID → connection

	routers map[string]Router // ocpp version → router
}

func NewHub() *Hub {
	return &Hub{
		connections: make(map[string]*ChargePoint),
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
