package wsredis

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"sync"

	"github.com/coder/websocket"
	"github.com/redis/go-redis/v9"
)

// Identifier extracts a topic from the HTTP request.
// Return empty string for broadcast-only connections.
type Identifier func(r *http.Request) string

type Message struct {
	Topic   string          `json:"topic"`
	Event   string          `json:"event"`
	Payload json.RawMessage `json:"payload"`
}

// Publish sends a message to Redis pub/sub without needing a Hub.
// Use from services that don't run WebSocket (ingester, worker, OCPP).
func Publish(ctx context.Context, rdb *redis.Client, channel, topic, event string, payload any) error {
	p, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	data, err := json.Marshal(Message{
		Topic:   topic,
		Event:   event,
		Payload: p,
	})
	if err != nil {
		return err
	}
	return rdb.Publish(ctx, channel, data).Err()
}

type Hub struct {
	mu      sync.RWMutex
	topics  map[string]map[*websocket.Conn]struct{}
	all     map[*websocket.Conn]struct{}
	rdb     *redis.Client
	channel string
	id      Identifier
}

func New(rdb *redis.Client, channel string, id Identifier) *Hub {
	if id == nil {
		id = func(r *http.Request) string { return "" }
	}
	return &Hub{
		topics:  make(map[string]map[*websocket.Conn]struct{}),
		all:     make(map[*websocket.Conn]struct{}),
		rdb:     rdb,
		channel: channel,
		id:      id,
	}
}

func (h *Hub) Subscribe(ctx context.Context) {
	sub := h.rdb.Subscribe(ctx, h.channel)
	defer sub.Close()

	for msg := range sub.Channel() {
		var m Message
		if err := json.Unmarshal([]byte(msg.Payload), &m); err != nil {
			slog.Error("wsredis: unmarshal", "error", err)
			continue
		}

		data, err := json.Marshal(map[string]any{
			"event":   m.Event,
			"payload": m.Payload,
		})
		if err != nil {
			continue
		}

		h.mu.RLock()
		if m.Topic == "" {
			for conn := range h.all {
				conn.Write(ctx, websocket.MessageText, data)
			}
		} else {
			for conn := range h.topics[m.Topic] {
				conn.Write(ctx, websocket.MessageText, data)
			}
		}
		h.mu.RUnlock()
	}
}

func (h *Hub) Publish(ctx context.Context, topic, event string, payload any) error {
	return Publish(ctx, h.rdb, h.channel, topic, event, payload)
}

func (h *Hub) Broadcast(ctx context.Context, event string, payload any) error {
	return h.Publish(ctx, "", event, payload)
}

func (h *Hub) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			OriginPatterns: []string{"*"},
		})
		if err != nil {
			slog.Error("wsredis: accept", "error", err)
			return
		}
		defer conn.CloseNow()

		topic := h.id(r)
		h.join(conn, topic)
		defer h.leave(conn, topic)

		for {
			_, _, err := conn.Read(r.Context())
			if err != nil {
				return
			}
		}
	})
}

func (h *Hub) join(conn *websocket.Conn, topic string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.all[conn] = struct{}{}
	if topic != "" {
		if h.topics[topic] == nil {
			h.topics[topic] = make(map[*websocket.Conn]struct{})
		}
		h.topics[topic][conn] = struct{}{}
	}
}

func (h *Hub) leave(conn *websocket.Conn, topic string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	delete(h.all, conn)
	if topic != "" {
		delete(h.topics[topic], conn)
		if len(h.topics[topic]) == 0 {
			delete(h.topics, topic)
		}
	}
}
