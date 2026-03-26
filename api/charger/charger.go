package charger

import (
	"context"
	"fmt"
	"time"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/pgsql"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/acoshift/pgsql/pgstmt"
	"github.com/lib/pq"
	"github.com/moonrhythm/validator"
	"github.com/rs/xid"
	"github.com/shopspring/decimal"

	"github.com/anertic/anertic/api/iam"
)

var (
	ErrNotFound = arpc.NewErrorCode("charger/not-found", "charger not found")
)

// ConnectorItem represents a single connector with live metrics.
type ConnectorItem struct {
	ID               int             `json:"id"`
	Status           string          `json:"status"`
	ErrorCode        string          `json:"errorCode"`
	ConnectorType    string          `json:"connectorType"`
	MaxPowerKW       decimal.Decimal `json:"maxPowerKw"`
	PowerKW          decimal.Decimal `json:"powerKw"`
	LastStatusAt     *time.Time      `json:"lastStatusAt"`
	VehicleID        *string         `json:"vehicleId"`
	SessionStartedAt *time.Time      `json:"sessionStartedAt"`
	SessionKWH       decimal.Decimal `json:"sessionKwh"`
}

// List

type ListParams struct {
	SiteID string `json:"siteId"`
}

func (p *ListParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	return v.Error()
}

type Item struct {
	ID                 string          `json:"id"`
	SiteID             string          `json:"siteId"`
	ChargePointID      string          `json:"chargePointId"`
	OcppVersion        string          `json:"ocppVersion"`
	Status             string          `json:"status"`
	RegistrationStatus string          `json:"registrationStatus"`
	ConnectorCount     decimal.Decimal `json:"connectorCount"`
	MaxPowerKW         decimal.Decimal `json:"maxPowerKw"`
	Vendor             string          `json:"vendor"`
	Model              string          `json:"model"`
	SerialNumber       string          `json:"serialNumber"`
	FirmwareVersion    string          `json:"firmwareVersion"`
	LastHeartbeatAt    *time.Time      `json:"lastHeartbeatAt"`
	CreatedAt          time.Time       `json:"createdAt"`
	Connectors         []ConnectorItem `json:"connectors"`
	TodayEnergyKwh     decimal.Decimal `json:"todayEnergyKwh"`
	TodaySessions      int             `json:"todaySessions"`
	CurrentPowerKw     decimal.Decimal `json:"currentPowerKw"`
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

	items := make([]Item, 0)

	err := pgstmt.Select(func(b pgstmt.SelectStatement) {
		b.Columns(
			"id",
			"site_id",
			"charge_point_id",
			"ocpp_version",
			"status",
			"registration_status",
			"connector_count",
			"max_power_kw",
			"vendor",
			"model",
			"serial_number",
			"firmware_version",
			"last_heartbeat_at",
			"created_at",
		)
		b.From("ev_chargers")
		b.Where(func(c pgstmt.Cond) {
			c.Eq("site_id", p.SiteID)
		})
		b.OrderBy("created_at DESC")
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
		var it Item
		err := scan(
			&it.ID,
			&it.SiteID,
			&it.ChargePointID,
			&it.OcppVersion,
			&it.Status,
			&it.RegistrationStatus,
			&it.ConnectorCount,
			&it.MaxPowerKW,
			&it.Vendor,
			&it.Model,
			&it.SerialNumber,
			&it.FirmwareVersion,
			pgsql.Null(&it.LastHeartbeatAt),
			&it.CreatedAt,
		)
		if err != nil {
			return err
		}
		it.Connectors = make([]ConnectorItem, 0)
		items = append(items, it)
		return nil
	})
	if err != nil {
		return nil, err
	}

	if len(items) == 0 {
		return &ListResult{Items: items}, nil
	}

	// Build index for fast lookup.
	chargerIndex := make(map[string]int, len(items))
	chargerIDs := make([]string, len(items))
	for i, it := range items {
		chargerIndex[it.ID] = i
		chargerIDs[i] = it.ID
	}

	// 1. Fetch all connectors for the batch of charger IDs.
	connectors, err := fetchConnectors(ctx, chargerIDs)
	if err != nil {
		return nil, err
	}

	// 2. Fetch current power per connector from latest meter values.
	connectorPower, err := fetchConnectorPower(ctx, chargerIDs)
	if err != nil {
		return nil, err
	}

	// 3. Fetch active sessions (end_time IS NULL) per connector.
	activeSessions, err := fetchActiveSessions(ctx, chargerIDs)
	if err != nil {
		return nil, err
	}

	// 4. Fetch today's session stats per charger.
	todayStats, err := fetchTodayStats(ctx, chargerIDs)
	if err != nil {
		return nil, err
	}

	// Merge connectors into items.
	for _, c := range connectors {
		idx, ok := chargerIndex[c.chargerID]
		if !ok {
			continue
		}
		ci := ConnectorItem{
			ID:            c.connectorID,
			Status:        c.status,
			ErrorCode:     c.errorCode,
			ConnectorType: c.connectorType,
			MaxPowerKW:    c.maxPowerKW,
			LastStatusAt:  c.lastStatusAt,
		}
		key := connectorKey(c.chargerID, c.connectorID)
		if pw, ok := connectorPower[key]; ok {
			ci.PowerKW = pw
		}
		if sess, ok := activeSessions[key]; ok {
			ci.VehicleID = sess.vehicleID
			ci.SessionStartedAt = &sess.startTime
			ci.SessionKWH = sess.energyKwh
		}
		items[idx].Connectors = append(items[idx].Connectors, ci)
		items[idx].CurrentPowerKw = items[idx].CurrentPowerKw.Add(ci.PowerKW)
	}

	// Merge today stats into items.
	for chargerID, stats := range todayStats {
		idx, ok := chargerIndex[chargerID]
		if !ok {
			continue
		}
		items[idx].TodayEnergyKwh = stats.energyKwh
		items[idx].TodaySessions = stats.sessions
	}

	return &ListResult{Items: items}, nil
}

