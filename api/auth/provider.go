package auth

import (
	"context"
)

// UserInfo holds the normalized user information from any OAuth provider.
type UserInfo struct {
	ProviderID string
	Email      string
	Name       string
	Picture    string
}

// OAuthProvider defines the interface for an external OAuth provider.
type OAuthProvider interface {
	// Name returns the provider identifier (e.g. "google", "github").
	Name() string
	// AuthURL returns the URL to redirect the user to for authentication.
	AuthURL(state string) string
	// Exchange exchanges the authorization code for user information.
	Exchange(ctx context.Context, code string) (*UserInfo, error)
}

var providers = map[string]OAuthProvider{}

// RegisterProvider registers an OAuth provider by name.
func RegisterProvider(p OAuthProvider) {
	providers[p.Name()] = p
}
