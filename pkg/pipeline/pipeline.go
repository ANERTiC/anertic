package pipeline

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"
	"time"

	mqtt "github.com/eclipse/paho.mqtt.golang"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"
)

type Config struct {
	DatabaseURL string
	RedisURL    string
	MQTTBroker  string
	MQTTTopic   string
}

type Pipeline struct {
	db    *sql.DB
	redis *redis.Client
	mqtt  mqtt.Client
	topic string
}

// Reading represents a raw sensor reading from MQTT.
type Reading struct {
	MeterID            string  `json:"meter_id"`
	PowerW             float64 `json:"power_w"`
	EnergyKWh          float64 `json:"energy_kwh"`
	VoltageV           float64 `json:"voltage_v"`
	CurrentA           float64 `json:"current_a"`
	Frequency          float64 `json:"frequency"`
	PF                 float64 `json:"pf"`
	ApparentPowerVA    float64 `json:"apparent_power_va"`
	ReactivePowerVAR   float64 `json:"reactive_power_var"`
	ApparentEnergyKVAh float64 `json:"apparent_energy_kvah"`
	ReactiveEnergyKVARh float64 `json:"reactive_energy_kvarh"`
	THDV               float64 `json:"thd_v"`
	THDI               float64 `json:"thd_i"`
	TemperatureC       float64 `json:"temperature_c"`
	Timestamp          string  `json:"timestamp"`
}

func New(cfg Config) (*Pipeline, error) {
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

	opts := mqtt.NewClientOptions().
		AddBroker(cfg.MQTTBroker).
		SetClientID("anertic-ingester").
		SetAutoReconnect(true).
		SetConnectRetry(true).
		SetConnectRetryInterval(5 * time.Second)

	mqttClient := mqtt.NewClient(opts)

	return &Pipeline{
		db:    db,
		redis: rdb,
		mqtt:  mqttClient,
		topic: cfg.MQTTTopic,
	}, nil
}

func (p *Pipeline) Close() {
	p.db.Close()
	p.redis.Close()
	if p.mqtt.IsConnected() {
		p.mqtt.Disconnect(1000)
	}
}

func (p *Pipeline) Run(ctx context.Context) error {
	token := p.mqtt.Connect()
	if token.Wait() && token.Error() != nil {
		return token.Error()
	}

	token = p.mqtt.Subscribe(p.topic, 1, func(_ mqtt.Client, msg mqtt.Message) {
		p.handleMessage(ctx, msg)
	})
	if token.Wait() && token.Error() != nil {
		return token.Error()
	}

	<-ctx.Done()
	return nil
}

func (p *Pipeline) handleMessage(ctx context.Context, msg mqtt.Message) {
	var r Reading
	if err := json.Unmarshal(msg.Payload(), &r); err != nil {
		slog.Error("failed to parse reading", "error", err, "topic", msg.Topic())
		return
	}

	ts, err := time.Parse(time.RFC3339, r.Timestamp)
	if err != nil {
		ts = time.Now()
	}

	// Insert into TimescaleDB
	_, err = p.db.ExecContext(ctx, `
		insert into meter_readings (
			time,
			meter_id,
			power_w,
			energy_kwh,
			voltage_v,
			current_a,
			frequency,
			pf,
			apparent_power_va,
			reactive_power_var,
			apparent_energy_kvah,
			reactive_energy_kvarh,
			thd_v,
			thd_i,
			temperature_c
		) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`,
		ts,
		r.MeterID,
		r.PowerW,
		r.EnergyKWh,
		r.VoltageV,
		r.CurrentA,
		r.Frequency,
		r.PF,
		r.ApparentPowerVA,
		r.ReactivePowerVAR,
		r.ApparentEnergyKVAh,
		r.ReactiveEnergyKVARh,
		r.THDV,
		r.THDI,
		r.TemperatureC,
	)
	if err != nil {
		slog.Error("failed to insert reading", "error", err)
		return
	}

	// Update meter's latest reading
	latestReading, _ := json.Marshal(map[string]any{
		"time":                ts,
		"powerW":              r.PowerW,
		"energyKwh":           r.EnergyKWh,
		"voltageV":            r.VoltageV,
		"currentA":            r.CurrentA,
		"frequency":           r.Frequency,
		"pf":                  r.PF,
		"apparentPowerVa":     r.ApparentPowerVA,
		"reactivePowerVar":    r.ReactivePowerVAR,
		"apparentEnergyKvah":  r.ApparentEnergyKVAh,
		"reactiveEnergyKvarh": r.ReactiveEnergyKVARh,
		"thdV":                r.THDV,
		"thdI":                r.THDI,
		"temperatureC":        r.TemperatureC,
	})
	_, err = p.db.ExecContext(ctx, `
		update meters
		set latest_reading = $1,
		    is_online = true,
		    last_seen_at = $2
		where id = $3
	`,
		latestReading,
		ts,
		r.MeterID,
	)
	if err != nil {
		slog.Error("failed to update meter latest reading", "error", err)
	}

	// Publish to Redis for real-time WebSocket fan-out
	data, _ := json.Marshal(r)
	if err := p.redis.Publish(ctx, "readings:realtime", data).Err(); err != nil {
		slog.Error("failed to publish reading", "error", err)
	}
}