// Create

type CreateParams struct {
	SiteID         string          `json:"siteId"`
	ChargePointID  string          `json:"chargePointId"`
	OcppVersion    string          `json:"ocppVersion"`
	ConnectorCount decimal.Decimal `json:"connectorCount"`
	MaxPowerKW     decimal.Decimal `json:"maxPowerKw"`
}

func (p *CreateParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	v.Must(p.ChargePointID != "", "chargePointId is required")
	if p.OcppVersion == "" {
		p.OcppVersion = "1.6"
	}
	v.Must(p.OcppVersion == "1.6" || p.OcppVersion == "2.0.1", "ocpp version must be 1.6 or 2.0.1")
	if p.ConnectorCount.LessThanOrEqual(decimal.Zero) {
		p.ConnectorCount = decimal.NewFromInt(1)
	}
	if p.MaxPowerKW.LessThanOrEqual(decimal.Zero) {
		p.MaxPowerKW = decimal.NewFromInt(22)
	}
	return v.Error()
}

type CreateResult struct {
	ID string `json:"id"`
}

func Create(ctx context.Context, p *CreateParams) (*CreateResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	id := xid.New().String()
	_, err := pgctx.Exec(ctx, `
		insert into ev_chargers (
			id,
			site_id,
			charge_point_id,
			ocpp_version,
			connector_count,
			max_power_kw
		) values ($1, $2, $3, $4, $5, $6)
	`,
		id,
		p.SiteID,
		p.ChargePointID,
		p.OcppVersion,
		p.ConnectorCount,
		p.MaxPowerKW,
	)
	if err != nil {
		return nil, err
	}

	return &CreateResult{ID: id}, nil
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
	ChargeBoxSerialNumber string          `json:"chargeBoxSerialNumber"`
	FirmwareStatus        string          `json:"firmwareStatus"`
	DiagnosticsStatus     string          `json:"diagnosticsStatus"`
	HeartbeatInterval     int             `json:"heartbeatInterval"`
	TotalEnergyKwh        decimal.Decimal `json:"totalEnergyKwh"`
	TotalSessions         int             `json:"totalSessions"`
	UptimePercent         decimal.Decimal `json:"uptimePercent"`
}

