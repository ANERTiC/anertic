package transaction

import (
	"context"

	"github.com/anertic/anertic/ocppv16/chargepoint"
)

// IdTagInfo is a common OCPP 1.6 type.
type IdTagInfo struct {
	Status      string `json:"status"` // Accepted, Blocked, Expired, Invalid, ConcurrentTx
	ExpiryDate  string `json:"expiryDate,omitempty"`
	ParentIdTag string `json:"parentIdTag,omitempty"`
}

// MeterValue embedded in StopTransaction
type MeterValue struct {
	Timestamp    string         `json:"timestamp"`
	SampledValue []SampledValue `json:"sampledValue"`
}

type SampledValue struct {
	Value     string `json:"value"`
	Context   string `json:"context,omitempty"`
	Format    string `json:"format,omitempty"`
	Measurand string `json:"measurand,omitempty"`
	Phase     string `json:"phase,omitempty"`
	Location  string `json:"location,omitempty"`
	Unit      string `json:"unit,omitempty"`
}

// StartParams matches OCPP 1.6 StartTransaction.req
type StartParams struct {
	ConnectorID   int    `json:"connectorId"`
	IdTag         string `json:"idTag"`
	MeterStart    int    `json:"meterStart"`
	Timestamp     string `json:"timestamp"`
	ReservationID *int   `json:"reservationId,omitempty"`
}

// StartResult matches OCPP 1.6 StartTransaction.conf
type StartResult struct {
	TransactionID int       `json:"transactionId"`
	IdTagInfo     IdTagInfo `json:"idTagInfo"`
}

func Start(ctx context.Context, p *StartParams) (*StartResult, error) {
	_ = chargepoint.ID(ctx)

	// TODO: create charging_sessions record
	// TODO: generate transactionId from DB sequence or session ID
	// TODO: validate idTag via authorize
	// TODO: update ev_connectors status to "Charging"

	return &StartResult{
		TransactionID: 1,
		IdTagInfo:     IdTagInfo{Status: "Accepted"},
	}, nil
}

// StopParams matches OCPP 1.6 StopTransaction.req
type StopParams struct {
	TransactionID   int          `json:"transactionId"`
	IdTag           string       `json:"idTag"`
	MeterStop       int          `json:"meterStop"`
	Timestamp       string       `json:"timestamp"`
	Reason          string       `json:"reason"` // EmergencyStop, EVDisconnected, HardReset, Local, Other, PowerLoss, Reboot, Remote, SoftReset, UnlockCommand, DeAuthorized
	TransactionData []MeterValue `json:"transactionData,omitempty"`
}

// StopResult matches OCPP 1.6 StopTransaction.conf
type StopResult struct {
	IdTagInfo *IdTagInfo `json:"idTagInfo,omitempty"`
}

func Stop(ctx context.Context, p *StopParams) (*StopResult, error) {
	_ = chargepoint.ID(ctx)

	// TODO: close charging_sessions (set end_time, energy_kwh, stop_reason)
	// TODO: calculate energy from meterStop - meterStart
	// TODO: store transactionData meter values
	// TODO: update ev_connectors status

	return &StopResult{
		IdTagInfo: &IdTagInfo{Status: "Accepted"},
	}, nil
}
