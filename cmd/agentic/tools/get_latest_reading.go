package tools

import (
	"context"
	"encoding/json"
	"fmt"
)

type getLatestReadingTool struct {
	api Invoker
}

func NewGetLatestReading(api Invoker) Tool {
	return &getLatestReadingTool{api: api}
}

func (t *getLatestReadingTool) Name() string { return "get_latest_reading" }

func (t *getLatestReadingTool) Description() string {
	return "Returns the most recent energy reading for a device including power (W), energy (kWh), voltage (V), and current (A)."
}

func (t *getLatestReadingTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"device_id": {
				"type": "string",
				"description": "The device ID to get the latest reading for"
			}
		},
		"required": ["device_id"]
	}`)
}

type getLatestReadingInput struct {
	DeviceID string `json:"device_id"`
}

func (t *getLatestReadingTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p getLatestReadingInput
	if err := json.Unmarshal(input, &p); err != nil {
		return "", fmt.Errorf("get_latest_reading: invalid input: %w", err)
	}
	if p.DeviceID == "" {
		return "", fmt.Errorf("get_latest_reading: device_id is required")
	}

	var result json.RawMessage
	if err := t.api.Invoke(ctx, token, "reading.latest", map[string]any{"deviceId": p.DeviceID}, &result); err != nil {
		return "", fmt.Errorf("get_latest_reading: %w", err)
	}
	return string(result), nil
}
