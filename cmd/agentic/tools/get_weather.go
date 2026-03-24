package tools

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/anertic/anertic/cmd/agentic/weather"
)

type getWeatherTool struct{}

func NewGetWeather() Tool {
	return &getWeatherTool{}
}

func (t *getWeatherTool) Name() string { return "get_weather" }

func (t *getWeatherTool) Description() string {
	return "Gets current weather and forecast for a location. Useful for understanding solar production potential, temperature-related energy usage, and weather impacts on energy consumption."
}

func (t *getWeatherTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"location": {
				"type": "string",
				"description": "City or place name (e.g. Bangkok, Tokyo, New York)"
			},
			"days": {
				"type": "integer",
				"description": "Number of forecast days (1-7). Defaults to 1."
			}
		},
		"required": ["location"]
	}`)
}

type getWeatherInput struct {
	Location string `json:"location"`
	Days     int    `json:"days"`
}

func (t *getWeatherTool) Execute(ctx context.Context, _ string, input json.RawMessage) (string, error) {
	var p getWeatherInput
	if err := json.Unmarshal(input, &p); err != nil {
		return "", fmt.Errorf("get_weather: invalid input: %w", err)
	}
	if p.Location == "" {
		return "", fmt.Errorf("get_weather: location is required")
	}

	return weather.RawJSON(ctx, p.Location, p.Days)
}
