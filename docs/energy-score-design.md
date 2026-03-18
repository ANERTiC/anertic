# ANERTiC Energy Score — Research, Formula Design, and Recommendation

**Date:** 2026-03-19
**Status:** Design Proposal
**Scope:** `site_energy_daily`, `ev_charging_sessions`, `ev_chargers`, `meter_readings`, `sites`

---

## 1. Industry Standards Research Summary

### 1.1 ENERGY STAR (US EPA)

ENERGY STAR Portfolio Manager scores buildings on a 1–100 percentile scale comparing a building's **Energy Use Intensity (EUI)** against the national median for that building type, adjusted for weather (Heating Degree Days/Cooling Degree Days), operating hours, and occupancy. A score of 50 is median; 75+ qualifies for the ENERGY STAR label.

Key takeaway: the score is fundamentally a **peer-percentile rank**, not an absolute metric. This requires a large reference dataset which new platforms do not have. Not directly applicable to ANERTiC in its early stage.

### 1.2 NABERS (Australia)

NABERS rates buildings 0–6 stars based on measured energy consumption per unit of floor area (GJ/m²), normalized for hours of operation, weather, and tenancy occupancy. Ratings are based on metered actuals over 12 months.

Key takeaway: NABERS demands 12 months of continuous data and building-type reference benchmarks. Too slow-burn for a real-time dashboard score.

### 1.3 LEED (Green Building Council)

LEED EA Credit "Optimize Energy Performance" awards 1–20 points based on percentage energy cost savings vs. an ASHRAE 90.1 baseline model. The baseline model requires detailed building characteristics and simulation software.

Key takeaway: LEED is design-time, not operational. Not directly applicable.

### 1.4 US DOE Home Energy Score

The DOE HES predicts energy use from building characteristics (insulation, HVAC, windows) on a 1–10 scale compared to the median US home. It is asset-based (what could the building achieve) not operational-based (what is it actually doing).

Key takeaway: asset-based model requires structural input we do not have.

### 1.5 ISO 50001 / EnPIs (Energy Performance Indicators)

ISO 50001 uses normalized Energy Performance Indicators: `EnPI = Actual_EUI / Baseline_EUI`. Performance relative to an established baseline, adjusted for relevant variables (degree days, production volume). Commonly used in industrial settings.

Key takeaway: the concept of **improvement ratio vs. a rolling baseline** is directly applicable and is the basis for Option C below.

### 1.6 Microinverter / Residential Solar Platforms (SolarEdge, Enphase, Tesla Energy)

These platforms use composite scores combining:
- Self-consumption ratio (solar used on-site / solar generated)
- Self-sufficiency ratio (solar-covered consumption / total consumption)
- Export ratio (what fraction of solar went to the grid)
- Battery round-trip efficiency

Key takeaway: self-consumption and self-sufficiency ratios are the dominant signals for solar-equipped sites and are directly available in `site_energy_daily`.

### 1.7 Smart Building EMS Platforms (Schneider EcoStruxure, ABB Ability, Siemens Building X)

Enterprise BMS platforms typically score on five axes:
1. Energy intensity (kWh/m² or kWh/occupant)
2. Peak demand management (peak kW vs. contracted demand)
3. Renewable penetration rate
4. Carbon intensity (kg CO₂e/kWh consumed)
5. Cost variance vs. budget

Key takeaway: multi-axis composite scoring with operator-configurable weights is the industry best practice for commercial energy management platforms.

---

## 2. Formula Design

All three formulas map to the 0–100 scale that the frontend `ScoreRing` component expects, with the following band interpretation (already hard-coded in the UI):

| Score | Color | Label |
|-------|-------|-------|
| 90–100 | emerald | Excellent |
| 80–89 | emerald | Great |
| 70–79 | amber | Good |
| 60–69 | amber | Fair |
| 50–59 | amber | Needs work |
| <50 | red | Poor |

---

### Option A: Self-Sufficiency Weighted Score

