package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/acoshift/configfile"

	"github.com/anertic/anertic/pkg/pipeline"
)

func main() {
	if err := configfile.LoadDotEnv("./.env"); err != nil {
		slog.Warn("load .env", "error", err)
	}

	env := configfile.NewEnvReader()

	cfg := pipeline.Config{
		DatabaseURL: env.MustString("DATABASE_URL"),
		RedisURL:    env.MustString("REDIS_URL"),
		MQTTBroker:  env.MustString("MQTT_BROKER"),
		MQTTTopic:   env.StringDefault("MQTT_TOPIC", "anertic/+/readings"),
	}

	p, err := pipeline.New(cfg)
	if err != nil {
		slog.Error("failed to initialize ingester", "error", err)
		os.Exit(1)
	}
	defer p.Close()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	slog.Info("starting ingester", "broker", cfg.MQTTBroker, "topic", cfg.MQTTTopic)
	if err := p.Run(ctx); err != nil {
		slog.Error("ingester error", "error", err)
		os.Exit(1)
	}
}
