package ocpp

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"

	"github.com/redis/go-redis/v9"
)

// Hub manages OCPP charge point connections with Redis PubSub
// for cross-replica command routing.
//
// Pattern:
//   API replica A receives RemoteStart request
//   → publishes to Redis "ocpp:cmd:{chargePointID}"
//   → OCPP replica B (holds the WS connection) picks it up
//   → forwards to charger, gets response
//   → publishes response to Redis "ocpp:resp:{requestID}"
//   → API replica A receives response
type Hub struct {
	mu          sync.RWMutex
	connections map[string]*ChargePoint // chargePointID → connection
	redis       *redis.Client
	handlers    map[string]chan []byte // requestID → response channel
	handlersMu  sync.RWMutex
}

func NewHub(rdb *redis.Client) *Hub {
	return &Hub{
		connections: make(map[string]*ChargePoint),
		redis:       rdb,
		handlers:    make(map[string]chan []byte),
	}
}

// Register adds a charge point connection to this replica.
func (h *Hub) Register(cp *ChargePoint) {
	h.mu.Lock()
	h.connections[cp.Identity] = cp
	h.mu.Unlock()

	// announce presence in Redis so other replicas know where this charger lives
	h.redis.Set(context.Background(), "ocpp:location:"+cp.Identity, "", 0)

	slog.Info("charger registered", "chargePointID", cp.Identity)
}

// Unregister removes a charge point connection from this replica.
func (h *Hub) Unregister(chargePointID string) {
	h.mu.Lock()
	delete(h.connections, chargePointID)
	h.mu.Unlock()

	h.redis.Del(context.Background(), "ocpp:location:"+chargePointID)

	slog.Info("charger unregistered", "chargePointID", chargePointID)
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

// SubscribeCommands listens for commands from other replicas via Redis PubSub.
// Each replica subscribes to "ocpp:cmd:*" and handles commands for its local connections.
func (h *Hub) SubscribeCommands(ctx context.Context) {
	sub := h.redis.PSubscribe(ctx, "ocpp:cmd:*")
	defer sub.Close()

	ch := sub.Channel()
	for msg := range ch {
		var cmd Command
		if err := json.Unmarshal([]byte(msg.Payload), &cmd); err != nil {
			slog.Error("failed to parse ocpp command", "error", err)
			continue
		}

		cp := h.GetLocal(cmd.ChargePointID)
		if cp == nil {
			// not our charger, ignore
			continue
		}

		go h.executeCommand(ctx, cp, &cmd)
	}
}

// SubscribeResponses listens for command responses from other replicas.
func (h *Hub) SubscribeResponses(ctx context.Context) {
	sub := h.redis.PSubscribe(ctx, "ocpp:resp:*")
	defer sub.Close()

	ch := sub.Channel()
	for msg := range ch {
		var resp CommandResponse
		if err := json.Unmarshal([]byte(msg.Payload), &resp); err != nil {
			slog.Error("failed to parse ocpp response", "error", err)
			continue
		}

		h.handlersMu.RLock()
		respCh, ok := h.handlers[resp.RequestID]
		h.handlersMu.RUnlock()

		if ok {
			respCh <- []byte(msg.Payload)
		}
	}
}

// SendCommand sends a command to a charge point.
// If the charger is on this replica, execute directly.
// Otherwise, publish to Redis for the correct replica to pick up.
func (h *Hub) SendCommand(ctx context.Context, cmd *Command) (*CommandResponse, error) {
	// try local first
	cp := h.GetLocal(cmd.ChargePointID)
	if cp != nil {
		return h.executeCommandDirect(ctx, cp, cmd)
	}

	// publish to Redis for remote execution
	return h.sendRemoteCommand(ctx, cmd)
}

func (h *Hub) sendRemoteCommand(ctx context.Context, cmd *Command) (*CommandResponse, error) {
	// register response channel
	respCh := make(chan []byte, 1)
	h.handlersMu.Lock()
	h.handlers[cmd.RequestID] = respCh
	h.handlersMu.Unlock()

	defer func() {
		h.handlersMu.Lock()
		delete(h.handlers, cmd.RequestID)
		h.handlersMu.Unlock()
	}()

	// publish command
	data, err := json.Marshal(cmd)
	if err != nil {
		return nil, err
	}

	if err := h.redis.Publish(ctx, "ocpp:cmd:"+cmd.ChargePointID, data).Err(); err != nil {
		return nil, err
	}

	// wait for response
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
	resp, err := h.executeCommandDirect(ctx, cp, cmd)
	if err != nil {
		resp = &CommandResponse{
			RequestID: cmd.RequestID,
			Error:     err.Error(),
		}
	}

	data, _ := json.Marshal(resp)
	h.redis.Publish(ctx, "ocpp:resp:"+cmd.RequestID, data)
}

func (h *Hub) executeCommandDirect(ctx context.Context, cp *ChargePoint, cmd *Command) (*CommandResponse, error) {
	switch cmd.Action {
	case ActionRemoteStart:
		return cp.RemoteStartTransaction(ctx, cmd)
	case ActionRemoteStop:
		return cp.RemoteStopTransaction(ctx, cmd)
	case ActionReset:
		return cp.Reset(ctx, cmd)
	case ActionGetConfiguration:
		return cp.GetConfiguration(ctx, cmd)
	default:
		return &CommandResponse{
			RequestID: cmd.RequestID,
			Error:     "unsupported action: " + cmd.Action,
		}, nil
	}
}
