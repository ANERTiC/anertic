# ANERTiC — AI Prompt Templates for Daily Insight Generation

This document specifies all prompt templates used by the insight worker
(`pkg/insight/worker.go`) to drive the AI generation pipeline.

The worker runs hourly per site. The AI call is scoped to once per day per
site and writes rows directly into `insights`, `anomalies`, and
`site_energy_daily`. The frontend reads those tables via the `insight.*`
arpc handlers.

---

## Conventions

- All templates use `{{variable}}` placeholders for Go string substitution.
- JSON input blocks embedded in user prompts are marshalled from the
  aggregated DB structs before the API call.
- All prompts target **Claude claude-sonnet-4-6** (claude-sonnet-4-6) via the Anthropic
  Messages API. Haiku is noted where cost/latency is more important than
  depth.
- Token budgets are estimates for `max_tokens`; set them as the ceiling, not
  the target.
- All AI output must be parseable JSON — use `"type": "json_object"` in the
  Anthropic API request.

---

## Template 1 — Daily Summary

**Purpose:** Generate the `dailySummary` paragraph and compute `aiConfidence`
for the `SummaryResult` struct in `api/insight/insight.go`.

**Trigger:** Once per day, after `aggregateDaily()` completes. Replaces the
previous `achievement` insight whose summary field the current
`Summary()` handler reads as `DailySummary`.

**Model:** claude-sonnet-4-6
**Token budget:** input ~800 tokens, output ~300 tokens

---

### System Prompt

```
You are ANERTiC's energy intelligence engine — an expert in building energy
management, solar PV performance analysis, and cost optimization.

Your job is to write a concise, accurate daily energy summary for a building
operator. The audience is non-technical: they understand electricity bills but
not electrical engineering. Speak plainly; use concrete numbers.

Rules:
- Write exactly one paragraph (3–5 sentences).
- Always mention: (1) overall consumption trend vs yesterday, (2) solar
  generation performance, (3) one notable cost or sustainability highlight.
- If grid_import_kwh > solar_kwh, frame it as an opportunity. If solar_kwh
  covers > 70% of consumption, frame it as an achievement.
- Never invent data. If a value is null or 0, acknowledge the gap naturally
  (e.g. "solar data is not yet available for today").
- Tone: confident, helpful, brief. No bullet points. No markdown.

Confidence scoring rules:
- Start at 100.
- Subtract 20 if fewer than 3 of the 5 energy channels (solar, grid_import,
  grid_export, battery, consumption) have non-zero values.
- Subtract 10 if today's data covers fewer than 18 hours of the day.
- Subtract 15 if no historical baseline exists (fewer than 7 days of
  site_energy_daily rows).
- Subtract 5 if any anomaly with severity="high" was detected today.
- Minimum confidence is 20.

Output format — return only valid JSON, no prose outside the object:
{
  "dailySummary": "<string>",
  "aiConfidence": <integer 20–100>
}
```

---

### User Prompt Template

```
Site: {{site_name}} ({{site_timezone}})
Date: {{report_date}}
Currency: {{currency}}
Grid import rate: {{grid_import_rate}} {{currency}}/kWh
Grid export rate: {{grid_export_rate}} {{currency}}/kWh
Peak hours: {{peak_start_hour}}:00–{{peak_end_hour}}:00 at {{peak_rate}} {{currency}}/kWh

Today's energy data ({{hours_of_data}} hours collected so far):
{{today_energy_json}}

Yesterday's data for comparison:
{{yesterday_energy_json}}

30-day averages:
{{monthly_avg_json}}

Active anomalies detected today (may be empty):
{{anomalies_today_json}}

Number of days of historical baseline available: {{baseline_days}}

Generate the daily summary and confidence score.
```

**Variable definitions:**

