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

// Hub manages WebSocket connections with Redis PubSub for cross-replica fan-out.
type Hub struct {
	mu      sync.RWMutex
	clients map[*client]struct{}
	redis   *redis.Client
}

type client struct {
	conn   *websocket.Conn
	siteID string
}

func NewHub(rdb *redis.Client) *Hub {
	return &Hub{
		clients: make(map[*client]struct{}),
		redis:   rdb,
	}
}

// Subscribe listens to Redis PubSub and fans out to local WS clients.
func (h *Hub) Subscribe(ctx context.Context) {
	sub := h.redis.Subscribe(ctx, "readings:realtime")
	defer sub.Close()

	ch := sub.Channel()
	for msg := range ch {
		h.mu.RLock()
		for c := range h.clients {
			wsjson.Write(ctx, c.conn, msg.Payload)
		}
		h.mu.RUnlock()
	}
}

// Publish sends data to Redis PubSub (any replica can call this).
func (h *Hub) Publish(ctx context.Context, channel string, data []byte) error {
	return h.redis.Publish(ctx, channel, data).Err()
}

func (h *Hub) addClient(c *client) {
	h.mu.Lock()
	h.clients[c] = struct{}{}
	h.mu.Unlock()
}

func (h *Hub) removeClient(c *client) {
	h.mu.Lock()
	delete(h.clients, c)
	h.mu.Unlock()
}

// Handler returns an HTTP handler for WebSocket connections.
func (h *Hub) Handler() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
			OriginPatterns: []string{"*"},
		})
		if err != nil {
			slog.Error("ws accept error", "error", err)
			return
		}
		defer conn.CloseNow()

		siteID := r.URL.Query().Get("site_id")
		c := &client{conn: conn, siteID: siteID}
		h.addClient(c)
		defer h.removeClient(c)

		for {
			_, _, err := conn.Read(r.Context())
			if err != nil {
				return
			}
		}
	})
}
