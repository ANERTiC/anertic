package ops

import (
	"context"
	"log/slog"
	"strconv"

	"cloud.google.com/go/profiler"
	"github.com/acoshift/configfile"
	"github.com/samber/go-quickwit"
)

var (
	debugMode    bool
	projectID    string
	serviceName  string
	traceSampler float64
)

var (
	qw *quickwit.Client
)

func Init(ctx context.Context) error {
	slog.Info("ops: initializing")

	cfg := configfile.NewEnvReader()

	debugMode = cfg.Bool("OPS_DEBUG")
	projectID = cfg.String("OPS_PROJECT_ID")
	serviceName = cfg.StringDefault("OPS_SERVICE", "unknown_service")

	if projectID == "" {
		slog.Info("ops: project id is empty")
		goto skipGcp
	}

	if cfg.Bool("OPS_PROFILER") {
		err := profiler.Start(profiler.Config{
			Service:        serviceName,
			ServiceVersion: "1.0.0",
			ProjectID:      projectID,
		})
		if err != nil {
			slog.WarnContext(ctx, "ops: failed to start profiler", "error", err)
		}
	}

	if cfg.Bool("OPS_TRACING") {
		traceSampler, _ = strconv.ParseFloat(cfg.StringDefault("OPS_TRACE_SAMPLING", "0.01"), 64)
		slog.InfoContext(ctx, "ops: tracing enabled", "sampling", traceSampler)
	}

skipGcp:

	if qwURL := cfg.String("OPS_QUICKWIT_URL"); qwURL != "" {
		slog.InfoContext(ctx, "ops: quickwit logging enabled",
			"service_name", serviceName,
			"url", qwURL,
		)

		qw = quickwit.NewWithDefault(
			qwURL,
			cfg.StringDefault("OPS_QUICKWIT_INDEX_ID", "logging"),
		)

		slog.SetDefault(quickwitHandler(qw))
	}

	if debugMode {
		slog.SetLogLoggerLevel(slog.LevelDebug)
		slog.Info("ops: debug mode enabled")
	}

	return nil
}

func Close() {
	if qw != nil {
		qw.Stop()
	}
	slog.Info("ops: closed")
}
