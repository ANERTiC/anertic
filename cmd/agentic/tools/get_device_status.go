package tools

import (
	"context"
	"encoding/json"
	"fmt"
)

type getDeviceStatusTool struct {
	api Invoker
}

// NewGetDeviceStatus creates a tool that returns device and meter status for a site.
func NewGetDeviceStatus(api Invoker) Tool {
	return &getDeviceStatusTool{api: api}
}

func (t *getDeviceStatusTool) Name() string { return "get_device_status" }

func (t *getDeviceStatusTool) Description() string {
	return "Returns the combined status of all devices and meters at a specific site."
}

func (t *getDeviceStatusTool) InputSchema() json.RawMessage {
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

type getDeviceStatusInput struct {
	SiteID string `json:"site_id"`
}

func (t *getDeviceStatusTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p getDeviceStatusInput
	if err := json.Unmarshal(input, &p); err != nil {
		return "", fmt.Errorf("get_device_status: invalid input: %w", err)
	}
	if p.SiteID == "" {
		return "", fmt.Errorf("get_device_status: site_id is required")
	}

	body := map[string]any{"siteId": p.SiteID}

	var devices json.RawMessage
	if err := t.api.Invoke(ctx, token, "device.list", body, &devices); err != nil {
		return "", fmt.Errorf("get_device_status: device.list: %w", err)
	}

	var meters json.RawMessage
	if err := t.api.Invoke(ctx, token, "meter.list", body, &meters); err != nil {
		return "", fmt.Errorf("get_device_status: meter.list: %w", err)
	}

	out, err := json.Marshal(map[string]json.RawMessage{
		"devices": devices,
		"meters":  meters,
	})
	if err != nil {
		return "", fmt.Errorf("get_device_status: marshal result: %w", err)
	}
	return string(out), nil
}
