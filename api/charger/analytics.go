package charger

import (
	"context"

	"github.com/acoshift/pgsql"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/moonrhythm/validator"
	"github.com/shopspring/decimal"
)

// Analytics

type AnalyticsParams struct {
	ChargerID string `json:"chargerId"`
	Days      int    `json:"days"`
}

func (p *AnalyticsParams) Valid() error {
	v := validator.New()
	v.Must(p.ChargerID != "", "chargerId is required")
	if p.Days <= 0 {
		p.Days = 7
	}
	return v.Error()
}

type DailyEnergy struct {
	Date        string          `json:"date"`
	EnergyKWH   decimal.Decimal `json:"energyKwh"`
	Sessions    int             `json:"sessions"`
	PeakPowerKW decimal.Decimal `json:"peakPowerKw"`
}

type HourlyPower struct {
	Hour      int             `json:"hour"`
	PowerKW   decimal.Decimal `json:"powerKw"`
	EnergyKWH decimal.Decimal `json:"energyKwh"`
}

type AnalyticsSummary struct {
	TotalKWH      decimal.Decimal `json:"totalKwh"`
	TotalSessions int             `json:"totalSessions"`
	AvgDailyKWH   decimal.Decimal `json:"avgDailyKwh"`
	AvgSessionKWH decimal.Decimal `json:"avgSessionKwh"`
	PeakPowerKW   decimal.Decimal `json:"peakPowerKw"`
}

type AnalyticsResult struct {
	Daily   []DailyEnergy    `json:"daily"`
	Hourly  []HourlyPower    `json:"hourly"`
	Summary AnalyticsSummary `json:"summary"`
}

func Analytics(ctx context.Context, p *AnalyticsParams) (*AnalyticsResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	r := &AnalyticsResult{
		Daily:  make([]DailyEnergy, 0),
		Hourly: make([]HourlyPower, 0),
	}

	// Daily aggregates.
	err := pgctx.Iter(ctx, func(scan pgsql.Scanner) error {
		var d DailyEnergy
		err := scan(
			&d.Date,
			&d.EnergyKWH,
			&d.Sessions,
			&d.PeakPowerKW,
		)
		if err != nil {
			return err
		}
		r.Daily = append(r.Daily, d)
		return nil
	}, `
		select
			to_char(date(start_time), 'YYYY-MM-DD'),
			coalesce(sum(energy_kwh), 0),
			count(*),
			coalesce(max(max_power_kw), 0)
		from ev_charging_sessions
		where charger_id = $1
		  and start_time >= now() - $2 * interval '1 day'
		group by date(start_time)
		order by date(start_time)
	`,
		p.ChargerID,
		p.Days,
	)
	if err != nil {
		return nil, err
	}

	// Hourly aggregates (today, from meter values).
	err = pgctx.Iter(ctx, func(scan pgsql.Scanner) error {
		var h HourlyPower
		err := scan(
			&h.Hour,
			&h.PowerKW,
			&h.EnergyKWH,
		)
		if err != nil {
			return err
		}
		r.Hourly = append(r.Hourly, h)
		return nil
	}, `
		select
			extract(hour from time)::int,
			coalesce(avg(value) / 1000, 0),
			coalesce(sum(value) / 1000000, 0)
		from ev_meter_values
		where charger_id = $1
		  and time >= date_trunc('day', now())
		  and measurand = 'Power.Active.Import'
		group by extract(hour from time)
		order by extract(hour from time)
	`, p.ChargerID)
	if err != nil {
		return nil, err
	}

	// Summary aggregates.
	err = pgctx.QueryRow(ctx, `
		select
			coalesce(sum(energy_kwh), 0),
			count(*),
			coalesce(max(max_power_kw), 0)
		from ev_charging_sessions
		where charger_id = $1
		  and start_time >= now() - $2 * interval '1 day'
	`,
		p.ChargerID,
		p.Days,
	).Scan(
		&r.Summary.TotalKWH,
		&r.Summary.TotalSessions,
		&r.Summary.PeakPowerKW,
	)
	if err != nil {
		return nil, err
	}

	if len(r.Daily) > 0 {
		r.Summary.AvgDailyKWH = r.Summary.TotalKWH.Div(decimal.NewFromInt(int64(len(r.Daily))))
	}
	if r.Summary.TotalSessions > 0 {
		r.Summary.AvgSessionKWH = r.Summary.TotalKWH.Div(decimal.NewFromInt(int64(r.Summary.TotalSessions)))
	}

	return r, nil
}
