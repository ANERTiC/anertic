package boot

import (
	"context"
	"time"

	"github.com/anertic/anertic/ocppv16/chargepoint"
)

// Params matches OCPP 1.6 BootNotification.req
type Params struct {
	ChargePointVendor       string `json:"chargePointVendor"`
	ChargePointModel        string `json:"chargePointModel"`
	ChargePointSerialNumber string `json:"chargePointSerialNumber"`
	ChargeBoxSerialNumber   string `json:"chargeBoxSerialNumber"`
	FirmwareVersion         string `json:"firmwareVersion"`
	Iccid                   string `json:"iccid"`
	Imsi                    string `json:"imsi"`
	MeterType               string `json:"meterType"`
	MeterSerialNumber       string `json:"meterSerialNumber"`
}

// Result matches OCPP 1.6 BootNotification.conf
type Result struct {
	Status      string `json:"status"`
	CurrentTime string `json:"currentTime"`
	Interval    int    `json:"interval"`
}

func BootNotification(ctx context.Context, p *Params) (*Result, error) {
	_ = chargepoint.ID(ctx)

	// TODO: upsert charger info (vendor, model, serial, firmware) in ev_chargers
	// TODO: update last_heartbeat_at

	return &Result{
		Status:      "Accepted",
		CurrentTime: time.Now().UTC().Format(time.RFC3339),
		Interval:    60,
	}, nil
}
