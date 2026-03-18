package pipeline

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/acoshift/pgsql/pgctx"
	mqtt "github.com/eclipse/paho.mqtt.golang"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"

	"github.com/anertic/anertic/pkg/ingest"
	"github.com/anertic/anertic/pkg/rdctx"
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

// MQTTReading represents the MQTT payload which includes meter_id.
type MQTTReading struct {
	MeterID string `json:"meter_id"`
	ingest.Reading
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
	// Inject DB and Redis into context for pkg/ingest.ProcessReading
	ctx = pgctx.NewContext(ctx, p.db)
	ctx = rdctx.NewContext(ctx, p.redis)

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
	var r MQTTReading
	if err := json.Unmarshal(msg.Payload(), &r); err != nil {
		slog.Error("failed to parse reading", "error", err, "topic", msg.Topic())
		return
	}

	if err := ingest.ProcessReading(ctx, r.MeterID, &r.Reading); err != nil {
		slog.Error("failed to process reading", "error", err, "meter_id", r.MeterID)
	}
}
