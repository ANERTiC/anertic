package ocpp

const (
	ActionRemoteStart    = "RemoteStartTransaction"
	ActionRemoteStop     = "RemoteStopTransaction"
	ActionReset          = "Reset"
	ActionGetConfiguration = "GetConfiguration"
)

// Command represents a command to send to a charge point via Redis PubSub.
type Command struct {
	RequestID     string         `json:"requestId"`
	ChargePointID string         `json:"chargePointId"`
	Action        string         `json:"action"`
	Payload       map[string]any `json:"payload"`
}

// CommandResponse is the response from a charge point command.
type CommandResponse struct {
	RequestID string         `json:"requestId"`
	Status    string         `json:"status"`
	Payload   map[string]any `json:"payload,omitempty"`
	Error     string         `json:"error,omitempty"`
}
