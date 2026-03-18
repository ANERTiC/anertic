package site

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/pgsql"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/acoshift/pgsql/pgstmt"

	"github.com/moonrhythm/validator"
	"github.com/rs/xid"
	"github.com/shopspring/decimal"

	"github.com/anertic/anertic/api/auth"
	"github.com/anertic/anertic/api/iam"
)

var (
	ErrNotFound = arpc.NewErrorCode("site/not-found", "site not found")
)

// List

type ListParams struct {
	Search string `json:"search"`
}

type Item struct {
	ID        string         `json:"id"`
	Name      string         `json:"name"`
	Address   string         `json:"address"`
	Timezone  string         `json:"timezone"`
	Metadata  map[string]any `json:"metadata"`
	CreatedAt time.Time      `json:"createdAt"`
}

type ListResult struct {
	Items []Item `json:"items"`
}

func List(ctx context.Context, p *ListParams) (*ListResult, error) {
	items := make([]Item, 0)

	userID := auth.AccountID(ctx)

	err := pgstmt.Select(func(b pgstmt.SelectStatement) {
		b.Columns(
			"s.id",
			"s.name",
			"s.address",
			"s.timezone",
			"s.metadata",
			"s.created_at",
		)
		b.From("sites s")
		b.Join("site_members sm").On(func(c pgstmt.Cond) {
			c.EqRaw("sm.site_id", "s.id")
		})
		b.Where(func(c pgstmt.Cond) {
			c.Eq("sm.user_id", userID)
		})
		if p.Search != "" {
			b.Where(func(c pgstmt.Cond) {
				c.Mode().Or()
				c.ILike("s.name", "%"+p.Search+"%")
				c.ILike("s.address", "%"+p.Search+"%")
			})
		}
		b.OrderBy("s.created_at DESC")
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
		var it Item
		err := scan(
			&it.ID,
			&it.Name,
			&it.Address,
			&it.Timezone,
			pgsql.JSON(&it.Metadata),
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

// Create

type CreateParams struct {
	Name     string `json:"name"`
	Address  string `json:"address"`
	Timezone string `json:"timezone"`
}

func (p *CreateParams) Valid() error {
	v := validator.New()
	v.Must(p.Name != "", "name is required")
	v.Must(p.Timezone != "", "timezone is required")
	v.Must(utf8.RuneCountInString(p.Address) < 200, "address must be less than 200 characters")
	return v.Error()
}

type CreateResult struct {
	ID string `json:"id"`
}

func Create(ctx context.Context, p *CreateParams) (*CreateResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	tz := p.Timezone
	if tz == "" {
		tz = "Asia/Bangkok"
	}
	if _, err := time.LoadLocation(tz); err != nil {
		return nil, arpc.NewErrorCode("site/invalid-timezone", "invalid timezone")
	}

	userID := auth.AccountID(ctx)

	id := xid.New().String()
	_, err := pgctx.Exec(ctx, `
		insert into sites (
			id,
			name,
			address,
			timezone
		) values ($1, $2, $3, $4)
	`,
		id,
		p.Name,
		p.Address,
		tz,
	)
	if err != nil {
		return nil, err
	}

	_, err = pgctx.Exec(ctx, `
		insert into site_members (
			site_id,
			user_id,
			role
		) values ($1, $2, '*')
	`,
		id,
		userID,
	)
	if err != nil {
		return nil, err
	}

	// Create starter device + meter so new sites have sample data
	if err := createStarterDevice(ctx, id); err != nil {
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
	Currency       string          `json:"currency"`
	GridImportRate decimal.Decimal `json:"gridImportRate"`
	GridExportRate decimal.Decimal `json:"gridExportRate"`
	PeakStartHour  int             `json:"peakStartHour"`
	PeakEndHour    int             `json:"peakEndHour"`
	PeakRate       decimal.Decimal `json:"peakRate"`
	OffPeakRate    decimal.Decimal `json:"offPeakRate"`
}

func Get(ctx context.Context, p *GetParams) (*GetResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, p.ID); err != nil {
		return nil, err
	}

	var r GetResult
	err := pgctx.QueryRow(ctx, `
		select
			id,
			name,
			address,
			timezone,
			currency,
			grid_import_rate,
			grid_export_rate,
			peak_start_hour,
			peak_end_hour,
			peak_rate,
			off_peak_rate,
			metadata,
			created_at
		from sites
		where id = $1
	`, p.ID).Scan(
		&r.ID,
		&r.Name,
		&r.Address,
		&r.Timezone,
		&r.Currency,
		&r.GridImportRate,
		&r.GridExportRate,
		&r.PeakStartHour,
		&r.PeakEndHour,
		&r.PeakRate,
		&r.OffPeakRate,
		pgsql.JSON(&r.Metadata),
		&r.CreatedAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	return &r, nil
}

// Update

type UpdateParams struct {
	ID       string  `json:"id"`
	Name     *string `json:"name"`
	Address  *string `json:"address"`
	Timezone *string `json:"timezone"`
	Currency *string `json:"currency"`
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

	if err := iam.InSite(ctx, p.ID); err != nil {
		return nil, err
	}

	_, err := pgstmt.Update(func(b pgstmt.UpdateStatement) {
		b.Table("sites")
		if p.Name != nil {
			b.Set("name").To(*p.Name)
		}
		if p.Address != nil {
			b.Set("address").To(*p.Address)
		}
		if p.Timezone != nil {
			b.Set("timezone").To(*p.Timezone)
		}
		if p.Currency != nil {
			b.Set("currency").To(*p.Currency)
		}
		b.Set("updated_at").ToRaw("NOW()")
		b.Where(func(c pgstmt.Cond) {
			c.Eq("id", p.ID)
		})
	}).ExecWith(ctx)
	if err != nil {
		return nil, err
	}

	return new(struct{}), nil
}

// UpdateTariff

type UpdateTariffParams struct {
	ID             string           `json:"id"`
	GridImportRate *decimal.Decimal `json:"gridImportRate"`
	GridExportRate *decimal.Decimal `json:"gridExportRate"`
	PeakStartHour  *int             `json:"peakStartHour"`
	PeakEndHour    *int             `json:"peakEndHour"`
	PeakRate       *decimal.Decimal `json:"peakRate"`
	OffPeakRate    *decimal.Decimal `json:"offPeakRate"`
}

func (p *UpdateTariffParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	if p.PeakStartHour != nil {
		v.Must(*p.PeakStartHour >= 0 && *p.PeakStartHour <= 23, "peakStartHour must be 0-23")
	}
	if p.PeakEndHour != nil {
		v.Must(*p.PeakEndHour >= 0 && *p.PeakEndHour <= 23, "peakEndHour must be 0-23")
	}
	return v.Error()
}

func UpdateTariff(ctx context.Context, p *UpdateTariffParams) (*struct{}, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, p.ID); err != nil {
		return nil, err
	}

	_, err := pgstmt.Update(func(b pgstmt.UpdateStatement) {
		b.Table("sites")
		if p.GridImportRate != nil {
			b.Set("grid_import_rate").To(*p.GridImportRate)
		}
		if p.GridExportRate != nil {
			b.Set("grid_export_rate").To(*p.GridExportRate)
		}
		if p.PeakStartHour != nil {
			b.Set("peak_start_hour").To(*p.PeakStartHour)
		}
		if p.PeakEndHour != nil {
			b.Set("peak_end_hour").To(*p.PeakEndHour)
		}
		if p.PeakRate != nil {
			b.Set("peak_rate").To(*p.PeakRate)
		}
		if p.OffPeakRate != nil {
			b.Set("off_peak_rate").To(*p.OffPeakRate)
		}
		b.Set("updated_at").ToRaw("NOW()")
		b.Where(func(c pgstmt.Cond) {
			c.Eq("id", p.ID)
		})
	}).ExecWith(ctx)
	if err != nil {
		return nil, err
	}

	return new(struct{}), nil
}

func createStarterDevice(ctx context.Context, siteID string) error {
	// Grid meter
	gridDeviceID := xid.New().String()
	_, err := pgctx.Exec(ctx, `
		insert into devices (
			id,
			site_id,
			name,
			type,
			tag,
			brand,
			model
		) values ($1, $2, 'Grid Meter', 'meter', 'Grid import/export', 'Eastron', 'SDM630-Modbus V2')
	`,
		gridDeviceID,
		siteID,
	)
	if err != nil {
		return err
	}

	gridMeterID := xid.New().String()
	_, err = pgctx.Exec(ctx, `
		insert into meters (
			id,
			site_id,
			device_id,
			serial_number,
			protocol,
			vendor,
			channel
		) values ($1, $2, $3, $4, 'mqtt', 'Eastron', 'grid')
	`,
		gridMeterID,
		siteID,
		gridDeviceID,
		"DEMO-"+strings.ToUpper(gridMeterID),
	)
	if err != nil {
		return err
	}

	// Solar inverter
	solarDeviceID := xid.New().String()
	_, err = pgctx.Exec(ctx, `
		insert into devices (
			id,
			site_id,
			name,
			type,
			tag,
			brand,
			model
		) values ($1, $2, 'Solar Inverter', 'inverter', 'Rooftop PV system', 'Huawei', 'SUN2000-10KTL-M1')
	`,
		solarDeviceID,
		siteID,
	)
	if err != nil {
		return err
	}

	solarMeterID := xid.New().String()
	_, err = pgctx.Exec(ctx, `
		insert into meters (
			id,
			site_id,
			device_id,
			serial_number,
			protocol,
			vendor,
			channel
		) values ($1, $2, $3, $4, 'mqtt', 'Huawei', 'pv')
	`,
		solarMeterID,
		siteID,
		solarDeviceID,
		"DEMO-"+strings.ToUpper(solarMeterID),
	)
	if err != nil {
		return err
	}

	// Floor 0 sub-distribution board
	floorDeviceID := xid.New().String()
	_, err = pgctx.Exec(ctx, `
		insert into devices (
			id,
			site_id,
			name,
			type,
			tag,
			brand,
			model
		) values ($1, $2, 'Floor 0 SDB', 'meter', 'Sub-distribution board ground floor', 'Eastron', 'SDM120-Modbus')
	`,
		floorDeviceID,
		siteID,
	)
	if err != nil {
		return err
	}

	floorMeterID := xid.New().String()
	_, err = pgctx.Exec(ctx, `
		insert into meters (
			id,
			site_id,
			device_id,
			serial_number,
			protocol,
			vendor,
			channel
		) values ($1, $2, $3, $4, 'mqtt', 'Eastron', 'load')
	`,
		floorMeterID,
		siteID,
		floorDeviceID,
		"DEMO-"+strings.ToUpper(floorMeterID),
	)
	if err != nil {
		return err
	}

	// Battery storage
	batteryDeviceID := xid.New().String()
	_, err = pgctx.Exec(ctx, `
		insert into devices (
			id,
			site_id,
			name,
			type,
			tag,
			brand,
			model
		) values ($1, $2, 'Battery Storage', 'appliance', 'Home battery system', 'Tesla', 'Powerwall 3')
	`,
		batteryDeviceID,
		siteID,
	)
	if err != nil {
		return err
	}

	batteryMeterID := xid.New().String()
	_, err = pgctx.Exec(ctx, `
		insert into meters (
			id,
			site_id,
			device_id,
			serial_number,
			protocol,
			vendor,
			channel
		) values ($1, $2, $3, $4, 'mqtt', 'Tesla', 'battery')
	`,
		batteryMeterID,
		siteID,
		batteryDeviceID,
		"DEMO-"+strings.ToUpper(batteryMeterID),
	)
	return err
}
