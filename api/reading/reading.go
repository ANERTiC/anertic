package reading

import (
	"context"
	"time"

	"github.com/acoshift/pgsql/pgctx"
	"github.com/moonrhythm/validator"
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
	Time      time.Time `json:"time"`
	PowerW    float64   `json:"powerW"`
	EnergyKWh float64   `json:"energyKwh"`
	VoltageV  float64   `json:"voltageV"`
	CurrentA  float64   `json:"currentA"`
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
		table = "readings"
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

	rows, err := pgctx.Query(ctx, `
		SELECT
			`+timeCol+`,
			COALESCE(`+powerCol+`, 0),
			COALESCE(`+energyCol+`, 0),
			COALESCE(avg_voltage_v, 0),
			COALESCE(avg_current_a, 0)
		FROM `+table+`
		WHERE meter_id = $1
		  AND `+timeCol+` >= $2
		  AND `+timeCol+` <= $3
		ORDER BY `+timeCol+` ASC
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
		if err := rows.Scan(
			&r.Time,
			&r.PowerW,
			&r.EnergyKWh,
			&r.VoltageV,
			&r.CurrentA,
		); err != nil {
			return nil, err
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
	err := pgctx.QueryRow(ctx, `
		SELECT
			rd.time,
			COALESCE(rd.power_w, 0),
			COALESCE(rd.energy_kwh, 0),
			COALESCE(rd.voltage_v, 0),
			COALESCE(rd.current_a, 0)
		FROM readings rd
		JOIN meters m ON m.id = rd.meter_id
		WHERE m.device_id = $1
		ORDER BY rd.time DESC
		LIMIT 1
	`, p.DeviceID).Scan(
		&r.Time,
		&r.PowerW,
		&r.EnergyKWh,
		&r.VoltageV,
		&r.CurrentA,
	)
	if err != nil {
		return &LatestResult{Reading: nil}, nil
	}

	return &LatestResult{Reading: &r}, nil
}
