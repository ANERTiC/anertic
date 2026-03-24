package tools

import (
	"context"
	"encoding/json"
	"fmt"
)

type listDevicesTool struct {
	api Invoker
}

// NewListDevices creates a tool that lists devices at a site.
func NewListDevices(api Invoker) Tool {
	return &listDevicesTool{api: api}
}

func (t *listDevicesTool) Name() string { return "list_devices" }

func (t *listDevicesTool) Description() string {
	return "Returns all energy monitoring devices registered at a specific site."
}

func (t *listDevicesTool) InputSchema() json.RawMessage {
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

type listDevicesInput struct {
	SiteID string `json:"site_id"`
}

func (t *listDevicesTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p listDevicesInput
	if err := json.Unmarshal(input, &p); err != nil {
		return "", fmt.Errorf("list_devices: invalid input: %w", err)
	}
	if p.SiteID == "" {
		return "", fmt.Errorf("list_devices: site_id is required")
	}

	var result json.RawMessage
	if err := t.api.Invoke(ctx, token, "device.list", map[string]any{"siteId": p.SiteID}, &result); err != nil {
		return "", fmt.Errorf("list_devices: %w", err)
	}
	return string(result), nil
}
