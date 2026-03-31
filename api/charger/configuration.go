package charger

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/acoshift/pgsql"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/acoshift/pgsql/pgstmt"
	"github.com/moonrhythm/validator"
	"github.com/rs/xid"

	"github.com/anertic/anertic/api/iam"
	"github.com/anertic/anertic/pkg/ocpp"
)

// ListConfigurations

type ListConfigurationsParams struct {
	ID string `json:"id"`
}

func (p *ListConfigurationsParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

type ConfigurationItem struct {
	Key       string     `json:"key"`
	Value     *string    `json:"value"`
	Readonly  bool       `json:"readonly"`
	UpdatedAt *time.Time `json:"updatedAt"`
}

type ListConfigurationsResult struct {
	Items []ConfigurationItem `json:"items"`
}

func ListConfigurations(ctx context.Context, p *ListConfigurationsParams) (*ListConfigurationsResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var siteID string
	err := pgctx.QueryRow(ctx, `
		select site_id
		from ev_chargers
		where id = $1
	`,
		p.ID,
	).Scan(
		&siteID,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, siteID); err != nil {
		return nil, err
	}

	r := &ListConfigurationsResult{
		Items: make([]ConfigurationItem, 0),
	}

	err = pgstmt.Select(func(b pgstmt.SelectStatement) {
		b.Columns(
			"key",
			"value",
			"readonly",
			"updated_at",
		)
		b.From("ev_configurations")
		b.Where(func(c pgstmt.Cond) {
			c.Eq("charger_id", p.ID)
		})
		b.OrderBy("key")
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
		var item ConfigurationItem
		err := scan(
			&item.Key,
			pgsql.Null(&item.Value),
			&item.Readonly,
			&item.UpdatedAt,
		)
		if err != nil {
			return err
		}
		r.Items = append(r.Items, item)
		return nil
	})
	if err != nil {
		return nil, err
	}

	return r, nil
}

// GetConfiguration — sends GetConfiguration OCPP command to charger

type GetConfigurationParams struct {
	ID string `json:"id"`
}

func (p *GetConfigurationParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

type GetConfigurationResult struct{}

func GetConfiguration(ctx context.Context, p *GetConfigurationParams) (*GetConfigurationResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var chargePointID, siteID string
	err := pgctx.QueryRow(ctx, `
		select
			charge_point_id,
			site_id
		from ev_chargers
		where id = $1
	`,
		p.ID,
	).Scan(
		&chargePointID,
		&siteID,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, siteID); err != nil {
		return nil, err
	}

	// send empty payload = get all keys
	payload, err := json.Marshal(struct{}{})
	if err != nil {
		return nil, err
	}

	if err := ocpp.SendCommand(ctx, chargePointID, "GetConfiguration", payload); err != nil {
		return nil, err
	}

	return &GetConfigurationResult{}, nil
}

// ChangeConfiguration

type ChangeConfigurationParams struct {
	ID    string `json:"id"`
	Key   string `json:"key"`
	Value string `json:"value"`
}

func (p *ChangeConfigurationParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	v.Must(p.Key != "", "key is required")
	v.Must(p.Value != "", "value is required")
	return v.Error()
}

type ChangeConfigurationResult struct{}

func ChangeConfiguration(ctx context.Context, p *ChangeConfigurationParams) (*ChangeConfigurationResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var chargePointID, siteID string
	err := pgctx.QueryRow(ctx, `
		select
			charge_point_id,
			site_id
		from ev_chargers
		where id = $1
	`,
		p.ID,
	).Scan(
		&chargePointID,
		&siteID,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, siteID); err != nil {
		return nil, err
	}

	payload, err := json.Marshal(struct {
		Key   string `json:"key"`
		Value string `json:"value"`
	}{
		Key:   p.Key,
		Value: p.Value,
	})
	if err != nil {
		return nil, err
	}

	_, err = pgctx.Exec(ctx, `
		update ev_chargers
		set change_configuration_status = 0,
		    updated_at = now()
		where id = $1
	`, p.ID)
	if err != nil {
		return nil, err
	}

	// optimistically upsert the config value
	_, err = pgctx.Exec(ctx, `
		insert into ev_configurations (id, charger_id, key, value, updated_at)
		values ($1, $2, $3, $4, now())
		on conflict (charger_id, key)
		do update set value = excluded.value, updated_at = now()
	`,
		xid.New().String(),
		p.ID,
		p.Key,
		p.Value,
	)
	if err != nil {
		return nil, err
	}

	if err := ocpp.SendCommand(ctx, chargePointID, "ChangeConfiguration", payload); err != nil {
		return nil, err
	}

	return &ChangeConfigurationResult{}, nil
}
