package tools

import (
	"context"
	"encoding/json"
	"fmt"
)

type createMeterTool struct {
	api Invoker
}

func NewCreateMeter(api Invoker) Tool {
	return &createMeterTool{api: api}
}

func (t *createMeterTool) Name() string { return "create_meter" }

func (t *createMeterTool) Description() string {
	return "Creates a new meter under a device. A meter represents a physical measurement point (e.g. power meter, CT sensor). Always confirm with the user before creating."
}

func (t *createMeterTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"site_id": {
				"type": "string",
				"description": "The site ID"
			},
			"device_id": {
				"type": "string",
				"description": "The device ID to attach the meter to"
			},
			"name": {
				"type": "string",
				"description": "Display name for the meter"
			},
			"serial_number": {
				"type": "string",
				"description": "Unique serial number of the meter"
			},
			"protocol": {
				"type": "string",
				"enum": ["mqtt", "http"],
				"description": "Communication protocol"
			},
			"phase": {
				"type": "integer",
				"description": "Phase assignment: 0=unassigned, 1=L1, 2=L2, 3=L3"
			},
			"channel": {
				"type": "string",
				"enum": ["pv", "grid", "battery", "load", ""],
				"description": "Energy channel type"
			}
		},
		"required": ["site_id", "device_id", "serial_number", "protocol"]
	}`)
}

type createMeterInput struct {
	SiteID       string `json:"site_id"`
	DeviceID     string `json:"device_id"`
	Name         string `json:"name"`
	SerialNumber string `json:"serial_number"`
	Protocol     string `json:"protocol"`
	Phase        int    `json:"phase"`
	Channel      string `json:"channel"`
}

func (t *createMeterTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p createMeterInput
	if err := json.Unmarshal(input, &p); err != nil {
		return "", fmt.Errorf("create_meter: invalid input: %w", err)
	}
	if p.SiteID == "" || p.DeviceID == "" || p.SerialNumber == "" || p.Protocol == "" {
		return "", fmt.Errorf("create_meter: site_id, device_id, serial_number, and protocol are required")
	}

	body := map[string]any{
		"siteId":       p.SiteID,
		"deviceId":     p.DeviceID,
		"serialNumber": p.SerialNumber,
		"protocol":     p.Protocol,
	}
	if p.Name != "" {
		body["name"] = p.Name
	}
	if p.Phase > 0 {
		body["phase"] = p.Phase
	}
	if p.Channel != "" {
		body["channel"] = p.Channel
	}

	var result json.RawMessage
	if err := t.api.Invoke(ctx, token, "meter.create", body, &result); err != nil {
		return "", fmt.Errorf("create_meter: %w", err)
	}
	return string(result), nil
}
