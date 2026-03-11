# ANERTiC

AI-powered energy monitoring platform for solar production, grid usage, and EV charger management.

## Architecture

Multi-binary Go backend:

| Binary | Description |
|--------|-------------|
| `cmd/api` | REST API server (arpc + parapet) |
| `cmd/ingester` | Meter/sensor data ingestion pipeline |
| `cmd/worker` | Background job processing and AI insights |
| `cmd/ocpp` | OCPP 1.6/2.0 WebSocket server for EV chargers |

## Tech Stack

- **Go 1.26** with arpc, parapet, httpmux
- **PostgreSQL** with TimescaleDB for time-series data
- **Redis** for Pub/Sub, caching, and real-time WebSocket streaming
- **OCPP 1.6/2.0.1** for EV charger communication (multi-version)
- **MQTT** for IoT device integration

## Project Structure

```
cmd/
  api/            # API server entrypoint
  ingester/       # Data ingestion entrypoint
  worker/         # Background worker entrypoint
  ocpp/           # OCPP WebSocket server entrypoint
api/
  device/         # Device management endpoints
  insight/        # AI insight endpoints
  reading/        # Energy reading endpoints
  site/           # Site management endpoints
ocpp/             # OCPP core (Hub, ChargePoint, Router interface)
  v16/            # OCPP 1.6 handlers (authorize, boot, heartbeat, etc.)
  v201/           # OCPP 2.0.1 handlers (stub)
pkg/
  insight/        # Insight worker logic
  ocpp/           # Send commands to chargers via Redis pub/sub
  pipeline/       # Data ingestion pipeline
  rdctx/          # Redis context helpers
  rest/           # REST API utilities
  wsredis/        # WebSocket + Redis pub/sub broker
schema/           # SQL schema files (0001.sql, 0002.sql, etc.)
deploy/           # Docker Compose and deployment configs
docs/             # OCPP specification documents
```

## Development

```bash
# Start dependencies (PostgreSQL, Redis)
make dev-up

# Run services
make run-api
make run-worker
make run-ingester

# Format code
make fmt

# Stop dependencies
make dev-down
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_URL` | `postgres://anertic:anertic@localhost:5432/anertic?sslmode=disable` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `ADDR` | `:8080` | API server listen address |
