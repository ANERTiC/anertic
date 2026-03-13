package meter

import (
	"context"
	"database/sql"
	"log/slog"
	"strconv"
	"strings"
	"time"

	"github.com/acoshift/pgsql/pgctx"

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

	// resolve charger_id from charge_point_id
	var chargerID string
	err := pgctx.QueryRow(ctx, `
		select id
		from ev_chargers
		where charge_point_id = $1
	`,
		chargePointID,
	).Scan(
		&chargerID,
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
		insertMeterReadings(ctx, chargePointID, ts, mv.SampledValue)
	}

	return &Result{}, nil
}

// insertEVMeterValues writes raw sampled values to ev_meter_values (OCPP audit log).
func insertEVMeterValues(ctx context.Context, chargerID string, connectorID int, transactionID *int, ts time.Time, samples []SampledValue) {
	for _, sv := range samples {
		value, err := strconv.ParseFloat(sv.Value, 64)
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
	PowerW             sql.NullFloat64
	EnergyKwh          sql.NullFloat64
	VoltageV           sql.NullFloat64
	CurrentA           sql.NullFloat64
	Frequency          sql.NullFloat64
	PF                 sql.NullFloat64
	ApparentPowerVA    sql.NullFloat64
	ReactivePowerVar   sql.NullFloat64
	ReactiveEnergyKvarh sql.NullFloat64
	TemperatureC       sql.NullFloat64
}

// insertMeterReadings maps OCPP sampled values to the unified meter_readings table.
// Groups values by phase so each meter (identified by charge_point_id + phase) gets one row.
func insertMeterReadings(ctx context.Context, chargePointID string, ts time.Time, samples []SampledValue) {
	// group by phase: "" (no phase / total) and "L1", "L2", "L3"
	readings := make(map[string]*reading)

	for _, sv := range samples {
		value, err := strconv.ParseFloat(sv.Value, 64)
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
		meterID := resolveMeterID(ctx, chargePointID, phase)
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

// mapMeasurand maps an OCPP measurand value to the corresponding reading field.
func mapMeasurand(r *reading, measurand string, value float64) {
	switch measurand {
	case "Power.Active.Import":
		r.PowerW = sql.NullFloat64{Float64: value, Valid: true}
	case "Power.Active.Export":
		r.PowerW = sql.NullFloat64{Float64: -value, Valid: true}
	case "Energy.Active.Import.Register":
		r.EnergyKwh = sql.NullFloat64{Float64: value, Valid: true}
	case "Energy.Reactive.Import.Register":
		r.ReactiveEnergyKvarh = sql.NullFloat64{Float64: value, Valid: true}
	case "Power.Reactive.Import":
		r.ReactivePowerVar = sql.NullFloat64{Float64: value, Valid: true}
	case "Voltage":
		r.VoltageV = sql.NullFloat64{Float64: value, Valid: true}
	case "Current.Import":
		r.CurrentA = sql.NullFloat64{Float64: value, Valid: true}
	case "Current.Export":
		r.CurrentA = sql.NullFloat64{Float64: -value, Valid: true}
	case "Frequency":
		r.Frequency = sql.NullFloat64{Float64: value, Valid: true}
	case "Power.Factor":
		r.PF = sql.NullFloat64{Float64: value, Valid: true}
	case "Temperature":
		r.TemperatureC = sql.NullFloat64{Float64: value, Valid: true}
	}
}

// normalizeValue converts OCPP values to base units used in meter_readings.
// Power → W, Energy → kWh, Voltage → V, Current → A.
func normalizeValue(value float64, unit string) float64 {
	switch unit {
	case "kW":
		return value * 1000 // → W
	case "kWh":
		return value // already kWh
	case "Wh":
		return value / 1000 // → kWh
	case "kVA":
		return value * 1000 // → VA
	case "kvar":
		return value * 1000 // → var
	case "kvarh":
		return value // already kvarh
	case "varh":
		return value / 1000 // → kvarh
	case "kVARh":
		return value // already kvarh
	default:
		return value
	}
}

// resolveMeterID finds the meter_id linked to a charge point.
// Convention: meters.serial_number = charge_point_id for single-phase,
// or meters.serial_number = charge_point_id + phase suffix for multi-phase.
func resolveMeterID(ctx context.Context, chargePointID, phase string) string {
	phaseNum := ocppPhaseToNum(phase)

	var meterID string
	var err error

	if phaseNum > 0 {
		// try phase-specific meter first
		err = pgctx.QueryRow(ctx, `
			select id
			from meters
			where serial_number = $1
				and phase = $2
		`,
			chargePointID,
			phaseNum,
		).Scan(
			&meterID,
		)
		if err == nil {
			return meterID
		}
	}

	// fallback: meter with serial_number = charge_point_id
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
		// no linked meter — skip silently, charger may not be linked to devices yet
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
