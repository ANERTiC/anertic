# ANERTiC AI Insight Product — Overview & Flow

**Date:** 2026-03-19
**Issues:** #78, #79, #80, #81, #82, #84, #85, #86, #87
**Label:** `ai-insight-product`

---

## System Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DATA SOURCES                                  │
├──────────┬──────────┬──────────┬──────────┬─────────────────────────┤
│  Meters  │  Solar   │ Battery  │    EV    │   Site Config           │
│  (MQTT)  │ Panels   │ Storage  │ Chargers │   (tariffs, peaks)      │
└────┬─────┴────┬─────┴────┬─────┴────┬─────┴────────┬────────────────┘
     │          │          │          │               │
     ▼          ▼          ▼          ▼               │
┌─────────────────────────────────────┐               │
│       INGESTER (cmd/ingester)       │               │
│  MQTT subscribe → meter_readings    │               │
│  HTTP POST → meter_readings         │               │
└──────────────────┬──────────────────┘               │
                   │                                   │
                   ▼                                   │
┌──────────────────────────────────────────────────────┤
│              PostgreSQL + TimescaleDB                 │
│                                                      │
│  meter_readings ─── raw time-series                  │
│  site_energy_daily ─ daily aggregates                │
│  insights ────────── rule + AI insights              │
│  anomalies ───────── detected deviations             │
│  ai_briefs ───────── daily AI summaries    (NEW)     │
│  site_energy_score ─ daily scores          (NEW)     │
│  ai_generation_log ─ cost tracking         (NEW)     │
│  ev_chargers ─────── charger status                  │
│  ev_charging_sessions ─ session history              │
└──────────────────┬───────────────────────────────────┘
                   │
     ┌─────────────┴─────────────┐
     │                           │
     ▼                           ▼
┌────────────────┐    ┌──────────────────────────────────────┐
│  TIER 1: RULES │    │  TIER 2: AI (NEW)                    │
│  (Hourly)      │    │  (Daily @ 06:00 site-local)          │
│                │    │                                      │
│  Aggregate     │    │  Feature Extraction                  │
│  Daily         │    │       ▼                              │
│       ▼        │    │  Prompt Assembly (4 templates)       │
│  Detect        │    │       ▼                              │
│  Anomalies     │    │  Claude API Call (tool_use)          │
│  (>15% dev)    │    │       ▼                              │
│       ▼        │    │  Validate (schema + confidence ≥50)  │
│  Rule Checks   │    │       ▼                              │
│  • offline     │    │  Store (insights + ai_briefs + log)  │
│  • solar perf  │    │       ▼                              │
│  • grid depend │    │  Notify (Redis pub/sub)              │
│                │    │                                      │
│  source='rule' │    │  source='ai'                         │
└────────┬───────┘    └─────────────┬────────────────────────┘
         │                          │
         └────────────┬─────────────┘
                      │
                      ▼
┌──────────────────────────────────────────────────────────────┐
│                    API (cmd/api)                               │
│                                                              │
│  insight.summary ──────── AI confidence + daily summary      │
│  insight.list ─────────── Combined rule + AI insights        │
│  insight.dailyBrief ───── Full AI brief (NEW)                │
│  insight.anomalies ────── Anomaly list                       │
│  insight.savingsHistory ─ 14-day savings trend               │
│  insight.weeklyPattern ── 24×7 heatmap                       │
│  insight.regenerate ───── On-demand AI trigger (NEW)         │
│  insight.aiStatus ─────── Cost + generation status (NEW)     │
└──────────────────────┬───────────────────────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────────────────────┐
│                  FRONTEND (React Router 7)                     │
│                                                              │
│  /dashboard ── AI Insight Card + Live Energy Flow             │
│  /overview ─── Energy Score Ring + AI Summary + Insight Cards │
│  /insights ─── Full AI Hub: Pulse + Charts + Feed + Anomalies│
└──────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

```
Phase 0 ──▶ Phase 1 ──▶ Phase 2 ──▶ Phase 3 ──▶ Phase 4 ──▶ Phase 5
  │            │            │            │            │            │
  ▼            ▼            ▼            ▼            ▼            ▼
┌──────┐  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────┐
│ FIX  │  │ CORE AI  │ │ API +    │ │FRONTEND  │ │ mem0 +   │ │SCALE │
│BUGS  │  │ PIPELINE │ │ SCORE    │ │INTEGRATE │ │OBSERVE   │ │      │
│      │  │          │ │          │ │          │ │          │ │      │
│•read-│  │•pkg/llm/ │ │•daily   │ │•Replace  │ │•mem0     │ │•Multi│
│ ings │  │•features │ │ Brief   │ │ mock     │ │ client   │ │ lang │
│ table│  │•prompts  │ │ endpoint│ │ data     │ │•Grafana  │ │•Cust.│
│•grid │  │•daily    │ │•regen   │ │•Wire SWR │ │ dashboard│ │ tmpl │
│ class│  │ scheduler│ │ trigger │ │•Score    │ │•Quality  │ │•Fleet│
│•left │  │•ai_briefs│ │•energy  │ │ ring sub │ │ metrics  │ │ cross│
│ join │  │•cost ctrl│ │ score   │ │ scores   │ │•Weekly   │ │ site │
│•co2  │  │•validate │ │ compute │ │•Action   │ │ template │ │      │
│ 0.477│  │          │ │         │ │ buttons  │ │          │ │      │
└──────┘  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────┘
```

---

## Related Documents

| Document | Description |
|----------|-------------|
| [architecture-ai-insight.md](architecture-ai-insight.md) | Full 1207-line architecture design |
| [ai-prompt-templates.md](ai-prompt-templates.md) | 4 prompt templates with examples |
| [energy-score-design.md](energy-score-design.md) | Industry research + phased formula |
| [energy-score-research.md](energy-score-research.md) | Deep validation + benchmarks |

## Related Issues

| Issue | Title |
|-------|-------|
| #78 | Daily AI Insight Summary — Architecture & Pipeline |
| #79 | mem0 Integration Strategy |
| #80 | Worker Pipeline Design |
| #81 | AI Prompt Templates |
| #82 | Energy Score Formula |
| #84 | Frontend Design Audit — Current State |
| #85 | UI Research Patterns |
| #86 | AI Insight Pipeline & Services Architecture |
| #87 | Energy Score — Deep Validation & Benchmarks |
