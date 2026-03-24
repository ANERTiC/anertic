package tools

import (
	"context"
	"encoding/json"
	"fmt"
)

type getDeviceTool struct {
	api Invoker
}

func NewGetDevice(api Invoker) Tool {
	return &getDeviceTool{api: api}
}

func (t *getDeviceTool) Name() string { return "get_device" }

func (t *getDeviceTool) Description() string {
	return "Returns detailed information about a specific device including metadata, room assignment, and last seen time."
}

func (t *getDeviceTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"id": {
				"type": "string",
				"description": "The device ID"
			}
		},
		"required": ["id"]
	}`)
}

type getDeviceInput struct {
	ID string `json:"id"`
}

func (t *getDeviceTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p getDeviceInput
	if err := json.Unmarshal(input, &p); err != nil {
		return "", fmt.Errorf("get_device: invalid input: %w", err)
	}
	if p.ID == "" {
		return "", fmt.Errorf("get_device: id is required")
	}

	var result json.RawMessage
	if err := t.api.Invoke(ctx, token, "device.get", map[string]any{"id": p.ID}, &result); err != nil {
		return "", fmt.Errorf("get_device: %w", err)
	}
	return string(result), nil
}
