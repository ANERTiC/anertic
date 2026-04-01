package conf

import (
	"log/slog"
	"sync"

	"github.com/acoshift/configfile"
)

type Config struct {
	AppURL string

	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string

	AppleTeamID     string
	AppleClientID   string
	AppleKeyID      string
	ApplePrivateKey string
	AppleRedirectURL string

	SupermemoryAPIKey  string
	SupermemoryBaseURL string
}

var (
	once sync.Once
	c    Config
)

func Load() Config {
	once.Do(func() {
		cfg := configfile.NewEnvReader()

		c = Config{
			AppURL:             cfg.StringDefault("APP_URL", "http://localhost:5173"),
			GoogleClientID:     cfg.String("GOOGLE_CLIENT_ID"),
			GoogleClientSecret: cfg.String("GOOGLE_CLIENT_SECRET"),
			GoogleRedirectURL:  cfg.StringDefault("GOOGLE_REDIRECT_URL", "http://localhost:8080/auth/google/callback"),
			AppleTeamID:        cfg.String("APPLE_TEAM_ID"),
			AppleClientID:      cfg.String("APPLE_CLIENT_ID"),
			AppleKeyID:         cfg.String("APPLE_KEY_ID"),
			ApplePrivateKey:    cfg.String("APPLE_PRIVATE_KEY"),
			AppleRedirectURL:   cfg.StringDefault("APPLE_REDIRECT_URL", "http://localhost:8080/auth/apple/callback"),
			SupermemoryAPIKey:  cfg.StringDefault("SUPERMEMORY_API_KEY", ""),
			SupermemoryBaseURL: cfg.StringDefault("SUPERMEMORY_BASE_URL", "https://api.supermemory.ai"),
		}

		slog.Info("config: init",
			"google_client_id", c.GoogleClientID,
		)
	})

	return c
}
