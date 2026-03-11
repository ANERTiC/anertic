package auth

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"io"
	"log/slog"
	"net/http"
	"net/url"
	"time"

	"github.com/acoshift/pgsql/pgctx"
	"github.com/moonrhythm/session"

	"github.com/anertic/anertic/api/auth/provider"
	"github.com/anertic/anertic/api/conf"
)

const sessionName = "auth"


func generateState() string {
	var b [16]byte
	_, err := io.ReadFull(rand.Reader, b[:])
	if err != nil {
		panic(err)
	}
	return base64.RawURLEncoding.EncodeToString(b[:])
}

// ProviderRedirect redirects to the OAuth provider's consent page.
func ProviderRedirect(w http.ResponseWriter, r *http.Request) {
	name := r.PathValue("provider")
	p, ok := provider.Get(name)
	if !ok {
		http.Error(w, "unknown provider", http.StatusBadRequest)
		return
	}

	state := generateState()

	s, err := session.Get(r.Context(), sessionName)
	if err != nil {
		slog.ErrorContext(r.Context(), "auth: get session", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	s.Set("state", state)
	s.Set("redirect_url", r.URL.Query().Get("redirect_url"))

	u := p.AuthURL(state)
	http.Redirect(w, r, u, http.StatusFound)
}

// ProviderCallback handles the OAuth callback from any provider.
func ProviderCallback(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	name := r.PathValue("provider")
	p, ok := provider.Get(name)
	if !ok {
		http.Error(w, "unknown provider", http.StatusBadRequest)
		return
	}

	s, err := session.Get(ctx, sessionName)
	if err != nil {
		slog.ErrorContext(ctx, "auth: get session", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Validate state
	savedState := s.PopString("state")
	if savedState == "" || savedState != r.URL.Query().Get("state") {
		http.Error(w, "invalid state", http.StatusBadRequest)
		return
	}

	redirectURL := s.PopString("redirect_url")

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

	if redirectURL == "" {
		redirectURL = conf.Load().AppURL + "/login/callback"
	}

	redirectURL += "?" + url.Values{
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
