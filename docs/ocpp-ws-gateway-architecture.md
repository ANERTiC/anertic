# OCPP WebSocket Gateway Architecture

## Overview

The OCPP WebSocket Gateway handles the **full OCPP protocol** end-to-end — parsing messages, business logic, and writing directly to PostgreSQL.

The REST API's only role is to **initiate outbound commands** to chargers (RemoteStart, SetChargingProfile, GetVariables, etc.).

---

## Architecture

```
EV Charger
    │  wss://
    ▼
[ OCPP WS Gateway Pod ] (K8s, multiple replicas)
    │
    ├── handles all inbound OCPP messages
    ├── writes directly to PostgreSQL
    │
    └── listens Redis Pub/Sub for outbound commands
            ▲
            │ PUBLISH ocpp:cmd:{chargerID}
            │
        REST API
        (only initiates outbound commands)
```

---

## Responsibility Split

| Layer | Responsibility |
|---|---|
| **WS Gateway** | Full OCPP protocol, inbound message handling, direct DB writes |
| **REST API** | Initiate outbound commands only (RemoteStart, SetChargingProfile...) |
| **Redis** | Pub/Sub for command delivery, List for CALLRESULT reply |
| **PostgreSQL** | Persistent storage, written directly by gateway |

---

## Two Concurrent Loops Per Pod

| Loop | Direction | Transport |
|---|---|---|
| WS listener | Charger → Gateway | WebSocket |
| Redis subscriber | REST API → Gateway | Redis Pub/Sub |

Both share the same in-memory `Hub` (connection map + mutex).

---

## Inbound Message Handling (Gateway → DB directly)

```go
func (c *ChargerConn) handleMessage(raw []byte) {
    msg := parseOCPP(raw)

    switch msg.Action {
    case "BootNotification":
        db.UpsertCharger(c.ChargerID, msg.Payload)
        c.Send(bootNotificationResponse())

    case "Heartbeat":
        db.UpdateLastSeen(c.ChargerID)
        c.Send(heartbeatResponse())

    case "StatusNotification":
        db.UpdateChargerStatus(c.ChargerID, msg.Payload)
        c.Send(statusNotificationResponse())

    case "MeterValues":
        db.InsertMeterValues(c.ChargerID, msg.Payload)

    case "TransactionEvent":
        db.UpsertTransaction(c.ChargerID, msg.Payload)
        c.Send(transactionEventResponse())
    }
}
```

No REST hop. Gateway owns the full OCPP logic.

---

## Outbound Commands: REST API → Charger

REST API's only job — publish a command and wait for the result.

```go
func (s *Server) RemoteStart(w http.ResponseWriter, r *http.Request) {
    chargerID := chi.URLParam(r, "chargerID")
    uniqueID  := uuid.New().String()

    cmd := OCPPCommand{
        UniqueID: uniqueID,
        Action:   "RequestStartTransaction",
        ReplyTo:  "ocpp:reply:" + uniqueID,
        Payload:  payload,
    }

    // 1. publish command
    s.rdb.Publish(ctx, "ocpp:cmd:"+chargerID, marshal(cmd))

    // 2. block and wait for CALLRESULT (30s OCPP default timeout)
    result, err := s.rdb.BRPop(ctx, 30*time.Second, "ocpp:reply:"+uniqueID).Result()
    if err != nil {
        http.Error(w, "timeout", http.StatusGatewayTimeout)
        return
    }

    w.Write(result[1])
}
```

---

## Per-Charger Pub/Sub Subscription

Each pod subscribes to **exact channels** for its own connected chargers only.
Zero noise — other pods never wake up for commands they don't own.

```go
func (h *Hub) OnConnect(chargerID string, conn *ChargerConn) {
    h.mu.Lock()
    h.conns[chargerID] = conn
    h.mu.Unlock()

    go h.subscribeCharger(ctx, chargerID, conn)
}

func (h *Hub) subscribeCharger(ctx context.Context, chargerID string, conn *ChargerConn) {
    pubsub := rdb.Subscribe(ctx, "ocpp:cmd:"+chargerID)
    defer pubsub.Close() // auto-unsubscribes on disconnect

    for msg := range pubsub.Channel() {
        cmd := unmarshal(msg.Payload)

        // write OCPP CALL to charger
        conn.Send(buildOCPPCall(cmd))

        // store pending so we can match CALLRESULT
        h.pending[cmd.UniqueID] = cmd.ReplyTo
    }
}

func (h *Hub) OnDisconnect(chargerID string) {
    h.mu.Lock()
    delete(h.conns, chargerID)
    h.mu.Unlock()
    // pubsub.Close() in subscribeCharger handles unsubscribe
}
```

---

## CALLRESULT: Charger → REST API Reply

When charger responds to a CALL, gateway matches UniqueID and unblocks the REST API via Redis List.

```go
func (h *Hub) handleCallResult(msg OCPPMessage) {
    replyTo, ok := h.pending[msg.UniqueID]
    if !ok { return }

    delete(h.pending, msg.UniqueID)

    // unblock the waiting REST API
    rdb.LPush(ctx, replyTo, marshal(msg))
    rdb.Expire(ctx, replyTo, 35*time.Second) // safety cleanup
}
```

---

## Full Request-Response Flow

```
REST API
  │  1. PUBLISH ocpp:cmd:cp-001 { action, uniqueID, replyTo: "ocpp:reply:xyz" }
  │  2. BRPOP ocpp:reply:xyz  ← blocks (30s timeout)
  │
  ▼
Redis Pub/Sub
  │
  ▼
Pod N (subscribed to ocpp:cmd:cp-001)
  │  3. write OCPP CALL to charger WS
  │  4. store pending[uniqueID] = "ocpp:reply:xyz"
  │
  ▼
Charger cp-001
  │  5. send CALLRESULT back over WS
  │
  ▼
Pod N
  │  6. match UniqueID → find replyTo
  │  7. LPUSH ocpp:reply:xyz { result }
  │
  ▼
REST API unblocks ← gets CALLRESULT ✓
```

---

## Inbound Flow (no REST involved)

```
Charger cp-001
  │  MeterValues / BootNotification / StatusNotification...
  ▼
Pod N (WS Gateway)
  │  parse OCPP
  │  write to PostgreSQL directly
  │  send CALLRESULT back to charger
  ▼
Done ✓  (REST API never involved)
```

---

## Redis Data Structures

| Key | Type | Purpose |
|---|---|---|
| `ocpp:cmd:{chargerID}` | Pub/Sub channel | REST → Gateway command delivery |
| `ocpp:reply:{uniqueID}` | List (LPUSH/BRPOP) | Gateway → REST CALLRESULT reply |

---

## K8s Properties

- **Pods are stateless from REST's perspective** — just PUBLISH, no pod awareness needed
- **Per-charger subscription** — Redis tracks which pod owns which charger implicitly
- **Pod restarts are transparent** — charger reconnects to any pod, re-subscribes automatically
- **Zero noise** — only the pod holding the connection receives the command
- **No registry to maintain** — no stale IPs, no cleanup on pod death