**Philosophy:** The single most meaningful metric for a solar/battery site is how much of its own consumption it covers from clean sources. This option keeps the formula simple, transparent, and explainable to operators.

#### Formula

```
SS  = self_use_kwh / consumption_kwh        (0–1, capped at 1)
GEI = 1 - (grid_import_kwh / consumption_kwh)  (0–1, capped at 0 when grid > consumption)

Score_A = round(SS * 70 + GEI * 30)
```

Where:
- `SS` = Self-Sufficiency ratio. 70% weight because it directly measures how much clean energy covers real demand.
- `GEI` = Grid Efficiency Inversion. 30% weight because reducing grid dependency is the primary financial and environmental driver.
- Both values are clamped to [0, 1] before multiplication.

#### Worked Example — Good Solar Day

```
solar_kwh       = 30
consumption_kwh = 40
grid_import_kwh = 12
self_use_kwh    = 28   (min of solar and consumption, some solar exported)

SS  = 28 / 40 = 0.70
GEI = 1 - (12 / 40) = 0.70

Score_A = round(0.70 * 70 + 0.70 * 30)
        = round(49 + 21)
        = 70   → "Good"
```

#### Worked Example — Grid-Heavy Day

```
solar_kwh       = 5
consumption_kwh = 40
grid_import_kwh = 35
self_use_kwh    = 5

SS  = 5 / 40 = 0.125
GEI = 1 - (35 / 40) = 0.125

Score_A = round(0.125 * 70 + 0.125 * 30)
        = round(8.75 + 3.75)
        = 13   → "Poor"
```

#### Edge Case: No Solar (Grid-Only Monitoring Site)

When `solar_kwh = 0` and `self_use_kwh = 0`:

```
SS  = 0
GEI = 1 - (grid_import_kwh / consumption_kwh)

Score_A = round(0 * 70 + GEI * 30)
```

This means a grid-only site's maximum score is 30, which is misleading — a grid-only site cannot improve its solar. A site type flag (`hasSolar`) is needed to use a different formula path. See Section 4.

#### Edge Case: Zero Consumption

If `consumption_kwh = 0` (e.g., weekend, holiday), default to `Score_A = 50` (neutral) to avoid division by zero.

#### Pros

- Extremely simple to explain to facility managers
- Works well for solar + battery sites (the primary ANERTiC target)
- Low computation cost — uses only columns from `site_energy_daily`

#### Cons

- Ignores peak-hours behavior — two sites with identical self-sufficiency but different tariff patterns get the same score
- Grid-only sites cannot reach above 30/100 — ceiling effect is demotivating
- Does not reward EV smart charging or battery pre-charging strategies
- No carbon signal despite `co2_avoided_kg` being available

---

### Option B: Multi-Factor Composite Score

**Philosophy:** Reward all dimensions of good energy behavior. This is the most aligned with commercial EMS platforms and gives operators a clear picture of which axis to improve.

#### Five Sub-Scores (each 0–100)

**B1. Self-Sufficiency Score (SSS) — weight 35%**
```
SSS = min(1, self_use_kwh / consumption_kwh) * 100
```
Measures how much of demand is met from on-site clean sources. Zero when no solar, cap at 100.

**B2. Solar Utilization Score (SUS) — weight 20%**
```
SUS = min(1, self_use_kwh / solar_kwh) * 100
    = 0 if solar_kwh = 0
```
Measures what fraction of generated solar is actually consumed on-site (vs. exported). A high export rate when grid prices are low is OK, but high export during peak load indicates a missed opportunity. Rewarding self-consumption incentivizes battery charging and EV smart scheduling.

**B3. Peak Avoidance Score (PAS) — weight 20%**

Requires hourly data from `meter_readings`. Uses peak tariff window (`peak_start_hour`, `peak_end_hour`) from the `sites` table.

