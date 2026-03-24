package tools

import (
	"context"
	"encoding/json"
	"fmt"
)

type listRoomsTool struct {
	api Invoker
}

// NewListRooms creates a tool that lists rooms at a site.
func NewListRooms(api Invoker) Tool {
	return &listRoomsTool{api: api}
}

func (t *listRoomsTool) Name() string { return "list_rooms" }

func (t *listRoomsTool) Description() string {
	return "Returns all rooms defined at a specific site."
}

func (t *listRoomsTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"site_id": {
				"type": "string",
				"description": "The ID of the site to query"
			}
		},
		"required": ["site_id"]
	}`)
}

type listRoomsInput struct {
	SiteID string `json:"site_id"`
}

func (t *listRoomsTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p listRoomsInput
	if err := json.Unmarshal(input, &p); err != nil {
		return "", fmt.Errorf("list_rooms: invalid input: %w", err)
	}
	if p.SiteID == "" {
		return "", fmt.Errorf("list_rooms: site_id is required")
	}

	var result json.RawMessage
	if err := t.api.Invoke(ctx, token, "room.list", map[string]any{"siteId": p.SiteID}, &result); err != nil {
		return "", fmt.Errorf("list_rooms: %w", err)
	}
	return string(result), nil
}