func Get(ctx context.Context, p *GetParams) (*GetResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var r GetResult
	err := pgctx.QueryRow(ctx, `
		select
			id,
			site_id,
			charge_point_id,
			ocpp_version,
			status,
			registration_status,
			connector_count,
			max_power_kw,
			vendor,
			model,
			serial_number,
			firmware_version,
			last_heartbeat_at,
			created_at,
			charge_box_serial_number,
			firmware_status,
			diagnostics_status,
			heartbeat_interval
		from ev_chargers
		where id = $1
	`, p.ID).Scan(
		&r.ID,
		&r.SiteID,
		&r.ChargePointID,
		&r.OcppVersion,
		&r.Status,
		&r.RegistrationStatus,
		&r.ConnectorCount,
		&r.MaxPowerKW,
		&r.Vendor,
		&r.Model,
		&r.SerialNumber,
		&r.FirmwareVersion,
		pgsql.Null(&r.LastHeartbeatAt),
		&r.CreatedAt,
		&r.ChargeBoxSerialNumber,
		&r.FirmwareStatus,
		&r.DiagnosticsStatus,
		&r.HeartbeatInterval,
	)
	if err != nil {
		return nil, ErrNotFound
	}

	r.Connectors = make([]ConnectorItem, 0)

	chargerIDs := []string{r.ID}

	// Fetch connectors.
	connectors, err := fetchConnectors(ctx, chargerIDs)
	if err != nil {
		return nil, err
	}

	// Fetch current power per connector.
	connectorPower, err := fetchConnectorPower(ctx, chargerIDs)
	if err != nil {
		return nil, err
	}

	// Fetch active sessions.
	activeSessions, err := fetchActiveSessions(ctx, chargerIDs)
	if err != nil {
		return nil, err
	}

	// Merge connectors.
	for _, c := range connectors {
		ci := ConnectorItem{
			ID:            c.connectorID,
			Status:        c.status,
			ErrorCode:     c.errorCode,
			ConnectorType: c.connectorType,
			MaxPowerKW:    c.maxPowerKW,
			LastStatusAt:  c.lastStatusAt,
		}
		key := connectorKey(r.ID, c.connectorID)
		if pw, ok := connectorPower[key]; ok {
			ci.PowerKW = pw
		}
		if sess, ok := activeSessions[key]; ok {
			ci.VehicleID = sess.vehicleID
			ci.SessionStartedAt = &sess.startTime
			ci.SessionKWH = sess.energyKwh
		}
		r.Connectors = append(r.Connectors, ci)
		r.CurrentPowerKw = r.CurrentPowerKw.Add(ci.PowerKW)
	}

	// Fetch today stats.
	todayStats, err := fetchTodayStats(ctx, chargerIDs)
	if err != nil {
		return nil, err
	}
	if stats, ok := todayStats[r.ID]; ok {
		r.TodayEnergyKwh = stats.energyKwh
		r.TodaySessions = stats.sessions
	}

	// Fetch all-time aggregate.
	err = pgctx.QueryRow(ctx, `
		select
			coalesce(sum(energy_kwh), 0),
			count(*)
		from ev_charging_sessions
		where charger_id = $1
	`, r.ID).Scan(
		&r.TotalEnergyKwh,
		&r.TotalSessions,
	)
	if err != nil {
		return nil, err
	}

	return &r, nil
}

// Update

type UpdateParams struct {
	ID             string           `json:"id"`
	ConnectorCount *decimal.Decimal `json:"connectorCount"`
	MaxPowerKW     *decimal.Decimal `json:"maxPowerKw"`
}