```
peak_grid_import_kwh     = sum of grid meter readings during peak hours
total_grid_import_kwh    = grid_import_kwh from site_energy_daily

peak_ratio = peak_grid_import_kwh / total_grid_import_kwh   (0–1)
PAS = (1 - peak_ratio) * 100
    = 100 if total_grid_import_kwh = 0
```

A site that only imports from the grid during off-peak hours scores 100. A site that imports equally day and night scores ~50. A site that imports heavily during peak hours scores near 0.

If `peak_rate = off_peak_rate = 0` (flat tariff configured), PAS defaults to 50 (neutral — no signal to act on).

**B4. Carbon Score (CS) — weight 15%**
```
carbon_intensity = grid_import_kwh * 0.42   (grid CO₂ factor, kg/kWh, Thailand grid)
avoided_carbon   = co2_avoided_kg           (from site_energy_daily)
total_carbon     = carbon_intensity + avoided_carbon

CS = (avoided_carbon / total_carbon) * 100
   = 0 if total_carbon = 0
```
Measures what share of total carbon footprint was avoided by solar. Sites with more solar relative to grid use score higher.

**B5. Device Health Score (DHS) — weight 10%**
```
total_chargers    = count of ev_chargers for site
offline_chargers  = count where last_heartbeat_at < now() - interval '6 hours'
offline_meters    = count of meters where is_online = false

DHS = 100 * (1 - (offline_chargers + offline_meters) / max(1, total_chargers + total_meters))
```
Penalizes sites with offline infrastructure. A faulted charger or dead meter means lost revenue and data gaps. Cap denominator at 1 to prevent division by zero.

#### Composite Formula

```
Score_B = round(
    SSS * 0.35 +
    SUS * 0.20 +
    PAS * 0.20 +
    CS  * 0.15 +
    DHS * 0.10
)
```

#### Worked Example — Well-Performing Site

```
solar_kwh          = 30
consumption_kwh    = 40
grid_import_kwh    = 12
self_use_kwh       = 28
peak_grid_import   = 2    (mostly imported off-peak)
co2_avoided_kg     = 12.6 (30 kWh * 0.42)
total_chargers     = 4
offline_chargers   = 0
total_meters       = 8
offline_meters     = 1

SSS = min(1, 28/40) * 100          = 70.0
SUS = min(1, 28/30) * 100          = 93.3
PAS = (1 - 2/12) * 100             = 83.3
CS  = 12.6 / (12*0.42 + 12.6)*100 = 12.6 / (5.04 + 12.6)*100 = 71.4
DHS = (1 - 1/12) * 100             = 91.7

Score_B = round(70.0*0.35 + 93.3*0.20 + 83.3*0.20 + 71.4*0.15 + 91.7*0.10)
        = round(24.5 + 18.7 + 16.7 + 10.7 + 9.2)
        = round(79.8)
        = 80   → "Great"
```

#### Worked Example — Grid-Only Site (No Solar)

```
solar_kwh          = 0
consumption_kwh    = 80
grid_import_kwh    = 80
self_use_kwh       = 0
peak_grid_import   = 15  (some peak imports)
co2_avoided_kg     = 0
total_chargers     = 2
offline_chargers   = 0
total_meters       = 3
offline_meters     = 0

SSS = 0
SUS = 0 (solar_kwh = 0, defined as 0)
PAS = (1 - 15/80) * 100 = 81.25
CS  = 0 / (80*0.42 + 0) = 0
DHS = (1 - 0/5) * 100 = 100

Score_B = round(0*0.35 + 0*0.20 + 81.25*0.20 + 0*0.15 + 100*0.10)
        = round(0 + 0 + 16.25 + 0 + 10)
        = 26   → "Poor"
```

This is still a ceiling problem for grid-only sites. See Section 4 for the per-site-type weight adjustment.

#### Worked Example — New Site, No Data

When all energy values are zero (first day after installation):
- All sub-scores are either 0 or their defined neutral default
- `DHS` reflects device health (if meters are online and chargers are healthy, DHS = 100)
- Score defaults to `round(0 + 0 + 50 + 0 + 100*0.10)` = **20** if no tariff config
- This is intentionally low — a new site should prompt the operator to configure tariffs and connect meters, which will naturally raise the score

