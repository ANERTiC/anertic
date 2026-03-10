package ws

import (
	"context"
	"log/slog"
	"net/http"
	"sync"

	"github.com/coder/websocket"
	"github.com/coder/websocket/wsjson"
	"github.com/redis/go-redis/v9"
)

type Hub struct {
	mu    sync.RWMutex
	conns map[*websocket.Conn]struct{}
	rdb   *redis.Client
}

func NewHub(rdb *redis.Client) *Hub {
	return &Hub{
		conns: make(map[*websocket.Conn]struct{}),
		rdb:   rdb,
	}
}

func (h *Hub) Subscribe(ctx context.Context, channel string) {
	sub := h.rdb.Subscribe(ctx, channel)
	defer sub.Close()

	for msg := range sub.Channel() {
		h.mu.RLock()
		for conn := range h.conns {
			wsjson.Write(ctx, conn, msg.Payload)
		}
		h.mu.RUnlock()
	}
}

func (h *Hub) Publish(ctx context.Context, channel string, data any) error {
	return h.rdb.Publish(ctx, channel, data).Err()
}

func (h *Hub) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			OriginPatterns: []string{"*"},
		})
		if err != nil {
			slog.Error("ws: accept", "error", err)
			return
		}
		defer conn.CloseNow()

		h.add(conn)
		defer h.remove(conn)

		for {
			_, _, err := conn.Read(r.Context())
			if err != nil {
				return
			}
		}
	})
}

func (h *Hub) add(conn *websocket.Conn) {
	h.mu.Lock()
	h.conns[conn] = struct{}{}
	h.mu.Unlock()
}

func (h *Hub) remove(conn *websocket.Conn) {
	h.mu.Lock()
	delete(h.conns, conn)
	h.mu.Unlock()
}
