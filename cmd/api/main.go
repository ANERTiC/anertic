package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/configfile"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/moonrhythm/httpmux"
	"github.com/moonrhythm/parapet"
	"github.com/moonrhythm/parapet/pkg/cors"
	"github.com/moonrhythm/session"
	"github.com/moonrhythm/session/store"
	"github.com/redis/go-redis/v9"

	"github.com/anertic/anertic/api"
	"github.com/anertic/anertic/api/auth"
	"github.com/anertic/anertic/api/auth/provider"
	"github.com/anertic/anertic/api/conf"
	"github.com/anertic/anertic/pkg/rdctx"
)

func main() {
	if err := run(); err != nil {
		slog.Error("api: exited", "error", err)
	}
}

// run initializes all dependencies and starts the API server.
func run() error {
	if err := configfile.LoadDotEnv("./.env"); err != nil {
		slog.Warn("load .env", "error", err)
	}

	cfg := configfile.NewEnvReader()

	srv := parapet.NewBackend()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Connect to PostgreSQL and inject into context
	db, err := sql.Open("postgres", cfg.StringDefault("DATABASE_URL", "postgres://anertic:anertic@localhost:5432/anertic?sslmode=disable"))
	if err != nil {
		return err
	}
	defer db.Close()
	ctx = pgctx.NewContext(ctx, db)

	opt, err := redis.ParseURL(cfg.StringDefault("REDIS_URL", "redis://localhost:6379"))
	if err != nil {
		return err
	}
	rdb := redis.NewClient(opt)
	defer rdb.Close()

	appCfg := conf.Load()
	auth.SetAppURL(appCfg.AppURL)
	provider.Register(provider.NewGoogle(appCfg.GoogleClientID, appCfg.GoogleClientSecret, appCfg.GoogleRedirectURL))

	mux := httpmux.New()

	am := arpc.New()
	am.Encoder = func(w http.ResponseWriter, r *http.Request, v any) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(struct {
			OK     bool `json:"ok"`
			Result any  `json:"result"`
		}{true, v})
	}

	// OAuth routes (public, raw HTTP)
	mux.HandleFunc("GET /auth/{provider}", auth.ProviderRedirect)
	mux.HandleFunc("GET /auth/{provider}/callback", auth.ProviderCallback)

	// Public API routes
	mux.Handle("POST /api/v1/auth.refreshToken", am.Handler(auth.RefreshToken))

	// Protected API routes
	a := mux.Group("", am.Middleware(auth.Middleware))
	a.Handle("POST /api/v1/auth.me", am.Handler(auth.Me))
	api.Mount(a, am)

	mux.Handle("/", am.NotFoundHandler())

	srv.Handler = mux
	srv.Use(cors.New())
	srv.UseFunc(parapet.MiddlewareFunc(session.Middleware(session.Config{
		Store:    &store.Redis{Client: rdb, Prefix: "sess:"},
		HTTPOnly: true,
		Path:     "/",
		MaxAge:   10 * time.Minute,
		Secure:   session.PreferSecure,
		SameSite: http.SameSiteLaxMode,
	})))
	srv.UseFunc(pgctx.Middleware(db))
	srv.UseFunc(rdctx.Middleware(rdb))
	srv.Addr = cfg.StringDefault("ADDR", ":8080")

	slog.InfoContext(ctx, "starting api server", "addr", srv.Addr)
	return srv.ListenAndServe()
}