#### Pros

- Rewards all five independent behaviors: clean supply, solar use, peak timing, carbon, device health
- Sub-scores can be surfaced individually ("Your Solar Utilization score is only 40 — consider scheduling EV charging during solar peak hours 10–15h")
- Device health penalty directly connects to operational reliability KPIs
- Works well for sites at any configuration level

#### Cons

- Requires hourly `meter_readings` query for PAS (more expensive than daily-only)
- Five sub-scores may confuse facility managers who want a single clear signal
- Carbon sub-score (CS) is highly correlated with SSS, which slightly double-counts the same behavior
- Peak Avoidance requires the peak window configured correctly in `sites` table; if misconfigured, PAS is misleading

---

### Option C: Benchmark-Relative Score

**Philosophy:** Compare today's performance against the site's own 30-day rolling baseline and recent 7-day trend. This approach is immune to site type (solar vs. grid-only) because it measures improvement, not absolute level.

#### Formula

```
baseline_ss    = avg(self_use_kwh / consumption_kwh) over last 30 days (excluding zeros)
today_ss       = self_use_kwh / consumption_kwh (today)

baseline_grid  = avg(grid_import_kwh) over last 7 days
today_grid     = grid_import_kwh (today)

ss_delta    = (today_ss - baseline_ss) / max(baseline_ss, 0.01)
grid_delta  = (baseline_grid - today_grid) / max(baseline_grid, 0.01)
               ^ positive means grid is DOWN vs baseline (good)

raw_score = 50                         (neutral baseline)
          + clamp(ss_delta   * 40, -25, 25)
          + clamp(grid_delta * 30, -20, 20)
          + charger_health_bonus        (0 to 5)

Score_C = clamp(round(raw_score), 0, 100)

charger_health_bonus = 5 * (1 - offline_chargers / max(1, total_chargers))
```

#### Worked Example — Improving Site

```
30-day avg SS:   55%
Today SS:        70%
7-day avg grid:  18 kWh
Today grid:      12 kWh
Chargers:        4 total, 0 offline

ss_delta   = (0.70 - 0.55) / 0.55 = +0.273  → clamp(+0.273 * 40, -25, 25) = +10.9
grid_delta = (18 - 12) / 18 = +0.333        → clamp(+0.333 * 30, -20, 20) = +10.0
health     = 5 * (1 - 0/4) = 5.0

Score_C = clamp(round(50 + 10.9 + 10.0 + 5.0), 0, 100)
        = clamp(round(75.9), 0, 100)
        = 76   → "Good"
```

#### Worked Example — Declining Site (New High Load Event)

```
30-day avg SS:   72%
Today SS:        45%  (cloud cover + high load)
7-day avg grid:  10 kWh
Today grid:      28 kWh
Chargers:        4 total, 1 offline

ss_delta   = (0.45 - 0.72) / 0.72 = -0.375 → clamp(-0.375 * 40, -25, 25) = -15
grid_delta = (10 - 28) / 10 = -1.8          → clamp(-1.8 * 30, -20, 20) = -20
health     = 5 * (1 - 1/4) = 3.75

Score_C = clamp(round(50 - 15 - 20 + 3.75), 0, 100)
        = clamp(round(18.75), 0, 100)
        = 19   → "Poor"
```

#### Edge Case: Cold Start (< 7 days of data)

When `baseline_ss = 0` and `baseline_grid = 0` (new site, no history):

```
ss_delta   = 0 (no history to compare against)
grid_delta = 0

Score_C = clamp(round(50 + 0 + 0 + health_bonus), 0, 100)
        = 50 + health_bonus
```

A brand-new site with all meters online and chargers healthy starts at 55. This is the most sensible cold-start behavior: neutral until there is enough history.

#### Edge Case: Grid-Only Site

