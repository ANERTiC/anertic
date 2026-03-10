package meter

import (
	"context"

	"github.com/anertic/anertic/ocppv16/chargepoint"
)

// Params matches OCPP 1.6 MeterValues.req
type Params struct {
	ConnectorID   int              `json:"connectorId"`
	TransactionID *int             `json:"transactionId,omitempty"`
	MeterValue    []MeterValueItem `json:"meterValue"`
}

type MeterValueItem struct {
	Timestamp    string         `json:"timestamp"`
	SampledValue []SampledValue `json:"sampledValue"`
}

type SampledValue struct {
	Value     string `json:"value"`
	Context   string `json:"context,omitempty"`   // Sample.Periodic, Transaction.Begin, Transaction.End, etc.
	Format    string `json:"format,omitempty"`    // Raw, SignedData
	Measurand string `json:"measurand,omitempty"` // Energy.Active.Import.Register, Power.Active.Import, etc.
	Phase     string `json:"phase,omitempty"`     // L1, L2, L3, L1-N, L2-N, L3-N, L1-L2, L2-L3, L3-L1
	Location  string `json:"location,omitempty"`  // Body, Cable, EV, Inlet, Outlet
	Unit      string `json:"unit,omitempty"`      // Wh, kWh, varh, kvarh, W, kW, VA, kVA, var, kvar, A, V, Celsius, Fahrenheit, K, Percent
}

// Result matches OCPP 1.6 MeterValues.conf
type Result struct{}

func MeterValues(ctx context.Context, p *Params) (*Result, error) {
	_ = chargepoint.ID(ctx)

	// TODO: parse meter values, extract power/energy/voltage/current
	// TODO: insert into readings table
	// TODO: update charging_sessions.energy_kwh and max_power_kw if transactionId present

	return &Result{}, nil
}
