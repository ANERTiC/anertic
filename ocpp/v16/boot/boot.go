package boot

import (
	"context"
	"log/slog"
	"time"

	"github.com/acoshift/pgsql/pgctx"

	"github.com/anertic/anertic/ocpp"
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
	Status      string `json:"status"`      // Accepted, Pending, Rejected
	CurrentTime string `json:"currentTime"` // RFC3339
	Interval    int    `json:"interval"`    // heartbeat interval in seconds
}

func BootNotification(ctx context.Context, p *Params) (*Result, error) {
	chargePointID := ocpp.ChargePointID(ctx)

	var registrationStatus string
	var heartbeatInterval int
	err := pgctx.QueryRow(ctx, `
		update ev_chargers
		set vendor = $2,
		    model = $3,
		    serial_number = $4,
		    charge_box_serial_number = $5,
		    firmware_version = $6,
		    iccid = $7,
		    imsi = $8,
		    meter_type = $9,
		    meter_serial_number = $10,
		    registration_status = case when site_id is not null then 'Accepted' else 'Pending' end,
		    last_heartbeat_at = now(),
		    updated_at = now()
		where charge_point_id = $1
		returning registration_status, heartbeat_interval
	`,
		chargePointID,
		p.ChargePointVendor,
		p.ChargePointModel,
		p.ChargePointSerialNumber,
		p.ChargeBoxSerialNumber,
		p.FirmwareVersion,
		p.Iccid,
		p.Imsi,
		p.MeterType,
		p.MeterSerialNumber,
	).Scan(
		&registrationStatus,
		&heartbeatInterval,
	)
	if err != nil {
		return nil, err
	}

	slog.InfoContext(ctx, "boot notification",
		"chargePointID", chargePointID,
		"vendor", p.ChargePointVendor,
		"model", p.ChargePointModel,
		"serial", p.ChargePointSerialNumber,
		"firmware", p.FirmwareVersion,
		"status", registrationStatus,
	)

	return &Result{
		Status:      registrationStatus,
		CurrentTime: time.Now().UTC().Format(time.RFC3339),
		Interval:    heartbeatInterval,
	}, nil
}
