package provider

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

// Register registers an OAuth provider by name.
// A nil provider is silently ignored (provider not configured).
func Register(p OAuthProvider) {
	if p == nil {
		return
	}
	providers[p.Name()] = p
}

// Get returns the provider by name and whether it exists.
func Get(name string) (OAuthProvider, bool) {
	p, ok := providers[name]
	return p, ok
}
