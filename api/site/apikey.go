package site

import (
	"context"
	"time"

	"github.com/acoshift/pgsql"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/moonrhythm/validator"

	"github.com/anertic/anertic/api/iam"
	"github.com/anertic/anertic/pkg/apikey"
)

// GetApiKey

type GetApiKeyParams struct {
	SiteID string `json:"siteId"`
}

func (p *GetApiKeyParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	return v.Error()
}

type GetApiKeyResult struct {
	HasKey    bool       `json:"hasKey"`
	CreatedAt *time.Time `json:"createdAt"`
}

func GetApiKey(ctx context.Context, p *GetApiKeyParams) (*GetApiKeyResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	var key string
	var createdAt *time.Time
	err := pgctx.QueryRow(ctx, `
		select
			api_key,
			api_key_created_at
		from sites
		where id = $1
	`, p.SiteID).Scan(
		&key,
		pgsql.Null(&createdAt),
	)
	if err != nil {
		return nil, err
	}

	return &GetApiKeyResult{
		HasKey:    key != "",
		CreatedAt: createdAt,
	}, nil
}

// RegenerateApiKey

type RegenerateApiKeyParams struct {
	SiteID string `json:"siteId"`
}

func (p *RegenerateApiKeyParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	return v.Error()
}

type RegenerateApiKeyResult struct {
	ApiKey string `json:"apiKey"`
}

func RegenerateApiKey(ctx context.Context, p *RegenerateApiKeyParams) (*RegenerateApiKeyResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, p.SiteID); err != nil {
		return nil, err
	}

	rawKey := apikey.Generate()
	hashed := apikey.Hash(rawKey)

	_, err := pgctx.Exec(ctx, `
		update sites
		set
			api_key = $2,
			api_key_created_at = now(),
			updated_at = now()
		where id = $1
	`, p.SiteID, hashed)
	if err != nil {
		return nil, err
	}

	return &RegenerateApiKeyResult{ApiKey: rawKey}, nil
}
