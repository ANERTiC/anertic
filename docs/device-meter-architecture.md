# Device & Meter Architecture

## Core Concept

**Devices are virtual containers.** They do not produce energy data themselves. All energy data flows through **meters**, which are physical or logical measurement points attached to a device.

```
Device (virtual) → Meter(s) (data source) → Meter Readings (time-series)
```

Every device type — meter, inverter, solar_panel, appliance — uses the `meters` table as its data source. There are no exceptions.

---

## Schema

### devices

```sql
create table if not exists devices
(
    id         varchar(20) primary key not null,
    site_id    varchar(20) references sites (id),
    name       text                    not null,
    type       text                    not null,     -- 'meter', 'inverter', 'solar_panel', 'appliance'
    tag        text                    not null default '', -- free text describing what the device measures or its location
    brand      text                    not null default '',
    model      text                    not null default '',
    metadata   jsonb                   not null default '{}',
    is_active  boolean                 not null default true,
    created_at timestamptz             not null default now(),
    updated_at timestamptz             not null default now()
);
```

### meters

```sql
create table if not exists meters
(
    id            varchar(20) primary key not null,
    device_id     varchar(20) references devices (id),
    serial_number text                    not null unique,
    protocol      text                    not null default 'mqtt', -- 'mqtt', 'http'
    vendor        text                    not null default '',
    phase         smallint                not null default 0,      -- 0: unassigned, 1: L1, 2: L2, 3: L3
    channel       text                    not null default '',     -- 'pv', 'grid', 'battery', 'load', 'ev', '' (general)
    config        jsonb                   not null default '{}',
    is_online     boolean                 not null default false,
    last_seen_at  timestamptz,
    created_at    timestamptz             not null default now(),
    updated_at    timestamptz             not null default now()
);
```

### meter_readings

```sql
create table if not exists meter_readings
(
    time                  timestamptz    not null,
    meter_id              varchar(20)    not null,
    power_w               numeric(12, 3),
    energy_kwh            numeric(12, 6),
    voltage_v             numeric(8, 2),
    current_a             numeric(8, 3),
    frequency             numeric(6, 2),
    pf                    numeric(4, 3),
    apparent_power_va     numeric(12, 3),
    reactive_power_var    numeric(12, 3),
    apparent_energy_kvah  numeric(12, 6),
    reactive_energy_kvarh numeric(12, 6),
    thd_v                 numeric(5, 2),
    thd_i                 numeric(5, 2),
    temperature_c         numeric(6, 2),
    metadata              jsonb          not null default '{}'
);
```

All columns except `time`, `meter_id`, and `metadata` are nullable — meters report only what they support.

---

## Device Types

### meter

Energy meters that measure consumption or flow at a distribution point. Use `tag` to describe what the meter measures (e.g. "Main DB", "Floor 2 Sub-DB", "Lobby AC circuit").

Phase configuration is determined by the meters attached to the device — a 3-phase setup has 3 meters (L1, L2, L3), a single-phase setup has 1 meter (phase=0).

### inverter

Solar or hybrid inverter. A single inverter can measure multiple channels simultaneously:

| Channel | Description | Typical Phase |
|---|---|---|
| `pv` | Solar PV DC input | 0 (DC, no phase) |
| `battery` | Battery charge/discharge | 0 (DC, no phase) |
| `grid` | Grid import/export | 1, 2, 3 (per phase) or 0 (single-phase) |
| `load` | Consumption output | 0 or per phase |

A hybrid inverter may have 6+ meters covering all channels and phases.

### solar_panel

PV panel or panel array. Measured via an attached meter or CT clamp.

| Channel | Description |
|---|---|
| `pv` | Solar generation output |

Typically 1 meter with channel=`pv`, phase=0.

### appliance

Individual energy-consuming device (AC unit, fridge, water heater, etc.).

| Channel | Description |
|---|---|
| `''` (general) | Power consumption |

Typically 1 meter with channel=`''`, phase=0. Measured via smart plug or sub-meter.

**Note:** EV chargers are appliances but use channel=`ev` instead of general, so the dashboard can display them separately.

---