A grid-only site with no solar has `ss_delta = 0` by definition (no baseline either). Score is driven entirely by grid reduction vs. trend and device health. A grid-only site that consistently reduces its consumption relative to its own trend will score above 50. This makes Option C the most universally fair formula across site types.

#### Pros

- No ceiling effect for grid-only sites
- Completely self-calibrating to each site's own history
- Graceful cold start (starts at neutral 50, not 0)
- Operators always understand "how have we been doing relative to ourselves"
- Resistant to weather variability — a cloudy week lowers the baseline, so a sunny day still rewards
- Does not require tariff configuration to produce a meaningful score

#### Cons

- Harder to explain: "Why did my score drop from 74 to 63?" requires surfacing delta factors
- A site that is consistently terrible gets a baseline of terrible, and 50 means "as bad as usual" — there is no absolute floor signal
- High variance for sites with irregular patterns (e.g., a factory that only operates 3 days/week)
- Score carries less cross-site comparability — two sites with score 75 may have very different absolute energy performance

---

## 3. Weight Justification Summary

### Why These Specific Weights for Option B

| Sub-score | Weight | Justification |
|-----------|--------|---------------|
| Self-Sufficiency | 35% | Largest single driver of energy independence, cost reduction, and carbon reduction. Directly tied to the primary value proposition of deploying solar. |
| Solar Utilization | 20% | Incentivizes smart scheduling (EV charging and battery pre-charge during solar peak). Curtailment is waste. |
| Peak Avoidance | 20% | In markets with time-of-use tariffs (Thailand has peak/off-peak rates in `sites`), shifting demand by 1 kWh can reduce cost by 3–5x. Behavioral incentive with measurable ROI. |
| Carbon Reduction | 15% | CO₂ avoided is a customer-facing KPI increasingly required for ESG reporting. Lower weight than financial metrics because most ANERTiC customers are optimizing cost first. |
| Device Health | 10% | Offline infrastructure silently corrupts the other four scores by falsifying data. A 10% penalty maintains data quality incentives without over-penalizing for a single transient outage. |

---

## 4. Handling Different Site Configurations

### Site Type Detection

Sites should be classified automatically from their device inventory:

```sql
select
    s.id,
    count(d.id) filter (where d.type = 'solar_panel') > 0 as has_solar,
    count(d.id) filter (where d.type = 'battery')     > 0 as has_battery,
    count(c.id)                                             as charger_count
from sites s
left join devices d on d.site_id = s.id and d.deleted_at is null
left join ev_chargers c on c.site_id = s.id
group by s.id
```

### Adjusted Weights Per Configuration

| Site Type | SSS | SUS | PAS | CS | DHS | Notes |
|-----------|-----|-----|-----|----|-----|-------|
| Solar + Battery + EV | 35% | 20% | 20% | 15% | 10% | Default weights as designed |
| Solar only (no battery) | 40% | 25% | 15% | 15% | 5% | SUS more important (no battery buffer). Peak avoidance lower (limited flexibility). |
| Solar + Battery (no EV) | 35% | 25% | 20% | 15% | 5% | SUS raised, DHS slightly lower (fewer devices to fail) |
| Grid-only (no solar) | 0% | 0% | 50% | 0% | 50% | No solar metrics apply. Score is purely about peak management and device health. |

For grid-only sites, the formula becomes:
```
Score_grid_only = round(PAS * 0.50 + DHS * 0.50)
```

This gives grid-only sites a meaningful 0–100 range driven by how well they manage demand timing and keep infrastructure online, and they can reach 100.

---

## 5. Cold-Start Problem

### Definition

A "cold-start" site has fewer than 7 days of `site_energy_daily` rows. Common causes:
- Newly commissioned site
- Site that previously had no meters
- Site recovering from a database gap

### Solutions Per Option

**Option A (Cold Start):** Full score is available from day 1, using only today's energy data. No history needed. Score = 0 on day 0 if no meters are sending data, which is correct.

