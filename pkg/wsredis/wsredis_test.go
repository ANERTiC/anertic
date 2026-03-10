package wsredis

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/redis/go-redis/v9"
)

func newTestRedis(t *testing.T) *redis.Client {
	t.Helper()
	rdb := redis.NewClient(&redis.Options{
		Addr: "localhost:6379",
	})
	t.Cleanup(func() { rdb.Close() })
	if err := rdb.Ping(context.Background()).Err(); err != nil {
		t.Skip("redis not available")
	}
	return rdb
}

func dial(t *testing.T, url string) *websocket.Conn {
	t.Helper()
	conn, _, err := websocket.Dial(context.Background(), url, nil)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.CloseNow() })
	return conn
}

func readMessage(t *testing.T, conn *websocket.Conn) map[string]any {
	t.Helper()
	var msg map[string]any
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := wsjson.Read(ctx, conn, &msg); err != nil {
		t.Fatal(err)
	}
	return msg
}

func TestBroadcast(t *testing.T) {
	rdb := newTestRedis(t)
	hub := New(rdb, "test:broadcast", nil)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go hub.Subscribe(ctx)

	srv := httptest.NewServer(hub.Handler())
	defer srv.Close()

	ws1 := dial(t, "ws"+srv.URL[4:])
	ws2 := dial(t, "ws"+srv.URL[4:])

	time.Sleep(50 * time.Millisecond)

	err := hub.Broadcast(context.Background(), "ping", map[string]string{"msg": "hello"})
	if err != nil {
		t.Fatal(err)
	}

	msg1 := readMessage(t, ws1)
	msg2 := readMessage(t, ws2)

	if msg1["event"] != "ping" {
		t.Errorf("expected event ping, got %v", msg1["event"])
	}
	if msg2["event"] != "ping" {
		t.Errorf("expected event ping, got %v", msg2["event"])
	}
}

func TestTopicFiltering(t *testing.T) {
	rdb := newTestRedis(t)
	hub := New(rdb, "test:topic", TopicFromQuery("site_id"))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go hub.Subscribe(ctx)

	srv := httptest.NewServer(hub.Handler())
	defer srv.Close()

	wsA := dial(t, "ws"+srv.URL[4:]+"?site_id=site_a")
	wsB := dial(t, "ws"+srv.URL[4:]+"?site_id=site_b")

	time.Sleep(50 * time.Millisecond)

	err := hub.Publish(context.Background(), "site_a", "reading", map[string]int{"power": 100})
	if err != nil {
		t.Fatal(err)
	}

	// site_a should receive
	msg := readMessage(t, wsA)
	if msg["event"] != "reading" {
		t.Errorf("expected event reading, got %v", msg["event"])
	}

	// site_b should NOT receive — timeout expected
	ctx2, cancel2 := context.WithTimeout(context.Background(), 200*time.Millisecond)
	defer cancel2()
	var unexpected map[string]any
	err = wsjson.Read(ctx2, wsB, &unexpected)
	if err == nil {
		t.Errorf("site_b should not receive site_a message, got %v", unexpected)
	}
}

func TestBroadcastReachesAllTopics(t *testing.T) {
	rdb := newTestRedis(t)
	hub := New(rdb, "test:all-topics", TopicFromQuery("id"))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go hub.Subscribe(ctx)

	srv := httptest.NewServer(hub.Handler())
	defer srv.Close()

	wsA := dial(t, "ws"+srv.URL[4:]+"?id=a")
	wsB := dial(t, "ws"+srv.URL[4:]+"?id=b")
	wsNone := dial(t, "ws"+srv.URL[4:])

	time.Sleep(50 * time.Millisecond)

	err := hub.Broadcast(context.Background(), "announce", "hello all")
	if err != nil {
		t.Fatal(err)
	}

	for _, ws := range []*websocket.Conn{wsA, wsB, wsNone} {
		msg := readMessage(t, ws)
		if msg["event"] != "announce" {
			t.Errorf("expected event announce, got %v", msg["event"])
		}
	}
}

func TestMultipleReplicas(t *testing.T) {
	rdb1 := newTestRedis(t)
	rdb2 := newTestRedis(t)

	channel := "test:replicas"
	hub1 := New(rdb1, channel, TopicFromQuery("room"))
	hub2 := New(rdb2, channel, TopicFromQuery("room"))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go hub1.Subscribe(ctx)
	go hub2.Subscribe(ctx)

	srv1 := httptest.NewServer(hub1.Handler())
	defer srv1.Close()
	srv2 := httptest.NewServer(hub2.Handler())
	defer srv2.Close()

	// client on replica 1
	ws1 := dial(t, "ws"+srv1.URL[4:]+"?room=chat")
	// client on replica 2
	ws2 := dial(t, "ws"+srv2.URL[4:]+"?room=chat")

	time.Sleep(50 * time.Millisecond)

	// publish from replica 1
	err := hub1.Publish(context.Background(), "chat", "msg", "from replica 1")
	if err != nil {
		t.Fatal(err)
	}

	// both should receive
	msg1 := readMessage(t, ws1)
	msg2 := readMessage(t, ws2)

	if msg1["event"] != "msg" {
		t.Errorf("replica 1 client: expected event msg, got %v", msg1["event"])
	}
	if msg2["event"] != "msg" {
		t.Errorf("replica 2 client: expected event msg, got %v", msg2["event"])
	}
}

func TestTopicFromPath(t *testing.T) {
	rdb := newTestRedis(t)
	hub := New(rdb, "test:path", TopicFromPath("id"))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go hub.Subscribe(ctx)

	mux := http.NewServeMux()
	mux.Handle("GET /ws/{id}", hub.Handler())
	srv := httptest.NewServer(mux)
	defer srv.Close()

	ws1 := dial(t, "ws"+srv.URL[4:]+"/ws/charger_001")

	time.Sleep(50 * time.Millisecond)

	err := hub.Publish(context.Background(), "charger_001", "status", map[string]string{"status": "charging"})
	if err != nil {
		t.Fatal(err)
	}

	msg := readMessage(t, ws1)
	if msg["event"] != "status" {
		t.Errorf("expected event status, got %v", msg["event"])
	}

	payload, _ := json.Marshal(msg["payload"])
	var p map[string]string
	json.Unmarshal(payload, &p)
	if p["status"] != "charging" {
		t.Errorf("expected status charging, got %v", p["status"])
	}
}

func TestDisconnectCleanup(t *testing.T) {
	rdb := newTestRedis(t)
	hub := New(rdb, "test:cleanup", TopicFromQuery("t"))

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go hub.Subscribe(ctx)

	srv := httptest.NewServer(hub.Handler())
	defer srv.Close()

	conn := dial(t, "ws"+srv.URL[4:]+"?t=room1")
	time.Sleep(50 * time.Millisecond)

	hub.mu.RLock()
	if len(hub.all) != 1 {
		t.Errorf("expected 1 connection, got %d", len(hub.all))
	}
	if len(hub.topics["room1"]) != 1 {
		t.Errorf("expected 1 connection in room1, got %d", len(hub.topics["room1"]))
	}
	hub.mu.RUnlock()

	conn.Close(websocket.StatusNormalClosure, "bye")
	time.Sleep(100 * time.Millisecond)

	hub.mu.RLock()
	if len(hub.all) != 0 {
		t.Errorf("expected 0 connections after disconnect, got %d", len(hub.all))
	}
	if len(hub.topics["room1"]) != 0 {
		t.Errorf("expected 0 connections in room1 after disconnect, got %d", len(hub.topics["room1"]))
	}
	hub.mu.RUnlock()
}
