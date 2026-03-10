package ocpp

import (
	"context"
	"encoding/json"
	"fmt"
	"sync"
	"sync/atomic"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
)

// OCPP message types
const (
	MessageTypeCall       = 2
	MessageTypeCallResult = 3
	MessageTypeCallError  = 4
)

// ChargePoint represents a connected OCPP charge point.
type ChargePoint struct {
	Identity    string
	Conn        *websocket.Conn
	OCPPVersion string

	mu       sync.Mutex
	msgID    atomic.Int64
	pending  map[string]chan json.RawMessage // messageID → response channel
	pendMu   sync.Mutex
}

func NewChargePoint(identity string, conn *websocket.Conn, version string) *ChargePoint {
	return &ChargePoint{
		Identity:    identity,
		Conn:        conn,
		OCPPVersion: version,
		pending:     make(map[string]chan json.RawMessage),
	}
}

// Call sends an OCPP Call message and waits for response.
// OCPP Call format: [2, "messageId", "action", {payload}]
func (cp *ChargePoint) Call(ctx context.Context, action string, payload any) (json.RawMessage, error) {
	msgID := fmt.Sprintf("%d", cp.msgID.Add(1))

	respCh := make(chan json.RawMessage, 1)
	cp.pendMu.Lock()
	cp.pending[msgID] = respCh
	cp.pendMu.Unlock()

	defer func() {
		cp.pendMu.Lock()
		delete(cp.pending, msgID)
		cp.pendMu.Unlock()
	}()

	msg := []any{MessageTypeCall, msgID, action, payload}

	cp.mu.Lock()
	err := wsjson.Write(ctx, cp.Conn, msg)
	cp.mu.Unlock()
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()

	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case resp := <-respCh:
		return resp, nil
	}
}

// HandleResponse routes an incoming CallResult/CallError to the waiting caller.
func (cp *ChargePoint) HandleResponse(msgID string, payload json.RawMessage) {
	cp.pendMu.Lock()
	ch, ok := cp.pending[msgID]
	cp.pendMu.Unlock()

	if ok {
		ch <- payload
	}
}

// Reply sends a CallResult response to the charge point.
// OCPP CallResult format: [3, "messageId", {payload}]
func (cp *ChargePoint) Reply(ctx context.Context, msgID string, payload any) error {
	msg := []any{MessageTypeCallResult, msgID, payload}

	cp.mu.Lock()
	defer cp.mu.Unlock()
	return wsjson.Write(ctx, cp.Conn, msg)
}

// RemoteStartTransaction sends RemoteStartTransaction to the charger.
func (cp *ChargePoint) RemoteStartTransaction(ctx context.Context, cmd *Command) (*CommandResponse, error) {
	idTag, _ := cmd.Payload["idTag"].(string)
	if idTag == "" {
		idTag = "default"
	}

	raw, err := cp.Call(ctx, "RemoteStartTransaction", map[string]any{
		"idTag": idTag,
	})
	if err != nil {
		return nil, err
	}

	var result map[string]any
	json.Unmarshal(raw, &result)

	status, _ := result["status"].(string)
	return &CommandResponse{
		RequestID: cmd.RequestID,
		Status:    status,
		Payload:   result,
	}, nil
}

// RemoteStopTransaction sends RemoteStopTransaction to the charger.
func (cp *ChargePoint) RemoteStopTransaction(ctx context.Context, cmd *Command) (*CommandResponse, error) {
	txID, _ := cmd.Payload["transactionId"].(float64)

	raw, err := cp.Call(ctx, "RemoteStopTransaction", map[string]any{
		"transactionId": int(txID),
	})
	if err != nil {
		return nil, err
	}

	var result map[string]any
	json.Unmarshal(raw, &result)

	status, _ := result["status"].(string)
	return &CommandResponse{
		RequestID: cmd.RequestID,
		Status:    status,
		Payload:   result,
	}, nil
}

// Reset sends a Reset command to the charger.
func (cp *ChargePoint) Reset(ctx context.Context, cmd *Command) (*CommandResponse, error) {
	resetType, _ := cmd.Payload["type"].(string)
	if resetType == "" {
		resetType = "Soft"
	}

	raw, err := cp.Call(ctx, "Reset", map[string]any{
		"type": resetType,
	})
	if err != nil {
		return nil, err
	}

	var result map[string]any
	json.Unmarshal(raw, &result)

	status, _ := result["status"].(string)
	return &CommandResponse{
		RequestID: cmd.RequestID,
		Status:    status,
		Payload:   result,
	}, nil
}

// GetConfiguration retrieves configuration from the charger.
func (cp *ChargePoint) GetConfiguration(ctx context.Context, cmd *Command) (*CommandResponse, error) {
	raw, err := cp.Call(ctx, "GetConfiguration", map[string]any{})
	if err != nil {
		return nil, err
	}

	var result map[string]any
	json.Unmarshal(raw, &result)

	return &CommandResponse{
		RequestID: cmd.RequestID,
		Status:    "Accepted",
		Payload:   result,
	}, nil
}
