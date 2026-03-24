package tools

import (
	"context"
	"encoding/json"
	"fmt"
)

type listFloorsTool struct {
	api Invoker
}

// NewListFloors creates a tool that lists floors at a site.
func NewListFloors(api Invoker) Tool {
	return &listFloorsTool{api: api}
}

func (t *listFloorsTool) Name() string { return "list_floors" }

func (t *listFloorsTool) Description() string {
	return "Returns all floors at a specific site, including their level, name, and device stats."
}

func (t *listFloorsTool) InputSchema() json.RawMessage {
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

type listFloorsInput struct {
	SiteID string `json:"site_id"`
}

func (t *listFloorsTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p listFloorsInput
	if err := json.Unmarshal(input, &p); err != nil {
		return "", fmt.Errorf("list_floors: invalid input: %w", err)
	}
	if p.SiteID == "" {
		return "", fmt.Errorf("list_floors: site_id is required")
	}

	var result json.RawMessage
	if err := t.api.Invoke(ctx, token, "floor.list", map[string]any{"siteId": p.SiteID}, &result); err != nil {
		return "", fmt.Errorf("list_floors: %w", err)
	}
	return string(result), nil
}
