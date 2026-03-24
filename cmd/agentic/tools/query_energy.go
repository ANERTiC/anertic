package tools

import (
	"context"
	"encoding/json"
	"fmt"
)

type queryEnergyTool struct {
	api Invoker
}

// NewQueryEnergy creates a tool that queries energy readings for a site.
func NewQueryEnergy(api Invoker) Tool {
	return &queryEnergyTool{api: api}
}

func (t *queryEnergyTool) Name() string { return "query_energy" }

func (t *queryEnergyTool) Description() string {
	return "Queries historical energy readings for a site. If no device_id is provided, it automatically queries the first device found at the site."
}

func (t *queryEnergyTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"site_id": {
				"type": "string",
				"description": "The ID of the site to query"
			},
			"device_id": {
				"type": "string",
				"description": "Optional device ID. If omitted, uses the first device at the site."
			},
			"start_time": {
				"type": "string",
				"description": "Start time in RFC3339 format (e.g. 2024-01-01T00:00:00Z). Defaults to 24 hours ago."
			},
			"end_time": {
				"type": "string",
				"description": "End time in RFC3339 format. Defaults to now."
			},
			"interval": {
				"type": "string",
				"enum": ["raw", "hourly", "daily"],
				"description": "Aggregation interval. Defaults to hourly."
			}
		},
		"required": ["site_id"]
	}`)
}

type queryEnergyInput struct {
	SiteID    string `json:"site_id"`
	DeviceID  string `json:"device_id"`
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`
	Interval  string `json:"interval"`
}

func (t *queryEnergyTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p queryEnergyInput
	if err := json.Unmarshal(input, &p); err != nil {
		return "", fmt.Errorf("query_energy: invalid input: %w", err)
	}
	if p.SiteID == "" {
		return "", fmt.Errorf("query_energy: site_id is required")
	}

	// Auto-resolve device_id if not provided
	if p.DeviceID == "" {
		var devices struct {
			Items []struct {
				ID string `json:"id"`
			} `json:"items"`
		}
		if err := t.api.Invoke(ctx, token, "device.list", map[string]any{"siteId": p.SiteID}, &devices); err != nil {
			return "", fmt.Errorf("query_energy: failed to list devices: %w", err)
		}
		if len(devices.Items) == 0 {
			return "No devices found at this site.", nil
		}
		p.DeviceID = devices.Items[0].ID
	}

	body := map[string]any{
		"deviceId": p.DeviceID,
	}
	if p.StartTime != "" {
		body["startTime"] = p.StartTime
	}
	if p.EndTime != "" {
		body["endTime"] = p.EndTime
	}
	if p.Interval != "" {
		body["interval"] = p.Interval
	}

	var result json.RawMessage
	if err := t.api.Invoke(ctx, token, "reading.query", body, &result); err != nil {
		return "", fmt.Errorf("query_energy: %w", err)
	}
	return string(result), nil
}