**Option B (Cold Start):** Full score available from day 1. All five sub-scores can be computed from today's data alone (PAS uses today's hourly readings; DHS uses current device state). The score may be volatile in early days because a single unusual day has outsized influence. No special handling needed.

**Option C (Cold Start):** Use progressive baseline population:
- Days 1–6: Score = 50 (neutral) + health_bonus. Explicitly surface "Gathering baseline data (N/7 days)" in the UI tooltip.
- Days 7–29: Use available history as baseline (shorter window is fine)
- Day 30+: Full 30-day rolling baseline

---

## 6. Recalculation Frequency

### Recommended Schedule

| Trigger | Action | Latency |
|---------|--------|---------|
| Hourly worker tick | Recalculate full score for all sites, write to `site_energy_daily` as new `energy_score` column | ~60 min |
| On-demand via `site.overview` API | Read last computed score from DB, add real-time DHS from live meter/charger state | <100ms |
| Manual refresh via UI | Same as on-demand | <100ms |

### Why Not Real-Time?

The full score (especially Option B with PAS requiring hourly aggregation) involves multi-table joins across potentially millions of `meter_readings` rows. Computing it per-request would add 500ms–5s of latency. Pre-computing and caching in `site_energy_daily` keeps the API response under 100ms.

Device Health Score (DHS) is the only sub-score that changes in real time (a charger can go offline at any moment). The recommended approach is to compute DHS live in the API layer and blend it with the cached base score:

```
served_score = cached_score_without_DHS + live_DHS * 0.10
```

This gives operators an immediately responsive score when they reconnect a charger, without full recomputation.

---

## 7. Recommendation

### Recommended Formula: Option B (Multi-Factor Composite Score)

**Primary rationale:** ANERTiC's stated value proposition spans solar self-sufficiency, EV smart charging, peak avoidance, and carbon visibility. A single-axis score (Option A) would fail to capture the peak scheduling and device health behaviors that differentiate managed sites. A benchmark-relative score (Option C) is excellent for ongoing engagement but obscures absolute performance — two sites with the same trend score may have fundamentally different energy health.

Option B directly maps each of ANERTiC's five key platform features to a scored dimension:

| Platform Feature | Corresponding Sub-Score |
|-----------------|------------------------|
| Solar monitoring | SSS + SUS |
| EV smart charging | PAS (peak shift) + SUS (solar-timed EV charging) |
| Battery management | SUS (battery absorbs solar), PAS (battery covers peak) |
| Carbon reporting | CS |
| Device monitoring | DHS |

### Implementation Recommendation

**Phase 1 (MVP):** Implement Option A as the initial formula. It requires only `site_energy_daily`, is computable in a single SQL expression, and gives a working ring in the frontend within hours. Add `energy_score` and `prev_energy_score` columns to `site_energy_daily`.

**Phase 2:** Migrate to Option B. Add the site-type weight adjustment table. Expose sub-scores as a breakdown endpoint (`insight.scoreBreakdown`) so the UI can show "What's dragging your score down?" tooltips.

**Phase 3 (optional):** Layer in Option C's relative-trend signal as a `scoreTrend` bonus/penalty (±5 points) added on top of Option B's absolute score. This gives operators both an absolute benchmark (Option B) and a momentum signal (Option C trend), which is the pattern used by leading commercial EMS platforms.

---

## 8. Database Schema Changes Required

### 8.1 Add Energy Score to `site_energy_daily`

```sql
alter table site_energy_daily
    add column if not exists energy_score          smallint not null default 0,
    add column if not exists score_ss              smallint not null default 0,
    add column if not exists score_solar_util      smallint not null default 0,
    add column if not exists score_peak_avoidance  smallint not null default 0,
    add column if not exists score_carbon          smallint not null default 0,
    add column if not exists score_device_health   smallint not null default 0;
```

Storing sub-scores enables:
- Time-series trend charts per sub-score
- "Weakest sub-score" insight generation in the worker
- Historical score comparison (yesterday's score is in yesterday's row)

