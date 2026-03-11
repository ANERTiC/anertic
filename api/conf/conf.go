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
		}

		slog.Info("config: init",
			"google_client_id", c.GoogleClientID,
		)
	})

	return c
}