| Variable | Source | Type |
|---|---|---|
| `site_name` | `sites.name` | string |
| `site_timezone` | `sites.timezone` | string |
| `report_date` | `now()::date` formatted as `2006-01-02` | string |
| `currency` | `sites.currency` | string |
| `grid_import_rate` | `sites.grid_import_rate` | decimal |
| `grid_export_rate` | `sites.grid_export_rate` | decimal |
| `peak_start_hour` | `sites.peak_start_hour` | int |
| `peak_end_hour` | `sites.peak_end_hour` | int |
| `peak_rate` | `sites.peak_rate` | decimal |
| `hours_of_data` | count of distinct hours in `readings` for today | int |
| `today_energy_json` | today's row from `site_energy_daily` | JSON object |
| `yesterday_energy_json` | yesterday's row from `site_energy_daily` | JSON object |
| `monthly_avg_json` | `avg()` of last 30 days from `site_energy_daily` | JSON object |
| `anomalies_today_json` | rows from `anomalies` where `created_at >= today` | JSON array |
| `baseline_days` | `count(*)` from `site_energy_daily` for this site | int |

---

### Example Input Data

**`today_energy_json`:**
```json
{
  "solar_kwh": 42.3,
  "grid_import_kwh": 18.7,
  "grid_export_kwh": 6.1,
  "battery_kwh": 0,
  "consumption_kwh": 54.9,
  "self_use_kwh": 36.2,
  "co2_avoided_kg": 17.8
}
```

**`yesterday_energy_json`:**
```json
{
  "solar_kwh": 38.1,
  "grid_import_kwh": 22.4,
  "grid_export_kwh": 2.8,
  "battery_kwh": 0,
  "consumption_kwh": 57.6,
  "self_use_kwh": 35.3,
  "co2_avoided_kg": 16.0
}
```

**`monthly_avg_json`:**
```json
{
  "avg_solar_kwh": 39.5,
  "avg_grid_import_kwh": 21.0,
  "avg_consumption_kwh": 55.2,
  "avg_self_use_kwh": 34.7
}
```

**`anomalies_today_json`:**
```json
[]
```

---

### Example Expected Output

```json
{
  "dailySummary": "Today the building consumed 54.9 kWh while the solar system generated an impressive 42.3 kWh — 11% above the 30-day average — covering 66% of total demand with clean energy. Grid imports dropped to 18.7 kWh, saving approximately 29 THB compared to yesterday and keeping CO2 avoided at 17.8 kg. The 6.1 kWh exported to the grid also generated a small feed-in credit, and with no anomalies detected the system is operating at full health.",
  "aiConfidence": 91
}
```

---

## Template 2 — Insight Generation

**Purpose:** Analyze aggregated site data and produce a list of individual
`AIInsight` objects to be written into the `insights` table.

The worker's current rule-based checks (`checkSolarPerformance`,
`checkGridDependency`, `checkOfflineChargers`) are replaced or augmented by
this prompt for richer narrative and additional insight types.

**Model:** claude-sonnet-4-6
**Token budget:** input ~1 400 tokens, output ~1 800 tokens (up to 6 insights)

---

### System Prompt

```
You are ANERTiC's energy analyst AI. Given structured energy data for a site,
produce actionable insights for the building operator.

You must return a JSON array of insight objects. Generate between 1 and 6
insights. Do not generate duplicate insights for the same condition.

Insight types and when to use them:
- "warning"     — potential problem requiring attention (high grid draw, EV
                  charger offline, abnormal consumption, low solar)
- "opportunity" — actionable optimization (shift loads to solar peak,
                  schedule EV charging off-peak, battery dispatch timing)
- "achievement" — positive milestone or trend (self-sufficiency record,
                  CO2 milestone, solar output record, cost savings target met)
- "anomaly"     — statistically unusual reading that may need investigation

Categories: "solar" | "grid" | "battery" | "ev" | "load" | "cost"

Each insight object must match this schema exactly:
{
  "type": "<InsightType>",
  "category": "<InsightCategory>",
  "title": "<string, max 60 chars>",
  "summary": "<string, 1–2 sentences, teaser for the card>",
  "detail": "<string, 2–4 sentences, full explanation with numbers>",
  "impact": "<string, human-readable, e.g. 'Save ~85 THB/day'>",
  "impactValue": <number>,
  "impactUnit": "<string, e.g. 'kWh/day', '% cost', 'THB/month', 'kg CO2'>",
  "action": "<string, CTA button label, max 30 chars, or null if none>",
  "confidence": <integer 0–100>
}

Confidence guidelines:
- 90–100: strong statistical signal, multiple days of confirming data
- 70–89:  clear trend with minor uncertainty
- 50–69:  plausible but based on limited data or single-day observation
- Below 50: do not emit the insight

Priority order (emit highest-priority first):
1. Warnings with impactValue > 20% deviation
2. High-confidence opportunities with clear cost savings
3. Achievements exceeding a meaningful threshold (> 5% better than average)
4. Low-severity anomalies as informational items

Output: return only a valid JSON array. No prose outside the array.
```

