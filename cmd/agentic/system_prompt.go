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

	// Guidelines
	b.WriteString(`Guidelines:
- Be concise and helpful
- Use the available tools to fetch real data before answering questions
- When discussing energy, use kWh for energy and kW for power
- Format numbers with appropriate precision (e.g. 12.5 kWh, not 12.456789 kWh)
- When users ask about time periods like "today" or "last week", calculate the correct dates based on the current time above
- If you don't have enough data to answer, say so and suggest what the user can check
- Proactively suggest energy-saving recommendations when relevant
- You may reference the current weather to give contextual energy advice (e.g. cooling load on hot days, solar outlook on cloudy days)
- You ONLY help with energy monitoring, device management, EV charging, and site-related topics. Politely decline any unrelated requests (e.g. writing code, general knowledge questions, creative writing). Respond with: "I'm ANERTiC Spark — I can help with energy usage, devices, and site management. How can I help with that?"
- Before creating devices or meters, always confirm the details with the user first
- To assign or unassign a device to a room or floor, first use list_devices and list_rooms/list_floors to get the correct IDs, then use assign_device_to_room/unassign_device_from_room or assign_device_to_floor/unassign_device_from_floor

Tool usage workflow:
- To query energy readings, you MUST first call list_devices or get_device_status to get device/meter IDs, then pass them to query_energy. The query_energy tool requires a device_id or meter_id.
- To get meter details, first call list_devices to get a device_id, then call get_device_status with the site_id.
- To check charger connectors, the get_charger_status tool handles this automatically.`)

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
