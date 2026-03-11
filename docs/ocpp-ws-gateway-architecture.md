# OCPP WebSocket Gateway Architecture

## Overview

The OCPP WebSocket Gateway handles the **full OCPP protocol** end-to-end — parsing messages, business logic, and writing directly to PostgreSQL.

The REST API's only role is to **initiate outbound commands** to chargers (RemoteStart, SetChargingProfile, etc.).

---

## Architecture

```
EV Charger
    |  wss://host/ocpp/{chargePointID}
    |  subprotocol: ocpp1.6 | ocpp2.0.1
    v
[ OCPP WS Gateway Pod ] (K8s, multiple replicas)
    |
    |-- ocpp.Handler          accepts WebSocket, negotiates version
    |-- ocpp.Hub              manages connections, routes commands
    |-- v16.Router            dispatches OCPP 1.6 actions
    |-- v201.Router           dispatches OCPP 2.0.1 actions
    |-- pgctx                 writes directly to PostgreSQL
    |
    +-- listens Redis Pub/Sub for outbound commands
            ^
            | PUBLISH ocpp:cp:{chargePointID}
            |
        REST API
        (only initiates outbound commands)
```

---

## Package Structure

```
ocpp/
    handler.go         HTTP handler, WebSocket accept, version negotiation, message loop
    hub.go             Hub: connection registry, Redis pub/sub per-charger
    chargepoint.go     ChargePoint: WebSocket conn, Call/Reply, pending response tracking
    router.go          Router interface
    context.go         ChargePointID context helpers
    types.go           Message type constants (Call=2, CallResult=3, CallError=4)
    v16/
        router.go      OCPP 1.6 action dispatcher
        authorize/     Authorize handler
        boot/          BootNotification handler
        datatransfer/  DataTransfer handler
        diagnostics/   DiagnosticsStatusNotification handler
        firmware/      FirmwareStatusNotification handler
        heartbeat/     Heartbeat handler
        meter/         MeterValues handler
        status/        StatusNotification handler
        transaction/   StartTransaction / StopTransaction handlers
    v201/
        router.go      OCPP 2.0.1 action dispatcher (stub)
```

---

## Responsibility Split

| Layer | Responsibility |
|---|---|
| **WS Gateway** (`cmd/ocpp`) | Full OCPP protocol, inbound message handling, direct DB writes |
| **REST API** (`cmd/api`) | Initiate outbound commands only (RemoteStart, SetChargingProfile...) |
| **Redis** | Pub/Sub for command delivery to per-charger channels |
| **PostgreSQL** | Persistent storage, written directly by gateway via `pgctx` |

---

## Core Components

### Hub (`ocpp/hub.go`)

Manages charge point connections and version-specific routers.

```go
type Hub struct {
    connections map[string]*ChargePoint // chargePointID -> connection
    rdb         redis.UniversalClient
    routers     map[string]Router       // "ocpp1.6" -> v16.Router
}
```

- `Register(ctx, cp)` — adds a charge point to the connection map
- `Unregister(ctx, chargePointID)` — removes on disconnect
- `RegisterRouter(version, router)` — registers version-specific router
- `RouterFor(version)` — returns the router for a given OCPP version
- `SubscribeChargePoint(ctx, cp)` — subscribes to Redis channel, forwards commands

### ChargePoint (`ocpp/chargepoint.go`)

Represents a single connected charge point.

```go
type ChargePoint struct {
    Identity    string
    Conn        *websocket.Conn
    OCPPVersion string
    pending     map[string]chan json.RawMessage // messageID -> response channel
}
```

- `Call(ctx, action, payload)` — sends OCPP Call, blocks up to 30s for response
- `Reply(ctx, msgID, payload)` — sends CallResult back to charger
- `HandleResponse(msgID, payload)` — routes CallResult/CallError to waiting caller

### Router (`ocpp/router.go`)

```go
type Router interface {
    HandleCall(ctx context.Context, cp *ChargePoint, msgID string, action string, payload json.RawMessage)
}
```

Each OCPP version implements this interface. The router dispatches to typed handler functions via `CallAction`.

### CallAction (`ocpp/handler.go`)

Generic helper that unmarshals payload, calls handler, and replies:

```go
func CallAction[P any, R any](ctx context.Context, cp *ChargePoint, msgID string, payload json.RawMessage, fn func(context.Context, *P) (*R, error))
```

Handlers follow the pattern: `func ActionName(ctx context.Context, p *Params) (*Result, error)`

---

## Handler Registration (cmd/ocpp/main.go)

```go
hub := ocpp.NewHub(rdb)
hub.RegisterRouter("ocpp1.6", v16.NewRouter())
hub.RegisterRouter("ocpp2.0.1", v201.NewRouter())

mux.Handle("GET /ocpp/{chargePointID}", pgctx.Middleware(db)(ocpp.Handler(hub)))
```

The `pgctx.Middleware` injects the database connection into the request context so handlers can use `pgctx.Exec`/`pgctx.QueryRow` directly.

---

## OCPP 1.6 Supported Actions

