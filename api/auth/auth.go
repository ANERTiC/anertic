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
	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

var errUnauthorized = arpc.NewErrorCode("unauthorized", "unauthorized")

type Config struct {
	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string
	AppURL             string
}

// Mount registers auth routes on the mux.
func Mount(mux interface{ Handle(string, http.Handler) }, cfg Config) {
	h := &handler{cfg: cfg}
	h.init()
	mux.Handle("GET /auth/google", http.HandlerFunc(h.googleLogin))
	mux.Handle("GET /auth/google/callback", http.HandlerFunc(h.googleCallback))
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

type handler struct {
	cfg      Config
	oauth2   *oauth2.Config
	provider *oidc.Provider
}

func (h *handler) init() {
	provider, err := oidc.NewProvider(context.Background(), "https://accounts.google.com")
	if err != nil {
		slog.Error("auth: failed to init google oidc provider", "error", err)
		return
	}
	h.provider = provider
	h.oauth2 = &oauth2.Config{
		ClientID:     h.cfg.GoogleClientID,
		ClientSecret: h.cfg.GoogleClientSecret,
		RedirectURL:  h.cfg.GoogleRedirectURL,
		Endpoint:     provider.Endpoint(),
		Scopes:       []string{oidc.ScopeOpenID, "email", "profile"},
	}
}

func (h *handler) googleLogin(w http.ResponseWriter, r *http.Request) {
	// TODO: add state param with HMAC for CSRF protection
	u := h.oauth2.AuthCodeURL("", oauth2.AccessTypeOffline)
	http.Redirect(w, r, u, http.StatusFound)
}

func (h *handler) googleCallback(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "missing code", http.StatusBadRequest)
		return
	}

	tok, err := h.oauth2.Exchange(ctx, code)
	if err != nil {
		slog.ErrorContext(ctx, "auth: exchange code", "error", err)
		http.Error(w, "authentication failed", http.StatusInternalServerError)
		return
	}

	rawIDToken, ok := tok.Extra("id_token").(string)
	if !ok {
		slog.ErrorContext(ctx, "auth: no id_token in response")
		http.Error(w, "authentication failed", http.StatusInternalServerError)
		return
	}

	verifier := h.provider.Verifier(&oidc.Config{ClientID: h.cfg.GoogleClientID})
	idToken, err := verifier.Verify(ctx, rawIDToken)
	if err != nil {
		slog.ErrorContext(ctx, "auth: verify id_token", "error", err)
		http.Error(w, "authentication failed", http.StatusInternalServerError)
		return
	}

	var claims struct {
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}
	if err := idToken.Claims(&claims); err != nil {
		slog.ErrorContext(ctx, "auth: parse claims", "error", err)
		http.Error(w, "authentication failed", http.StatusInternalServerError)
		return
	}

	userID, err := upsertUser(ctx, idToken.Subject, claims.Email, claims.Name, claims.Picture)
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

	redirectURL := h.cfg.AppURL + "/login/callback?" + url.Values{
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

func Me(ctx context.Context, _ *struct{}) (*MeResult, error) {
	id := AccountID(ctx)
	if id == "" {
		return nil, errUnauthorized
	}

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

func RefreshTokenHandler(ctx context.Context, p *RefreshTokenParams) (*TokenResult, error) {
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

func upsertUser(ctx context.Context, providerID, email, name, picture string) (string, error) {
	var id string
	err := pgctx.QueryRow(ctx, `
		insert into users (
			email,
			name,
			picture,
			provider,
			provider_id
		) values ($1, $2, $3, 'google', $4)
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
		providerID,
	).Scan(&id)
	if err != nil {
		return "", err
	}
	return id, nil
}

