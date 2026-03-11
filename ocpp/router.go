package ocpp

import (
	"context"
	"encoding/json"
)

// Router routes inbound OCPP actions and outbound commands for a specific version.
type Router interface {
	// HandleCall dispatches an inbound OCPP Call to the appropriate handler.
	HandleCall(ctx context.Context, cp *ChargePoint, msgID string, action string, payload json.RawMessage)

	// ExecuteRemoteCommand dispatches an outbound command to the charger.
	ExecuteRemoteCommand(ctx context.Context, cp *ChargePoint, cmd *Command) (*CommandResponse, error)
}
