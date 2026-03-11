package conf

import (
	"github.com/acoshift/configfile"
)

var (
	AppURL string

	GoogleClientID     string
	GoogleClientSecret string
	GoogleRedirectURL  string
)

func Init() {
	cfg := configfile.NewEnvReader()

	AppURL = cfg.StringDefault("APP_URL", "http://localhost:5173")

	GoogleClientID = cfg.String("GOOGLE_CLIENT_ID")
	GoogleClientSecret = cfg.String("GOOGLE_CLIENT_SECRET")
	GoogleRedirectURL = cfg.StringDefault("GOOGLE_REDIRECT_URL", "http://localhost:8080/auth/google/callback")
}
