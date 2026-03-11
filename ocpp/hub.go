package ocpp

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"

	"github.com/anertic/anertic/pkg/wsredis"
)

// Hub manages OCPP charge point connections with wsredis Broker
// for cross-replica command routing. Supports multiple OCPP versions.
type Hub struct {
	mu          sync.RWMutex
	connections map[string]*ChargePoint // chargePointID → connection

	broker wsredis.Broker

	routers map[string]Router // ocpp version → router

	handlers   map[string]chan []byte // requestID → response channel
	handlersMu sync.RWMutex
}

func NewHub(broker wsredis.Broker) *Hub {
	return &Hub{
		connections: make(map[string]*ChargePoint),
		broker:      broker,
		routers:     make(map[string]Router),
		handlers:    make(map[string]chan []byte),
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

// Subscribe listens for commands and responses from other replicas via broker.
func (h *Hub) Subscribe(ctx context.Context) {
	sub := h.broker.Subscribe(ctx)
	defer sub.Close()

	for msg := range sub.Channel() {
		var env envelope
		if err := json.Unmarshal([]byte(msg), &env); err != nil {
			slog.ErrorContext(ctx, "failed to parse ocpp envelope", "error", err)
			continue
		}

		switch env.Type {
		case "cmd":
			var cmd Command
			if err := json.Unmarshal(env.Data, &cmd); err != nil {
				slog.ErrorContext(ctx, "failed to parse ocpp command", "error", err)
				continue
			}

			cp := h.GetLocal(cmd.ChargePointID)
			if cp == nil {
				continue
			}

			go h.executeCommand(ctx, cp, &cmd)

		case "resp":
			var resp CommandResponse
			if err := json.Unmarshal(env.Data, &resp); err != nil {
				slog.ErrorContext(ctx, "failed to parse ocpp response", "error", err)
				continue
			}

			h.handlersMu.RLock()
			respCh, ok := h.handlers[resp.RequestID]
			h.handlersMu.RUnlock()

			if ok {
				respCh <- env.Data
			}
		}
	}
}

// SendCommand sends a command to a charge point.
// If the charger is on this replica, execute directly.
// Otherwise, publish to broker for the correct replica to pick up.
func (h *Hub) SendCommand(ctx context.Context, cmd *Command) (*CommandResponse, error) {
	cp := h.GetLocal(cmd.ChargePointID)
	if cp != nil {
		router := h.RouterFor(cp.OCPPVersion)
		if router == nil {
			return &CommandResponse{
				RequestID: cmd.RequestID,
				Error:     "unsupported ocpp version: " + cp.OCPPVersion,
			}, nil
		}
		return router.ExecuteRemoteCommand(ctx, cp, cmd)
	}

	return h.sendRemoteCommand(ctx, cmd)
}

func (h *Hub) publish(ctx context.Context, typ string, data any) error {
	raw, err := json.Marshal(data)
	if err != nil {
		return err
	}

	env, err := json.Marshal(envelope{
		Type: typ,
		Data: raw,
	})
	if err != nil {
		return err
	}

	return h.broker.Publish(ctx, env)
}

func (h *Hub) sendRemoteCommand(ctx context.Context, cmd *Command) (*CommandResponse, error) {
	respCh := make(chan []byte, 1)
	h.handlersMu.Lock()
	h.handlers[cmd.RequestID] = respCh
	h.handlersMu.Unlock()

	defer func() {
		h.handlersMu.Lock()
		delete(h.handlers, cmd.RequestID)
		h.handlersMu.Unlock()
	}()

	if err := h.publish(ctx, "cmd", cmd); err != nil {
		return nil, err
	}

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case raw := <-respCh:
		var resp CommandResponse
		if err := json.Unmarshal(raw, &resp); err != nil {
			return nil, err
		}
		return &resp, nil
	}
}

func (h *Hub) executeCommand(ctx context.Context, cp *ChargePoint, cmd *Command) {
	router := h.RouterFor(cp.OCPPVersion)
	if router == nil {
		h.publish(ctx, "resp", &CommandResponse{
			RequestID: cmd.RequestID,
			Error:     "unsupported ocpp version: " + cp.OCPPVersion,
		})
		return
	}

	resp, err := router.ExecuteRemoteCommand(ctx, cp, cmd)
	if err != nil {
		resp = &CommandResponse{
			RequestID: cmd.RequestID,
			Error:     err.Error(),
		}
	}

	h.publish(ctx, "resp", resp)
}
