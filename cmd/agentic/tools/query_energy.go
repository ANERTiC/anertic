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
	return "Queries historical energy readings. Requires either device_id or meter_id (or both). Use get_device_status first to find device and meter IDs."
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
				"description": "Device ID to query readings for"
			},
			"meter_id": {
				"type": "string",
				"description": "Meter ID to query readings for"
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
	MeterID   string `json:"meter_id"`
	StartTime string `json:"start_time"`
	EndTime   string `json:"end_time"`
	Interval  string `json:"interval"`
}

// queryEnergyBody maps to the camelCase API params expected by reading.query.
type queryEnergyBody struct {
	SiteID    string `json:"siteId"`
	DeviceID  string `json:"deviceId"`
	MeterID   string `json:"meterId"`
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
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
	if p.DeviceID == "" && p.MeterID == "" {
		return "", fmt.Errorf("query_energy: device_id or meter_id is required")
	}

	body := queryEnergyBody{
		SiteID:    p.SiteID,
		DeviceID:  p.DeviceID,
		MeterID:   p.MeterID,
		StartTime: p.StartTime,
		EndTime:   p.EndTime,
		Interval:  p.Interval,
	}

	var result json.RawMessage
	if err := t.api.Invoke(ctx, token, "reading.query", body, &result); err != nil {
		return "", fmt.Errorf("query_energy: %w", err)
	}
	return string(result), nil
}