## Why `channel` Lives on Meter, Not Device

A single device can have **multiple channels**. A hybrid inverter is one physical device but measures PV, battery, grid, and load simultaneously — each through a different meter.

**If channel were on device:**
- You'd need 4 separate devices for one physical inverter (pv device, grid device, battery device, load device) — that doesn't match reality
- Or the device only has one channel value, losing the ability to query by channel

**With channel on meter:**
- 1 inverter device → 6 meters (pv, battery, grid L1, grid L2, grid L3, load) — each meter knows what it measures
- Queries group by `meter.channel` directly — no extra joins or mapping tables
- Simple devices (appliance, solar_panel) just have 1 meter with channel=`''` — no overhead

```
Device: Huawei SUN2000 (inverter)
├── meter: HW-PV-001     channel=pv       phase=0
├── meter: HW-BAT-001    channel=battery   phase=0
├── meter: HW-GRID-L1    channel=grid      phase=1
├── meter: HW-GRID-L2    channel=grid      phase=2
├── meter: HW-GRID-L3    channel=grid      phase=3
└── meter: HW-LOAD-001   channel=load      phase=0
```

If channel were on the device, this would require 4 devices for one inverter — breaking the 1:1 mapping between physical hardware and virtual device.

---

## Meter Columns Detail

### phase (smallint)

Identifies which electrical line the meter is on.

| Value | Meaning |
|---|---|
| `0` | Unassigned (single-phase or DC measurement) |
| `1` | Line 1 (L1) |
| `2` | Line 2 (L2) |
| `3` | Line 3 (L3) |

### channel (text)

Identifies what the meter is measuring. Maps directly to dashboard categories.

| Value | Dashboard Label | Description | Sign Convention |
|---|---|---|---|
| `pv` | Solar | Solar PV generation | Positive = generating |
| `grid` | Grid | Grid connection | Positive = import, negative = export |
| `battery` | Battery | Battery storage | Positive = charging, negative = discharging |
| `ev` | EV | EV charger consumption | Positive = charging (special load) |
| `load` | Load | General consumption | Positive = consuming |
| `''` | General | Default / unclassified | Positive = consuming |

### protocol (text)

Communication protocol for data ingestion.

| Value | Description |
|---|---|
| `mqtt` | MQTT broker subscription |
| `http` | HTTP polling or webhook |

### config (jsonb)

Protocol-specific configuration. Structure varies by protocol:

**MQTT:**
```json
{
  "topic": "home/meter/L1/power",
  "broker": "mqtt://localhost:1883",
  "qos": 1
}
```

**HTTP:**
```json
{
  "url": "https://api.vendor.com/meter/123/readings",
  "method": "GET",
  "interval_sec": 30,
  "auth_header": "Bearer ..."
}
```

---

## Dashboard Categories

The dashboard displays energy flow by category. Each category maps directly to `meter.channel`:

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Solar   │     │   Grid   │     │ Battery  │     │    EV    │     │   Load   │
│ (pv)     │     │ (grid)   │     │(battery) │     │ (ev)     │     │(load+'') │
│          │     │          │     │          │     │          │     │          │
│ 5.2 kW   │     │ -1.2 kW  │     │ 0.8 kW   │     │ 3.5 kW   │     │ 2.1 kW   │
│ ▲ gen    │     │ ▼ export │     │ ▲ charge │     │ ▲ charge │     │ ▲ consume│
└──────────┘     └──────────┘     └──────────┘     └──────────┘     └──────────┘
```

**Site-level dashboard query:**

```sql
select m.channel,
       sum(r.power_w) as power_w
from devices d
join meters m on m.device_id = d.id
join lateral (
    select power_w
    from meter_readings
    where meter_id = m.id
    order by time desc
    limit 1
) r on true
where d.site_id = $1
  and d.is_active = true
