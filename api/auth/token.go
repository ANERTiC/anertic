package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"errors"
	"io"
	"time"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/pgsql/pgctx"
)

const (
	TokenLifeTime        = 7 * 24 * time.Hour
	RefreshTokenLifeTime = 30 * 24 * time.Hour
)

var (
	ErrTokenExpired = arpc.NewErrorCode("auth/token-expired", "auth: token expired")
	ErrUnauthorized = arpc.NewErrorCode("auth/unauthorized", "auth: unauthorized")
)

var tokenSalt = "@anertic"

func HashToken(token string) string {
	b := sha256.Sum256([]byte(token + tokenSalt))
	return base64.RawStdEncoding.EncodeToString(b[:])
}

func ValidateToken(ctx context.Context, hashedToken string) (string, error) {
	var userID string
	var expiresAt time.Time
	err := pgctx.QueryRow(ctx, `
		select user_id, expires_at
		from user_auth_tokens
		where token = $1
	`,
		hashedToken,
	).Scan(
		&userID,
		&expiresAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrUnauthorized
	}
	if err != nil {
		return "", err
	}
	if expiresAt.Before(time.Now()) {
		return "", ErrTokenExpired
	}
	return userID, nil
}

func ValidateRefreshToken(ctx context.Context, hashedToken string) (string, error) {
	var userID string
	var expiresAt time.Time
	err := pgctx.QueryRow(ctx, `
		select user_id, expires_at
		from user_auth_refresh_tokens
		where token = $1
	`,
		hashedToken,
	).Scan(
		&userID,
		&expiresAt,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return "", ErrUnauthorized
	}
	if err != nil {
		return "", err
	}
	if expiresAt.Before(time.Now()) {
		return "", ErrTokenExpired
	}
	return userID, nil
}

func generateToken(ctx context.Context, userID string, exp time.Time) (string, error) {
	t := randToken()
	_, err := pgctx.Exec(ctx, `
		insert into user_auth_tokens (
			user_id,
			token,
			expires_at
		) values ($1, $2, $3)
	`,
		userID,
		HashToken(t),
		exp,
	)
	if err != nil {
		return "", err
	}
	return t, nil
}

func generateRefreshToken(ctx context.Context, userID string, exp time.Time) (string, error) {
	t := randToken()
	_, err := pgctx.Exec(ctx, `
		insert into user_auth_refresh_tokens (
			user_id,
			token,
			expires_at
		) values ($1, $2, $3)
	`,
		userID,
		HashToken(t),
		exp,
	)
	if err != nil {
		return "", err
	}
	return t, nil
}

func randToken() string {
	var token [32]byte
	_, err := io.ReadFull(rand.Reader, token[:])
	if err != nil {
		panic(err)
	}
	return base64.RawStdEncoding.EncodeToString(token[:])
}
