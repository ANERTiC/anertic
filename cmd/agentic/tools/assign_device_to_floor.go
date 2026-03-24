package tools

import (
	"context"
	"encoding/json"
	"fmt"
)

type assignDeviceToFloorTool struct {
	api Invoker
}

// NewAssignDeviceToFloor creates a tool that assigns a device to a floor.
func NewAssignDeviceToFloor(api Invoker) Tool {
	return &assignDeviceToFloorTool{api: api}
}

func (t *assignDeviceToFloorTool) Name() string { return "assign_device_to_floor" }

func (t *assignDeviceToFloorTool) Description() string {
	return "Assigns a device to a floor level. Use list_devices to get the device ID and list_floors to get the floor level first."
}

func (t *assignDeviceToFloorTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"site_id": {
				"type": "string",
				"description": "The ID of the site"
			},
			"level": {
				"type": "integer",
				"description": "The floor level number (e.g. 1 for first floor, -1 for basement)"
			},
			"device_id": {
				"type": "string",
				"description": "The ID of the device to assign"
			}
		},
		"required": ["site_id", "level", "device_id"]
	}`)
}

type assignDeviceToFloorInput struct {
	SiteID   string `json:"site_id"`
	Level    int    `json:"level"`
	DeviceID string `json:"device_id"`
}

func (t *assignDeviceToFloorTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p assignDeviceToFloorInput
	if err := json.Unmarshal(input, &p); err != nil {
		return "", fmt.Errorf("assign_device_to_floor: invalid input: %w", err)
	}
	if p.SiteID == "" || p.DeviceID == "" {
		return "", fmt.Errorf("assign_device_to_floor: site_id and device_id are required")
	}

	var result json.RawMessage
	if err := t.api.Invoke(ctx, token, "floor.assignDevice", map[string]any{
		"siteId":   p.SiteID,
		"level":    p.Level,
		"deviceId": p.DeviceID,
	}, &result); err != nil {
		return "", fmt.Errorf("assign_device_to_floor: %w", err)
	}
	return string(result), nil
}
