package ocpp

// CommandStatus represents the status of a CSMS→CP command stored on ev_chargers.
// Values: 0=pending, 1=ok, 2=error.
const (
	CommandStatusPending int16 = iota // 0
	CommandStatusOk                   // 1
	CommandStatusError                // 2
)
