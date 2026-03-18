# ANERTiC AI Insight Product -- Architecture Design

**Date**: 2026-03-19
**Status**: Proposal
**Author**: Architecture Review

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Service Architecture Decision](#2-service-architecture-decision)
3. [Data Pipeline Architecture](#3-data-pipeline-architecture)
4. [LLM Integration Layer](#4-llm-integration-layer)
5. [Database Schema Evolution](#5-database-schema-evolution)
6. [Caching and Performance](#6-caching-and-performance)
7. [Real-time vs Batch Coexistence](#7-real-time-vs-batch-coexistence)
8. [API Surface](#8-api-surface)
9. [Observability](#9-observability)
10. [Configuration and Feature Flags](#10-configuration-and-feature-flags)
11. [Future Extensibility](#11-future-extensibility)
12. [Implementation Roadmap](#12-implementation-roadmap)

---

## 1. Current State Analysis

### Existing Services

```
                    +------------------+
                    |   Frontend (SPA) |
                    |  React Router 7  |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v---+  +------v-----+  +-----v------+
     |    API      |  |   OCPP     |  |  Ingester  |
     |  :8080      |  |  :8081     |  |  (MQTT)    |
     +------+------+  +-----+-----+  +-----+------+
            |              |              |
     +------v--------------v--------------v------+
     |            PostgreSQL + TimescaleDB        |
     +-------------------+------------------------+
                         |
     +-------------------v------------------------+
     |                  Redis                     |
     |   (sessions, pub/sub, real-time fanout)    |
     +--------------------------------------------+

     +--------------------------------------------+
     |              Worker (standalone)            |
     |   1h ticker -> aggregate -> detect -> gen   |
     +--------------------------------------------+
```

### Current Worker Pipeline (`pkg/insight/worker.go`)

The existing worker runs on a 1-hour ticker and executes three stages per site:

1. **aggregateDaily** -- upserts `site_energy_daily` from raw `readings` joined through `meters` and `devices`
2. **detectAnomalies** -- compares current-hour readings against 7-day moving average, inserts into `anomalies` table when deviation exceeds 15%
3. **generateSiteInsights** -- three rule-based checks:
   - Offline chargers (no heartbeat > 24h)
   - Solar performance vs 30-day average
   - Grid dependency vs 7-day average

**Strengths**: Simple, predictable, low cost, no external dependencies.

**Weaknesses**:
- Insights are formulaic -- always the same pattern of "X deviated Y% from Z-day average"
- No cross-domain reasoning (cannot correlate solar dip with EV charging spike)
- No actionable recommendations beyond hardcoded strings
- No daily narrative summary
- No cost optimization suggestions
- Cannot learn from site-specific patterns
- Frontend uses mock data for the daily summary (`generateMockInsights()`)

### Data Available for AI Reasoning

| Source | Table | Granularity | Fields |
|--------|-------|-------------|--------|
| Energy meters | `meter_readings` | Per-reading (~seconds) | power_w, energy_kwh, voltage_v, current_a, pf, thd, temperature |
| Daily aggregates | `site_energy_daily` | Daily | solar_kwh, grid_import/export, battery, consumption, self_use, co2 |
| EV chargers | `ev_charging_sessions` | Per-session | start/end time, energy_kwh, connector, id_tag |
| EV meter values | `ev_meter_values` | Per-sample | measurand, value, unit, phase |
| Charger status | `ev_chargers` | Point-in-time | status, heartbeat, firmware, registration |
| Site config | `sites` | Static | tariff rates, peak hours, thresholds, timezone |
| Anomalies | `anomalies` | Per-detection | metric, expected, actual, deviation, severity |
| Existing insights | `insights` | Per-generation | type, category, title, summary, impact, confidence |
| Devices | `devices` | Static | type (solar_panel, grid, battery, appliance), tag |
| Rooms/Floors | `rooms`, `floors` | Static | room-to-device assignment, floor level |

---

## 2. Service Architecture Decision

### Recommendation: Keep AI insight generation inside the existing `worker` binary

**Rationale**:

1. **The worker already owns the insight domain.** It has direct access to PostgreSQL, Redis, and the full insight pipeline. Splitting into a separate binary would duplicate DB connection management, config loading, and the aggregation stages that feed the AI.

2. **Deployment simplicity.** ANERTiC deploys via Nortezh with a single container per service. Adding a 5th binary means another deployment target, health check, scaling configuration, and on-call surface. The AI workload is batch (daily + triggered), not latency-sensitive, so it does not need independent horizontal scaling.

3. **Shared aggregation.** The hourly rule-based pipeline produces `site_energy_daily` rows and anomaly records that the AI pipeline consumes. Running them in the same process avoids race conditions and ensures the AI always sees fresh aggregates.

4. **Cost control.** A single worker process with a scheduler makes it straightforward to enforce one LLM call per site per day, preventing runaway costs from multiple replicas.

**When to reconsider**: If the worker needs more than one replica (e.g., 500+ sites each taking >30s to process), extract the AI generation into a separate binary that pulls jobs from a Redis queue. The design below supports this extraction cleanly.

### Target Architecture

```
     +------------------+
     |   Frontend (SPA) |
     +--------+---------+
              |
   +----------v-----------+
   |       API :8080       |
   |  insight.summary      |
   |  insight.list         |
   |  insight.dailyBrief   | <--- NEW endpoint
   |  insight.regenerate   | <--- NEW endpoint
   +----------+------------+
              |
   +----------v-------------------------+
   |        PostgreSQL + TimescaleDB     |
   +----------+--------------------------+
              |
              |  reads aggregated data
              |
   +----------v-----------+           +------------------+
   |     Worker            |           |   Anthropic API  |
   |                       |---------->|   (Claude)       |
   |  HOURLY PIPELINE:     |<----------|                  |
   |    aggregate daily    |           +------------------+
   |    detect anomalies   |
   |    rule-based insights|
   |                       |
   |  DAILY PIPELINE (NEW):|
   |    feature extraction |
   |    build LLM context  |
   |    call Anthropic API |
   |    parse + validate   |
   |    store AI insights  |
   |    notify via Redis   |
   |                       |
   |  TRIGGERED (NEW):     |
   |    Redis sub for      |
   |    on-demand regen    |
   +----------+------------+
              |
   +----------v-----------+
   |        Redis          |
   |  insights:{siteID}    | ---> WebSocket fanout to frontend
   |  ai:regen:{siteID}    | <--- trigger from API
   |  ai:cache:{siteID}    | ---> cache daily brief
   |  ai:cost:daily        | ---> cost tracking
   +------------------------+
```

### Service Interaction Diagram

```
  +----------+     POST /insight.regenerate     +----------+
  | Frontend | -------------------------------->|   API    |
  +----+-----+                                  +----+-----+
       |                                             |
       |  WebSocket (insights:{siteID})              | Redis PUBLISH ai:regen:{siteID}
       |                                             |
       |  +------------------------------------------v-------+
       |  |                    Redis                         |
       |  +------------------------------------------+-------+
       |                                             |
       |                                    SUBSCRIBE ai:regen:*
       |                                             |
       |                                     +-------v--------+
       |                                     |     Worker      |
       |                                     |                 |
       |                                     | 1. Query PG for |
       |                                     |    aggregated   |
       |                                     |    features     |
       |                                     |                 |
       |                                     | 2. Build prompt |
       |                                     |    from template|
       |                                     |                 |
       |                                     | 3. Call Claude  |
       |                                     |    API          |
       |                                     |                 |
       |                                     | 4. Parse JSON   |
       |                                     |    response     |
       |                                     |                 |
       |                                     | 5. Write to PG  |
       |                                     |    (insights,   |
       |                                     |     ai_briefs)  |
       |                                     |                 |
       |                                     | 6. PUBLISH      |
       |  <------ insights:{siteID} ---------+    Redis        |
       |                                     +-----------------+
       |
       | Also: Ingester writes readings --> PG --> Worker aggregates
       | Also: OCPP writes EV data     --> PG --> Worker aggregates
```

---

## 3. Data Pipeline Architecture

### Pipeline Stages

```
Raw Readings (meter_readings, ev_meter_values, ev_charging_sessions)
        |
        v
[Stage 1] AGGREGATION (existing, hourly)
        |  - site_energy_daily upsert
        |  - Per-device-type breakdowns
        v
[Stage 2] ANOMALY DETECTION (existing, hourly)
        |  - 7-day moving average comparison
        |  - Severity classification
        v
[Stage 3] RULE-BASED INSIGHTS (existing, hourly)
        |  - Offline charger check
        |  - Solar performance check
        |  - Grid dependency check
        v
[Stage 4] FEATURE EXTRACTION (NEW, daily at site's local 06:00)
        |  - Yesterday's full energy profile
        |  - 7-day and 30-day trends
        |  - EV charging session patterns
        |  - Cost calculations using site tariffs
        |  - Anomaly summary for the period
        |  - Device health status
        v
[Stage 5] AI PROMPT CONSTRUCTION (NEW)
        |  - Select template (daily_brief, weekly_report, anomaly_deep_dive)
        |  - Inject extracted features as structured data
        |  - Include site context (tariffs, timezone, device inventory)
        |  - Include previous insights for continuity
        v
[Stage 6] LLM CALL (NEW)
        |  - POST to Anthropic Messages API
        |  - Structured JSON output via tool_use
        |  - Retry with exponential backoff
        v
[Stage 7] RESPONSE VALIDATION (NEW)
        |  - JSON schema validation
        |  - Confidence score sanity check
        |  - Impact value range validation
        |  - Profanity/hallucination guard
        v
[Stage 8] STORAGE (NEW)
        |  - Insert into insights table (multiple rows)
        |  - Insert/update ai_briefs table (daily narrative)
        |  - Update ai_generation_log (cost tracking)
        v
[Stage 9] NOTIFICATION
        - Redis PUBLISH insights:{siteID}
        - (Future) Email digest, push notification
```

### Stage 4: Feature Extraction -- Detailed Design

The feature extractor produces a `SiteFeatures` struct that becomes the LLM's context window.

```go
// pkg/insight/features.go

type SiteFeatures struct {
    SiteID    string
    SiteName  string
    Timezone  string
    Currency  string
    Date      time.Time  // the day being analyzed

    // Tariff context
    GridImportRate  decimal.Decimal
    GridExportRate  decimal.Decimal
    PeakStartHour   int
    PeakEndHour     int
    PeakRate        decimal.Decimal
    OffPeakRate     decimal.Decimal

    // Yesterday's energy profile
    Yesterday EnergyDay
    // 7-day trailing averages
    Week7Avg  EnergyDay
    // 30-day trailing averages
    Month30Avg EnergyDay
    // Day-over-day trend (last 7 days)
    DailyTrend []EnergyDay

    // EV charging patterns (last 7 days)
    EVSessions     []EVSessionSummary
    EVTotalEnergy  decimal.Decimal
    EVAvgSessionKWh decimal.Decimal
    EVPeakHourPct  float64  // % of sessions during TOU peak

    // Device health
    Devices        []DeviceStatus
    OfflineMeters  int
    OfflineChargers int

    // Recent anomalies (last 48h)
    Anomalies []AnomalySummary

    // Previous AI insights (last 3 days, for continuity)
    RecentInsights []InsightSummary

    // Room/floor breakdown (if available)
    RoomBreakdown []RoomEnergy
}

type EnergyDay struct {
    Date           string
    SolarKWh       decimal.Decimal
    GridImportKWh  decimal.Decimal
    GridExportKWh  decimal.Decimal
    BatteryKWh     decimal.Decimal
    ConsumptionKWh decimal.Decimal
    SelfUseKWh     decimal.Decimal
    CO2AvoidedKg   decimal.Decimal
    SelfSufficiency float64  // self_use / consumption * 100
    EstimatedCost  decimal.Decimal  // calculated from tariff rates
}
```

The feature extraction runs 6-8 SQL queries against pre-aggregated data (`site_energy_daily`, `ev_charging_sessions`, `meters`, `anomalies`). Since it reads daily-level aggregates, not raw readings, each query should complete in <100ms even with 90 days of history.

### Stage 5: Prompt Construction

Each prompt template is a Go `text/template` that receives `SiteFeatures` and produces a system + user message pair. Templates live in `pkg/insight/prompts/` as embedded `.tmpl` files.

```
pkg/insight/prompts/
    daily_brief.tmpl       -- morning daily summary
    weekly_report.tmpl     -- weekly analysis (Sunday)
    anomaly_analysis.tmpl  -- deep dive on specific anomaly
    cost_optimization.tmpl -- cost-saving recommendations
```

---

## 4. LLM Integration Layer

### Package Structure

```
pkg/llm/
    llm.go          -- Client interface and factory
    anthropic.go    -- Anthropic Messages API implementation
    response.go     -- Response types and validation
    budget.go       -- Token budget management
    cost.go         -- Cost tracking
```

### Client Interface

```go
// pkg/llm/llm.go

type Client interface {
    Generate(ctx context.Context, req *Request) (*Response, error)
}

type Request struct {
    Model       string            // "claude-sonnet-4-20250514", "claude-haiku-4-20250414"
    System      string            // system prompt
    Messages    []Message         // user/assistant messages
    Tools       []Tool            // for structured output
    MaxTokens   int
    Temperature float64
    Metadata    map[string]string // for tracking (site_id, template)
}

type Message struct {
    Role    string // "user", "assistant"
    Content string
}

type Tool struct {
    Name        string
    Description string
    InputSchema json.RawMessage // JSON Schema
}

type Response struct {
    Content     string
    ToolCalls   []ToolCall
    InputTokens  int
    OutputTokens int
    Model        string
    StopReason   string
    Latency      time.Duration
}

type ToolCall struct {
    Name  string
    Input json.RawMessage
}
```

### Why Direct Anthropic API (Not an Abstraction Layer)

For this system, a direct Anthropic API client is the right choice:

1. **Single provider.** ANERTiC uses Claude exclusively. An abstraction layer for "maybe switching providers later" adds complexity without value today.
2. **Tool use for structured output.** Claude's tool_use feature provides reliable JSON extraction. The tool schema defines the exact insight structure, and Claude returns valid JSON matching the schema. This eliminates the need for regex-based response parsing.
3. **Simpler debugging.** When an insight looks wrong, you look at one API call with one provider. No translation layers to debug.

### Model Selection Per Template

| Template | Model | Rationale | Est. Cost/Call |
|----------|-------|-----------|----------------|
| `daily_brief` | claude-sonnet-4 | Needs deep reasoning about energy patterns | ~$0.015 |
| `weekly_report` | claude-sonnet-4 | Longer context, trend analysis | ~$0.025 |
| `anomaly_analysis` | claude-haiku-4 | Focused, single-anomaly analysis | ~$0.002 |
| `cost_optimization` | claude-sonnet-4 | Complex tariff calculations | ~$0.015 |

### Token Budget Management

```go
// pkg/llm/budget.go

type BudgetConfig struct {
    DailyBudgetUSD    decimal.Decimal  // e.g., 5.00
    PerSiteBudgetUSD  decimal.Decimal  // e.g., 0.10
    MaxInputTokens    int              // 8000 (keep context focused)
    MaxOutputTokens   int              // 2000
}

// Before each LLM call:
// 1. Check daily spend from ai_generation_log (sum of today's costs)
// 2. Check per-site spend (sum of today's costs for this site)
// 3. If either exceeds budget, skip generation and log warning
// 4. After call, record cost in ai_generation_log
```

Token estimation before sending:
- System prompt: ~500 tokens (fixed)
- Feature data: ~2000-4000 tokens (varies by site complexity)
- Previous insights: ~500 tokens
- Reserve for output: 2000 tokens

If the feature data exceeds `MaxInputTokens`, truncate older daily trends and reduce EV session detail.

### Response Validation and Retry

```go
func (w *Worker) callLLM(ctx context.Context, req *llm.Request) (*llm.Response, error) {
    var lastErr error
    for attempt := 0; attempt < 3; attempt++ {
        if attempt > 0 {
            // Exponential backoff: 2s, 8s
            time.Sleep(time.Duration(math.Pow(2, float64(attempt+1))) * time.Second)
        }

        resp, err := w.llm.Generate(ctx, req)
        if err != nil {
            lastErr = err
            // Retry on 429 (rate limit) and 529 (overloaded)
            // Do NOT retry on 400 (bad request) or 401 (auth)
            if isRetryable(err) {
                continue
            }
            return nil, err
        }

        // Validate structured output
        if err := validateInsightResponse(resp); err != nil {
            lastErr = err
            slog.WarnContext(ctx, "invalid LLM response, retrying",
                "attempt", attempt, "error", err)
            continue
        }

        return resp, nil
    }
    return nil, fmt.Errorf("LLM call failed after 3 attempts: %w", lastErr)
}
```

Validation checks on the parsed tool_call output:
- All required fields present (title, summary, type, category)
- `type` is one of: warning, opportunity, achievement, anomaly
- `category` is one of: solar, grid, battery, ev, load, cost
- `confidence` is 0-100
- `impactValue` is within reasonable range for the `impactUnit`
- Summary is 1-3 sentences (not empty, not a novel)
- Title is under 120 characters

### Structured Output via Tool Use

Define a tool that the LLM "calls" to structure its response:

```json
{
  "name": "publish_insights",
  "description": "Publish AI-generated energy insights for the site",
  "input_schema": {
    "type": "object",
    "required": ["dailyBrief", "insights"],
    "properties": {
      "dailyBrief": {
        "type": "string",
        "description": "2-4 sentence narrative summary of yesterday's energy performance, written in second person ('Your site...'). Reference specific numbers."
      },
      "insights": {
        "type": "array",
        "items": {
          "type": "object",
          "required": ["type", "category", "title", "summary", "detail", "impact", "impactValue", "impactUnit", "confidence"],
          "properties": {
            "type": { "type": "string", "enum": ["warning", "opportunity", "achievement", "anomaly"] },
            "category": { "type": "string", "enum": ["solar", "grid", "battery", "ev", "load", "cost"] },
            "title": { "type": "string", "maxLength": 120 },
            "summary": { "type": "string", "maxLength": 500 },
            "detail": { "type": "string", "maxLength": 2000 },
            "impact": { "type": "string", "maxLength": 50 },
            "impactValue": { "type": "number" },
            "impactUnit": { "type": "string" },
            "action": { "type": "string", "maxLength": 100 },
            "confidence": { "type": "integer", "minimum": 0, "maximum": 100 }
          }
        },
        "minItems": 1,
        "maxItems": 8
      }
    }
  }
}
```

---

## 5. Database Schema Evolution

### New Tables

Add to `schema/0001.sql` (modify original):

```sql
-- AI-generated daily briefs (one per site per day)
create table if not exists ai_briefs
(
    site_id      varchar(20) not null references sites (id),
    date         date        not null,
    brief        text        not null,  -- the narrative summary
    model        text        not null default '',  -- e.g. "claude-sonnet-4-20250514"
    prompt_version text      not null default '',  -- e.g. "daily_brief_v2"
    input_tokens  int        not null default 0,
    output_tokens int        not null default 0,
    latency_ms   int         not null default 0,
    created_at   timestamptz not null default now(),
    primary key (site_id, date)
);

-- LLM call cost tracking and audit log
create table if not exists ai_generation_log
(
    id             varchar(20) primary key not null,
    site_id        varchar(20) not null references sites (id),
    template       text        not null,  -- 'daily_brief', 'weekly_report', etc.
    model          text        not null,
    prompt_version text        not null default '',
    input_tokens   int         not null default 0,
    output_tokens  int         not null default 0,
    cost_usd       numeric(10, 6) not null default 0,
    latency_ms     int         not null default 0,
    status         text        not null default 'success',  -- 'success', 'error', 'budget_exceeded', 'validation_failed'
    error_message  text        not null default '',
    insights_count int         not null default 0,  -- number of insights generated
    created_at     timestamptz not null default now()
);

create index if not exists idx_ai_generation_log_site on ai_generation_log (site_id, created_at desc);
create index if not exists idx_ai_generation_log_date on ai_generation_log (created_at);
```

### Modifications to Existing Tables

Add to `sites` table:

```sql
-- AI feature flags (add to sites table in 0001.sql)
    ai_enabled            boolean not null default false,
    ai_model_preference   text    not null default '',  -- empty = use default per template
    ai_language           text    not null default 'en',  -- 'en', 'th'
```

Add `source` column to `insights` table to distinguish rule-based from AI-generated:

```sql
-- Add to insights table in 0001.sql
    source       text        not null default 'rule',  -- 'rule', 'ai'
    model        text        not null default '',
    prompt_version text      not null default '',
```

---

## 6. Caching and Performance

### Redis Cache Strategy

```
KEY                              TTL      PURPOSE
ai:brief:{siteID}:{date}        24h      Cached daily brief text (avoid re-reading PG)
ai:features:{siteID}:{date}     6h       Cached feature extraction (expensive queries)
ai:cost:daily:{YYYY-MM-DD}      48h      Running daily cost total (INCRBY after each call)
ai:cost:site:{siteID}:{date}    48h      Per-site daily cost total
ai:lock:gen:{siteID}            10min    Distributed lock preventing concurrent generation
ai:regen:{siteID}               N/A      Pub/sub channel for on-demand regeneration
```

### Avoiding Redundant LLM Calls

1. **Daily deduplication.** Before calling the LLM, check if `ai_briefs` already has a row for `(site_id, today)`. If it does, skip unless explicitly triggered via `insight.regenerate`.

2. **Distributed lock.** Use Redis `SET ai:lock:gen:{siteID} NX EX 600` before starting generation. If the lock exists, another process is already generating. This prevents duplicate calls when the worker restarts or is deployed.

3. **Feature cache.** Cache the extracted `SiteFeatures` JSON in Redis. If the daily aggregation has not changed since the last extraction (compare `site_energy_daily.updated_at` or a hash), reuse the cached features. This matters for re-generation triggers.

4. **Budget circuit breaker.** If `ai:cost:daily:{date}` exceeds the configured daily budget, refuse all new LLM calls for the rest of the day. This is checked before acquiring the generation lock.

### Pre-computed vs On-demand Aggregations

**Pre-computed (in the hourly pipeline, already exists):**
- `site_energy_daily` -- daily energy breakdown per site
- `anomalies` -- hourly anomaly detections

**Pre-computed (new, add to hourly pipeline):**
- EV session summary per day (total sessions, total energy, peak-hour percentage) -- store in a new `site_ev_daily` table or compute at feature extraction time from `ev_charging_sessions`

**On-demand (at feature extraction time):**
- 7-day and 30-day trend calculations from `site_energy_daily` (fast, indexed by `(site_id, date)`)
- Room-level energy breakdown (complex join, only computed if rooms are configured)
- Cost calculations using site-specific tariff rates (pure computation on aggregated data)

The TimescaleDB continuous aggregates (`readings_hourly`, `readings_daily`) are currently commented out in `0002_timescaledb.sql`. Enabling them would dramatically speed up the feature extraction queries that currently operate on raw `meter_readings`. **Recommendation: enable the continuous aggregates and compression policy as a prerequisite for the AI pipeline.**

---

## 7. Real-time vs Batch Coexistence

### Two-tier Architecture

```
TIER 1: HOURLY (existing, enhanced)             TIER 2: DAILY (new)
+--------------------------------------+        +--------------------------------------+
| Every 1 hour, for each site:         |        | Once daily at site's local 06:00:    |
|                                      |        |                                      |
| 1. Aggregate daily energy (upsert)   |        | 1. Extract features for yesterday    |
| 2. Detect anomalies (7-day avg)      |        | 2. Build LLM prompt from template    |
| 3. Rule-based insights:              |        | 3. Call Claude API                   |
|    - Offline chargers                |        | 4. Validate JSON response            |
|    - Solar performance               |        | 5. Store AI insights + daily brief   |
|    - Grid dependency                 |        | 6. Notify via Redis pub/sub          |
|    - (NEW) Meter offline check       |        |                                      |
|    - (NEW) Battery SoC anomaly       |        | Weekly (Sunday 07:00 local):         |
| 4. Notify via Redis pub/sub          |        | - Run weekly_report template         |
+--------------------------------------+        +--------------------------------------+
          |                                               |
          | source = 'rule'                               | source = 'ai'
          | confidence = 85-95                            | confidence = from LLM
          | immediate, low-latency                        | richer, contextual
          v                                               v
+--------------------------------------------------------------------+
|                     insights table                                  |
|  Both rule-based and AI insights coexist, filterable by source     |
+--------------------------------------------------------------------+
```

### Scheduling

The daily pipeline should respect the site's timezone. A site in `Asia/Bangkok` (UTC+7) should receive its daily brief at 06:00 ICT, which is 23:00 UTC the previous day.

```go
func (w *Worker) scheduleDailyPipeline(ctx context.Context) {
    ticker := time.NewTicker(5 * time.Minute) // check every 5 min
    defer ticker.Stop()

    for {
        select {
        case <-ctx.Done():
            return
        case <-ticker.C:
            sites, _ := w.listAISites(ctx) // sites where ai_enabled = true
            for _, site := range sites {
                loc, _ := time.LoadLocation(site.Timezone)
                now := time.Now().In(loc)
                // Run at 06:00 local time, only if not already run today
                if now.Hour() == 6 && now.Minute() < 5 {
                    if !w.hasRunToday(ctx, site.ID) {
                        go w.runAIPipeline(ctx, site)
                    }
                }
            }
        }
    }
}
```

### Real-time Anomaly Detection with AI Enrichment

When the hourly rule-based pipeline detects a high-severity anomaly (deviation >= 50%), it can trigger an immediate AI analysis using the lightweight `anomaly_analysis` template with Claude Haiku:

```
Hourly pipeline detects high-severity anomaly
        |
        v
Insert anomaly into `anomalies` table
        |
        v
If severity == "high" AND site.ai_enabled:
        |
        v
Build anomaly_analysis prompt (just this anomaly + 24h context)
        |
        v
Call Claude Haiku (fast, cheap)
        |
        v
Insert AI insight with category=anomaly, source=ai
        |
        v
Redis PUBLISH insights:{siteID} (real-time to frontend)
```

This gives users AI-enriched explanations for critical anomalies within minutes, not the next morning.

### WebSocket Notification Flow

The existing `pkg/wsredis` infrastructure already supports topic-based WebSocket fanout. The insight notification flow:

```
Worker: Redis PUBLISH insights:{siteID} '{"id":"...","type":"achievement","title":"..."}'
   |
   v
API process: wsredis.Hub subscribes to insights:* pattern
   |
   v
API process: Hub routes message to all WebSocket connections joined to topic {siteID}
   |
   v
Frontend: Receives event, shows toast notification, refreshes insight list
```

No changes needed to the WebSocket infrastructure. The frontend already has the `useSiteId()` hook to know which site's WebSocket topic to subscribe to.

---

## 8. API Surface

### New Endpoints

Add to `api/handler.go`:

```go
// AI Insights (new)
a.Handle("POST /insight.dailyBrief", am.Handler(insight.DailyBrief))
a.Handle("POST /insight.regenerate", am.Handler(insight.Regenerate))
a.Handle("POST /insight.aiStatus", am.Handler(insight.AIStatus))
```

### Endpoint Contracts

**insight.dailyBrief** -- Get today's AI-generated narrative brief

```go
type DailyBriefParams struct {
    SiteID string `json:"siteId"`
    Date   string `json:"date"` // optional, defaults to today
}

type DailyBriefResult struct {
    Brief         string    `json:"brief"`
    Date          string    `json:"date"`
    Model         string    `json:"model"`
    PromptVersion string    `json:"promptVersion"`
    GeneratedAt   time.Time `json:"generatedAt"`
}
```

The handler first checks Redis cache `ai:brief:{siteID}:{date}`, then falls back to the `ai_briefs` table. Returns empty string if no brief exists yet (site not AI-enabled or too early in the day).

**insight.regenerate** -- Trigger on-demand AI insight regeneration

```go
type RegenerateParams struct {
    SiteID string `json:"siteId"`
}

type RegenerateResult struct {
    Queued bool `json:"queued"`
}
```

Publishes to `ai:regen:{siteID}` Redis channel. The worker picks it up and runs the AI pipeline. Rate-limited to 3 regenerations per site per day (tracked via Redis counter).

**insight.aiStatus** -- Check AI generation status and cost for a site

```go
type AIStatusParams struct {
    SiteID string `json:"siteId"`
}

type AIStatusResult struct {
    Enabled           bool            `json:"enabled"`
    LastGeneratedAt   time.Time       `json:"lastGeneratedAt"`
    TodayCostUSD      decimal.Decimal `json:"todayCostUsd"`
    MonthCostUSD      decimal.Decimal `json:"monthCostUsd"`
    TotalInsightsAI   int             `json:"totalInsightsAi"`
    TotalInsightsRule  int             `json:"totalInsightsRule"`
    ModelPreference   string          `json:"modelPreference"`
    Language          string          `json:"language"`
}
```

### Modification to Existing Endpoints

**insight.summary** -- Enhance to include the daily brief:

```go
type SummaryResult struct {
    AIConfidence       int     `json:"aiConfidence"`
    DailySummary       string  `json:"dailySummary"` // NOW populated from ai_briefs, not latest achievement
    TotalSavingsMonth  float64 `json:"totalSavingsThisMonth"`
    SavingsTarget      float64 `json:"savingsTarget"`
    CO2AvoidedKg       float64 `json:"co2AvoidedKg"`
    SelfSufficiencyAvg float64 `json:"selfSufficiencyAvg"`
    InsightCount       int     `json:"insightCount"`
    NewCount           int     `json:"newCount"`
    AIEnabled          bool    `json:"aiEnabled"` // NEW
}
```

**insight.list** -- Add `source` filter:

```go
type ListParams struct {
    SiteID   string `json:"siteId"`
    Type     string `json:"type"`
    Category string `json:"category"`
    Status   string `json:"status"`
    Source   string `json:"source"` // NEW: "rule", "ai", or "" for both
}
```

---

## 9. Observability

### Metrics (via slog structured logging, ingested by Quickwit)

The system already uses Quickwit for centralized logging via `pkg/ops`. All metrics are emitted as structured slog events that Quickwit indexes and Grafana dashboards query.

```go
// After each LLM call
slog.InfoContext(ctx, "ai_generation_complete",
    "site_id", siteID,
    "template", template,
    "model", model,
    "input_tokens", resp.InputTokens,
    "output_tokens", resp.OutputTokens,
    "cost_usd", costUSD.String(),
    "latency_ms", resp.Latency.Milliseconds(),
    "insights_count", len(insights),
    "status", "success",
)

// On failure
slog.ErrorContext(ctx, "ai_generation_failed",
    "site_id", siteID,
    "template", template,
    "model", model,
    "error", err.Error(),
    "attempt", attempt,
    "status", "error",
)
```

### Key Metrics to Track

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Daily LLM cost (USD) | `ai_generation_log` sum | > $10/day |
| Per-site generation latency | `ai_generation_log.latency_ms` | p99 > 30s |
| LLM error rate | `ai_generation_log` where `status != 'success'` | > 10% in 1h |
| Validation failure rate | `ai_generation_log` where `status = 'validation_failed'` | > 5% in 1h |
| Budget exceeded events | `ai_generation_log` where `status = 'budget_exceeded'` | Any |
| Insights per generation | `ai_generation_log.insights_count` | Avg < 1 (LLM producing empty results) |
| Queue depth | Redis `ai:regen:*` pending messages | > 50 |
| Daily brief coverage | Sites with `ai_enabled` that have today's brief | < 90% by 08:00 local |

### Insight Quality Metrics

Quality is harder to measure automatically, but these proxies help:

1. **User engagement rate**: `insights WHERE source = 'ai' AND status != 'new'` / total AI insights. If users never acknowledge or act on AI insights, they are not valuable.

2. **Dismissal rate**: `insights WHERE source = 'ai' AND status = 'dismissed'` / total. High dismissal means the AI is producing noise.

3. **Action rate**: Insights with `action` field where the user clicked the action button (track via a new `acted_at` column).

4. **Confidence calibration**: Compare the AI's self-reported confidence against whether the insight was dismissed or acted upon. Over time, insights with confidence 90+ should have lower dismissal rates than those at 60.

5. **A/B comparison**: Rule-based and AI insights coexist. Compare engagement rates between `source = 'rule'` and `source = 'ai'` for the same category.

### Job Health Monitoring

```go
// Emit heartbeat every cycle
slog.InfoContext(ctx, "worker_heartbeat",
    "pipeline", "ai_daily",
    "sites_processed", processedCount,
    "sites_skipped", skippedCount,
    "cycle_duration_ms", cycleDuration.Milliseconds(),
)
```

Alert if the worker heartbeat is missing for > 2 hours (process crashed or stuck).

---

## 10. Configuration and Feature Flags

### Per-site AI Enablement

Controlled by the `ai_enabled` column on the `sites` table. Toggled via a new API endpoint:

```go
// In site.Update handler, add ai_enabled to updateable fields
// Or a dedicated endpoint:
a.Handle("POST /site.updateAI", am.Handler(site.UpdateAI))
```

When `ai_enabled` is false for a site:
- Daily AI pipeline skips the site
- `insight.regenerate` returns an error
- `insight.dailyBrief` returns empty
- Rule-based insights continue as before

### Model Selection

Three levels of configuration, in priority order:

1. **Site-level override**: `sites.ai_model_preference` (e.g., "claude-haiku-4-20250414" for cost-sensitive sites)
2. **Template-level default**: Each template specifies its preferred model in the template metadata
3. **Global default**: Environment variable `AI_DEFAULT_MODEL`

```go
func (w *Worker) selectModel(site *Site, template string) string {
    if site.AIModelPreference != "" {
        return site.AIModelPreference
    }
    if m, ok := templateDefaults[template]; ok {
        return m
    }
    return w.cfg.DefaultModel
}
```

### Prompt Versioning Strategy

Prompts are versioned by embedding a version string in each template file:

```
{{/* Version: daily_brief_v3 */}}
{{/* Model: claude-sonnet-4 */}}
{{/* MaxTokens: 2000 */}}
```

The version string is recorded in `ai_generation_log.prompt_version` and `ai_briefs.prompt_version`. This enables:

1. **A/B testing**: Run two versions of a prompt for different sites and compare quality metrics
2. **Rollback**: If a new prompt version produces worse insights, revert the template file. The version tag in the log tells you which version generated each insight.
3. **Audit**: Answer "why did the AI say X?" by looking up the prompt version and replaying the exact template + features.

### Environment Variables (New)

| Variable | Default | Description |
|----------|---------|-------------|
| `AI_ANTHROPIC_API_KEY` | (required) | Anthropic API key |
| `AI_DEFAULT_MODEL` | `claude-sonnet-4-20250514` | Default model for AI generation |
| `AI_DAILY_BUDGET_USD` | `5.00` | Max daily spend across all sites |
| `AI_PER_SITE_BUDGET_USD` | `0.10` | Max daily spend per site |
| `AI_MAX_REGEN_PER_DAY` | `3` | Max on-demand regenerations per site per day |
| `AI_ENABLED` | `true` | Global kill switch for all AI generation |

---

## 11. Future Extensibility

### Adding New Insight Types

The template-based system makes new insight types straightforward:

1. Create a new `.tmpl` file in `pkg/insight/prompts/`
2. Add a new entry to the template registry with model preference and schedule
3. Optionally extend `SiteFeatures` with new data fields
4. Deploy the worker -- no API changes needed, insights flow through the existing `insights` table

Example: **"Monthly Report"** insight type:
- Template: `monthly_report.tmpl`
- Schedule: 1st of each month at 08:00 local
- Model: claude-sonnet-4 (needs deep analysis of 30 days)
- Output: A single long-form insight with type="report" and a detailed multi-paragraph body

### Multi-language Insights

The `sites.ai_language` field controls the output language. The prompt template includes a language instruction:

```
{{if eq .Language "th"}}
Respond entirely in Thai. Use Thai numerals for percentages.
{{else}}
Respond in English.
{{end}}
```

Claude handles Thai fluently. The only consideration is that Thai text uses more tokens per "concept" than English, so the token budget should be ~30% higher for Thai output.

Future languages (Japanese, Chinese, etc.) require only adding the language option to the site settings UI and the prompt template conditional.

### Custom Insight Templates Per Site/Customer

For enterprise customers who want tailored insights:

1. Add a `sites.ai_custom_prompt` text column (or a JSON array of custom instructions)
2. The prompt builder appends the custom instructions to the system prompt:
   ```
   {{if .CustomPrompt}}
   Additional context from the site administrator:
   {{.CustomPrompt}}
   {{end}}
   ```
3. This allows site admins to add things like "We are a hospital, so power reliability insights are critical" or "Ignore battery metrics, we don't have a battery system"

### Feedback Loop

Add a thumbs-up/thumbs-down mechanism to insights:

```sql
-- Add to insights table
    feedback   text,  -- 'positive', 'negative', null
    feedback_at timestamptz
```

```go
a.Handle("POST /insight.feedback", am.Handler(insight.Feedback))
```

Over time, aggregate feedback data and include it in the prompt:
```
Historical note: Users at this site have marked solar-related insights as
helpful 85% of the time, but EV insights only 40% of the time.
Focus more on solar optimization.
```

---

## 12. Implementation Roadmap

### Phase 1: Foundation (1-2 weeks)

- [ ] Enable TimescaleDB continuous aggregates (`readings_hourly`, `readings_daily`) and compression
- [ ] Add `ai_enabled`, `ai_model_preference`, `ai_language` columns to `sites`
- [ ] Add `source`, `model`, `prompt_version` columns to `insights`
- [ ] Create `ai_briefs` and `ai_generation_log` tables
- [ ] Implement `pkg/llm/` package (Anthropic client, budget tracker, cost calculator)
- [ ] Write feature extraction queries (`pkg/insight/features.go`)
- [ ] Add environment variables and config loading to worker

### Phase 2: Core AI Pipeline (2-3 weeks)

- [ ] Create `daily_brief` prompt template
- [ ] Create `anomaly_analysis` prompt template
- [ ] Implement daily scheduler with timezone-aware execution
- [ ] Implement on-demand regeneration via Redis pub/sub
- [ ] Implement response validation and retry logic
- [ ] Implement distributed locking and deduplication
- [ ] Wire up cost tracking to `ai_generation_log`
- [ ] Add `insight.dailyBrief`, `insight.regenerate`, `insight.aiStatus` API endpoints
- [ ] Update `insight.summary` to pull from `ai_briefs`

### Phase 3: Quality and Observability (1-2 weeks)

- [ ] Add structured logging for all AI operations
- [ ] Set up Grafana dashboards for cost, latency, error rate
- [ ] Implement budget circuit breaker
- [ ] Add user feedback endpoint (`insight.feedback`)
- [ ] Create `weekly_report` and `cost_optimization` prompt templates
- [ ] Connect frontend to real API (replace `generateMockInsights()`)

### Phase 4: Polish and Extend (ongoing)

- [ ] A/B test prompt versions
- [ ] Add Thai language support
- [ ] Add custom prompt support for enterprise sites
- [ ] Real-time anomaly enrichment with Claude Haiku
- [ ] Monthly report template
- [ ] Email digest integration

---

## Appendix A: Prompt Template Example (daily_brief)

```
{{/* Version: daily_brief_v1 */}}
{{/* Model: claude-sonnet-4 */}}
{{/* MaxTokens: 2000 */}}

SYSTEM:
You are an AI energy advisor for ANERTiC, an energy monitoring platform. You analyze
energy data for buildings with solar panels, batteries, EV chargers, and grid connections.

Your role is to provide actionable, data-driven insights that help site operators reduce
energy costs, increase solar self-consumption, and improve operational efficiency.

Rules:
- Always reference specific numbers from the data (kWh, percentages, times)
- Write in second person ("Your site...", "You consumed...")
- Be concise and actionable
- Confidence scores should reflect data quality: 90+ if trends are clear, 60-70 if data is sparse
- Never fabricate data points not present in the input
- If a metric has no data, say so rather than guessing

{{if eq .Language "th"}}Respond entirely in Thai.{{end}}

USER:
## Site: {{.SiteName}}
Timezone: {{.Timezone}} | Currency: {{.Currency}}
Analysis date: {{.Date.Format "2006-01-02"}}

## Tariff Configuration
Grid import: {{.GridImportRate}} {{.Currency}}/kWh
Grid export: {{.GridExportRate}} {{.Currency}}/kWh
Peak hours: {{.PeakStartHour}}:00 - {{.PeakEndHour}}:00
Peak rate: {{.PeakRate}} {{.Currency}}/kWh | Off-peak: {{.OffPeakRate}} {{.Currency}}/kWh

## Yesterday's Energy
Solar: {{.Yesterday.SolarKWh}} kWh
Grid import: {{.Yesterday.GridImportKWh}} kWh
Grid export: {{.Yesterday.GridExportKWh}} kWh
Battery: {{.Yesterday.BatteryKWh}} kWh
Total consumption: {{.Yesterday.ConsumptionKWh}} kWh
Self-use: {{.Yesterday.SelfUseKWh}} kWh ({{printf "%.1f" .Yesterday.SelfSufficiency}}%)
CO2 avoided: {{.Yesterday.CO2AvoidedKg}} kg
Estimated cost: {{.Yesterday.EstimatedCost}} {{.Currency}}

## 7-Day Average
Solar: {{.Week7Avg.SolarKWh}} kWh | Grid: {{.Week7Avg.GridImportKWh}} kWh | Self-sufficiency: {{printf "%.1f" .Week7Avg.SelfSufficiency}}%

## 30-Day Average
Solar: {{.Month30Avg.SolarKWh}} kWh | Grid: {{.Month30Avg.GridImportKWh}} kWh | Self-sufficiency: {{printf "%.1f" .Month30Avg.SelfSufficiency}}%

## Daily Trend (Last 7 Days)
{{range .DailyTrend}}
{{.Date}}: Solar {{.SolarKWh}} | Grid {{.GridImportKWh}} | Self-use {{printf "%.0f" .SelfSufficiency}}%
{{end}}

{{if gt (len .EVSessions) 0}}
## EV Charging (Last 7 Days)
Total sessions: {{len .EVSessions}} | Total energy: {{.EVTotalEnergy}} kWh
Average per session: {{.EVAvgSessionKWh}} kWh
Sessions during peak hours: {{printf "%.0f" .EVPeakHourPct}}%
{{end}}

{{if gt (len .Anomalies) 0}}
## Recent Anomalies (Last 48h)
{{range .Anomalies}}
- [{{.Severity}}] {{.Description}} (deviation: {{printf "%.0f" .Deviation}}%)
{{end}}
{{end}}

## Device Health
Total devices: {{len .Devices}} | Offline meters: {{.OfflineMeters}} | Offline chargers: {{.OfflineChargers}}

{{if gt (len .RecentInsights) 0}}
## Previous Insights (for context continuity, do not repeat these)
{{range .RecentInsights}}
- [{{.Type}}] {{.Title}}
{{end}}
{{end}}

Generate a daily brief and up to 6 actionable insights using the publish_insights tool.
```

---

## Appendix B: Cost Estimation

Assumptions: 50 active sites, all AI-enabled.

| Operation | Frequency | Model | Input Tokens | Output Tokens | Cost/Call | Daily Cost |
|-----------|-----------|-------|-------------|---------------|-----------|------------|
| Daily brief | 50/day | sonnet-4 | ~3000 | ~1500 | ~$0.018 | $0.90 |
| Weekly report | 50/week | sonnet-4 | ~5000 | ~2000 | ~$0.028 | $0.20 |
| Anomaly enrichment | ~10/day | haiku-4 | ~1000 | ~500 | ~$0.001 | $0.01 |
| On-demand regen | ~5/day | sonnet-4 | ~3000 | ~1500 | ~$0.018 | $0.09 |
| **Total** | | | | | | **~$1.20/day** |

Monthly estimate: ~$36/month for 50 sites. With a $5/day budget ceiling, there is comfortable headroom for growth to ~200 sites before needing to revisit pricing.
