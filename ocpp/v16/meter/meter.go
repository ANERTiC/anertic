package meter

import (
	"context"
	"log/slog"
	"strings"
	"time"

	"github.com/acoshift/pgsql/pgctx"
	"github.com/shopspring/decimal"

	"github.com/anertic/anertic/ocpp"
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
	chargePointID := ocpp.ChargePointID(ctx)

	// resolve charger_id and site_id from charge_point_id
	var chargerID string
	var siteID string
	err := pgctx.QueryRow(ctx, `
		select id,
		       coalesce(site_id, '')
		from ev_chargers
		where charge_point_id = $1
	`,
		chargePointID,
	).Scan(
		&chargerID,
		&siteID,
	)
	if err != nil {
		return nil, err
	}

	for _, mv := range p.MeterValue {
		ts := time.Now()
		if mv.Timestamp != "" {
			if parsed, err := time.Parse(time.RFC3339, mv.Timestamp); err == nil {
				ts = parsed
			}
		}

		// 1. Write raw OCPP audit log to ev_meter_values
		insertEVMeterValues(ctx, chargerID, p.ConnectorID, p.TransactionID, ts, mv.SampledValue)

		// 2. Write unified meter_readings for dashboard
		insertMeterReadings(ctx, chargePointID, siteID, ts, mv.SampledValue)
	}

	return &Result{}, nil
}

// insertEVMeterValues writes raw sampled values to ev_meter_values (OCPP audit log).
func insertEVMeterValues(ctx context.Context, chargerID string, connectorID int, transactionID *int, ts time.Time, samples []SampledValue) {
	for _, sv := range samples {
		value, err := decimal.NewFromString(sv.Value)
		if err != nil {
			slog.ErrorContext(ctx, "invalid meter value",
				"error", err,
				"value", sv.Value,
				"measurand", sv.Measurand,
			)
			continue
		}

		measurand := sv.Measurand
		if measurand == "" {
			measurand = "Energy.Active.Import.Register"
		}

		unit := sv.Unit
		if unit == "" {
			unit = "Wh"
		}

		svContext := sv.Context
		if svContext == "" {
			svContext = "Sample.Periodic"
		}

		location := sv.Location
		if location == "" {
			location = "Outlet"
		}

		format := sv.Format
		if format == "" {
			format = "Raw"
		}

		_, err = pgctx.Exec(ctx, `
			insert into ev_meter_values (
				time,
				charger_id,
				connector_id,
				transaction_id,
				measurand,
				phase,
				value,
				unit,
				context,
				location,
				format
			)
			values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		`,
			ts,
			chargerID,
			connectorID,
			transactionID,
			measurand,
			sv.Phase,
			value,
			unit,
			svContext,
			location,
			format,
		)
		if err != nil {
			slog.ErrorContext(ctx, "failed to insert ev_meter_value",
				"error", err,
				"chargerID", chargerID,
				"measurand", measurand,
			)
		}
	}
}

// reading collects mapped OCPP measurands into meter_readings columns.
type reading struct {
	PowerW              *decimal.Decimal
	EnergyKwh           *decimal.Decimal
	VoltageV            *decimal.Decimal
	CurrentA            *decimal.Decimal
	Frequency           *decimal.Decimal
	PF                  *decimal.Decimal
	ApparentPowerVA     *decimal.Decimal
	ReactivePowerVar    *decimal.Decimal
	ReactiveEnergyKvarh *decimal.Decimal
	TemperatureC        *decimal.Decimal
}

// insertMeterReadings maps OCPP sampled values to the unified meter_readings table.
// Groups values by phase so each meter (identified by charge_point_id + phase) gets one row.
func insertMeterReadings(ctx context.Context, chargePointID, siteID string, ts time.Time, samples []SampledValue) {
	// group by phase: "" (no phase / total) and "L1", "L2", "L3"
	readings := make(map[string]*reading)

	for _, sv := range samples {
		value, err := decimal.NewFromString(sv.Value)
		if err != nil {
			continue
		}

		measurand := sv.Measurand
		if measurand == "" {
			measurand = "Energy.Active.Import.Register"
		}

		unit := sv.Unit
		if unit == "" {
			unit = "Wh"
		}

		// normalize value to base units
		value = normalizeValue(value, unit)

		phase := sv.Phase // "", "L1", "L2", "L3", etc.

		r, ok := readings[phase]
		if !ok {
			r = &reading{}
			readings[phase] = r
		}

		mapMeasurand(r, measurand, value)
	}

	// write one meter_readings row per phase
	for phase, r := range readings {
		meterID := resolveMeterID(ctx, chargePointID, siteID, phase)
		if meterID == "" {
			continue
		}

		_, err := pgctx.Exec(ctx, `
			insert into meter_readings (
				time,
				meter_id,
				power_w,
				energy_kwh,
				voltage_v,
				current_a,
				frequency,
				pf,
				apparent_power_va,
				reactive_power_var,
				reactive_energy_kvarh,
				temperature_c
			)
			values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
		`,
			ts,
			meterID,
			r.PowerW,
			r.EnergyKwh,
			r.VoltageV,
			r.CurrentA,
			r.Frequency,
			r.PF,
			r.ApparentPowerVA,
			r.ReactivePowerVar,
			r.ReactiveEnergyKvarh,
			r.TemperatureC,
		)
		if err != nil {
			slog.ErrorContext(ctx, "failed to insert meter_reading",
				"error", err,
				"meterID", meterID,
				"chargePointID", chargePointID,
			)
		}
	}
}

