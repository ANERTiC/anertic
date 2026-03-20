package insight

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"math"
	"strings"
	"time"

	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
	"github.com/rs/xid"
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
// Pipeline: readings → aggregate daily → detect anomalies → generate insights → notify
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
	slog.InfoContext(ctx, "generating insights...")

	sites, err := w.listActiveSites(ctx)
	if err != nil {
		slog.ErrorContext(ctx, "failed to list sites", "error", err)
		return
	}

	for _, siteID := range sites {
		if err := w.processSite(ctx, siteID); err != nil {
			slog.ErrorContext(ctx, "failed to process site", "siteID", siteID, "error", err)
		}
	}
}

func (w *Worker) listActiveSites(ctx context.Context) ([]string, error) {
	rows, err := w.db.QueryContext(ctx, `select id from sites where deleted_at is null`)
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

func (w *Worker) processSite(ctx context.Context, siteID string) error {
	// Step 1: Aggregate daily energy
	if err := w.aggregateDaily(ctx, siteID); err != nil {
		slog.ErrorContext(ctx, "failed to aggregate daily", "siteID", siteID, "error", err)
	}

	// Step 2: Detect anomalies
	if err := w.detectAnomalies(ctx, siteID); err != nil {
		slog.ErrorContext(ctx, "failed to detect anomalies", "siteID", siteID, "error", err)
	}

	// Step 3: Generate insights from context
	if err := w.generateSiteInsights(ctx, siteID); err != nil {
		slog.ErrorContext(ctx, "failed to generate insights", "siteID", siteID, "error", err)
	}

	return nil
}

// aggregateDaily upserts today's row in site_energy_daily from raw readings.
func (w *Worker) aggregateDaily(ctx context.Context, siteID string) error {
	_, err := w.db.ExecContext(ctx, `
		insert into site_energy_daily (site_id, date, solar_kwh, grid_import_kwh, grid_export_kwh, battery_kwh, consumption_kwh, self_use_kwh, co2_avoided_kg)
		select
			$1,
			now()::date,
			coalesce(sum(case when d.type = 'solar_panel' then r.energy_kwh else 0 end), 0),
			coalesce(sum(case when d.type = 'grid' and r.energy_kwh > 0 then r.energy_kwh else 0 end), 0),
			coalesce(sum(case when d.type = 'grid' and r.energy_kwh < 0 then abs(r.energy_kwh) else 0 end), 0),
			coalesce(sum(case when d.type = 'battery' then r.energy_kwh else 0 end), 0),
			coalesce(sum(r.energy_kwh), 0),
			least(
				coalesce(sum(case when d.type = 'solar_panel' then r.energy_kwh else 0 end), 0),
				coalesce(sum(r.energy_kwh), 0)
			),
			coalesce(sum(case when d.type = 'solar_panel' then r.energy_kwh else 0 end), 0) * 0.42
		from readings r
		join meters m on m.id = r.meter_id
		join devices d on d.id = m.device_id
		where d.site_id = $1
		  and r.time >= now()::date
		  and r.time < now()::date + interval '1 day'
		on conflict (site_id, date) do update set
			solar_kwh = excluded.solar_kwh,
			grid_import_kwh = excluded.grid_import_kwh,
			grid_export_kwh = excluded.grid_export_kwh,
			battery_kwh = excluded.battery_kwh,
			consumption_kwh = excluded.consumption_kwh,
			self_use_kwh = excluded.self_use_kwh,
			co2_avoided_kg = excluded.co2_avoided_kg
	`, siteID)
	if err != nil {
		return fmt.Errorf("aggregate daily: %w", err)
	}

	slog.InfoContext(ctx, "aggregated daily energy", "siteID", siteID)
	return nil
}

// detectAnomalies compares current hour readings against 7-day moving average.
func (w *Worker) detectAnomalies(ctx context.Context, siteID string) error {
	rows, err := w.db.QueryContext(ctx, `
		with current_hour as (
			select
				d.type as device_type,
				avg(r.power_w) as avg_power,
				sum(r.energy_kwh) as energy_kwh
			from readings r
			join meters m on m.id = r.meter_id
			join devices d on d.id = m.device_id
			where d.site_id = $1
			  and r.time >= date_trunc('hour', now())
			  and r.time < date_trunc('hour', now()) + interval '1 hour'
			group by d.type
		),
		historical_avg as (
			select
				d.type as device_type,
				avg(r.power_w) as avg_power,
				avg(r.energy_kwh) as avg_energy_kwh
			from readings r
			join meters m on m.id = r.meter_id
			join devices d on d.id = m.device_id
			where d.site_id = $1
			  and extract(hour from r.time) = extract(hour from now())
			  and r.time >= now() - interval '7 days'
			  and r.time < date_trunc('hour', now())
			group by d.type
		)
		select
			ch.device_type,
			coalesce(ha.avg_power, 0) as expected,
			ch.avg_power as actual
		from current_hour ch
		left join historical_avg ha on ha.device_type = ch.device_type
		where ha.avg_power is not null
		  and ha.avg_power > 0
	`, siteID)
	if err != nil {
		return fmt.Errorf("detect anomalies: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var (
			deviceType string
			expected   float64
			actual     float64
		)
		if err := rows.Scan(
			&deviceType,
			&expected,
			&actual,
		); err != nil {
			return err
		}

		deviation := math.Abs(actual-expected) / expected * 100
		if deviation < 15 {
			continue
		}

		severity := "low"
		if deviation >= 50 {
			severity = "high"
		} else if deviation >= 30 {
			severity = "medium"
		}

		metric := formatMetric(deviceType)
		desc := fmt.Sprintf("%s deviated %.0f%% from 7-day average (expected %.1f W, actual %.1f W)",
			metric, deviation, expected, actual)

		_, err := w.db.ExecContext(ctx, `
			insert into anomalies (id, site_id, metric, expected, actual, deviation, severity, description)
			values ($1, $2, $3, $4, $5, $6, $7, $8)
		`,
			xid.New().String(),
			siteID,
			metric,
			expected,
			actual,
			deviation,
			severity,
			desc,
		)
		if err != nil {
			slog.ErrorContext(ctx, "failed to insert anomaly", "error", err)
		}
	}

	return rows.Err()
}

// generateSiteInsights creates rule-based insights from recent data.
func (w *Worker) generateSiteInsights(ctx context.Context, siteID string) error {
	// Check for offline chargers
	w.checkOfflineChargers(ctx, siteID)

	// Check solar performance
	w.checkSolarPerformance(ctx, siteID)

	// Check grid dependency
	w.checkGridDependency(ctx, siteID)

	// Step 4: Notify via Redis pub/sub
	w.redis.Publish(ctx, fmt.Sprintf("insights:%s", siteID), "refresh")

	slog.InfoContext(ctx, "insights generated", "siteID", siteID)
	return nil
}

func (w *Worker) checkOfflineChargers(ctx context.Context, siteID string) {
	rows, err := w.db.QueryContext(ctx, `
		select charge_point_id, last_heartbeat_at
		from ev_chargers
		where site_id = $1
		  and last_heartbeat_at < now() - interval '24 hours'
		  and last_heartbeat_at is not null
	`, siteID)
	if err != nil {
		slog.ErrorContext(ctx, "failed to check offline chargers", "error", err)
		return
	}
	defer rows.Close()

	for rows.Next() {
		var (
			cpID          string
			lastHeartbeat time.Time
		)
		if err := rows.Scan(&cpID, &lastHeartbeat); err != nil {
			continue
		}

		hours := int(time.Since(lastHeartbeat).Hours())
		w.insertInsight(ctx, siteID, "warning", "ev", fmt.Sprintf("Charger %s offline for %d hours", cpID, hours),
			fmt.Sprintf("No heartbeat since %s.", lastHeartbeat.Format("Jan 02, 15:04")),
			"", "-45 kWh/day", -45, "kWh/day", "Restart charger", 90)
	}
}

func (w *Worker) checkSolarPerformance(ctx context.Context, siteID string) {
	var todaySolar, avgSolar float64
	err := w.db.QueryRowContext(ctx, `
		select
			coalesce((select solar_kwh from site_energy_daily where site_id = $1 and date = now()::date), 0),
			coalesce((select avg(solar_kwh) from site_energy_daily where site_id = $1 and date >= now()::date - 30 and date < now()::date), 0)
	`, siteID).Scan(&todaySolar, &avgSolar)
	if err != nil || avgSolar == 0 {
		return
	}

	pctChange := (todaySolar - avgSolar) / avgSolar * 100
	if pctChange > 10 {
		w.insertInsight(ctx, siteID, "achievement", "solar",
			fmt.Sprintf("Solar output %.0f%% above 30-day average", pctChange),
			fmt.Sprintf("Today's solar generation of %.1f kWh exceeds the 30-day average of %.1f kWh.", todaySolar, avgSolar),
			"", fmt.Sprintf("+%.0f%% output", pctChange), pctChange, "% output", "", 92)
	} else if pctChange < -20 {
		w.insertInsight(ctx, siteID, "warning", "solar",
			fmt.Sprintf("Solar output %.0f%% below 30-day average", math.Abs(pctChange)),
			fmt.Sprintf("Today's solar generation of %.1f kWh is significantly below the 30-day average of %.1f kWh.", todaySolar, avgSolar),
			"", fmt.Sprintf("%.0f%% output", pctChange), pctChange, "% output", "", 88)
	}
}

func (w *Worker) checkGridDependency(ctx context.Context, siteID string) {
	var todayGrid, avgGrid float64
	err := w.db.QueryRowContext(ctx, `
		select
			coalesce((select grid_import_kwh from site_energy_daily where site_id = $1 and date = now()::date), 0),
			coalesce((select avg(grid_import_kwh) from site_energy_daily where site_id = $1 and date >= now()::date - 7 and date < now()::date), 0)
	`, siteID).Scan(&todayGrid, &avgGrid)
	if err != nil || avgGrid == 0 {
		return
	}

	pctChange := (todayGrid - avgGrid) / avgGrid * 100
	if pctChange > 30 {
		w.insertInsight(ctx, siteID, "warning", "grid",
			fmt.Sprintf("Grid import %.0f%% higher than weekly average", pctChange),
			fmt.Sprintf("Today's grid import of %.1f kWh exceeds the 7-day average of %.1f kWh.", todayGrid, avgGrid),
			"", fmt.Sprintf("+%.0f%% grid", pctChange), pctChange, "% grid", "", 85)
	} else if pctChange < -20 {
		w.insertInsight(ctx, siteID, "achievement", "grid",
			fmt.Sprintf("Grid dependency dropped %.0f%% vs weekly average", math.Abs(pctChange)),
			fmt.Sprintf("Today's grid import of %.1f kWh is %.0f%% below the 7-day average.", todayGrid, math.Abs(pctChange)),
			"", fmt.Sprintf("%.0f%% grid", pctChange), pctChange, "% grid", "", 87)
	}
}

func (w *Worker) insertInsight(ctx context.Context, siteID, insightType, category, title, summary, detail, impact string, impactValue float64, impactUnit, action string, confidence int) {
	// Deduplicate: skip if similar insight exists in last 24h
	var exists bool
	w.db.QueryRowContext(ctx, `
		select exists(
			select 1 from insights
			where site_id = $1
			  and type = $2
			  and category = $3
			  and title = $4
			  and created_at >= now() - interval '24 hours'
		)
	`, siteID, insightType, category, title).Scan(&exists)
	if exists {
		return
	}

	id := xid.New().String()
	_, err := w.db.ExecContext(ctx, `
		insert into insights (id, site_id, type, category, title, summary, detail, impact, impact_value, impact_unit, action, confidence)
		values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`,
		id,
		siteID,
		insightType,
		category,
		title,
		summary,
		detail,
		impact,
		impactValue,
		impactUnit,
		action,
		confidence,
	)
	if err != nil {
		slog.ErrorContext(ctx, "failed to insert insight", "error", err)
		return
	}

	// Push notification via Redis
	payload, _ := json.Marshal(map[string]string{"id": id, "type": insightType, "title": title})
	w.redis.Publish(ctx, fmt.Sprintf("insights:%s", siteID), string(payload))
}

func formatMetric(deviceType string) string {
	parts := strings.Split(deviceType, "_")
	for i, p := range parts {
		if len(p) > 0 {
			parts[i] = strings.ToUpper(p[:1]) + p[1:]
		}
	}
	return strings.Join(parts, " ")
}