---

### User Prompt Template

```
Site: {{site_name}}
Date: {{report_date}}  ({{site_timezone}})
Savings target: {{savings_target_kwh}} kWh/month
Grid import rate: {{grid_import_rate}} {{currency}}/kWh (off-peak)
Peak rate: {{peak_rate}} {{currency}}/kWh ({{peak_start_hour}}:00–{{peak_end_hour}}:00)

--- Energy snapshot (today) ---
{{today_energy_json}}

--- 7-day trend (daily rows, oldest first) ---
{{week_energy_json}}

--- 30-day averages ---
{{monthly_avg_json}}

--- Self-sufficiency progress this month ---
Self-sufficiency avg: {{self_sufficiency_avg}}%
CO2 avoided this month: {{co2_avoided_month}} kg

--- EV chargers ---
{{ev_chargers_json}}

--- Recent EV charging sessions (last 7 days) ---
{{ev_sessions_json}}

--- Anomalies detected in the last 24 h ---
{{anomalies_24h_json}}

Generate the insight list.
```

**Variable definitions:**

| Variable | Source | Type |
|---|---|---|
| `savings_target_kwh` | `sites.savings_target_kwh` | decimal |
| `week_energy_json` | last 7 rows from `site_energy_daily` ordered by date asc | JSON array |
| `self_sufficiency_avg` | computed from `site_energy_daily` last 30d | float, 1 decimal |
| `co2_avoided_month` | `sum(co2_avoided_kg)` from `site_energy_daily` this month | float |
| `ev_chargers_json` | rows from `ev_chargers` for site: `charge_point_id`, `status`, `last_heartbeat_at`, `max_power_kw` | JSON array |
| `ev_sessions_json` | rows from `ev_charging_sessions` joined to `ev_chargers` for site, last 7d: `start_time`, `end_time`, `energy_kwh`, `stop_reason` | JSON array |
| `anomalies_24h_json` | rows from `anomalies` for site where `created_at >= now() - 24h` | JSON array |

---

### Example Input Data

**`week_energy_json`:**
```json
[
  {"date":"2026-03-12","solar_kwh":40.1,"grid_import_kwh":20.3,"consumption_kwh":55.8,"self_use_kwh":35.5},
  {"date":"2026-03-13","solar_kwh":38.8,"grid_import_kwh":21.7,"consumption_kwh":57.1,"self_use_kwh":37.1},
  {"date":"2026-03-14","solar_kwh":41.2,"grid_import_kwh":19.6,"consumption_kwh":56.4,"self_use_kwh":36.8},
  {"date":"2026-03-15","solar_kwh":12.4,"grid_import_kwh":45.0,"consumption_kwh":54.9,"self_use_kwh":12.4},
  {"date":"2026-03-16","solar_kwh":39.7,"grid_import_kwh":22.1,"consumption_kwh":58.3,"self_use_kwh":36.2},
  {"date":"2026-03-17","solar_kwh":40.5,"grid_import_kwh":20.8,"consumption_kwh":56.0,"self_use_kwh":35.7},
  {"date":"2026-03-18","solar_kwh":42.3,"grid_import_kwh":18.7,"consumption_kwh":54.9,"self_use_kwh":36.2}
]
```

**`ev_chargers_json`:**
```json
[
  {
    "charge_point_id": "CP-001",
    "status": "Available",
    "last_heartbeat_at": "2026-03-18T14:30:00Z",
    "max_power_kw": 22.0
  },
  {
    "charge_point_id": "CP-002",
    "status": "Unavailable",
    "last_heartbeat_at": "2026-03-17T08:15:00Z",
    "max_power_kw": 22.0
  }
]
```

**`ev_sessions_json`:**
```json
[
  {"start_time":"2026-03-18T18:05:00Z","end_time":"2026-03-18T19:47:00Z","energy_kwh":16.4,"stop_reason":"Remote"},
  {"start_time":"2026-03-17T19:10:00Z","end_time":"2026-03-17T20:55:00Z","energy_kwh":14.8,"stop_reason":"EVDisconnected"}
]
```