| Profile | Action | Handler | DB Table |
|---|---|---|---|
| Core | Authorize | `authorize.Authorize` | `ev_authorization_tags` |
| Core | BootNotification | `boot.BootNotification` | `ev_chargers` |
| Core | DataTransfer | `datatransfer.DataTransfer` | `ev_message_log` |
| Core | Heartbeat | `heartbeat.Heartbeat` | `ev_chargers` |
| Core | MeterValues | `meter.MeterValues` | `ev_meter_values` |
| Core | StartTransaction | `transaction.Start` | `ev_charging_sessions` |
| Core | StatusNotification | `status.StatusNotification` | `ev_chargers`, `ev_connectors` |
| Core | StopTransaction | `transaction.Stop` | `ev_charging_sessions`, `ev_meter_values` |
| Firmware | DiagnosticsStatusNotification | `diagnostics.StatusNotification` | `ev_chargers` |
| Firmware | FirmwareStatusNotification | `firmware.StatusNotification` | `ev_chargers` |

CS-initiated actions (ChangeConfiguration, RemoteStartTransaction, etc.) are sent via `Hub.SubscribeChargePoint` → `ChargePoint.Call`.

---

## Connection Lifecycle

```
1. Charger connects: GET /ocpp/{chargePointID}
                     subprotocol: ocpp1.6

2. Handler:
   - websocket.Accept (negotiates subprotocol)
   - Resolves Router for version
   - Creates ChargePoint
   - hub.Register(cp)
   - Starts hub.SubscribeChargePoint(cp) in goroutine
   - Enters read loop

3. Read loop:
   - conn.Read() -> raw bytes
   - handleOCPPMessage() in goroutine:
     - Parse [msgType, msgID, action, payload]
     - msgType 2 (Call)       -> router.HandleCall()
     - msgType 3 (CallResult) -> cp.HandleResponse()
     - msgType 4 (CallError)  -> cp.HandleResponse()

4. Disconnect:
   - conn.Read() returns error
   - defer hub.Unregister(chargePointID)
   - defer subCancel() (closes Redis subscription)
```

---

## Outbound Commands: REST API -> Charger

REST API publishes a command to the charger's Redis channel:

```go
cmd := command{
    Action:  "RemoteStartTransaction",
    Payload: json.RawMessage(`{"idTag":"ABC123","connectorId":1}`),
}
rdb.Publish(ctx, "ocpp:cp:"+chargerID, marshal(cmd))
```

The gateway pod holding the connection receives it via `SubscribeChargePoint`:

```go
func (h *Hub) SubscribeChargePoint(ctx context.Context, cp *ChargePoint) {
    channel := "ocpp:cp:" + cp.Identity
    sub := h.rdb.Subscribe(ctx, channel)
    defer sub.Close()

    for msg := range sub.Channel() {
        var cmd command
        json.Unmarshal([]byte(msg.Payload), &cmd)

        go func() {
            raw, err := cp.Call(ctx, cmd.Action, cmd.Payload)
            // Call blocks up to 30s waiting for charger response
        }()
    }
}
```

---

## Inbound Flow (no REST involved)

```
Charger cp-001
  |  [2, "msg1", "MeterValues", {...}]
  v
Pod N (WS Gateway)
  |  handleOCPPMessage -> router.HandleCall
  |  -> CallAction[meter.Params, meter.Result](ctx, cp, msgID, payload, meter.MeterValues)
  |  -> meter.MeterValues(ctx, &params) writes to PostgreSQL via pgctx
  |  -> cp.Reply(ctx, msgID, &result)
  v
Done  (REST API never involved)
```

---

## Database Schema

All EV-related tables use the `ev_` prefix. Schema defined in `schema/0004_ev.sql`.

| Table | Purpose |
|---|---|
| `ev_chargers` | Charge point registry (belongs to `sites`) |
| `ev_connectors` | Per-connector status |
| `ev_charging_sessions` | Transaction lifecycle (StartTransaction -> StopTransaction) |
| `ev_meter_values` | Time-series sampled values |
| `ev_authorization_tags` | IdTag management and local list |
| `ev_configurations` | Per-charger key/value config |
| `ev_reservations` | Reservation lifecycle |
| `ev_charging_profiles` | Smart charging profiles |
| `ev_message_log` | OCPP message audit trail |

---

## Redis Channels

| Key Pattern | Type | Purpose |
|---|---|---|
| `ocpp:cp:{chargePointID}` | Pub/Sub channel | REST -> Gateway command delivery |

---

## K8s Properties

- **Pods are stateless from REST's perspective** — just PUBLISH to Redis, no pod awareness needed
- **Per-charger subscription** — each connected charger gets its own Redis channel
- **Pod restarts are transparent** — charger reconnects to any pod, resubscribes automatically
- **Zero noise** — only the pod holding the connection receives the command
- **No registry to maintain** — no stale IPs, no cleanup on pod death

---

## Configuration

| Env Var | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgres://anertic:anertic@localhost:5432/anertic?sslmode=disable` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection (pool: 20, min idle: 5) |
| `OCPP_ADDR` | `:8081` | Gateway listen address |

## Dependencies

- `github.com/coder/websocket` — WebSocket library (subprotocol negotiation)
- `github.com/acoshift/pgsql/pgctx` — PostgreSQL context middleware
- `github.com/redis/go-redis/v9` — Redis client
- `github.com/acoshift/configfile` — Environment variable reader
