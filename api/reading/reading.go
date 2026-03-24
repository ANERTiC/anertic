package reading

import (
	"context"
	"time"

	"github.com/acoshift/pgsql/pgctx"
	"github.com/moonrhythm/validator"
	"github.com/shopspring/decimal"
)

// Query

type QueryParams struct {
	MeterID   string `json:"meterId"`
	DeviceID  string `json:"deviceId"`
	StartTime string `json:"startTime"`
	EndTime   string `json:"endTime"`
	Interval  string `json:"interval"` // "raw", "hourly", "daily"
}

func (p *QueryParams) Valid() error {
	v := validator.New()
	v.Must(p.MeterID != "" || p.DeviceID != "", "meterId or deviceId is required")
	return v.Error()
}

type Reading struct {
	Time         time.Time        `json:"time"`
	PowerW       decimal.Decimal  `json:"powerW"`
	EnergyKWh    decimal.Decimal  `json:"energyKwh"`
	VoltageV     decimal.Decimal  `json:"voltageV"`
	CurrentA     decimal.Decimal  `json:"currentA"`
	Frequency    *decimal.Decimal `json:"frequency"`
	PF           *decimal.Decimal `json:"pf"`
	THDV         *decimal.Decimal `json:"thdV"`
	THDI         *decimal.Decimal `json:"thdI"`
	TemperatureC *decimal.Decimal `json:"temperatureC"`
}

type QueryResult struct {
	Readings []Reading `json:"readings"`
}

func Query(ctx context.Context, p *QueryParams) (*QueryResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	interval := p.Interval
	if interval == "" {
		interval = "hourly"
	}

	var table string
	switch interval {
	case "raw":
		table = "meter_readings"
	case "daily":
		table = "readings_daily"
	default:
		table = "readings_hourly"
	}

	startTime := p.StartTime
	if startTime == "" {
		startTime = time.Now().Add(-24 * time.Hour).Format(time.RFC3339)
	}
	endTime := p.EndTime
	if endTime == "" {
		endTime = time.Now().Format(time.RFC3339)
	}

	var timeCol string
	var powerCol, energyCol string
	if interval == "raw" {
		timeCol = "time"
		powerCol = "power_w"
		energyCol = "energy_kwh"
	} else {
		timeCol = "bucket"
		powerCol = "avg_power_w"
		energyCol = "energy_kwh"
	}

	var readings []Reading

	var extraCols string
	if interval == "raw" {
		extraCols = `,
			frequency,
			pf,
			thd_v,
			thd_i,
			temperature_c`
	}

	var voltageCol, currentCol string
	if interval == "raw" {
		voltageCol = "voltage_v"
		currentCol = "current_a"
	} else {
		voltageCol = "avg_voltage_v"
		currentCol = "avg_current_a"
	}

	rows, err := pgctx.Query(ctx, `
		select
			`+timeCol+`,
			coalesce(`+powerCol+`, 0),
			coalesce(`+energyCol+`, 0),
			coalesce(`+voltageCol+`, 0),
			coalesce(`+currentCol+`, 0)`+extraCols+`
		from `+table+`
		where meter_id = $1
		  and `+timeCol+` >= $2
		  and `+timeCol+` <= $3
		order by `+timeCol+` asc
	`,
		p.MeterID,
		startTime,
		endTime,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var r Reading
		dest := []any{
			&r.Time,
			&r.PowerW,
			&r.EnergyKWh,
			&r.VoltageV,
			&r.CurrentA,
		}
		var freq, pf, thdV, thdI, tempC decimal.NullDecimal
		if interval == "raw" {
			dest = append(dest, &freq, &pf, &thdV, &thdI, &tempC)
		}
		if err := rows.Scan(dest...); err != nil {
			return nil, err
		}
		if interval == "raw" {
			if freq.Valid {
				r.Frequency = &freq.Decimal
			}
			if pf.Valid {
				r.PF = &pf.Decimal
			}
			if thdV.Valid {
				r.THDV = &thdV.Decimal
			}
			if thdI.Valid {
				r.THDI = &thdI.Decimal
			}
			if tempC.Valid {
				r.TemperatureC = &tempC.Decimal
			}
		}
		readings = append(readings, r)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &QueryResult{Readings: readings}, nil
}

// Latest

type LatestParams struct {
	DeviceID string `json:"deviceId"`
}

func (p *LatestParams) Valid() error {
	v := validator.New()
	v.Must(p.DeviceID != "", "deviceId is required")
	return v.Error()
}

type LatestResult struct {
	Reading *Reading `json:"reading"`
}

func Latest(ctx context.Context, p *LatestParams) (*LatestResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var r Reading
	var freq, pf, thdV, thdI, tempC decimal.NullDecimal

	err := pgctx.QueryRow(ctx, `
		select
			m.last_seen_at,
			coalesce((m.latest_reading->>'powerW')::numeric, 0),
			coalesce((m.latest_reading->>'energyKwh')::numeric, 0),
			coalesce((m.latest_reading->>'voltageV')::numeric, 0),
			coalesce((m.latest_reading->>'currentA')::numeric, 0),
			(m.latest_reading->>'frequency')::numeric,
			(m.latest_reading->>'pf')::numeric,
			(m.latest_reading->>'thdV')::numeric,
			(m.latest_reading->>'thdI')::numeric,
			(m.latest_reading->>'temperatureC')::numeric
		from meters m
		where m.device_id = $1
		  and m.latest_reading is not null
		order by m.last_seen_at desc
		limit 1
	`, p.DeviceID).Scan(
		&r.Time,
		&r.PowerW,
		&r.EnergyKWh,
		&r.VoltageV,
		&r.CurrentA,
		&freq,
		&pf,
		&thdV,
		&thdI,
		&tempC,
	)
	if err != nil {
		return &LatestResult{Reading: nil}, nil
	}
	if freq.Valid {
		r.Frequency = &freq.Decimal
	}
	if pf.Valid {
		r.PF = &pf.Decimal
	}
	if thdV.Valid {
		r.THDV = &thdV.Decimal
	}
	if thdI.Valid {
		r.THDI = &thdI.Decimal
	}
	if tempC.Valid {
		r.TemperatureC = &tempC.Decimal
	}

	return &LatestResult{Reading: &r}, nil
}