---

### Example Expected Output

```json
[
  {
    "type": "warning",
    "category": "ev",
    "title": "Charger CP-002 offline for 30+ hours",
    "summary": "CP-002 has not sent a heartbeat since yesterday morning and may need a restart.",
    "detail": "Charger CP-002 last reported at 08:15 on March 17 — over 30 hours ago. An offline charger cannot serve drivers and may indicate a network or firmware issue. Check physical connectivity and attempt a remote reset via the OCPP management panel.",
    "impact": "Up to 22 kW charging capacity unavailable",
    "impactValue": 22,
    "impactUnit": "kW capacity lost",
    "action": "Remote Reset",
    "confidence": 95
  },
  {
    "type": "opportunity",
    "category": "ev",
    "title": "Shift EV charging to solar peak hours",
    "summary": "Both recent charging sessions started after 18:00, missing the 08:00–15:00 solar surplus window entirely.",
    "detail": "Your site generates its peak solar between 08:00 and 15:00, producing on average 38 kWh during that window. Scheduling EV sessions to start at 09:00 could displace up to 14 kWh per session from grid import to free solar energy, saving approximately 42 THB per session at the current grid rate.",
    "impact": "~42 THB saved per session",
    "impactValue": 42,
    "impactUnit": "THB/session",
    "action": "Set Charging Schedule",
    "confidence": 82
  },
  {
    "type": "achievement",
    "category": "solar",
    "title": "Solar output 7% above monthly average today",
    "summary": "Today's 42.3 kWh generation is the best single-day output in the last 7 days.",
    "detail": "The system produced 42.3 kWh today versus a 30-day average of 39.5 kWh — a 7% improvement likely driven by clear skies and low haze. This also pushed the month-to-date self-sufficiency average to 65.8%, approaching the 70% milestone.",
    "impact": "+2.8 kWh vs monthly average",
    "impactValue": 2.8,
    "impactUnit": "kWh above average",
    "action": null,
    "confidence": 91
  },
  {
    "type": "anomaly",
    "category": "solar",
    "title": "Solar output collapsed on March 15 (70% drop)",
    "summary": "March 15 recorded only 12.4 kWh from solar — a 70% drop relative to surrounding days.",
    "detail": "On March 15 the solar array generated 12.4 kWh while the adjacent days averaged 40 kWh. The grid compensated with a 45 kWh import, the highest single-day grid draw in 7 days. The cause may be heavy cloud cover, soiling, or a partial inverter fault. If the pattern repeats tomorrow, consider scheduling a panel inspection.",
    "impact": "-27.6 kWh generation lost",
    "impactValue": -27.6,
    "impactUnit": "kWh lost",
    "action": "View March 15 Data",
    "confidence": 88
  }
]
```

---

## Template 3 — Anomaly Detection

**Purpose:** Replace the rule-based `detectAnomalies()` in `worker.go` with
an AI-driven version that generates richer natural-language `description`
fields for the `anomalies` table, and decides severity more contextually.

The statistical pre-processing (current vs 7-day moving average) still
happens in Go code. The AI only classifies and describes what the numbers mean.

**Model:** claude-haiku-3-5 (fast, low cost; anomalies run per metric per hour)
**Token budget:** input ~400 tokens, output ~300 tokens

---

### System Prompt

```
You are an energy monitoring anomaly analyst. You receive a list of metric
deviations detected by statistical comparison of current readings against a
7-day moving average for the same hour-of-day.

For each deviation provided, output a classification with:
- A clear English description of what happened, what it means, and what could
  cause it. Write for a building manager, not an engineer.
- A severity: "low" (15–29% deviation), "medium" (30–49%), "high" (≥50%).
- Whether the anomaly warrants an immediate action (boolean).

Return only a JSON array where each object corresponds to the input items
in the same order:
{
  "metric": "<same metric name from input>",
  "severity": "low" | "medium" | "high",
  "description": "<string, 2–3 sentences>",
  "requires_action": <boolean>
}

If the deviation is explainable (e.g. it is Monday after a weekend baseline,
or a known seasonal pattern), lower the severity by one level and note the
reason in the description.
```

---

### User Prompt Template

