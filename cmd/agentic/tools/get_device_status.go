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

	var devicesRaw json.RawMessage
	if err := t.api.Invoke(ctx, token, "device.list", map[string]any{"siteId": p.SiteID}, &devicesRaw); err != nil {
		return "", fmt.Errorf("get_device_status: device.list: %w", err)
	}

	var deviceList struct {
		Items []struct {
			ID string `json:"id"`
		} `json:"items"`
	}
	json.Unmarshal(devicesRaw, &deviceList)
	devices := deviceList.Items

	// Fetch meters per device
	var allMeters []json.RawMessage
	for _, d := range devices {
		var meters json.RawMessage
		if err := t.api.Invoke(ctx, token, "meter.list", map[string]any{
			"siteId":   p.SiteID,
			"deviceId": d.ID,
		}, &meters); err != nil {
			return "", fmt.Errorf("get_device_status: meter.list (device %s): %w", d.ID, err)
		}
		allMeters = append(allMeters, meters)
	}

	metersJSON, _ := json.Marshal(allMeters)
	out, err := json.Marshal(map[string]json.RawMessage{
		"devices": devicesRaw,
		"meters":  json.RawMessage(metersJSON),
	})
	if err != nil {
		return "", fmt.Errorf("get_device_status: marshal result: %w", err)
	}
	return string(out), nil
}
