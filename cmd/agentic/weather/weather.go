package weather

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"time"
)

// Current holds the current weather conditions for a location.
type Current struct {
	Location    string  `json:"location"`
	Temperature float64 `json:"temperature"`
	Humidity    int     `json:"humidity"`
	CloudCover  int     `json:"cloudCover"`
	WindSpeed   float64 `json:"windSpeed"`
	WeatherCode int     `json:"weatherCode"`
	Description string  `json:"description"`
}

// Forecast holds a single day forecast.
type Forecast struct {
	Date             string  `json:"date"`
	TempMax          float64 `json:"tempMax"`
	TempMin          float64 `json:"tempMin"`
	SunshineDuration float64 `json:"sunshineDuration"`
	Precipitation    float64 `json:"precipitation"`
	WeatherCode      int     `json:"weatherCode"`
	Description      string  `json:"description"`
}

// Result holds the full weather response.
type Result struct {
	Location string     `json:"location"`
	Current  Current    `json:"current"`
	Forecast []Forecast `json:"forecast"`
}

type geocodeResult struct {
	Results []struct {
		Latitude  float64 `json:"latitude"`
		Longitude float64 `json:"longitude"`
		Name      string  `json:"name"`
		Country   string  `json:"country"`
	} `json:"results"`
}

type openMeteoResponse struct {
	Current struct {
		Temperature float64 `json:"temperature_2m"`
		Humidity    float64 `json:"relative_humidity_2m"`
		WeatherCode int     `json:"weather_code"`
		WindSpeed   float64 `json:"wind_speed_10m"`
		CloudCover  float64 `json:"cloud_cover"`
	} `json:"current"`
	Daily struct {
		Time             []string  `json:"time"`
		TempMax          []float64 `json:"temperature_2m_max"`
		TempMin          []float64 `json:"temperature_2m_min"`
		SunshineDuration []float64 `json:"sunshine_duration"`
		Precipitation    []float64 `json:"precipitation_sum"`
		WeatherCode      []int     `json:"weather_code"`
	} `json:"daily"`
}

// Geocode resolves a location name to coordinates.
func Geocode(ctx context.Context, location string) (lat, lon float64, name string, err error) {
	client := &http.Client{Timeout: 10 * time.Second}

	geoURL := fmt.Sprintf("https://geocoding-api.open-meteo.com/v1/search?name=%s&count=1&language=en&format=json",
		url.QueryEscape(location))

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, geoURL, nil)
	if err != nil {
		return 0, 0, "", fmt.Errorf("geocode: build request: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return 0, 0, "", fmt.Errorf("geocode: request: %w", err)
	}
	defer resp.Body.Close()

	var geo geocodeResult
	if err := json.NewDecoder(resp.Body).Decode(&geo); err != nil {
		return 0, 0, "", fmt.Errorf("geocode: decode: %w", err)
	}
	if len(geo.Results) == 0 {
		return 0, 0, "", fmt.Errorf("geocode: location '%s' not found", location)
	}

	return geo.Results[0].Latitude, geo.Results[0].Longitude,
		fmt.Sprintf("%s, %s", geo.Results[0].Name, geo.Results[0].Country), nil
}

// Fetch gets current weather and forecast for a location.
// days specifies the number of forecast days (1-7).
func Fetch(ctx context.Context, location string, days int) (*Result, error) {
	if days <= 0 {
		days = 1
	}
	if days > 7 {
		days = 7
	}

	lat, lon, locName, err := Geocode(ctx, location)
	if err != nil {
		return nil, err
	}

	return FetchByCoords(ctx, lat, lon, locName, days)
}

// FetchByCoords gets weather using lat/lon directly (skips geocoding).
func FetchByCoords(ctx context.Context, lat, lon float64, locationName string, days int) (*Result, error) {
	if days <= 0 {
		days = 1
	}
	if days > 7 {
		days = 7
	}

	client := &http.Client{Timeout: 10 * time.Second}

	weatherURL := fmt.Sprintf(
		"https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,cloud_cover&daily=temperature_2m_max,temperature_2m_min,sunshine_duration,precipitation_sum,weather_code&forecast_days=%d&timezone=auto",
		lat, lon, days)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, weatherURL, nil)
	if err != nil {
		return nil, fmt.Errorf("weather: build request: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("weather: request: %w", err)
	}
	defer resp.Body.Close()

	var data openMeteoResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nil, fmt.Errorf("weather: decode: %w", err)
	}

	result := &Result{
		Location: locationName,
		Current: Current{
			Location:    locationName,
			Temperature: data.Current.Temperature,
			Humidity:    int(data.Current.Humidity),
			CloudCover:  int(data.Current.CloudCover),
			WindSpeed:   data.Current.WindSpeed,
			WeatherCode: data.Current.WeatherCode,
			Description: weatherCodeToDescription(data.Current.WeatherCode),
		},
	}

	for i, t := range data.Daily.Time {
		f := Forecast{
			Date:        t,
			Description: weatherCodeToDescription(data.Daily.WeatherCode[i]),
			WeatherCode: data.Daily.WeatherCode[i],
		}
		if i < len(data.Daily.TempMax) {
			f.TempMax = data.Daily.TempMax[i]
		}
		if i < len(data.Daily.TempMin) {
			f.TempMin = data.Daily.TempMin[i]
		}
		if i < len(data.Daily.SunshineDuration) {
			f.SunshineDuration = data.Daily.SunshineDuration[i]
		}
		if i < len(data.Daily.Precipitation) {
			f.Precipitation = data.Daily.Precipitation[i]
		}
		result.Forecast = append(result.Forecast, f)
	}

	return result, nil
}

// RawJSON returns the full Open-Meteo JSON for the get_weather tool.
func RawJSON(ctx context.Context, location string, days int) (string, error) {
	if days <= 0 {
		days = 1
	}
	if days > 7 {
		days = 7
	}

	lat, lon, locName, err := Geocode(ctx, location)
	if err != nil {
		return "", err
	}

	client := &http.Client{Timeout: 10 * time.Second}

	weatherURL := fmt.Sprintf(
		"https://api.open-meteo.com/v1/forecast?latitude=%.4f&longitude=%.4f&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,cloud_cover&daily=temperature_2m_max,temperature_2m_min,sunshine_duration,precipitation_sum,weather_code&forecast_days=%d&timezone=auto",
		lat, lon, days)

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, weatherURL, nil)
	if err != nil {
		return "", fmt.Errorf("weather: build request: %w", err)
	}

	resp, err := client.Do(req)
	if err != nil {
		return "", fmt.Errorf("weather: request: %w", err)
	}
	defer resp.Body.Close()

	var raw json.RawMessage
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return "", fmt.Errorf("weather: decode: %w", err)
	}

	result, _ := json.Marshal(map[string]any{
		"location": locName,
		"weather":  raw,
	})
	return string(result), nil
}

func weatherCodeToDescription(code int) string {
	switch code {
	case 0:
		return "Clear sky"
	case 1:
		return "Mainly clear"
	case 2:
		return "Partly cloudy"
	case 3:
		return "Overcast"
	case 45, 48:
		return "Foggy"
	case 51, 53, 55:
		return "Drizzle"
	case 61, 63, 65:
		return "Rain"
	case 66, 67:
		return "Freezing rain"
	case 71, 73, 75:
		return "Snow"
	case 77:
		return "Snow grains"
	case 80, 81, 82:
		return "Rain showers"
	case 85, 86:
		return "Snow showers"
	case 95:
		return "Thunderstorm"
	case 96, 99:
		return "Thunderstorm with hail"
	default:
		return "Unknown"
	}
}
