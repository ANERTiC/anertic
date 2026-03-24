package tools

import (
	"context"
	"encoding/json"
	"fmt"
)

type unassignDeviceFromFloorTool struct {
	api Invoker
}

// NewUnassignDeviceFromFloor creates a tool that removes a device from a floor.
func NewUnassignDeviceFromFloor(api Invoker) Tool {
	return &unassignDeviceFromFloorTool{api: api}
}

func (t *unassignDeviceFromFloorTool) Name() string { return "unassign_device_from_floor" }

func (t *unassignDeviceFromFloorTool) Description() string {
	return "Removes a device from a floor level. Use list_devices to get the device ID and list_floors to get the floor level first."
}

func (t *unassignDeviceFromFloorTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"site_id": {
				"type": "string",
				"description": "The ID of the site"
			},
			"level": {
				"type": "integer",
				"description": "The floor level number to remove the device from"
			},
			"device_id": {
				"type": "string",
				"description": "The ID of the device to remove"
			}
		},
		"required": ["site_id", "level", "device_id"]
	}`)
}

type unassignDeviceFromFloorInput struct {
	SiteID   string `json:"site_id"`
	Level    int    `json:"level"`
	DeviceID string `json:"device_id"`
}

func (t *unassignDeviceFromFloorTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p unassignDeviceFromFloorInput
	if err := json.Unmarshal(input, &p); err != nil {
		return "", fmt.Errorf("unassign_device_from_floor: invalid input: %w", err)
	}
	if p.SiteID == "" || p.DeviceID == "" {
		return "", fmt.Errorf("unassign_device_from_floor: site_id and device_id are required")
	}

	var result json.RawMessage
	if err := t.api.Invoke(ctx, token, "floor.unassign_device", map[string]any{
		"siteId":   p.SiteID,
		"level":    p.Level,
		"deviceId": p.DeviceID,
	}, &result); err != nil {
		return "", fmt.Errorf("unassign_device_from_floor: %w", err)
	}
	return string(result), nil
}
