package insight

import (
	"context"
	"time"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/pgsql"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/acoshift/pgsql/pgstmt"
	"github.com/moonrhythm/validator"

	"github.com/anertic/anertic/api/iam"
)

var (
	ErrNotFound = arpc.NewErrorCode("insight/not-found", "insight not found")
)

// Summary

type SummaryParams struct {
	SiteID string `json:"siteId"`
}

func (p *SummaryParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	return v.Error()
}

type SummaryResult struct {
	AIConfidence       int     `json:"aiConfidence"`
	DailySummary       string  `json:"dailySummary"`
	TotalSavingsMonth  float64 `json:"totalSavingsThisMonth"`
	SavingsTarget      float64 `json:"savingsTarget"`
	CO2AvoidedKg       float64 `json:"co2AvoidedKg"`
	SelfSufficiencyAvg float64 `json:"selfSufficiencyAvg"`
	InsightCount       int     `json:"insightCount"`
	NewCount           int     `json:"newCount"`
}

func Summary(ctx context.Context, p *SummaryParams) (*SummaryResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	var r SummaryResult

	pgctx.QueryRow(ctx, `
		select coalesce(avg(confidence), 0)::int
		from insights
		where site_id = $1
		  and created_at >= now() - interval '7 days'
	`, p.SiteID).Scan(&r.AIConfidence)

	pgctx.QueryRow(ctx, `
		select summary
		from insights
		where site_id = $1
		  and type = 'achievement'
		order by created_at desc
		limit 1
	`, p.SiteID).Scan(&r.DailySummary)

	pgctx.QueryRow(ctx, `
		select savings_target_kwh
		from sites
		where id = $1
	`, p.SiteID).Scan(&r.SavingsTarget)

	pgctx.QueryRow(ctx, `
		select
			coalesce(sum(self_use_kwh), 0),
			coalesce(sum(co2_avoided_kg), 0)
		from site_energy_daily
		where site_id = $1
		  and date >= date_trunc('month', now())
	`, p.SiteID).Scan(
		&r.TotalSavingsMonth,
		&r.CO2AvoidedKg,
	)

	pgctx.QueryRow(ctx, `
		select coalesce(avg(
			case when consumption_kwh > 0
				then self_use_kwh / consumption_kwh * 100
				else 0
			end
		), 0)
		from site_energy_daily
		where site_id = $1
		  and date >= now() - interval '30 days'
	`, p.SiteID).Scan(&r.SelfSufficiencyAvg)

	pgctx.QueryRow(ctx, `
		select
			count(*),
			count(*) filter (where status = 'new')
		from insights
		where site_id = $1
	`, p.SiteID).Scan(
		&r.InsightCount,
		&r.NewCount,
	)

	return &r, nil
}

// List

type ListParams struct {
	SiteID   string `json:"siteId"`
	Type     string `json:"type"`
	Category string `json:"category"`
	Status   string `json:"status"`
}

func (p *ListParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	return v.Error()
}

type Item struct {
	ID          string    `json:"id"`
	Type        string    `json:"type"`
	Category    string    `json:"category"`
	Status      string    `json:"status"`
	Title       string    `json:"title"`
	Summary     string    `json:"summary"`
	Detail      string    `json:"detail"`
	Impact      string    `json:"impact"`
	ImpactValue float64   `json:"impactValue"`
	ImpactUnit  string    `json:"impactUnit"`
	Action      string    `json:"action"`
	Confidence  int       `json:"confidence"`
	CreatedAt   time.Time `json:"createdAt"`
}

type ListResult struct {
	Items []Item `json:"items"`
}

