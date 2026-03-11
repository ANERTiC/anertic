package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/acoshift/configfile"

	"github.com/anertic/anertic/pkg/insight"
)

func main() {
	if err := configfile.LoadDotEnv("./.env"); err != nil {
		slog.Warn("load .env", "error", err)
	}

	env := configfile.NewEnvReader()

	cfg := insight.WorkerConfig{
		DatabaseURL:      env.MustString("DATABASE_URL"),
		RedisURL:         env.MustString("REDIS_URL"),
		SupermemoryURL:   env.StringDefault("SUPERMEMORY_URL", ""),
		SupermemoryToken: env.StringDefault("SUPERMEMORY_TOKEN", ""),
	}

	w, err := insight.NewWorker(cfg)
	if err != nil {
		slog.Error("failed to initialize worker", "error", err)
		os.Exit(1)
	}
	defer w.Close()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	slog.Info("starting insight worker")
	if err := w.Run(ctx); err != nil {
		slog.Error("worker error", "error", err)
		os.Exit(1)
	}
}
