package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/acoshift/configfile"
	"github.com/redis/go-redis/v9"

	"github.com/ANERTiC/anertic/pkg/ocpp"
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

	opt, err := redis.ParseURL(cfg.StringDefault("REDIS_URL", "redis://localhost:6379"))
	if err != nil {
		return err
	}
	rdb := redis.NewClient(opt)
	defer rdb.Close()

	hub := ocpp.NewHub(rdb)

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// start Redis PubSub subscribers for cross-replica command routing
	go hub.SubscribeCommands(ctx)
	go hub.SubscribeResponses(ctx)

	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})
	mux.Handle("GET /ocpp/{chargePointID}", ocpp.Handler(hub))

	addr := cfg.StringDefault("OCPP_ADDR", ":8081")
	srv := &http.Server{
		Addr:         addr,
		Handler:      mux,
		ReadTimeout:  0, // no timeout for websocket
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
