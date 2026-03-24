package tools

import (
	"context"
	"encoding/json"
	"fmt"
)

type assignDeviceToRoomTool struct {
	api Invoker
}

// NewAssignDeviceToRoom creates a tool that assigns a device to a room.
func NewAssignDeviceToRoom(api Invoker) Tool {
	return &assignDeviceToRoomTool{api: api}
}

func (t *assignDeviceToRoomTool) Name() string { return "assign_device_to_room" }

func (t *assignDeviceToRoomTool) Description() string {
	return "Assigns a device to a room. Use list_devices to get the device ID and list_rooms to get the room ID first."
}

func (t *assignDeviceToRoomTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"site_id": {
				"type": "string",
				"description": "The ID of the site"
			},
			"room_id": {
				"type": "string",
				"description": "The ID of the room to assign the device to"
			},
			"device_id": {
				"type": "string",
				"description": "The ID of the device to assign"
			}
		},
		"required": ["site_id", "room_id", "device_id"]
	}`)
}

type assignDeviceToRoomInput struct {
	SiteID   string `json:"site_id"`
	RoomID   string `json:"room_id"`
	DeviceID string `json:"device_id"`
}

func (t *assignDeviceToRoomTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p assignDeviceToRoomInput
	if err := json.Unmarshal(input, &p); err != nil {
		return "", fmt.Errorf("assign_device_to_room: invalid input: %w", err)
	}
	if p.SiteID == "" || p.RoomID == "" || p.DeviceID == "" {
		return "", fmt.Errorf("assign_device_to_room: site_id, room_id, and device_id are required")
	}

	var result json.RawMessage
	if err := t.api.Invoke(ctx, token, "room.assignDevice", map[string]any{
		"siteId":   p.SiteID,
		"roomId":   p.RoomID,
		"deviceId": p.DeviceID,
	}, &result); err != nil {
		return "", fmt.Errorf("assign_device_to_room: %w", err)
	}
	return string(result), nil
}
