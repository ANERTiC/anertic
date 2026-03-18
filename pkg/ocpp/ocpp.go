package ocpp

import (
	"context"
	"encoding/json"

	"github.com/anertic/anertic/pkg/rdctx"
)

type command struct {
	ID      string          `json:"id"`
	Action  string          `json:"action"`
	Payload json.RawMessage `json:"payload"`
}

// SendCommand publishes a command to a charge point via its Redis pub/sub channel.
// id is a unique command identifier used to track the command status in ev_charger_commands.
func SendCommand(ctx context.Context, chargePointID string, id string, action string, payload json.RawMessage) error {
	data, err := json.Marshal(command{
		ID:      id,
		Action:  action,
		Payload: payload,
	})
	if err != nil {
		return err
	}
	return rdctx.From(ctx).Publish(ctx, "ocpp:cp:"+chargePointID, data).Err()
}