```
Site: {{site_name}}
Current time: {{current_hour}}:00 {{site_timezone}}
Day of week: {{day_of_week}}

Deviations detected (ordered by deviation magnitude):
{{deviations_json}}

Site context:
- Peak hours: {{peak_start_hour}}:00–{{peak_end_hour}}:00
- Solar panels installed: {{has_solar}}
- Battery storage installed: {{has_battery}}
- EV chargers installed: {{ev_charger_count}}

Classify and describe each anomaly.
```

**Variable definitions:**

| Variable | Source | Type |
|---|---|---|
| `current_hour` | `extract(hour from now())` | int |
| `day_of_week` | Go `time.Weekday().String()` | string |
| `deviations_json` | output of the CTE query in `detectAnomalies()` | JSON array |
| `has_solar` | `exists(select 1 from devices where site_id=? and type='solar_panel')` | bool |
| `has_battery` | `exists(select 1 from devices where site_id=? and type='battery')` | bool |
| `ev_charger_count` | `count(*) from ev_chargers where site_id=?` | int |

**`deviations_json` element schema:**
```json
{
  "metric": "Solar Panel",
  "expected_w": 3200.0,
  "actual_w": 480.0,
  "deviation_pct": 85.0
}
```

---

### Example Input Data

```json
[
  {
    "metric": "Solar Panel",
    "expected_w": 3200.0,
    "actual_w": 480.0,
    "deviation_pct": 85.0
  },
  {
    "metric": "Grid",
    "expected_w": 1100.0,
    "actual_w": 3850.0,
    "deviation_pct": 250.0
  }
]
```

Site context: peak_start_hour=17, has_solar=true, ev_charger_count=2,
day_of_week=Saturday at 14:00.

---

### Example Expected Output

```json
[
  {
    "metric": "Solar Panel",
    "severity": "high",
    "description": "Solar output at 14:00 is 85% below the typical 3,200 W seen at this time of day over the last week, delivering only 480 W. On a Saturday afternoon in clear-season conditions this is unexpected and may indicate heavy cloud cover, panel soiling, or an inverter issue. If this continues past 16:00 a physical inspection is recommended.",
    "requires_action": true
  },
  {
    "metric": "Grid",
    "severity": "high",
    "description": "Grid import is drawing 3,850 W — 250% above the expected 1,100 W for this hour. The most likely cause is the collapsed solar output forcing the site to pull from the grid instead. Resolving the solar issue should automatically reduce grid dependency. If solar recovers and grid draw remains elevated, an unplanned high-consumption appliance may be running.",
    "requires_action": false
  }
]
```

**Notes:** The grid anomaly's `requires_action` is `false` because it is
downstream of the solar anomaly. The system prompt instructs the model to note
causal relationships.

---

## Template 4 — Weekly Pattern Analysis

**Purpose:** Analyse the 7-day hourly energy heatmap (the same data returned
by `WeeklyPattern()`) and produce a focused set of `opportunity` and
`achievement` insights oriented around time-of-use patterns.

This template is called once per week (e.g. every Monday) rather than daily.

**Model:** claude-sonnet-4-6
**Token budget:** input ~900 tokens, output ~1 200 tokens (2–4 insights)

---

### System Prompt

```
You are an energy efficiency consultant specialising in time-of-use
optimisation for commercial buildings with solar generation and EV charging.

You receive a 7-day hourly energy consumption heatmap for a site alongside
rate schedule information. Your task is to identify:

1. Off-peak hours that are consistently underutilised — good windows for
   shifting deferrable loads or scheduling EV charging.
2. Peak-tariff hours that show avoidable demand — quantify the potential
   savings if that load were shifted by 1–3 hours.
3. Hours where solar surplus is being exported to grid at a lower rate than
   the import rate — an opportunity for battery storage or demand shifting.
4. Days or hours where consumption is significantly lower than the rest of the
   week — this may indicate under-utilisation or an opportunity to
   pre-cool/pre-heat.

For each finding, emit one insight object in the same schema as Template 2.
Return only a valid JSON array, 2–4 items maximum.

Quantify every impact in monetary terms using the provided rates if possible.
If you cannot compute an exact value, provide a reasonable estimate and flag
it in the detail field.
```

---

### User Prompt Template

