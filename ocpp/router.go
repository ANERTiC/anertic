package ocpp

import (
	"context"
	"encoding/json"
)

// Router routes inbound OCPP actions for a specific version.
type Router interface {
	// HandleCall dispatches an inbound OCPP Call to the appropriate handler.
	HandleCall(ctx context.Context, cp *ChargePoint, msgID string, action string, payload json.RawMessage)
}