var (
	thousand = decimal.NewFromInt(1000)
)

// mapMeasurand maps an OCPP measurand value to the corresponding reading field.
func mapMeasurand(r *reading, measurand string, value decimal.Decimal) {
	switch measurand {
	case "Power.Active.Import":
		r.PowerW = &value
	case "Power.Active.Export":
		neg := value.Neg()
		r.PowerW = &neg
	case "Energy.Active.Import.Register":
		r.EnergyKwh = &value
	case "Energy.Reactive.Import.Register":
		r.ReactiveEnergyKvarh = &value
	case "Power.Reactive.Import":
		r.ReactivePowerVar = &value
	case "Voltage":
		r.VoltageV = &value
	case "Current.Import":
		r.CurrentA = &value
	case "Current.Export":
		neg := value.Neg()
		r.CurrentA = &neg
	case "Frequency":
		r.Frequency = &value
	case "Power.Factor":
		r.PF = &value
	case "Temperature":
		r.TemperatureC = &value
	}
}

// normalizeValue converts OCPP values to base units used in meter_readings.
// Power → W, Energy → kWh, Voltage → V, Current → A.
func normalizeValue(value decimal.Decimal, unit string) decimal.Decimal {
	switch unit {
	case "kW":
		return value.Mul(thousand) // → W
	case "kWh":
		return value // already kWh
	case "Wh":
		return value.Div(thousand) // → kWh
	case "kVA":
		return value.Mul(thousand) // → VA
	case "kvar":
		return value.Mul(thousand) // → var
	case "kvarh":
		return value // already kvarh
	case "varh":
		return value.Div(thousand) // → kvarh
	case "kVARh":
		return value // already kvarh
	default:
		return value
	}
}

// resolveMeterID finds the meter_id linked to a charge point within a site.
// Convention: meters.serial_number = charge_point_id for single-phase,
// or meters.serial_number = charge_point_id + phase suffix for multi-phase.
func resolveMeterID(ctx context.Context, chargePointID, siteID, phase string) string {
	phaseNum := ocppPhaseToNum(phase)

	var meterID string
	var err error

	if phaseNum > 0 && siteID != "" {
		// try phase-specific meter within site first
		err = pgctx.QueryRow(ctx, `
			select id
			from meters
			where serial_number = $1
			  and site_id = $2
			  and phase = $3
		`,
			chargePointID,
			siteID,
			phaseNum,
		).Scan(
			&meterID,
		)
		if err == nil {
			return meterID
		}
	}

	if siteID != "" {
		// fallback: meter with serial_number = charge_point_id within site
		err = pgctx.QueryRow(ctx, `
			select id
			from meters
			where serial_number = $1
			  and site_id = $2
			limit 1
		`,
			chargePointID,
			siteID,
		).Scan(
			&meterID,
		)
		if err == nil {
			return meterID
		}
	}

	// last resort: no site_id (charger not assigned to site yet)
	err = pgctx.QueryRow(ctx, `
		select id
		from meters
		where serial_number = $1
		limit 1
	`,
		chargePointID,
	).Scan(
		&meterID,
	)
	if err != nil {
		return ""
	}

	return meterID
}

// ocppPhaseToNum converts OCPP phase string to meter phase number.
func ocppPhaseToNum(phase string) int {
	switch {
	case strings.HasPrefix(phase, "L1"):
		return 1
	case strings.HasPrefix(phase, "L2"):
		return 2
	case strings.HasPrefix(phase, "L3"):
		return 3
	default:
		return 0
	}
}