```
Site: {{site_name}}
Analysis period: {{week_start}} to {{week_end}} ({{site_timezone}})
Currency: {{currency}}
Grid import rate: {{grid_import_rate}} {{currency}}/kWh
Grid export rate: {{grid_export_rate}} {{currency}}/kWh
Peak hours: {{peak_start_hour}}:00–{{peak_end_hour}}:00 at {{peak_rate}} {{currency}}/kWh
Off-peak rate: {{off_peak_rate}} {{currency}}/kWh

Hourly consumption heatmap (kWh per hour, rows = hours 0–23, columns = Mon–Sun):
{{weekly_pattern_json}}

Peak solar generation window this site (estimated from 7-day data): {{solar_peak_start}}:00–{{solar_peak_end}}:00

Average daily EV sessions this week: {{avg_daily_ev_sessions}}
Average session start hour: {{avg_ev_start_hour}}:00
Average session energy: {{avg_ev_kwh}} kWh

Identify time-of-use optimisation opportunities and achievements.
```

**Variable definitions:**

| Variable | Source | Type |
|---|---|---|
| `week_start` | 7 days ago formatted `2006-01-02` | string |
| `week_end` | today formatted `2006-01-02` | string |
| `off_peak_rate` | `sites.off_peak_rate` | decimal |
| `weekly_pattern_json` | output of `WeeklyPattern()` — 24 rows with `hour`, `mon`–`sun` | JSON array |
| `solar_peak_start` | derived: first hour where avg solar > 30% of daily max | int |
| `solar_peak_end` | derived: last hour where avg solar > 30% of daily max | int |
| `avg_daily_ev_sessions` | `count(*) / 7` from `ev_charging_sessions` last 7d for site | float |
| `avg_ev_start_hour` | `avg(extract(hour from start_time))` | int |
| `avg_ev_kwh` | `avg(energy_kwh)` from `ev_charging_sessions` last 7d | float |

---

### Example Input Data

**`weekly_pattern_json` (abbreviated — full array has 24 rows):**
```json
[
  {"hour": 0, "mon": 0.4, "tue": 0.3, "wed": 0.4, "thu": 0.3, "fri": 0.5, "sat": 0.2, "sun": 0.2},
  {"hour": 8, "mon": 3.2, "tue": 3.1, "wed": 3.4, "thu": 3.0, "fri": 3.3, "sat": 1.2, "sun": 0.9},
  {"hour": 11, "mon": 4.8, "tue": 4.9, "wed": 5.1, "thu": 4.7, "fri": 4.6, "sat": 2.1, "sun": 1.8},
  {"hour": 14, "mon": 18.4, "tue": 17.9, "wed": 19.2, "thu": 18.7, "fri": 17.5, "sat": 6.3, "sun": 5.1},
  {"hour": 18, "mon": 16.2, "tue": 15.8, "wed": 14.7, "thu": 16.1, "fri": 15.9, "sat": 14.8, "sun": 13.5},
  {"hour": 19, "mon": 15.1, "tue": 14.6, "wed": 14.2, "thu": 15.8, "fri": 14.9, "sat": 13.2, "sun": 12.9}
]
```

avg_ev_start_hour: 18, solar_peak_start: 8, solar_peak_end: 15,
peak_start_hour: 17, peak_end_hour: 21

---

### Example Expected Output

