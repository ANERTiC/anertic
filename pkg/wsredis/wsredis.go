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

type Hub struct {
	mu      sync.RWMutex
	rooms   map[string]map[*websocket.Conn]struct{}
	all     map[*websocket.Conn]struct{}
	rdb     *redis.Client
	channel string
}

type Message struct {
	Room    string          `json:"room"`
	Event   string          `json:"event"`
	Payload json.RawMessage `json:"payload"`
}

func New(rdb *redis.Client, channel string) *Hub {
	return &Hub{
		rooms:   make(map[string]map[*websocket.Conn]struct{}),
		all:     make(map[*websocket.Conn]struct{}),
		rdb:     rdb,
		channel: channel,
	}
}

// Subscribe listens to Redis pub/sub and fans out to local connections.
// Run as a goroutine: go hub.Subscribe(ctx)
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
		if m.Room == "" {
			// broadcast to all
			for conn := range h.all {
				conn.Write(ctx, websocket.MessageText, data)
			}
		} else {
			// fan out to room only
			for conn := range h.rooms[m.Room] {
				conn.Write(ctx, websocket.MessageText, data)
			}
		}
		h.mu.RUnlock()
	}
}

// Publish sends a message to Redis pub/sub.
// All replicas subscribed to the channel will receive it.
func (h *Hub) Publish(ctx context.Context, room, event string, payload any) error {
	p, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	m := Message{
		Room:    room,
		Event:   event,
		Payload: p,
	}
	data, err := json.Marshal(m)
	if err != nil {
		return err
	}
	return h.rdb.Publish(ctx, h.channel, data).Err()
}

// Broadcast sends a message to all connected clients across all replicas.
func (h *Hub) Broadcast(ctx context.Context, event string, payload any) error {
	return h.Publish(ctx, "", event, payload)
}

// Handler returns an HTTP handler for WebSocket connections.
// Room is determined by the "room" query parameter.
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

		room := r.URL.Query().Get("room")
		h.join(conn, room)
		defer h.leave(conn, room)

		for {
			_, _, err := conn.Read(r.Context())
			if err != nil {
				return
			}
		}
	})
}

func (h *Hub) join(conn *websocket.Conn, room string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	h.all[conn] = struct{}{}
	if room != "" {
		if h.rooms[room] == nil {
			h.rooms[room] = make(map[*websocket.Conn]struct{})
		}
		h.rooms[room][conn] = struct{}{}
	}
}

func (h *Hub) leave(conn *websocket.Conn, room string) {
	h.mu.Lock()
	defer h.mu.Unlock()

	delete(h.all, conn)
	if room != "" {
		delete(h.rooms[room], conn)
		if len(h.rooms[room]) == 0 {
			delete(h.rooms, room)
		}
	}
}
