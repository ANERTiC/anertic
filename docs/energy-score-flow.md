# Energy Score — Calculation Flow

**Date:** 2026-03-19
**Issues:** #82, #87

---

## Score Calculation Pipeline

```
┌─────────────────────────────────────────────────────────┐
│                 SITE DAILY DATA                          │
│  site_energy_daily + meter_readings + ev_sessions        │
└───────────────────────┬─────────────────────────────────┘
                        │
          ┌─────────────┼─────────────┐
          │             │             │
          ▼             ▼             ▼
    ┌───────────┐ ┌───────────┐ ┌───────────┐
    │ SSS: Self │ │ SUS: Solar│ │ PAS: Peak │
    │ Sufficiency│ │ Utiliz.  │ │ Avoidance │ ───┐
    │           │ │           │ │           │    │ EV sites:
    │ self_use  │ │ self_use  │ │ offpeak   │    │ blend with
    │ ────────  │ │ ────────  │ │ ────────  │    │ EVLSS
    │ consumpt. │ │ solar     │ │ total_imp │    │
    └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ ◄──┘
          │             │             │
          │             │             │         ┌───────────┐
          │             │             │         │ DHS: Device│
          │             │             │         │ Health     │
          │             │             │         │           │
          │             │             │         │ online    │
          │             │             │         │ ────────  │
          │             │             │         │ total     │
          │             │             │         └─────┬─────┘
          │             │             │               │
          ▼             ▼             ▼               ▼
┌─────────────────────────────────────────────────────────┐
│              ADAPTIVE WEIGHT SELECTION                    │
│                                                         │
│  Solar+Battery+EV:  SSS=35% SUS=20% PAS=25% DHS=15%    │
│  Solar only:        SSS=40% SUS=25% PAS=20% DHS=15%    │
│  Grid only:         ────── ─────── PAS=50% DHS=50%     │
│                                                         │
│  Null sub-scores excluded, weights renormalized         │
└───────────────────────┬─────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│           COMPOSITE ENERGY SCORE (0-100)                 │
│                                                         │
│  Score = Σ(wi × Si) / Σ(wi)  for non-null Si           │
│                                                         │
│  ≥80  Green  (Excellent/Great)                          │
│  60-79  Amber  (Good/Fair)                              │
│  <60  Red  (Needs work/Poor)                            │
│                                                         │
│  + Confidence (0-100) based on data quality             │
│  + Trend (improving/stable/declining) via 3d vs 14d EWMA│
└─────────────────────────────────────────────────────────┘
```

---

## Sub-Score Formulas

### SSS — Self-Sufficiency Score (0-100)

How much consumption is met by on-site generation.

```
self_use_kwh = max(0, consumption_kwh - grid_import_kwh)

SSS = clamp(self_use_kwh / consumption_kwh × 100, 0, 100)
```

- `null` when `has_solar = false` (weight redistributed)
- `null` when `consumption_kwh = 0`
- **Bug fix:** Previous formula `least(solar, consumption)` ignores battery discharge

### SUS — Solar Utilization Score (0-100)

How well generated solar is consumed vs wasted/exported.

```
SUS = clamp(self_use_kwh / solar_kwh × 100, 0, 100)
```

- `SUS = 0` when solar system exists but produced nothing (fault signal)
- `null` when `has_solar = false`

### PAS — Peak Avoidance Score (0-100)

Grid import during off-peak vs peak hours.

```
offpeak_fraction = offpeak_import_kwh / grid_import_kwh

PAS = clamp(offpeak_fraction × 100, 0, 100)
```

- `PAS = 100` when `grid_import_kwh = 0`
- For EV sites: `PAS_effective = PAS × 0.5 + EVLSS × 0.5`
- Requires hourly data from `meter_readings` joined via `meters.channel = 'grid'`

### DHS — Device Health Score (0-100)

Operational availability of meters and EV chargers.

```
healthy_units = online_meters + healthy_chargers (heartbeat < 30min)
total_units   = total_meters + total_chargers

DHS = clamp(healthy_units / total_units × 100, 0, 100)
```

- `null` when no equipment registered (cold start)

### EVLSS — EV Load Shift Score (Phase 2)

Whether EV sessions occur during off-peak/solar hours.

```
solar_sessions = count of sessions starting in solar_peak_start..solar_peak_end
total_sessions = count of all sessions in period

EVLSS = clamp(solar_sessions / total_sessions × 100, 0, 100)
```

### SRR — Savings Realization Rate (Phase 2)

Progress toward site savings target.

```
SRR = clamp(mtd_self_use_kwh / savings_target_kwh × 100, 0, 100)
```

---

## Adaptive Weight Tables

### Phase 1 Weights (4 sub-scores)

| Site Config | SSS | SUS | PAS | DHS |
|-------------|-----|-----|-----|-----|
| Solar + Battery + EV | 35% | 20% | 25% | 15% + 5% SRR |
| Solar + Battery | 40% | 25% | 20% | 15% |
| Solar only | 40% | 25% | 20% | 15% |
| Grid only | — | — | 50% | 50% |

### Phase 2 Weights (with EVLSS + SRR)

| Site Config | SSS | SUS | PAS+EVLSS | DHS | SRR |
|-------------|-----|-----|-----------|-----|-----|
| Solar + Battery + EV | 35% | 20% | 25% | 15% | 5% |
| Solar + Battery | 40% | 25% | 20% | 15% | — |
| Grid only | — | — | 50% | 50% | — |

Null sub-scores excluded, remaining weights renormalized to 100%.

---

## Confidence Score (4 factors)

```
confidence = 100

if data_days < 3:        confidence -= 40
elif data_days < 7:      confidence -= 20

if online_meters/total_meters < 0.8:  confidence -= 20

if hours_with_readings < 18:          confidence -= 10

if |solar + grid_import - grid_export - consumption| / consumption > 0.15:
    confidence -= 10     # energy balance inconsistency

confidence = max(0, confidence)
```

---

## Trend Detection (EWMA)

```
alpha = 2.0 / (period + 1)
ewma_today = alpha × score_today + (1 - alpha) × ewma_yesterday

trend_short = 3-day EWMA
trend_long  = 14-day EWMA
delta       = trend_short - trend_long

if delta > 3.0:   "improving"
if delta < -3.0:  "declining"
else:              "stable"
```

---

## Real-World Benchmarks (Thai Commercial Sites)

| Site Type | Expected Score | Notes |
|-----------|---------------|-------|
| Solar + battery, well-managed | 65–85 | Typical |
| Solar + battery, excellent | 85–95 | >85% self-sufficiency |
| Solar only, no battery | 45–70 | Evening grid dependency |
| Grid only | 30–80 | PAS + DHS only |
| New site, 1 week data | 40–60 | confidence=low |

---

## Schema

```sql
create table if not exists site_energy_score (
    site_id     varchar(20) not null references sites (id),
    date        date        not null,
    score       numeric(5,2),
    s_sss       numeric(5,2),
    s_sus       numeric(5,2),
    s_pas       numeric(5,2),
    s_dhs       numeric(5,2),
    confidence  smallint    not null default 0,
    trend       text        not null default 'unknown',
    trend_delta numeric(6,2) not null default 0,
    computed_at timestamptz not null default now(),
    primary key (site_id, date)
);
```

---

## Calculation Frequency

| Trigger | Action |
|---------|--------|
| Daily at 00:05 site-local | Full score for previous day |
| Hourly (existing worker) | Intraday preview (confidence=partial) |
| On-demand | `site.scoreRefresh` RPC for backfills |