func List(ctx context.Context, p *ListParams) (*ListResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	var items []Item

	err := pgstmt.Select(func(b pgstmt.SelectStatement) {
		b.Columns(
			"id",
			"type",
			"category",
			"status",
			"title",
			"summary",
			"detail",
			"impact",
			"impact_value",
			"impact_unit",
			"action",
			"confidence",
			"created_at",
		)
		b.From("insights")
		b.Where(func(c pgstmt.Cond) {
			c.Mode().And()
			c.Eq("site_id", p.SiteID)
			if p.Type != "" {
				c.Eq("type", p.Type)
			}
			if p.Category != "" {
				c.Eq("category", p.Category)
			}
			if p.Status != "" {
				c.Eq("status", p.Status)
			}
		})
		b.OrderBy("created_at desc")
		b.Limit(50)
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
		var it Item
		err := scan(
			&it.ID,
			&it.Type,
			&it.Category,
			&it.Status,
			&it.Title,
			&it.Summary,
			&it.Detail,
			&it.Impact,
			&it.ImpactValue,
			&it.ImpactUnit,
			&it.Action,
			&it.Confidence,
			&it.CreatedAt,
		)
		if err != nil {
			return err
		}
		items = append(items, it)
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &ListResult{Items: items}, nil
}

// Get

type GetParams struct {
	ID string `json:"id"`
}

func (p *GetParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

type GetResult struct {
	Item
}

func Get(ctx context.Context, p *GetParams) (*GetResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var r GetResult
	err := pgctx.QueryRow(ctx, `
		select
			id,
			type,
			category,
			status,
			title,
			summary,
			detail,
			impact,
			impact_value,
			impact_unit,
			action,
			confidence,
			created_at
		from insights
		where id = $1
	`, p.ID).Scan(
		&r.ID,
		&r.Type,
		&r.Category,
		&r.Status,
		&r.Title,
		&r.Summary,
		&r.Detail,
		&r.Impact,
		&r.ImpactValue,
		&r.ImpactUnit,
		&r.Action,
		&r.Confidence,
		&r.CreatedAt,
	)
	if err != nil {
		return nil, ErrNotFound
	}

	return &r, nil
}

// UpdateStatus

type UpdateStatusParams struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

func (p *UpdateStatusParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	v.Must(p.Status == "acknowledged" || p.Status == "resolved" || p.Status == "dismissed", "status must be acknowledged, resolved, or dismissed")
	return v.Error()
}

type UpdateStatusResult struct{}

func UpdateStatus(ctx context.Context, p *UpdateStatusParams) (*UpdateStatusResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	res, err := pgctx.Exec(ctx, `
		update insights
		set status = $2
		where id = $1
	`, p.ID, p.Status)
	if err != nil {
		return nil, err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return nil, ErrNotFound
	}

	return &UpdateStatusResult{}, nil
}

// SavingsHistory

type SavingsHistoryParams struct {
	SiteID string `json:"siteId"`
	Days   int    `json:"days"`
}

func (p *SavingsHistoryParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	if p.Days <= 0 {
		p.Days = 14
	}
	return v.Error()
}

type SavingsHistoryItem struct {
	Date    string  `json:"date"`
	Actual  float64 `json:"actual"`
	Optimal float64 `json:"optimal"`
	Grid    float64 `json:"grid"`
}

type SavingsHistoryResult struct {
	Items []SavingsHistoryItem `json:"items"`
}

func SavingsHistory(ctx context.Context, p *SavingsHistoryParams) (*SavingsHistoryResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	var items []SavingsHistoryItem

	rows, err := pgctx.Query(ctx, `
		select
			to_char(date, 'Mon DD'),
			self_use_kwh,
			optimal_kwh,
			grid_import_kwh
		from site_energy_daily
		where site_id = $1
		  and date >= now()::date - $2::int
		order by date
	`, p.SiteID, p.Days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var it SavingsHistoryItem
		err := rows.Scan(
			&it.Date,
			&it.Actual,
			&it.Optimal,
			&it.Grid,
		)
		if err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &SavingsHistoryResult{Items: items}, nil
}

// WeeklyPattern

type WeeklyPatternParams struct {
	SiteID string `json:"siteId"`
}

func (p *WeeklyPatternParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	return v.Error()
}

type WeeklyPatternItem struct {
	Hour int     `json:"hour"`
	Mon  float64 `json:"mon"`
	Tue  float64 `json:"tue"`
	Wed  float64 `json:"wed"`
	Thu  float64 `json:"thu"`
	Fri  float64 `json:"fri"`
	Sat  float64 `json:"sat"`
	Sun  float64 `json:"sun"`
}

type WeeklyPatternResult struct {
	Items []WeeklyPatternItem `json:"items"`
}

func WeeklyPattern(ctx context.Context, p *WeeklyPatternParams) (*WeeklyPatternResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	var items []WeeklyPatternItem

	rows, err := pgctx.Query(ctx, `
		select
			extract(hour from r.time)::int as hour,
			coalesce(sum(case when extract(dow from r.time) = 1 then r.energy_kwh else 0 end), 0),
			coalesce(sum(case when extract(dow from r.time) = 2 then r.energy_kwh else 0 end), 0),
			coalesce(sum(case when extract(dow from r.time) = 3 then r.energy_kwh else 0 end), 0),
			coalesce(sum(case when extract(dow from r.time) = 4 then r.energy_kwh else 0 end), 0),
			coalesce(sum(case when extract(dow from r.time) = 5 then r.energy_kwh else 0 end), 0),
			coalesce(sum(case when extract(dow from r.time) = 6 then r.energy_kwh else 0 end), 0),
			coalesce(sum(case when extract(dow from r.time) = 0 then r.energy_kwh else 0 end), 0)
		from readings r
		join meters m on m.id = r.meter_id
		join devices d on d.id = m.device_id
		where d.site_id = $1
		  and r.time >= now() - interval '7 days'
		group by extract(hour from r.time)
		order by hour
	`, p.SiteID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var it WeeklyPatternItem
		err := rows.Scan(
			&it.Hour,
			&it.Mon,
			&it.Tue,
			&it.Wed,
			&it.Thu,
			&it.Fri,
			&it.Sat,
			&it.Sun,
		)
		if err != nil {
			return nil, err
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &WeeklyPatternResult{Items: items}, nil
}

// Anomalies

type AnomaliesParams struct {
	SiteID   string `json:"siteId"`
	Severity string `json:"severity"`
}

func (p *AnomaliesParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	return v.Error()
}

type AnomalyItem struct {
	ID          string    `json:"id"`
	Metric      string    `json:"metric"`
	Expected    float64   `json:"expected"`
	Actual      float64   `json:"actual"`
	Deviation   float64   `json:"deviation"`
	Severity    string    `json:"severity"`
	Description string    `json:"description"`
	CreatedAt   time.Time `json:"createdAt"`
}

type AnomaliesResult struct {
	Items []AnomalyItem `json:"items"`
}

func Anomalies(ctx context.Context, p *AnomaliesParams) (*AnomaliesResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	var items []AnomalyItem

	err := pgstmt.Select(func(b pgstmt.SelectStatement) {
		b.Columns(
			"id",
			"metric",
			"expected",
			"actual",
			"deviation",
			"severity",
			"description",
			"created_at",
		)
		b.From("anomalies")
		b.Where(func(c pgstmt.Cond) {
			c.Mode().And()
			c.Eq("site_id", p.SiteID)
			if p.Severity != "" {
				c.Eq("severity", p.Severity)
			}
		})
		b.OrderBy("created_at desc")
		b.Limit(50)
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
		var it AnomalyItem
		err := scan(
			&it.ID,
			&it.Metric,
			&it.Expected,
			&it.Actual,
			&it.Deviation,
			&it.Severity,
			&it.Description,
			&it.CreatedAt,
		)
		if err != nil {
			return err
		}
		items = append(items, it)
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &AnomaliesResult{Items: items}, nil
}
