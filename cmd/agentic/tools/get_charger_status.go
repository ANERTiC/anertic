package tools

import (
	"context"
	"encoding/json"
	"fmt"
)

type getChargerStatusTool struct {
	api Invoker
}

// NewGetChargerStatus creates a tool that returns EV charger and connector status for a site.
func NewGetChargerStatus(api Invoker) Tool {
	return &getChargerStatusTool{api: api}
}

func (t *getChargerStatusTool) Name() string { return "get_charger_status" }

func (t *getChargerStatusTool) Description() string {
	return "Returns the status of all EV chargers and their connectors at a specific site."
}

func (t *getChargerStatusTool) InputSchema() json.RawMessage {
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

type getChargerStatusInput struct {
	SiteID string `json:"site_id"`
}

func (t *getChargerStatusTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p getChargerStatusInput
	if err := json.Unmarshal(input, &p); err != nil {
		return "", fmt.Errorf("get_charger_status: invalid input: %w", err)
	}
	if p.SiteID == "" {
		return "", fmt.Errorf("get_charger_status: site_id is required")
	}

	body := map[string]any{"siteId": p.SiteID}

	var chargers json.RawMessage
	if err := t.api.Invoke(ctx, token, "charger.list", body, &chargers); err != nil {
		return "", fmt.Errorf("get_charger_status: charger.list: %w", err)
	}

	var connectors json.RawMessage
	if err := t.api.Invoke(ctx, token, "connector.list", body, &connectors); err != nil {
		return "", fmt.Errorf("get_charger_status: connector.list: %w", err)
	}

	out, err := json.Marshal(map[string]json.RawMessage{
		"chargers":   chargers,
		"connectors": connectors,
	})
	if err != nil {
		return "", fmt.Errorf("get_charger_status: marshal result: %w", err)
	}
	return string(out), nil
}
