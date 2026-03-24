package tools

import (
	"context"
	"encoding/json"
	"fmt"
)

type createFloorTool struct {
	api Invoker
}

func NewCreateFloor(api Invoker) Tool {
	return &createFloorTool{api: api}
}

func (t *createFloorTool) Name() string { return "create_floor" }

func (t *createFloorTool) Description() string {
	return "Creates a new floor at a site. Always confirm with the user before creating. Use list_floors to check existing floors first."
}

func (t *createFloorTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"site_id": {
				"type": "string",
				"description": "The site ID to add the floor to"
			},
			"name": {
				"type": "string",
				"description": "Display name for the floor (e.g. Ground Floor, Basement)"
			},
			"level": {
				"type": "integer",
				"description": "The floor level number (e.g. 1 for first floor, 0 for ground, -1 for basement). Must be between -99 and 99"
			}
		},
		"required": ["site_id", "name", "level"]
	}`)
}

type createFloorInput struct {
	SiteID string `json:"site_id"`
	Name   string `json:"name"`
	Level  int    `json:"level"`
}

func (t *createFloorTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p createFloorInput
	if err := json.Unmarshal(input, &p); err != nil {
		return "", fmt.Errorf("create_floor: invalid input: %w", err)
	}
	if p.SiteID == "" || p.Name == "" {
		return "", fmt.Errorf("create_floor: site_id and name are required")
	}

	var result json.RawMessage
	if err := t.api.Invoke(ctx, token, "floor.create", map[string]any{
		"siteId": p.SiteID,
		"name":   p.Name,
		"level":  p.Level,
	}, &result); err != nil {
		return "", fmt.Errorf("create_floor: %w", err)
	}
	return string(result), nil
}
