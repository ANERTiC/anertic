package provider

import (
	"context"
	"crypto/x509"
	"encoding/pem"
	"log/slog"
	"sync"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/oauth2"
)

type appleProvider struct {
	oauth2   *oauth2.Config
	oidc     *oidc.Provider
	teamID   string
	keyID    string
	privKey  any
	mu       sync.Mutex
	secret   string
	secretAt time.Time
}

type AppleConfig struct {
	TeamID      string
	ClientID    string
	KeyID       string
	PrivateKey  string // PEM-encoded .p8 file contents
	RedirectURL string
}

func NewApple(cfg AppleConfig) OAuthProvider {
	p, err := oidc.NewProvider(context.Background(), "https://appleid.apple.com")
	if err != nil {
		slog.Error("auth: failed to init apple oidc provider", "error", err)
		return nil
	}

	block, _ := pem.Decode([]byte(cfg.PrivateKey))
	if block == nil {
		slog.Error("auth: failed to decode apple private key PEM")
		return nil
	}

	privKey, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		slog.Error("auth: failed to parse apple private key", "error", err)
		return nil
	}

	ap := &appleProvider{
		oidc:    p,
		teamID:  cfg.TeamID,
		keyID:   cfg.KeyID,
		privKey: privKey,
	}

	ap.oauth2 = &oauth2.Config{
		ClientID:     cfg.ClientID,
		RedirectURL:  cfg.RedirectURL,
		Endpoint:     p.Endpoint(),
		Scopes:       []string{oidc.ScopeOpenID, "email", "name"},
	}

	return ap
}

func (a *appleProvider) Name() string {
	return "apple"
}

func (a *appleProvider) AuthURL(state string) string {
	return a.oauth2.AuthCodeURL(state, oauth2.SetAuthURLParam("response_mode", "form_post"))
}

func (a *appleProvider) Exchange(ctx context.Context, code string) (*UserInfo, error) {
	secret, err := a.clientSecret()
	if err != nil {
		return nil, err
	}
	a.oauth2.ClientSecret = secret

	tok, err := a.oauth2.Exchange(ctx, code)
	if err != nil {
		return nil, err
	}

	rawIDToken, ok := tok.Extra("id_token").(string)
	if !ok {
		return nil, ErrAuthFailed
	}

	verifier := a.oidc.Verifier(&oidc.Config{ClientID: a.oauth2.ClientID})
	idToken, err := verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return nil, err
	}

	var claims struct {
		Email string `json:"email"`
	}
	if err := idToken.Claims(&claims); err != nil {
		return nil, err
	}

	return &UserInfo{
		ProviderID: idToken.Subject,
		Email:      claims.Email,
	}, nil
}

// clientSecret generates a short-lived JWT client secret for Apple Sign-In.
// Apple requires the client_secret to be a signed JWT rather than a static string.
func (a *appleProvider) clientSecret() (string, error) {
	a.mu.Lock()
	defer a.mu.Unlock()

	// Reuse if still valid (regenerate 1 minute before expiry)
	if a.secret != "" && time.Since(a.secretAt) < 5*time.Minute-time.Minute {
		return a.secret, nil
	}

	now := time.Now()
	token := jwt.NewWithClaims(jwt.SigningMethodES256, jwt.MapClaims{
		"iss": a.teamID,
		"iat": now.Unix(),
		"exp": now.Add(5 * time.Minute).Unix(),
		"aud": "https://appleid.apple.com",
		"sub": a.oauth2.ClientID,
	})
	token.Header["kid"] = a.keyID

	secret, err := token.SignedString(a.privKey)
	if err != nil {
		return "", err
	}

	a.secret = secret
	a.secretAt = now
	return secret, nil
}
