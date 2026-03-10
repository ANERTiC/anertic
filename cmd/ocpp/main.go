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

	"github.com/anertic/anertic/ocppv16"
	"github.com/anertic/anertic/pkg/wsredis"
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

	db, err := sql.Open("postgres", cfg.StringDefault("DATABASE_URL", "postgres://anertic:anertic@localhost:5432/anertic?sslmode=disable"))
	if err != nil {
		return err
	}
	defer db.Close()

	opt, err := redis.ParseURL(cfg.StringDefault("REDIS_URL", "redis://localhost:6379"))
	if err != nil {
		return err
	}
	rdb := redis.NewClient(opt)
	defer rdb.Close()

	broker := wsredis.NewRedisBroker(rdb, "ocpp:bus")
	hub := ocppv16.NewHub(broker)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	ctx = pgctx.NewContext(ctx, db)

	go hub.Subscribe(ctx)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})
	mux.Handle("GET /ocpp/{chargePointID}", pgctx.Middleware(db)(ocppv16.Handler(hub)))

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
