package insight

import (
	"context"
	"database/sql"
	"log/slog"
	"time"

	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

type WorkerConfig struct {
	DatabaseURL      string
	RedisURL         string
	SupermemoryURL   string
	SupermemoryToken string
}

type Worker struct {
	db    *sql.DB
	redis *redis.Client
	cfg   WorkerConfig
}

func NewWorker(cfg WorkerConfig) (*Worker, error) {
	db, err := sql.Open("postgres", cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}
	if err := db.Ping(); err != nil {
		return nil, err
	}

	opt, err := redis.ParseURL(cfg.RedisURL)
	if err != nil {
		return nil, err
	}
	rdb := redis.NewClient(opt)

	return &Worker{
		db:    db,
		redis: rdb,
		cfg:   cfg,
	}, nil
}

func (w *Worker) Close() {
	w.db.Close()
	w.redis.Close()
}

// Run starts the insight worker loop.
// Pipeline: TimescaleDB aggregates → AI format → Supermemory → summarize → push insight
func (w *Worker) Run(ctx context.Context) error {
	ticker := time.NewTicker(1 * time.Hour)
	defer ticker.Stop()

	// Run once on start
	w.generateInsights(ctx)

	for {
		select {
		case <-ctx.Done():
			return nil
		case <-ticker.C:
			w.generateInsights(ctx)
		}
	}
}

func (w *Worker) generateInsights(ctx context.Context) {
	slog.Info("generating insights...")

	sites, err := w.listActiveSites(ctx)
	if err != nil {
		slog.Error("failed to list sites", "error", err)
		return
	}

	for _, siteID := range sites {
		if err := w.generateSiteInsight(ctx, siteID); err != nil {
			slog.Error("failed to generate insight", "siteID", siteID, "error", err)
		}
	}
}

func (w *Worker) listActiveSites(ctx context.Context) ([]string, error) {
	rows, err := w.db.QueryContext(ctx, `select id from sites`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var ids []string
	for rows.Next() {
		var id string
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

func (w *Worker) generateSiteInsight(ctx context.Context, siteID string) error {
	// Step 1: Query hourly aggregates from TimescaleDB
	rows, err := w.db.QueryContext(ctx, `
		select
			rh.bucket,
			m.serial_number,
			d.name as device_name,
			d.type as device_type,
			rh.avg_power_w,
			rh.max_power_w,
			rh.energy_kwh
		from readings_hourly rh
		join meters m on m.id = rh.meter_id
		join devices d on d.id = m.device_id
		where d.site_id = $1
		  and rh.bucket >= now() - interval '24 hours'
		order by rh.bucket desc
	`, siteID)
	if err != nil {
		return err
	}
	defer rows.Close()

	// Step 2: Format data for AI/Supermemory
	var entries []map[string]any
	for rows.Next() {
		var (
			bucket     time.Time
			serial     string
			deviceName string
			deviceType string
			avgPower   float64
			maxPower   float64
			energyKWh  float64
		)
		if err := rows.Scan(
			&bucket,
			&serial,
			&deviceName,
			&deviceType,
			&avgPower,
			&maxPower,
			&energyKWh,
		); err != nil {
			return err
		}
		entries = append(entries, map[string]any{
			"time":        bucket,
			"device":      deviceName,
			"type":        deviceType,
			"avg_power_w": avgPower,
			"max_power_w": maxPower,
			"energy_kwh":  energyKWh,
		})
	}

	if len(entries) == 0 {
		return nil
	}

	// Step 3: Store context in Supermemory (semantic layer)
	// TODO: call Supermemory API to store energy context

	// Step 4: Generate insight summary via LLM
	// TODO: call LLM with energy context → natural language insight

	// Step 5: Store insight in DB and push via WebSocket
	// TODO: insert into insights table, publish via Redis

	slog.Info("insight generated", "siteID", siteID, "entries", len(entries))
	return nil
}
