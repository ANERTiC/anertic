package auth

import (
	"context"
	"log/slog"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"

	"github.com/anertic/anertic/api/conf"
)

type googleProvider struct {
	oauth2 *oauth2.Config
	oidc   *oidc.Provider
}

func initGoogle() {
	provider, err := oidc.NewProvider(context.Background(), "https://accounts.google.com")
	if err != nil {
		slog.Error("auth: failed to init google oidc provider", "error", err)
		return
	}

	RegisterProvider(&googleProvider{
		oauth2: &oauth2.Config{
			ClientID:     conf.GoogleClientID,
			ClientSecret: conf.GoogleClientSecret,
			RedirectURL:  conf.GoogleRedirectURL,
			Endpoint:     provider.Endpoint(),
			Scopes:       []string{oidc.ScopeOpenID, "email", "profile"},
		},
		oidc: provider,
	})
}

func (g *googleProvider) Name() string {
	return "google"
}

func (g *googleProvider) AuthURL(state string) string {
	return g.oauth2.AuthCodeURL(state, oauth2.AccessTypeOffline)
}

func (g *googleProvider) Exchange(ctx context.Context, code string) (*UserInfo, error) {
	tok, err := g.oauth2.Exchange(ctx, code)
	if err != nil {
		return nil, err
	}

	rawIDToken, ok := tok.Extra("id_token").(string)
	if !ok {
		return nil, errAuthFailed
	}

	verifier := g.oidc.Verifier(&oidc.Config{ClientID: g.oauth2.ClientID})
	idToken, err := verifier.Verify(ctx, rawIDToken)
	if err != nil {
		return nil, err
	}

	var claims struct {
		Email   string `json:"email"`
		Name    string `json:"name"`
		Picture string `json:"picture"`
	}
	if err := idToken.Claims(&claims); err != nil {
		return nil, err
	}

	return &UserInfo{
		ProviderID: idToken.Subject,
		Email:      claims.Email,
		Name:       claims.Name,
		Picture:    claims.Picture,
	}, nil
}
