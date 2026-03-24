package tools

import (
	"context"
	"encoding/json"
	"fmt"
)

type createDeviceTool struct {
	api Invoker
}

func NewCreateDevice(api Invoker) Tool {
	return &createDeviceTool{api: api}
}

func (t *createDeviceTool) Name() string { return "create_device" }

func (t *createDeviceTool) Description() string {
	return "Creates a new energy monitoring device at a site. Always confirm with the user before creating."
}

func (t *createDeviceTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"site_id": {
				"type": "string",
				"description": "The site ID to add the device to"
			},
			"name": {
				"type": "string",
				"description": "Display name for the device"
			},
			"type": {
				"type": "string",
				"enum": ["meter", "inverter", "solar_panel", "appliance"],
				"description": "The type of device"
			},
			"tag": {
				"type": "string",
				"description": "Optional tag/label for the device"
			},
			"brand": {
				"type": "string",
				"description": "Optional brand/manufacturer"
			},
			"model": {
				"type": "string",
				"description": "Optional model name"
			}
		},
		"required": ["site_id", "name", "type"]
	}`)
}

type createDeviceInput struct {
	SiteID string `json:"site_id"`
	Name   string `json:"name"`
	Type   string `json:"type"`
	Tag    string `json:"tag"`
	Brand  string `json:"brand"`
	Model  string `json:"model"`
}

func (t *createDeviceTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p createDeviceInput
	if err := json.Unmarshal(input, &p); err != nil {
		return "", fmt.Errorf("create_device: invalid input: %w", err)
	}
	if p.SiteID == "" || p.Name == "" || p.Type == "" {
		return "", fmt.Errorf("create_device: site_id, name, and type are required")
	}

	body := map[string]any{
		"siteId": p.SiteID,
		"name":   p.Name,
		"type":   p.Type,
	}
	if p.Tag != "" {
		body["tag"] = p.Tag
	}
	if p.Brand != "" {
		body["brand"] = p.Brand
	}
	if p.Model != "" {
		body["model"] = p.Model
	}

	var result json.RawMessage
	if err := t.api.Invoke(ctx, token, "device.create", body, &result); err != nil {
		return "", fmt.Errorf("create_device: %w", err)
	}
	return string(result), nil
}