```json
[
  {
    "type": "opportunity",
    "category": "ev",
    "title": "EV charging during peak tariff costs 40% more",
    "summary": "All EV sessions this week started at 18:00–19:00, squarely inside the peak tariff window costing 5.5 THB/kWh instead of 3.9 THB/kWh.",
    "detail": "With an average session consuming 15.6 kWh, each charge costs roughly 86 THB at peak versus 61 THB off-peak — a 25 THB penalty per session. Shifting session start to 09:00–14:00 would also overlap with peak solar output (08:00–15:00), potentially eliminating grid import for EV charging entirely on sunny days. At 2.3 sessions per day, the monthly opportunity is approximately 1,725 THB.",
    "impact": "~1,725 THB/month",
    "impactValue": 1725,
    "impactUnit": "THB/month",
    "action": "Set Charging Schedule",
    "confidence": 84
  },
  {
    "type": "opportunity",
    "category": "load",
    "title": "14:00 consumption spike could shift to off-peak",
    "summary": "Weekday consumption peaks at 18–19 kWh between 14:00 and 15:00 — coinciding with solar surplus and before peak tariff begins.",
    "detail": "The 14:00 hour shows the single largest consumption block of the week on weekdays, yet this falls within the solar generation window and before the 17:00 peak tariff. The load profile suggests HVAC pre-cooling is absent — running cooling 1–2 hours earlier could reduce thermal load during the 17:00–21:00 peak window where the same electricity costs 41% more. The potential saving depends on thermal mass but is estimated at 80–150 THB per weekday.",
    "impact": "~2,000–3,750 THB/month",
    "impactValue": 2875,
    "impactUnit": "THB/month (midpoint estimate)",
    "action": "Review HVAC Schedule",
    "confidence": 71
  },
  {
    "type": "achievement",
    "category": "solar",
    "title": "Weekend consumption is 65% lower — solar covers nearly all demand",
    "summary": "Saturday and Sunday consumption averages 30 kWh/day versus 56 kWh on weekdays, meaning solar alone covers ~140% of weekend demand.",
    "detail": "On both weekend days the building draws fewer than 2 kWh per hour outside of the 14:00 block, and solar generation easily covers that. The excess 10+ kWh being exported to the grid at the lower feed-in rate of 2.2 THB/kWh represents 22+ THB/day of potential battery storage value that is currently unrealised.",
    "impact": "22+ THB/day export opportunity",
    "impactValue": 22,
    "impactUnit": "THB/day",
    "action": null,
    "confidence": 88
  }
]
```

---

## Implementation Notes

### Calling Convention from Go Worker

The worker calls the Anthropic Messages API directly from
`pkg/insight/worker.go`. The request structure for each template follows:

```
POST https://api.anthropic.com/v1/messages
Authorization: x-api-key: {{ANTHROPIC_API_KEY}}
anthropic-version: 2023-06-01

{
  "model": "claude-sonnet-4-6",
  "max_tokens": 1800,
  "system": "<system prompt string>",
  "messages": [
    { "role": "user", "content": "<rendered user prompt string>" }
  ]
}
```

Parse `response.content[0].text` as JSON. Wrap the parse in a fallback: if
JSON decode fails, log the raw text and skip the insert (never crash the
worker on a malformed AI response).

### API Key

Add `ANTHROPIC_API_KEY` to `WorkerConfig` and to the worker's `.env`. It is
already referenced in `cmd/worker/main.go` via `configfile.NewEnvReader()`.

### Call Frequency and Cost Estimates

| Template | Frequency | Input tokens | Output tokens | Model | Cost/call (est.) |
|---|---|---|---|---|---|
| 1 — Daily Summary | Once/day/site | ~800 | ~300 | claude-sonnet-4-6 | ~$0.006 |
| 2 — Insight Generation | Once/day/site | ~1 400 | ~1 800 | claude-sonnet-4-6 | ~$0.025 |
| 3 — Anomaly Description | Per deviation/hour | ~400 | ~300 | claude-haiku-3-5 | ~$0.0003 |
| 4 — Weekly Pattern | Once/week/site | ~900 | ~1 200 | claude-sonnet-4-6 | ~$0.015 |

For a 10-site deployment the daily AI cost is approximately $0.31/day
(Templates 1 + 2) plus anomaly costs proportional to number of deviations
detected.

### Deduplication

Before inserting any AI-generated insight, apply the same deduplication check
already in `insertInsight()`: skip if a row with the same `site_id`, `type`,
`category`, and `title` exists within the last 24 hours (Template 2) or 7 days
(Template 4 weekly patterns).

### Confidence Floor

Any insight with `confidence < 50` must be discarded before writing to the
database. The system prompt already instructs the model not to emit them, but
this is a hard enforcement gate in Go code.

### Null / Missing Data Handling

If a data section is empty (e.g. no EV chargers), pass an empty JSON array
`[]` and a note: `"No EV chargers configured for this site."` — this prevents
the model from hallucinating EV-related insights.

### Error Handling

All API calls must be wrapped with a 30-second timeout context. Retry once on
HTTP 529 (overloaded) with a 5-second backoff. On any other error, log with
`slog.ErrorContext` and continue to the next site — never block the insight
pipeline on an API failure.
