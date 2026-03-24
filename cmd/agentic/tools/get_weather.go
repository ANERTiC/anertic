package tools

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
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

type geocodeResult struct {
	Results []struct {
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
		Name      string  `json:"name"`
		Country   string  `json:"country"`
	} `json:"results"`
}

func (t *getWeatherTool) Execute(ctx context.Context, _ string, input json.RawMessage) (string, error) {
	var p getWeatherInput
	if err := json.Unmarshal(input, &p); err != nil {
		return "", fmt.Errorf("get_weather: invalid input: %w", err)
	}
	if p.Location == "" {
		return "", fmt.Errorf("get_weather: location is required")
	}
	if p.Days <= 0 {
		p.Days = 1
	}
	if p.Days > 7 {
		p.Days = 7
	}

	client := &http.Client{Timeout: 10 * time.Second}

	// Geocode location
	geoURL := fmt.Sprintf("https://geocoding-api.open-meteo.com/v1/search?name=%s&count=1&language=en&format=json",
		url.QueryEscape(p.Location))

	geoResp, err := client.Get(geoURL)
	if err != nil {
		return "", fmt.Errorf("get_weather: geocode request: %w", err)
	}
	defer geoResp.Body.Close()

	var geo geocodeResult
	if err := json.NewDecoder(geoResp.Body).Decode(&geo); err != nil {
		return "", fmt.Errorf("get_weather: decode geocode: %w", err)
	}
	if len(geo.Results) == 0 {
		return fmt.Sprintf("Location '%s' not found.", p.Location), nil
	}

	lat := geo.Results[0].Latitude
	lon := geo.Results[0].Longitude
	locName := fmt.Sprintf("%s, %s", geo.Results[0].Name, geo.Results[0].Country)

	// Fetch weather
	weatherURL := fmt.Sprintf(
		"https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,cloud_cover&daily=temperature_2m_max,temperature_2m_min,sunshine_duration,precipitation_sum,weather_code&forecast_days=%d&timezone=auto",
		lat, lon, p.Days)

	weatherResp, err := client.Get(weatherURL)
	if err != nil {
		return "", fmt.Errorf("get_weather: weather request: %w", err)
	}
	defer weatherResp.Body.Close()

	var weather json.RawMessage
	if err := json.NewDecoder(weatherResp.Body).Decode(&weather); err != nil {
		return "", fmt.Errorf("get_weather: decode weather: %w", err)
	}

	result, _ := json.Marshal(map[string]any{
		"location": locName,
		"weather":  weather,
	})
	return string(result), nil
}
