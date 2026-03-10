package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"
	"net/http"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/configfile"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/moonrhythm/httpmux"
	"github.com/moonrhythm/parapet"
	"github.com/moonrhythm/parapet/pkg/cors"
	"github.com/redis/go-redis/v9"

	"github.com/ANERTiC/anertic/api"
	"github.com/ANERTiC/anertic/pkg/rdctx"
	"github.com/ANERTiC/anertic/pkg/ws"
)

func main() {
	if err := run(); err != nil {
		slog.Error("api: exited", "error", err)
	}
}

func run() error {
	if err := configfile.LoadDotEnv("./.env"); err != nil {
		slog.Warn("load .env", "error", err)
	}

	cfg := configfile.NewEnvReader()

	srv := parapet.NewBackend()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	db, err := sql.Open("postgres", cfg.StringDefault("DATABASE_URL", "postgres://anertic:anertic@localhost:5432/anertic?sslmode=disable"))
	if err != nil {
		return err
	}
	defer db.Close()
	ctx = pgctx.NewContext(ctx, db)

	opt, err := redis.ParseURL(cfg.StringDefault("REDIS_URL", "redis://localhost:6379"))
	if err != nil {
		return err
	}
	rdb := redis.NewClient(opt)
	defer rdb.Close()

	hub := ws.NewHub(rdb)
	go hub.Subscribe(context.Background())

	mux := httpmux.New()

	am := arpc.New()
	am.Encoder = func(w http.ResponseWriter, r *http.Request, v any) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(struct {
			OK     bool `json:"ok"`
			Result any  `json:"result"`
		}{true, v})
	}

	mux.Handle("/", am.NotFoundHandler())
	api.Mount(mux, am)

	// WebSocket: real-time readings via Redis PubSub
	mux.Handle("GET /ws/readings", hub.Handler())

	// OCPP WebSocket endpoint for EV chargers
	// mux.Handle("GET /ocpp/{chargePointID}", ocpp.Handler(db, rdb))

	srv.Handler = mux
	srv.Use(cors.New())
	srv.UseFunc(pgctx.Middleware(db))
	srv.UseFunc(rdctx.Middleware(rdb))
	srv.Addr = cfg.StringDefault("ADDR", ":8080")

	slog.InfoContext(ctx, "starting api server", "addr", srv.Addr)
	return srv.ListenAndServe()
}
