package main

import (
	"context"
	"database/sql"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/acoshift/configfile"
	"github.com/acoshift/pgsql/pgctx"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"

	"github.com/anertic/anertic/ocpp"
	"github.com/anertic/anertic/ocpp/v16"
	"github.com/anertic/anertic/ocpp/v201"
)

func main() {
	if err := run(); err != nil {
		slog.Error("ocpp: exited", "error", err)
		os.Exit(1)
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
	opt.ReadTimeout = 35 * time.Second  // > OCPP Call timeout (30s)
	opt.WriteTimeout = 10 * time.Second
	opt.DialTimeout = 5 * time.Second
	rdb := redis.NewClient(opt)
	defer rdb.Close()

	hub := ocpp.NewHub(rdb)
	hub.RegisterRouter("ocpp1.6", v16.NewRouter())
	hub.RegisterRouter("ocpp2.0.1", v201.NewRouter())

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	ctx = pgctx.NewContext(ctx, db)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})
	mux.Handle("GET /ocpp/{chargePointID}", pgctx.Middleware(db)(ocpp.Handler(hub)))

	addr := cfg.StringDefault("OCPP_ADDR", ":8081")
	srv := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  0,
		WriteTimeout: 0,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		slog.Info("starting ocpp server", "addr", addr)
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			slog.Error("ocpp server error", "error", err)
			os.Exit(1)
		}
	}()

	<-ctx.Done()
	slog.Info("shutting down ocpp server...")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	return srv.Shutdown(shutdownCtx)
}