func (p *UpdateParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

func Update(ctx context.Context, p *UpdateParams) (*struct{}, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	_, err := pgstmt.Update(func(b pgstmt.UpdateStatement) {
		b.Table("ev_chargers")
		if p.ConnectorCount != nil {
			b.Set("connector_count").To(*p.ConnectorCount)
		}
		if p.MaxPowerKW != nil {
			b.Set("max_power_kw").To(*p.MaxPowerKW)
		}
		b.Set("updated_at").ToRaw("now()")
		b.Where(func(c pgstmt.Cond) {
			c.Eq("id", p.ID)
		})
	}).ExecWith(ctx)
	if err != nil {
		return nil, err
	}

	return new(struct{}), nil
}

// Delete

type DeleteParams struct {
	ID string `json:"id"`
}

func (p *DeleteParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

func Delete(ctx context.Context, p *DeleteParams) (*struct{}, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	_, err := pgctx.Exec(ctx, `
		delete from ev_chargers
		where id = $1
	`, p.ID)
	if err != nil {
		return nil, err
	}

	return new(struct{}), nil
}

// --- batch query helpers ---

type connectorRow struct {
	chargerID     string
	connectorID   int
	status        string
	errorCode     string
	connectorType string
	maxPowerKW    decimal.Decimal
	lastStatusAt  *time.Time
}

type activeSessionRow struct {
	vehicleID *string
	startTime time.Time
	energyKwh decimal.Decimal
}

type todayStatRow struct {
	energyKwh decimal.Decimal
	sessions  int
}

func connectorKey(chargerID string, connectorID int) string {
	return fmt.Sprintf("%s:%d", chargerID, connectorID)
}

func fetchConnectors(ctx context.Context, chargerIDs []string) ([]connectorRow, error) {
	if len(chargerIDs) == 0 {
		return nil, nil
	}
	var result []connectorRow
	err := pgctx.Iter(ctx, func(scan pgsql.Scanner) error {
		var r connectorRow
		err := scan(
			&r.chargerID,
			&r.connectorID,
			&r.status,
			&r.errorCode,
			&r.connectorType,
			&r.maxPowerKW,
			pgsql.Null(&r.lastStatusAt),
		)
		if err != nil {
			return err
		}
		result = append(result, r)
		return nil
	}, `
		select
			charger_id,
			connector_id,
			status,
			error_code,
			connector_type,
			max_power_kw,
			last_status_at
		from ev_connectors
		where charger_id = any($1)
		order by charger_id, connector_id asc
	`,
		pq.Array(chargerIDs),
	)
	if err != nil {
		return nil, err
	}
	return result, nil
}

func fetchConnectorPower(ctx context.Context, chargerIDs []string) (map[string]decimal.Decimal, error) {
	if len(chargerIDs) == 0 {
		return nil, nil
	}
	result := make(map[string]decimal.Decimal)
	err := pgctx.Iter(ctx, func(scan pgsql.Scanner) error {
		var chargerID string
		var connectorID int
		var val decimal.Decimal
		if err := scan(
			&chargerID,
			&connectorID,
			&val,
		); err != nil {
			return err
		}
		// Convert W to kW.
		result[connectorKey(chargerID, connectorID)] = val.Div(decimal.NewFromInt(1000))
		return nil
	}, `
		select
			charger_id,
			connector_id,
			value
		from (
			select distinct on (charger_id, connector_id)
				charger_id,
				connector_id,
				value
			from ev_meter_values
			where measurand = 'Power.Active.Import'
			  and charger_id = any($1)
			order by charger_id, connector_id, time desc
		) latest_power
	`,
		pq.Array(chargerIDs),
	)
	if err != nil {
		return nil, err
	}
	return result, nil
}

func fetchActiveSessions(ctx context.Context, chargerIDs []string) (map[string]activeSessionRow, error) {
	if len(chargerIDs) == 0 {
		return nil, nil
	}
	result := make(map[string]activeSessionRow)
	err := pgctx.Iter(ctx, func(scan pgsql.Scanner) error {
		var chargerID string
		var connectorID int
		var idTag string
		var startTime time.Time
		var energyKwh decimal.Decimal
		if err := scan(
			&chargerID,
			&connectorID,
			&idTag,
			&startTime,
			&energyKwh,
		); err != nil {
			return err
		}
		row := activeSessionRow{
			startTime: startTime,
			energyKwh: energyKwh,
		}
		if idTag != "" {
			row.vehicleID = &idTag
		}
		result[connectorKey(chargerID, connectorID)] = row
		return nil
	}, `
		select
			charger_id,
			connector_id,
			id_tag,
			start_time,
			energy_kwh
		from ev_charging_sessions
		where charger_id = any($1)
		  and end_time is null
	`,
		pq.Array(chargerIDs),
	)
	if err != nil {
		return nil, err
	}
	return result, nil
}

func fetchTodayStats(ctx context.Context, chargerIDs []string) (map[string]todayStatRow, error) {
	if len(chargerIDs) == 0 {
		return nil, nil
	}
	result := make(map[string]todayStatRow)
	err := pgctx.Iter(ctx, func(scan pgsql.Scanner) error {
		var chargerID string
		var energyKwh decimal.Decimal
		var sessions int
		if err := scan(
			&chargerID,
			&energyKwh,
			&sessions,
		); err != nil {
			return err
		}
		result[chargerID] = todayStatRow{energyKwh: energyKwh, sessions: sessions}
		return nil
	}, `
		select
			charger_id,
			coalesce(sum(energy_kwh), 0),
			count(*)
		from ev_charging_sessions
		where charger_id = any($1)
		  and start_time >= date_trunc('day', now() at time zone 'UTC')
		group by charger_id
	`,
		pq.Array(chargerIDs),
	)
	if err != nil {
		return nil, err
	}
	return result, nil
}