### 8.2 Index for Score Trend Queries

The `site.overview` API will need the last 7 days of scores for the `scoreChange` / `scoreTrend` fields:

```sql
create index if not exists idx_site_energy_daily_site_date
    on site_energy_daily (site_id, date desc);
```

This index already exists from the primary key `(site_id, date)` but an explicit index `desc` helps the `ORDER BY date DESC LIMIT 2` query for yesterday's score.

### 8.3 Peak Grid Import (Required for PAS)

The PAS sub-score needs peak-hour grid readings. This is computed from `meter_readings` where the meter's `channel = 'grid'` and the reading time falls within `peak_start_hour`–`peak_end_hour`. No schema change needed; the query is:

```sql
select coalesce(sum(r.energy_kwh), 0) as peak_grid_kwh
from meter_readings r
join meters m on m.id = r.meter_id
where m.site_id = $1
  and m.channel = 'grid'
  and r.time >= $2::date
  and r.time < $2::date + interval '1 day'
  and extract(hour from r.time at time zone $3) >= $4   -- peak_start_hour
  and extract(hour from r.time at time zone $3) <  $5   -- peak_end_hour
```

Where `$3` is the site timezone, `$4`/`$5` are `peak_start_hour`/`peak_end_hour` from `sites`.

---

## 9. Go Implementation Sketch

The score computation belongs in `pkg/energyscore/energyscore.go`. It is called by the worker's hourly `processSite()` pipeline.

### Type Definitions

```go
// pkg/energyscore/energyscore.go

package energyscore

import "math"

// Input holds all daily data needed to compute the Energy Score.
// All kWh values are for a single calendar day in the site's local timezone.
type Input struct {
    SolarKwh        float64
    GridImportKwh   float64
    ConsumptionKwh  float64
    SelfUseKwh      float64
    CO2AvoidedKg    float64
    PeakGridImportKwh float64  // grid import during peak_start_hour..peak_end_hour

    HasSolar     bool
    HasBattery   bool
    ChargerCount int
    OfflineChargers int
    MeterCount   int
    OfflineMeterCount int

    PeakRate    float64
    OffPeakRate float64
}

// Result holds the computed score and sub-scores (each 0–100).
type Result struct {
    Score        int
    SelfSufficiency   int
    SolarUtilization  int
    PeakAvoidance     int
    Carbon            int
    DeviceHealth      int
}

// Compute returns the Option B composite energy score.
func Compute(in Input) Result {
    r := Result{}

    if in.ConsumptionKwh == 0 {
        r.Score = 50 // neutral: no activity
        return r
    }

    // --- SSS: Self-Sufficiency ---
    sss := math.Min(1.0, in.SelfUseKwh/in.ConsumptionKwh) * 100

    // --- SUS: Solar Utilization ---
    sus := 0.0
    if in.SolarKwh > 0 {
        sus = math.Min(1.0, in.SelfUseKwh/in.SolarKwh) * 100
    }

    // --- PAS: Peak Avoidance ---
    pas := 50.0 // neutral when no tariff differentiation
    if in.PeakRate != in.OffPeakRate && in.GridImportKwh > 0 {
        peakRatio := in.PeakGridImportKwh / in.GridImportKwh
        pas = (1 - peakRatio) * 100
    } else if in.GridImportKwh == 0 {
        pas = 100 // no grid import = perfect peak avoidance
    }

    // --- CS: Carbon ---
    cs := 0.0
    totalCarbon := in.GridImportKwh*0.42 + in.CO2AvoidedKg
    if totalCarbon > 0 {
        cs = (in.CO2AvoidedKg / totalCarbon) * 100
    }

    // --- DHS: Device Health ---
    totalDevices := in.ChargerCount + in.MeterCount
    offlineDevices := in.OfflineChargers + in.OfflineMeterCount
    dhs := 100.0
    if totalDevices > 0 {
        dhs = (1.0 - float64(offlineDevices)/float64(totalDevices)) * 100
    }

    // --- Weights by site type ---
    var wSSS, wSUS, wPAS, wCS, wDHS float64
    if !in.HasSolar {
        // Grid-only: peak + health only
        wSSS, wSUS, wPAS, wCS, wDHS = 0, 0, 0.50, 0, 0.50
    } else if in.HasSolar && !in.HasBattery {
        wSSS, wSUS, wPAS, wCS, wDHS = 0.40, 0.25, 0.15, 0.15, 0.05
    } else {
        // Solar + Battery (with or without EV)
        wSSS, wSUS, wPAS, wCS, wDHS = 0.35, 0.20, 0.20, 0.15, 0.10
    }

    composite := sss*wSSS + sus*wSUS + pas*wPAS + cs*wCS + dhs*wDHS

    r.Score = clamp(int(math.Round(composite)), 0, 100)
    r.SelfSufficiency = clamp(int(math.Round(sss)), 0, 100)
    r.SolarUtilization = clamp(int(math.Round(sus)), 0, 100)
    r.PeakAvoidance = clamp(int(math.Round(pas)), 0, 100)
    r.Carbon = clamp(int(math.Round(cs)), 0, 100)
    r.DeviceHealth = clamp(int(math.Round(dhs)), 0, 100)

    return r
}

func clamp(v, lo, hi int) int {
    if v < lo {
        return lo
    }
    if v > hi {
        return hi
    }
    return v
}
```

