package apikey

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"errors"
	"io"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/pgsql/pgctx"
)

const (
	salt   = "@anertic-site"
	prefix = "anr_"
)

var ErrInvalid = arpc.NewErrorCode("apikey/invalid", "invalid api key")

// Hash hashes a raw API key for storage.
func Hash(key string) string {
	b := sha256.Sum256([]byte(key + salt))
	return base64.RawStdEncoding.EncodeToString(b[:])
}

// Generate generates a new random API key with the anr_ prefix.
func Generate() string {
	var b [32]byte
	_, err := io.ReadFull(rand.Reader, b[:])
	if err != nil {
		panic(err)
	}
	return prefix + base64.RawURLEncoding.EncodeToString(b[:])
}

// ValidateSite looks up a site by its hashed API key and returns the site ID.
func ValidateSite(ctx context.Context, rawKey string) (siteID string, err error) {
	hashed := Hash(rawKey)
	err = pgctx.QueryRow(ctx, `
		select id
		from sites
		where api_key = $1
	`, hashed).Scan(&siteID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrInvalid
	}
	if err != nil {
		return "", err
	}
	return siteID, nil
}
