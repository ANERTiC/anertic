package ingest

import (
	"context"
	"encoding/json"
	"time"

	"github.com/acoshift/pgsql/pgctx"
	"github.com/shopspring/decimal"

	"github.com/anertic/anertic/pkg/rdctx"
)

// Reading represents a raw sensor reading.
type Reading struct {
	PowerW              decimal.Decimal `json:"power_w"`
	EnergyKWh           decimal.Decimal `json:"energy_kwh"`
	VoltageV            decimal.Decimal `json:"voltage_v"`
	CurrentA            decimal.Decimal `json:"current_a"`
	Frequency           decimal.Decimal `json:"frequency"`
	PF                  decimal.Decimal `json:"pf"`
	ApparentPowerVA     decimal.Decimal `json:"apparent_power_va"`
	ReactivePowerVAR    decimal.Decimal `json:"reactive_power_var"`
	ApparentEnergyKVAh  decimal.Decimal `json:"apparent_energy_kvah"`
	ReactiveEnergyKVARh decimal.Decimal `json:"reactive_energy_kvarh"`
	THDV                decimal.Decimal `json:"thd_v"`
	THDI                decimal.Decimal `json:"thd_i"`
	TemperatureC        decimal.Decimal `json:"temperature_c"`
	Metadata            json.RawMessage `json:"metadata"`
	Timestamp           string          `json:"timestamp"`
}

// ProcessReading inserts a reading into meter_readings, updates the meter's
// latest_reading/is_online/last_seen_at, and publishes to Redis for real-time fan-out.
func ProcessReading(ctx context.Context, meterID string, r *Reading) error {
	ts, err := time.Parse(time.RFC3339, r.Timestamp)
	if err != nil {
		ts = time.Now()
	}

	metadata := r.Metadata
	if len(metadata) == 0 {
		metadata = json.RawMessage(`{}`)
	}

	_, err = pgctx.Exec(ctx, `
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
			apparent_energy_kvah,
			reactive_energy_kvarh,
			thd_v,
			thd_i,
			temperature_c,
			metadata
		) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
	`,
		ts,
		meterID,
		r.PowerW,
		r.EnergyKWh,
		r.VoltageV,
		r.CurrentA,
		r.Frequency,
		r.PF,
		r.ApparentPowerVA,
		r.ReactivePowerVAR,
		r.ApparentEnergyKVAh,
		r.ReactiveEnergyKVARh,
		r.THDV,
		r.THDI,
		r.TemperatureC,
		metadata,
	)
	if err != nil {
		return err
	}

	latestReading, _ := json.Marshal(map[string]any{
		"time":                ts,
		"powerW":              r.PowerW,
		"energyKwh":           r.EnergyKWh,
		"voltageV":            r.VoltageV,
		"currentA":            r.CurrentA,
		"frequency":           r.Frequency,
		"pf":                  r.PF,
		"apparentPowerVa":     r.ApparentPowerVA,
		"reactivePowerVar":    r.ReactivePowerVAR,
		"apparentEnergyKvah":  r.ApparentEnergyKVAh,
		"reactiveEnergyKvarh": r.ReactiveEnergyKVARh,
		"thdV":                r.THDV,
		"thdI":                r.THDI,
		"temperatureC":        r.TemperatureC,
	})

	_, err = pgctx.Exec(ctx, `
		update meters
		set latest_reading = $1,
		    is_online = true,
		    last_seen_at = $2
		where id = $3
	`,
		latestReading,
		ts,
		meterID,
	)
	if err != nil {
		return err
	}

	data, _ := json.Marshal(map[string]any{
		"meterId":   meterID,
		"time":      ts,
		"powerW":    r.PowerW,
		"energyKwh": r.EnergyKWh,
		"voltageV":  r.VoltageV,
		"currentA":  r.CurrentA,
	})
	rdctx.From(ctx).Publish(ctx, "readings:realtime", data)

	return nil
}
