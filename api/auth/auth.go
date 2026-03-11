package auth

import (
	"context"
	"database/sql"
	"errors"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/pgsql/pgctx"

	"github.com/anertic/anertic/api/conf"
)

var (
	errUnauthorized = arpc.NewErrorCode("unauthorized", "unauthorized")
	errAuthFailed   = arpc.NewErrorCode("auth/failed", "authentication failed")
)

func Init() {
	initGoogle()
}

// Middleware validates Bearer token and sets user in context.
func Middleware(actx *arpc.MiddlewareContext) error {
	h := actx.Request().Header.Get("Authorization")
	if !strings.HasPrefix(h, "Bearer ") {
		return errUnauthorized
	}
	token := h[7:]
	if token == "" {
		return errUnauthorized
	}
	ctx := actx.Request().Context()

	userID, err := ValidateToken(ctx, HashToken(token))
	if errors.Is(err, sql.ErrNoRows) {
		return errUnauthorized
	}
	if err != nil {
		return err
	}

	ctx = WithAccountID(ctx, userID)
	actx.SetRequest(actx.Request().WithContext(ctx))
	return nil
}

// ProviderRedirect redirects to the OAuth provider's consent page.
// The provider is determined from the URL path: /auth/{provider}
func ProviderRedirect(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("provider")
	p, ok := providers[name]
	if !ok {
		http.Error(w, "unknown provider", http.StatusBadRequest)
		return
	}

	// TODO: add state param with HMAC for CSRF protection
	u := p.AuthURL("")
	http.Redirect(w, r, u, http.StatusFound)
}

// ProviderCallback handles the OAuth callback from any provider.
// The provider is determined from the URL path: /auth/{provider}/callback
func ProviderCallback(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	name := r.PathValue("provider")
	p, ok := providers[name]
	if !ok {
		http.Error(w, "unknown provider", http.StatusBadRequest)
		return
	}

	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "missing code", http.StatusBadRequest)
		return
	}

	info, err := p.Exchange(ctx, code)
	if err != nil {
		slog.ErrorContext(ctx, "auth: provider exchange", "provider", name, "error", err)
		http.Error(w, "authentication failed", http.StatusInternalServerError)
		return
	}

	userID, err := upsertUser(ctx, name, info.ProviderID, info.Email, info.Name, info.Picture)
	if err != nil {
		slog.ErrorContext(ctx, "auth: upsert user", "error", err)
		http.Error(w, "authentication failed", http.StatusInternalServerError)
		return
	}

	exp := time.Now().Add(TokenLifeTime)
	token, err := generateToken(ctx, userID, exp)
	if err != nil {
		slog.ErrorContext(ctx, "auth: generate token", "error", err)
		http.Error(w, "authentication failed", http.StatusInternalServerError)
		return
	}

	refreshToken, err := generateRefreshToken(ctx, userID, time.Now().Add(RefreshTokenLifeTime))
	if err != nil {
		slog.ErrorContext(ctx, "auth: generate refresh token", "error", err)
		http.Error(w, "authentication failed", http.StatusInternalServerError)
		return
	}

	redirectURL := conf.AppURL + "/login/callback?" + url.Values{
		"token":         {token},
		"refresh_token": {refreshToken},
	}.Encode()
	http.Redirect(w, r, redirectURL, http.StatusFound)
}

// Me

type MeResult struct {
	ID      string `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Picture string `json:"picture"`
}

func Me(ctx context.Context) (*MeResult, error) {
	id := AccountID(ctx)

	var r MeResult
	err := pgctx.QueryRow(ctx, `
		select
			id,
			email,
			name,
			picture
		from users
		where id = $1
	`,
		id,
	).Scan(
		&r.ID,
		&r.Email,
		&r.Name,
		&r.Picture,
	)
	if err != nil {
		return nil, err
	}
	return &r, nil
}

// RefreshToken

type RefreshTokenParams struct {
	RefreshToken string `json:"refreshToken"`
}

type TokenResult struct {
	Token        string    `json:"token"`
	ExpiresAt    time.Time `json:"expiresAt"`
	RefreshToken string    `json:"refreshToken"`
}

func RefreshToken(ctx context.Context, p RefreshTokenParams) (*TokenResult, error) {
	hashedToken := HashToken(p.RefreshToken)
	userID, err := ValidateRefreshToken(ctx, hashedToken)
	if err != nil {
		return nil, err
	}

	// Revoke old refresh token
	_, err = pgctx.Exec(ctx, `
		delete from user_auth_refresh_tokens where token = $1
	`,
		hashedToken,
	)
	if err != nil {
		return nil, err
	}

	exp := time.Now().Add(TokenLifeTime)
	token, err := generateToken(ctx, userID, exp)
	if err != nil {
		return nil, err
	}

	refreshToken, err := generateRefreshToken(ctx, userID, time.Now().Add(RefreshTokenLifeTime))
	if err != nil {
		return nil, err
	}

	return &TokenResult{
		Token:        token,
		ExpiresAt:    exp,
		RefreshToken: refreshToken,
	}, nil
}

func upsertUser(ctx context.Context, provider, providerID, email, name, picture string) (string, error) {
	var id string
	err := pgctx.QueryRow(ctx, `
		insert into users (
			email,
			name,
			picture,
			provider,
			provider_id
		) values ($1, $2, $3, $4, $5)
		on conflict (email) do update set
			name = excluded.name,
			picture = excluded.picture,
			provider_id = excluded.provider_id,
			updated_at = now()
		returning id
	`,
		email,
		name,
		picture,
		provider,
		providerID,
	).Scan(&id)
	if err != nil {
		return "", err
	}
	return id, nil
}