### Worker Integration

In `pkg/insight/worker.go`, after `aggregateDaily()`, add a call to `computeEnergyScore()`:

```go
// After aggregateDaily in processSite():
if err := w.computeEnergyScore(ctx, siteID); err != nil {
    slog.ErrorContext(ctx, "failed to compute energy score", "siteID", siteID, "error", err)
}
```

The `computeEnergyScore` method:
1. Reads today's `site_energy_daily` row
2. Reads today's peak-hour grid import from `meter_readings`
3. Reads charger/meter online counts
4. Calls `energyscore.Compute(input)`
5. Updates `site_energy_daily` with all six score columns

### API Layer Change

Add `energyScore`, `scoreChange`, `scoreTrend`, and sub-scores to the `insight.summary` handler response. The frontend's `SiteOverview.energyScore` field maps directly to the stored `energy_score` column. The `scoreChange` is computed as `today_score - yesterday_score` via a single SQL query:

```sql
select
    coalesce((select energy_score from site_energy_daily
              where site_id = $1 and date = now()::date), 0) as today_score,
    coalesce((select energy_score from site_energy_daily
              where site_id = $1 and date = now()::date - 1), 0) as yesterday_score
```

---

## 10. Summary Table

| Criterion | Option A | Option B | Option C |
|-----------|----------|----------|----------|
| Formula complexity | Low | Medium | Medium |
| Data requirements | Daily only | Daily + hourly | Daily + 30d history |
| Works from day 1 | Yes | Yes | No (starts at 50) |
| Grid-only site support | Poor (max 30) | Good (weight swap) | Excellent |
| Explainability | High | Medium (5 axes) | Low ("better than baseline") |
| Cross-site comparability | High | High | Low |
| Incentivizes peak shifting | No | Yes (PAS) | Indirectly |
| Incentivizes EV smart charging | No | Yes (PAS + SUS) | Indirectly |
| Incentivizes device maintenance | No | Yes (DHS) | Partial |
| Cold-start behavior | Neutral | Neutral | Explicitly neutral (50) |
| Recommended phase | MVP/Phase 1 | Production/Phase 2 | Trend signal/Phase 3 |

**Final Recommendation:** Ship Option A immediately to unblock the frontend (replaces hardcoded mock value of 78). Migrate to Option B within one sprint once the worker's `processSite()` pipeline is extended and `site_energy_daily` has the six new score columns. Layer in Option C's trend signal as ±5 bonus/penalty in Phase 3.
