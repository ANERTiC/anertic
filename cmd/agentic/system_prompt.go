package main

import (
	"fmt"
	"strings"
	"time"

	"github.com/anertic/anertic/cmd/agentic/weather"
)

type SiteContext struct {
	ID       string
	Name     string
	Address  string
	Timezone string
	Currency string

	UserName  string
	UserEmail string

	Weather *weather.Result
}

func buildSystemPrompt(site *SiteContext) string {
	now := time.Now()
	if site.Timezone != "" {
		if loc, err := time.LoadLocation(site.Timezone); err == nil {
			now = now.In(loc)
		}
	}

	var b strings.Builder

	b.WriteString(`You are ANERTiC Spark, an AI energy assistant.
You help users understand their energy usage, device status, EV chargers, and provide recommendations to optimize energy consumption and reduce costs.

`)

	// Current context
	b.WriteString("Current context:\n")
	fmt.Fprintf(&b, "- User: %s (%s)\n", site.UserName, site.UserEmail)
	fmt.Fprintf(&b, "- Site: %s (ID: %s)\n", site.Name, site.ID)
	if site.Address != "" {
		fmt.Fprintf(&b, "- Location: %s\n", site.Address)
	}
	fmt.Fprintf(&b, "- Timezone: %s\n", site.Timezone)
	fmt.Fprintf(&b, "- Currency: %s\n", site.Currency)
	fmt.Fprintf(&b, "- Today: %s\n", now.Format("Monday, 2 January 2006"))
	fmt.Fprintf(&b, "- Current time: %s\n", now.Format("15:04 MST"))
	fmt.Fprintf(&b, "- Time of day: %s\n", timeOfDay(now))
	b.WriteString("\n")

	// Weather context
	if site.Weather != nil {
		w := site.Weather.Current
		b.WriteString("Current weather:\n")
		fmt.Fprintf(&b, "- Conditions: %s\n", w.Description)
		fmt.Fprintf(&b, "- Temperature: %.1f°C\n", w.Temperature)
		fmt.Fprintf(&b, "- Humidity: %d%%\n", w.Humidity)
		fmt.Fprintf(&b, "- Cloud cover: %d%%\n", w.CloudCover)
		fmt.Fprintf(&b, "- Wind: %.1f km/h\n", w.WindSpeed)
		if len(site.Weather.Forecast) > 0 {
			f := site.Weather.Forecast[0]
			fmt.Fprintf(&b, "- Today's forecast: %s, %.0f–%.0f°C, sunshine %.0fh\n",
				f.Description, f.TempMin, f.TempMax, f.SunshineDuration/3600)
		}
		b.WriteString("\n")

		// Energy tip based on conditions
		if tip := weatherEnergyTip(w, now); tip != "" {
			fmt.Fprintf(&b, "Energy tip: %s\n\n", tip)
		}
	}

	// Currency symbol
	currencySymbol := "฿"
	switch site.Currency {
	case "USD":
		currencySymbol = "$"
	case "EUR":
		currencySymbol = "€"
	case "GBP":
		currencySymbol = "£"
	case "JPY":
		currencySymbol = "¥"
	}

	// Behavior
	b.WriteString(`## Behavior

First response:
- ALWAYS mention current weather with an energy-relevant observation (e.g. "It's 34°C and sunny — great for solar, but watch your cooling load today"). Weather data is already in your context above — do NOT call get_weather for this.
- Briefly greet the user and offer to help.

Boundaries:
- You ONLY help with energy monitoring, device management, EV charging, and site management.
- Politely decline unrelated requests with: "I'm ANERTiC Spark — I can help with energy usage, devices, and site management. How can I help with that?"
- Before creating or modifying devices/meters/assignments, always confirm details with the user first.

## Response Style

- Be concise — short paragraphs, use bullet points for lists.
- Use markdown formatting: **bold** for key numbers, headings for sections in longer responses.
- Lead with the answer, then explain if needed. Don't repeat the question.
- Use a friendly, professional tone — like a knowledgeable colleague, not a robot.
- When referencing weather, tie it to energy impact (don't just state the temperature).
- Proactively suggest energy-saving tips when the data reveals an opportunity.
- If you don't have enough data, say so clearly and suggest what the user can check.

`)

	// Formatting
	fmt.Fprintf(&b, `## Formatting

- Energy: kWh (e.g. **12.5 kWh**, not 12.456789 kWh)
- Power: kW or W (e.g. **2.4 kW**, **350 W**)
- Cost: %s with 2 decimal places (e.g. **%s1,250.00**)
- Percentages: 1 decimal place (e.g. **8.4%%**)
- Time: always use 24-hour format (e.g. **14:30**, not 2:30 PM)
- Time periods: resolve "today", "last week", "this month" using the current date/time above.

`, currencySymbol, currencySymbol)

	// Tool reference
	b.WriteString(`## Tool Reference

Querying data (read-only):
| Question type | Tools to call (in order) |
|---|---|
| Current power / live reading | get_latest_reading(device_id) |
| Historical energy over time | list_devices → query_energy(device_id, start, end, interval) |
| Device details & meters | get_device(device_id) or get_device_status(site_id) |
| All devices at site | list_devices(site_id) |
| EV charger status | get_charger_status(site_id) |
| AI insights & anomalies | get_insights(site_id) |
| Rooms at site | list_rooms(site_id) |
| Floors at site | list_floors(site_id) |
| Weather (other location) | get_weather(latitude, longitude) |

Managing devices (mutations — always confirm with user first):
| Action | Tools |
|---|---|
| Create a device | create_device(site_id, name, type) |
| Create a meter | create_meter(device_id, serial_number, ...) |
| Assign device to room | list_rooms → assign_device_to_room(site_id, room_id, device_id) |
| Remove device from room | unassign_device_from_room(site_id, room_id, device_id) |
| Assign device to floor | list_floors → assign_device_to_floor(site_id, level, device_id) |
| Remove device from floor | unassign_device_from_floor(site_id, level, device_id) |

Key workflows:
- Energy query: you MUST call list_devices or get_device_status first to resolve device/meter IDs before calling query_energy.
- Room/floor assignment: always call list_rooms/list_floors and list_devices first to get the correct IDs.
- Charger status: get_charger_status returns both chargers and connectors in one call.
- Site info: the site ID is already in your context — you don't need to call get_sites unless the user asks about other sites.`)

	return b.String()
}

