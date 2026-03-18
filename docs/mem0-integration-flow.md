# mem0 Integration — Data Flow

**Date:** 2026-03-19
**Issue:** #79

---

## Integration Architecture

```
┌──────────────┐     ┌─────────────────┐     ┌──────────────┐
│  Before AI   │────▶│  Search mem0    │────▶│  Inject into │
│  generation  │     │  user_id:       │     │  LLM prompt  │
│              │     │  "site_{siteID}"│     │  as context   │
└──────────────┘     └─────────────────┘     └──────┬───────┘
                                                     │
                                                     ▼
                                              ┌──────────────┐
                                              │  Claude API  │
                                              │  generates   │
                                              │  insights    │
                                              └──────┬───────┘
                                                     │
                     ┌─────────────────┐              │
                     │  Write to mem0  │◀─────────────┘
                     │  "On 2026-03-19 │
                     │   solar was 42  │
                     │   kWh, +18%"    │
                     └────────┬────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │  Next day's search returns    │
              │  this memory as context       │
              │  → AI says "This is the 3rd  │
              │    week of improvement..."    │
              └───────────────────────────────┘
```

---

## Three Options (Phased)

### Option A: Historical Context Store (Phase 1 — Recommended)

mem0 stores past insight summaries per site. Before generating new insights, relevant memories are fetched and injected into the LLM prompt.

```
Worker hourly run (per site):
  1. Read metrics from PostgreSQL
  2. Search mem0: query="solar performance grid dependency", user_id="site_{siteID}"
  3. Build prompt: current metrics + past memories + site config
  4. Call Claude API → structured insights
  5. Store insights in PostgreSQL
  6. Write memory to mem0: summary of what was generated
```

**Write after generation:**
```json
POST /v1/memories/
{
  "messages": [{"role": "system", "content": "Site abc123 report 2026-03-19: Solar 42.3 kWh (+18%), Grid 12.1 kWh (-8%), Self-sufficiency 78%."}],
  "user_id": "site_abc123",
  "agent_id": "anertic-insights",
  "metadata": {"site_id": "abc123", "date": "2026-03-19", "category": "solar"}
}
```

**Search before generation:**
```json
POST /v1/memories/search/
{"query": "solar performance patterns and anomalies", "user_id": "site_abc123", "limit": 10}
```

### Option B: Per-Site Conversational AI Agent (Phase 2)

Each site has a persistent AI persona that builds knowledge over time. mem0 auto-extracts facts like:
- "Site abc123 has solar producing ~35-45 kWh on sunny days"
- "Grid import spikes every Monday morning 09:00-11:00"

```
user_id:  "site_{siteID}"
agent_id: "energy-advisor"
```

### Option C: Cross-Site Pattern Recognition (Phase 3)

Shared memory space for fleet-wide pattern matching.

```
Search: "solar drop 30%+, outcome"
→ "Site xyz789 had 38% solar drop. Root cause: inverter fault. Fixed by firmware update."
→ Inject into prompt for similar anomaly at another site
```

---

## Outcome Feedback Loop

```
User acknowledges/resolves insight
         │
         ▼
  UpdateStatus handler (api/insight/insight.go)
         │
         ▼
  Update insights table
         │
         ▼
  Write outcome to mem0:
  "Offline charger insight from 2026-03-18 resolved after technician restart"
```

---

## Memory Identity Strategy

```
user_id  = "site_{siteID}"         → per-site isolation
agent_id = "anertic-insights"      → system identifier
metadata = {site_id, date, insight_id, category, type}
```

---

## Integration Points in Codebase

| Location | Action |
|----------|--------|
| `pkg/insight/worker.go` generateSiteInsights() | Search mem0 before LLM call |
| `pkg/insight/worker.go` insertInsight() | Write memory after PostgreSQL insert |
| `api/insight/insight.go` UpdateStatus() | Write outcome on resolve/acknowledge |

### New file: `pkg/mem0/mem0.go`
HTTP client wrapping mem0 REST API using `httpclient.Do`.

---

## Decision Matrix

| Option | Complexity | Value | Phase |
|--------|-----------|-------|-------|
| A — Historical context | Low-Medium | High | Phase 1 |
| B — Conversational agent | High | Very High | Phase 2 |
| C — Cross-site patterns | Medium | High (long-term) | Phase 3 |
