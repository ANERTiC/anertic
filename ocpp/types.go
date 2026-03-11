package ocpp

import "encoding/json"

// OCPP message types (same across 1.6 and 2.0.1)
const (
	MessageTypeCall       = 2
	MessageTypeCallResult = 3
	MessageTypeCallError  = 4
)

// Command represents a command to send to a charge point via Redis PubSub.
type Command struct {
	RequestID     string         `json:"requestId"`
	ChargePointID string         `json:"chargePointId"`
	Action        string         `json:"action"`
	Payload       map[string]any `json:"payload"`
}

// CommandResponse is the response from a charge point command.
type CommandResponse struct {
	RequestID string         `json:"requestId"`
	Status    string         `json:"status"`
	Payload   map[string]any `json:"payload,omitempty"`
	Error     string         `json:"error,omitempty"`
}

// envelope wraps commands and responses on the same broker channel.
type envelope struct {
	Type string          `json:"type"` // "cmd" or "resp"
	Data json.RawMessage `json:"data"`
}