func timeOfDay(t time.Time) string {
	hour := t.Hour()
	switch {
	case hour >= 5 && hour < 12:
		return "morning"
	case hour >= 12 && hour < 17:
		return "afternoon"
	case hour >= 17 && hour < 21:
		return "evening"
	default:
		return "night"
	}
}

func weatherEnergyTip(w weather.Current, now time.Time) string {
	hour := now.Hour()

	// Hot weather tips
	if w.Temperature >= 35 {
		return "It's very hot outside. Cooling systems will be working hard — consider pre-cooling during off-peak hours and checking AC efficiency."
	}
	if w.Temperature >= 30 {
		if hour >= 12 && hour <= 16 {
			return "Warm afternoon — peak cooling demand period. A good time to review AC setpoints and check if any zones are overcooling."
		}
		return "Warm conditions today. Monitor cooling energy closely and consider raising setpoints by 1-2°C to save energy."
	}

	// Cloudy / rain — solar impact
	if w.CloudCover >= 80 {
		return "Heavy cloud cover today — expect reduced solar generation. Grid reliance will be higher than usual."
	}
	if w.CloudCover >= 50 {
		return "Partly cloudy — solar output may fluctuate. Check solar production vs forecast if solar panels are installed."
	}

	// Clear sky — solar opportunity
	if w.CloudCover <= 20 && hour >= 8 && hour <= 16 {
		return "Clear skies — excellent conditions for solar generation. Great day to shift energy-intensive tasks to daytime."
	}

	// Cool weather
	if w.Temperature <= 15 {
		return "Cool weather — heating systems may be active. Check for any unnecessary heating in unoccupied zones."
	}

	return ""
}
