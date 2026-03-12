package main

import (
	"database/sql"
	"log/slog"
	"net/http"
	"time"

	"github.com/acoshift/configfile"
	"github.com/acoshift/pgsql/pgctx"
	_ "github.com/lib/pq"
	"github.com/moonrhythm/httpmux"
	"github.com/moonrhythm/parapet"
	"github.com/redis/go-redis/v9"

	"github.com/anertic/anertic/ocpp"
	v16 "github.com/anertic/anertic/ocpp/v16"
	v201 "github.com/anertic/anertic/ocpp/v201"
	"github.com/anertic/anertic/pkg/rdctx"
)

func main() {
	if err := run(); err != nil {
		slog.Error("ocpp: exited", "error", err)
	}
}

func run() error {
	if err := configfile.LoadDotEnv("./.env"); err != nil {
		slog.Warn("load .env", "error", err)
	}

	cfg := configfile.NewEnvReader()

	db, err := sql.Open("postgres", cfg.StringDefault("DB_URL", "postgres://anertic:anertic@localhost:5432/anertic?sslmode=disable"))
	if err != nil {
		return err
	}
	defer db.Close()

	opt, err := redis.ParseURL(cfg.StringDefault("REDIS_URL", "redis://localhost:6379"))
	if err != nil {
		return err
	}
	opt.PoolSize = 20
	opt.MinIdleConns = 5
	opt.ReadTimeout = 35 * time.Second // > OCPP Call timeout (30s)
	opt.WriteTimeout = 10 * time.Second
	opt.DialTimeout = 5 * time.Second
	rdb := redis.NewClient(opt)
	defer rdb.Close()

	hub := ocpp.NewHub(rdb)
	hub.RegisterRouter("ocpp1.6", v16.NewRouter())
	hub.RegisterRouter("ocpp2.0.1", v201.NewRouter())

	mux := httpmux.New()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})
	mux.Handle("GET /{chargePointID}", ocpp.Handler(hub))

	srv := parapet.NewBackend()
	srv.Handler = mux
	srv.UseFunc(pgctx.Middleware(db))
	srv.UseFunc(rdctx.Middleware(rdb))
	srv.Addr = cfg.StringDefault("OCPP_ADDR", ":8081")
	srv.ReadTimeout = 0
	srv.WriteTimeout = 0
	srv.IdleTimeout = 120 * time.Second

	slog.Info("starting ocpp server", "addr", srv.Addr)
	return srv.ListenAndServe()
}
