package ocpp

import (
	"context"
	"encoding/json"

	"github.com/anertic/anertic/pkg/rdctx"
)

type command struct {
	Action  string         `json:"action"`
	Payload map[string]any `json:"payload"`
}

// SendCommand publishes a command to a charge point via its Redis pub/sub channel.
func SendCommand(ctx context.Context, chargePointID string, action string, payload map[string]any) error {
	data, err := json.Marshal(command{
		Action:  action,
		Payload: payload,
	})
	if err != nil {
		return err
	}
	return rdctx.From(ctx).Publish(ctx, "ocpp:cp:"+chargePointID, data).Err()
}