group by m.channel
```

Result mapping:

| channel | power_w | Dashboard |
|---|---|---|
| `pv` | 5200 | Solar: 5.2 kW generating |
| `grid` | -1200 | Grid: 1.2 kW exporting |
| `battery` | 800 | Battery: 0.8 kW charging |
| `ev` | 3500 | EV: 3.5 kW charging |
| `load` | 2100 | Load: 2.1 kW consuming |
| `''` | 500 | Load: added to general load |

---

## Full Examples

### Example 1: Hybrid Inverter (3-phase grid connection)

**Device:**
```
id: dev_001, type: inverter, name: "Huawei SUN2000-10KTL", brand: "Huawei"
```

**Meters:**

| id | serial_number | channel | phase | protocol | description |
|---|---|---|---|---|---|
| mtr_001 | HW-PV-001 | pv | 0 | mqtt | Solar DC input |
| mtr_002 | HW-BAT-001 | battery | 0 | mqtt | Battery charge/discharge |
| mtr_003 | HW-GRID-L1 | grid | 1 | mqtt | Grid L1 |
| mtr_004 | HW-GRID-L2 | grid | 2 | mqtt | Grid L2 |
| mtr_005 | HW-GRID-L3 | grid | 3 | mqtt | Grid L3 |
| mtr_006 | HW-LOAD-001 | load | 0 | mqtt | Total load output |

### Example 2: Main Distribution Board (3-phase)

**Device:**
```
id: dev_002, type: meter, name: "Building MDB", tag: "Main distribution board"
```

**Meters:**

| id | serial_number | channel | phase | protocol |
|---|---|---|---|---|
| mtr_010 | ACME-MDB-L1 | (empty) | 1 | mqtt |
| mtr_011 | ACME-MDB-L2 | (empty) | 2 | mqtt |
| mtr_012 | ACME-MDB-L3 | (empty) | 3 | mqtt |

### Example 3: Floor Sub-DB (3-phase)

**Device:**
```
id: dev_003, type: meter, name: "Floor 2 SDB", tag: "Floor 2 sub-distribution board"
```

**Meters:**

| id | serial_number | channel | phase | protocol |
|---|---|---|---|---|
| mtr_020 | SDB-F2-L1 | (empty) | 1 | mqtt |
| mtr_021 | SDB-F2-L2 | (empty) | 2 | mqtt |
| mtr_022 | SDB-F2-L3 | (empty) | 3 | mqtt |

### Example 4: Appliance (smart plug)

**Device:**
```
id: dev_004, type: appliance, name: "Office AC Unit", tag: "2nd floor lobby"
```

**Meters:**

| id | serial_number | channel | phase | protocol |
|---|---|---|---|---|
| mtr_030 | PLUG-AC-001 | (empty) | 0 | mqtt |

### Example 5: Solar Panel Array

**Device:**
```
id: dev_005, type: solar_panel, name: "Rooftop PV Array", brand: "JA Solar"
```

**Meters:**

| id | serial_number | channel | phase | protocol |
|---|---|---|---|---|
| mtr_040 | CT-PV-001 | pv | 0 | mqtt |

### Example 6: Single-Phase Inverter (no battery)

**Device:**
```
id: dev_006, type: inverter, name: "Growatt MIN 5000TL-X"
```

**Meters:**

| id | serial_number | channel | phase | protocol |
|---|---|---|---|---|
| mtr_050 | GW-PV-001 | pv | 0 | http |
| mtr_051 | GW-GRID-001 | grid | 0 | http |

### Example 7: EV Charger (single-phase)

**Device:**
```
id: dev_007, type: appliance, name: "Wallbox Pulsar Plus", tag: "garage"
```

**Meters:**

| id | serial_number | channel | phase | protocol |
|---|---|---|---|---|
| mtr_060 | WB-EV-001 | ev | 0 | mqtt |

### Example 8: EV Charger (3-phase)

**Device:**
```
id: dev_008, type: appliance, name: "ABB Terra AC 22kW", tag: "parking lot"
```

**Meters:**

| id | serial_number | channel | phase | protocol |
|---|---|---|---|---|
| mtr_070 | ABB-EV-L1 | ev | 1 | mqtt |
| mtr_071 | ABB-EV-L2 | ev | 2 | mqtt |
| mtr_072 | ABB-EV-L3 | ev | 3 | mqtt |

---

## Aggregation Rules

### Device-Level (all meters under a device)

| Reading | Rule | Why |
|---|---|---|
| `power_w` | SUM | Total active power across all phases/channels |
| `apparent_power_va` | SUM | Total apparent power |
| `reactive_power_var` | SUM | Total reactive power |
| `energy_kwh` | SUM | Total active energy |
| `apparent_energy_kvah` | SUM | Total apparent energy |
| `reactive_energy_kvarh` | SUM | Total reactive energy |
| `current_a` | SUM | Total current draw |
| `voltage_v` | AVG | Voltage is per-phase, average gives system voltage |
| `frequency` | AVG | Same frequency across phases (grid-tied) |
| `pf` | Weighted AVG by `power_w` | Power factor weighted by load |
| `thd_v` | AVG | Average voltage distortion |
| `thd_i` | AVG | Average current distortion |
| `temperature_c` | MAX | Highest temperature across meters (safety) |

### Per-Channel Aggregation (Dashboard)

Filter meters by `channel` first, then apply the same rules. This is how the dashboard categories are computed:

- **Solar** → `where channel = 'pv'`, SUM power_w
- **Grid** → `where channel = 'grid'`, SUM power_w (negative = export)
- **Battery** → `where channel = 'battery'`, SUM power_w (negative = discharge)
- **EV** → `where channel = 'ev'`, SUM power_w
- **Load** → `where channel in ('load', '')`, SUM power_w

### Per-Phase Breakdown

Filter meters by `phase` to show L1/L2/L3 individually. Useful for:
- Phase imbalance detection
- Per-phase voltage/current monitoring

---

## SQL Query Examples

### Site dashboard — all categories

```sql
select m.channel,
       sum(r.power_w)    as total_power_w,
       sum(r.energy_kwh)  as total_energy_kwh
