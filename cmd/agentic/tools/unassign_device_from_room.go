package tools

import (
	"context"
	"encoding/json"
	"fmt"
)

type unassignDeviceFromRoomTool struct {
	api Invoker
}

// NewUnassignDeviceFromRoom creates a tool that removes a device from a room.
func NewUnassignDeviceFromRoom(api Invoker) Tool {
	return &unassignDeviceFromRoomTool{api: api}
}

func (t *unassignDeviceFromRoomTool) Name() string { return "unassign_device_from_room" }

func (t *unassignDeviceFromRoomTool) Description() string {
	return "Removes a device from a room. Use list_devices to get the device ID and list_rooms to get the room ID first."
}

func (t *unassignDeviceFromRoomTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"site_id": {
				"type": "string",
				"description": "The ID of the site"
			},
			"room_id": {
				"type": "string",
				"description": "The ID of the room to remove the device from"
			},
			"device_id": {
				"type": "string",
				"description": "The ID of the device to remove"
			}
		},
		"required": ["site_id", "room_id", "device_id"]
	}`)
}

type unassignDeviceFromRoomInput struct {
	SiteID   string `json:"site_id"`
	RoomID   string `json:"room_id"`
	DeviceID string `json:"device_id"`
}

func (t *unassignDeviceFromRoomTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p unassignDeviceFromRoomInput
	if err := json.Unmarshal(input, &p); err != nil {
		return "", fmt.Errorf("unassign_device_from_room: invalid input: %w", err)
	}
	if p.SiteID == "" || p.RoomID == "" || p.DeviceID == "" {
		return "", fmt.Errorf("unassign_device_from_room: site_id, room_id, and device_id are required")
	}

	var result json.RawMessage
	if err := t.api.Invoke(ctx, token, "room.unassignDevice", map[string]any{
		"siteId":   p.SiteID,
		"roomId":   p.RoomID,
		"deviceId": p.DeviceID,
	}, &result); err != nil {
		return "", fmt.Errorf("unassign_device_from_room: %w", err)
	}
	return string(result), nil
}
