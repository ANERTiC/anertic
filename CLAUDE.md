# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Run Commands

```bash
# Start dependencies (PostgreSQL/TimescaleDB, Redis, Mosquitto)
make dev-up

# Run individual services
make run-api        # REST API on :8080
make run-ocpp       # OCPP WebSocket server on :8081
make run-worker     # Background worker
make run-ingester   # Data ingestion pipeline

# Format code (gofmt + goimports with local module grouping)
make fmt

# Check formatting
make fmt-check

# Run tests
go test ./...
go test ./pkg/wsredis/   # single package

# Stop dependencies
make dev-down
```

### Frontend (web/app.anertic.com)

```bash
cd web/app.anertic.com
pnpm install
pnpm dev            # React Router dev server
pnpm build          # Production build
pnpm typecheck      # Type checking
pnpm format         # Prettier formatting
```

## Architecture

ANERTiC is an AI-powered energy monitoring platform with a multi-binary Go backend and a React frontend.

### Backend Services

Four binaries in `cmd/`, each with its own Dockerfile in `build/`:

- **api** — REST API using arpc + parapet + httpmux. Google OAuth auth, JWT-like token auth via hashed tokens stored in PostgreSQL.
- **ocpp** — OCPP WebSocket gateway for EV chargers. Supports OCPP 1.6 and 2.0.1 via subprotocol negotiation.
- **worker** — Background job processing and AI insights generation.
- **ingester** — Meter/sensor data ingestion pipeline.

### Key Patterns

**API handlers** follow the arpc pattern: `func(ctx context.Context, p *Params) (*Result, error)`. Routes are all POST with RPC-style naming (`site.list`, `device.create`). Response envelope is `{"ok": true, "result": ...}`.

**Database access** uses `pgctx` — the DB connection is stored in context via `pgctx.NewContext()` and accessed with `pgctx.Exec()`, `pgctx.QueryRow()`, etc. No repository/store layer; SQL is inline in handlers. Query building uses `pgstmt` for dynamic queries.

**Redis access** uses the same context pattern via `pkg/rdctx`.

**Validation** uses `moonrhythm/validator` — params structs implement a `Valid() error` method.

**OCPP architecture**: `ocpp.Hub` manages charge point connections and routes messages to version-specific `Router` implementations (`ocpp/v16/`, `ocpp/v201/`). External commands reach chargers via Redis pub/sub channels (`ocpp:cp:{chargePointID}`). The generic `ocpp.CallAction[P, R]()` helper unmarshals payloads, calls the typed handler, and replies. Each OCPP action lives in its own sub-package (e.g., `ocpp/v16/status/`, `ocpp/v16/transaction/`).

**Import ordering**: standard library, then external packages, then `github.com/anertic/anertic/...` (enforced by goimports with `-local` flag).

### Frontend

React Router 7 + Tailwind CSS 4 + shadcn/ui + Radix UI. Located in `web/app.anertic.com/`.

### Infrastructure

- PostgreSQL with TimescaleDB for time-series energy data
- Redis for pub/sub (OCPP commands, WebSocket streaming), caching
- Mosquitto MQTT broker for IoT devices
- Schema migrations in `schema/` (numbered SQL files, applied manually)
- Deployment via Nortezh platform (`make deploy-{api,ocpp,worker,ingester}`)

## Environment Variables

### API (`cmd/api`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_URL` | `postgres://anertic:anertic@localhost:5432/anertic?sslmode=disable` | PostgreSQL |
| `REDIS_URL` | `redis://localhost:6379` | Redis |
| `ADDR` | `:8080` | API server address |
| `OCPP_ADDR` | `:8081` | OCPP server address |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | — | Google OAuth |
| `GOOGLE_REDIRECT_URL` | `http://localhost:8080/auth/google/callback` | OAuth callback |
| `APP_URL` | `http://localhost:5173` | Frontend URL for auth redirects |

### Agentic (`cmd/agentic`)

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_URL` | `postgres://anertic:anertic@localhost:5432/anertic?sslmode=disable` | PostgreSQL |
| `REDIS_URL` | `redis://localhost:6379` | Redis |
| `AGENTIC_ADDR` | `:8082` | Agentic server address |
| `API_URL` | `http://localhost:8080` | Backend API base URL |
| `LLM_PROVIDER` | `anthropic` | LLM provider (`anthropic` or `openai`) |
| `LLM_MODEL` | `claude-opus-4-6` | Model ID |
| `LLM_MAX_TOKENS` | `16384` | Max output tokens |
| `LLM_TIMEOUT` | `60s` | Stream timeout |
| `ANTHROPIC_API_KEY` | — | Required when `LLM_PROVIDER=anthropic` |
| `OPENAI_API_KEY` | — | Required when `LLM_PROVIDER=openai` |
| `OPENAI_BASE_URL` | — | Custom OpenAI-compatible endpoint |