from devices d
join meters m on m.device_id = d.id
join lateral (
    select power_w, energy_kwh
    from meter_readings
    where meter_id = m.id
    order by time desc
    limit 1
) r on true
where d.site_id = $1
  and d.is_active = true
group by m.channel
```

### Device total power (latest reading per meter)

```sql
select d.id,
       d.name,
       sum(r.power_w)    as total_power_w,
       sum(r.energy_kwh)  as total_energy_kwh,
       sum(r.current_a)   as total_current_a,
       avg(r.voltage_v)   as avg_voltage_v,
       avg(r.frequency)   as avg_frequency
from devices d
join meters m on m.device_id = d.id
join lateral (
    select *
    from meter_readings
    where meter_id = m.id
    order by time desc
    limit 1
) r on true
where d.id = $1
group by d.id, d.name
```

### Per-phase breakdown for a device

```sql
select m.phase,
       r.power_w,
       r.voltage_v,
       r.current_a,
       r.pf
from meters m
join lateral (
    select *
    from meter_readings
    where meter_id = m.id
    order by time desc
    limit 1
) r on true
where m.device_id = $1
  and m.phase > 0
order by m.phase
```

### Per-channel breakdown for an inverter

```sql
select m.channel,
       sum(r.power_w)   as power_w,
       sum(r.current_a)  as current_a,
       avg(r.voltage_v)  as voltage_v
from meters m
join lateral (
    select *
    from meter_readings
    where meter_id = m.id
    order by time desc
    limit 1
) r on true
where m.device_id = $1
  and m.channel != ''
group by m.channel
```

### Site total consumption

```sql
select sum(r.power_w) as total_power_w
from devices d
join meters m on m.device_id = d.id
join lateral (
    select power_w
    from meter_readings
    where meter_id = m.id
    order by time desc
    limit 1
) r on true
where d.site_id = $1
  and d.is_active = true
```

---

## Edge Cases & Conventions

### 3-Phase Physical Meters

A real 3-phase meter (e.g., Schneider PM5350) has one serial number but reports 3 phases. In our model, this becomes 3 logical meters with suffixed serial numbers (e.g., `PM5350-001-L1`, `PM5350-001-L2`, `PM5350-001-L3`). A separate conversion API splits the single 3-phase message into 3 individual meter readings before ingestion.

### Cumulative energy_kwh

Real meters report **cumulative** energy counters (always increasing). Convention:
- Store cumulative values as-is in `meter_readings.energy_kwh`
- Calculate delta using TimescaleDB `last()` - `first()` within a `time_bucket` window:

```sql
select time_bucket('1 hour', time) as bucket,
       meter_id,
       last(energy_kwh, time) - first(energy_kwh, time) as consumed_kwh
