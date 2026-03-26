package ocpp

import (
	"context"
	"encoding/json"
	"log/slog"

	"github.com/anertic/anertic/pkg/rdctx"
)

type command struct {
	Action  string          `json:"action"`
	Payload json.RawMessage `json:"payload"`
}

// SendCommand publishes a command to a charge point via its Redis pub/sub channel.
func SendCommand(ctx context.Context, chargePointID string, action string, payload json.RawMessage) error {
	data, err := json.Marshal(command{
		Action:  action,
		Payload: payload,
	})
	if err != nil {
		return err
	}
	channel := "ocpp:cp:" + chargePointID
	result := rdctx.From(ctx).Publish(ctx, channel, data)
	receivers, err := result.Result()
	if err != nil {
		slog.ErrorContext(ctx, "failed to publish ocpp command",
			"error", err,
			"chargePointID", chargePointID,
			"action", action,
			"channel", channel,
		)
		return err
	}
	slog.InfoContext(ctx, "published ocpp command",
		"chargePointID", chargePointID,
		"action", action,
		"channel", channel,
		"receivers", receivers,
	)
	if receivers == 0 {
		slog.WarnContext(ctx, "no subscribers for ocpp command — charger may not be connected",
			"chargePointID", chargePointID,
			"action", action,
			"channel", channel,
		)
	}
	return nil
}
