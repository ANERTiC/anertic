package ingest

import (
	"context"

	"github.com/anertic/anertic/pkg/apikey"
)

// ValidateApiKey validates a raw API key and returns the associated site ID.
func ValidateApiKey(ctx context.Context, rawKey string) (siteID string, err error) {
	return apikey.ValidateSite(ctx, rawKey)
}