from meter_readings
where meter_id = $1
  and time >= now() - interval '24 hours'
group by bucket, meter_id
order by bucket
```

### Battery State of Charge (SoC)

Battery meters need SoC percentage. Store in `meter_readings.metadata`:
```json
{"soc_pct": 72}
```

### Temperature

Stored as a dedicated column `temperature_c` on `meter_readings`. Queryable via TimescaleDB aggregates — no need to parse metadata.

### OCPP EV Charger

EV chargers are virtual devices like everything else. Energy data flows through the same `meter_readings` table.

**Two separate worlds:**
- `devices` + `meters` + `meter_readings` — unified energy data for dashboard
- `ev_*` tables (`ev_chargers`, `ev_charging_sessions`, `ev_connectors`, etc.) — OCPP protocol management only

**Linked by convention:** `ev_chargers.charge_point_id` = `meters.serial_number`. No FK between them.

**OCPP ingestion flow:**
1. Charger connects → BootNotification → creates `ev_chargers` row + auto-creates `devices` (type=appliance) + `meters` (channel=ev)
2. MeterValues arrives → OCPP handler finds meter by `serial_number = charge_point_id` → writes to `meter_readings`
3. `ev_meter_values` stays as raw OCPP audit log for debugging

**Measurand mapping:**

| OCPP Measurand | → | meter_readings Column |
|---|---|---|
| `Power.Active.Import` | → | `power_w` |
| `Energy.Active.Import.Register` | → | `energy_kwh` |
| `Energy.Reactive.Import.Register` | → | `reactive_energy_kvarh` |
| `Power.Reactive.Import` | → | `reactive_power_var` |
| `Voltage` | → | `voltage_v` |
| `Current.Import` | → | `current_a` |
| `Temperature` | → | `temperature_c` |
| OCPP phase `L1/L2/L3` | → | meter phase `1/2/3` |

**Result:** Dashboard uses one query on `meter_readings` grouped by `channel` — no special EV handling needed.

### Meter Replacement

When a physical meter is replaced:
1. Deactivate old meter (`is_online = false`)
2. Create new meter with new serial number under the same device
3. Historical data stays linked to old meter_id
4. Device persists as the virtual container — no data loss

### Virtual / Calculated Meters

For derived values that don't come from a physical sensor (e.g., "net consumption = MDB - solar export").

**Setup:**
- Create a device (type=meter, tag="calculated") with a meter (protocol=`calculated`)
- Worker runs on interval, queries existing meter_readings, computes result, writes back to `meter_readings`

**Flow:**
```
Worker (cron/interval)
    ↓
Query meter_readings from source meters
    ↓
Compute derived value (sum, diff, avg, etc.)
    ↓
Insert into meter_readings for the virtual meter
```

**Common calculated meters:**

| Name | Formula | Channel |
|---|---|---|
| Net consumption | MDB total - solar export | `load` |
| Self-consumption | solar generation - grid export | `load` |
| Grid balance | grid import - grid export | `grid` |

The meter_readings table doesn't care how values got there — physical or calculated meters look the same to the dashboard.

### Stale Readings

Queries using `JOIN LATERAL ... ORDER BY time DESC LIMIT 1` return the last known reading regardless of age. Application layer should check `meters.last_seen_at` against a staleness threshold (default: `sites.offline_threshold_minutes`) to flag stale data in the UI.

---

## Data Flow

```
Physical sensor
    ↓
Protocol (MQTT / HTTP)
    ↓
Ingester service
    ↓
Meter (identified by serial_number + protocol)
    ↓
meter_readings table (time-series, per meter)
    ↓
Aggregate by channel → Dashboard categories (Solar, Grid, Battery, EV, Load)
Aggregate by device  → Device detail page
Aggregate by site    → Site overview
```
