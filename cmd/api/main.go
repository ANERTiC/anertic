package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"os"
	"time"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/configfile"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/moonrhythm/httpmux"
	"github.com/moonrhythm/parapet"
	"github.com/moonrhythm/parapet/pkg/cors"
	"github.com/moonrhythm/session"
	"github.com/moonrhythm/session/store"
	"github.com/moonrhythm/validator"
	"github.com/redis/go-redis/v9"
	"github.com/xkamail/godoclive/pkg/godoclive"

	"github.com/anertic/anertic/api"
	"github.com/anertic/anertic/api/auth/provider"
	"github.com/anertic/anertic/api/conf"
	"github.com/anertic/anertic/pkg/ops"
	"github.com/anertic/anertic/pkg/rdctx"
	"github.com/anertic/anertic/pkg/supermemory"
	"github.com/anertic/anertic/schema"
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

	if err := ops.Init(context.Background()); err != nil {
		return err
	}
	defer ops.Close()

	srv := parapet.NewBackend()
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	// Connect to PostgreSQL and inject into context
	db, err := sql.Open("postgres", cfg.StringDefault("DB_URL", "postgres://anertic:anertic@localhost:5432/anertic?sslmode=disable"))
	if err != nil {
		return err
	}
	defer db.Close()

	if err := schema.Migrate(ctx, db); err != nil {
		return err
	}

	ctx = pgctx.NewContext(ctx, db)

	opt, err := redis.ParseURL(cfg.StringDefault("REDIS_URL", "redis://localhost:6379"))
	if err != nil {
		return err
	}
	rdb := redis.NewClient(opt)
	defer rdb.Close()

	appCfg := conf.Load()
	provider.Register(provider.NewGoogle(appCfg.GoogleClientID, appCfg.GoogleClientSecret, appCfg.GoogleRedirectURL))
	provider.Register(provider.NewApple(provider.AppleConfig{
		TeamID:      appCfg.AppleTeamID,
		ClientID:    appCfg.AppleClientID,
		KeyID:       appCfg.AppleKeyID,
		PrivateKey:  appCfg.ApplePrivateKey,
		RedirectURL: appCfg.AppleRedirectURL,
	}))

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
	am.WrapError = func(err error) error {
		var arpcErr *arpc.Error
		if errors.As(err, &arpcErr) {
			return err
		}
		if validator.IsError(err) {
			return arpc.NewErrorCode("validation", err.Error())
		}
		slog.ErrorContext(ctx, "internal server error", "error", err)
		return arpc.NewErrorCode("unknown", "unknown error")
	}
	am.OnOK(func(w http.ResponseWriter, r *http.Request, req any, res any) {
		slog.Info("api", "method", r.Method, "path", r.URL.Path)
	})
	am.OnError(func(w http.ResponseWriter, r *http.Request, req any, err error) {
		slog.Error("api", "method", r.Method, "path", r.URL.Path, "error", err)
	})

	api.Mount(mux, am)

	mux.Handle("/", am.NotFoundHandler())
	if data, err := os.ReadFile("docs.json"); err == nil {
		var endpoints []godoclive.EndpointDef
		if err := json.Unmarshal(data, &endpoints); err == nil && len(endpoints) > 0 {
			slog.Info("docs", "endpoints", len(endpoints))
			mux.Handle("/docs", godoclive.Handler(endpoints,
				godoclive.WithTitle("ANERTiC API"),
				godoclive.WithBaseURL("https://app.anertic.com/api"),
				godoclive.WithTheme("light"),
			))
		}
	}

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
	smClient := supermemory.New(appCfg.SupermemoryBaseURL, appCfg.SupermemoryAPIKey)
	srv.UseFunc(pgctx.Middleware(db))
	srv.UseFunc(rdctx.Middleware(rdb))
	srv.UseFunc(supermemory.Middleware(smClient))
	srv.Addr = cfg.StringDefault("ADDR", ":8080")

	slog.InfoContext(ctx, "starting api server", "addr", srv.Addr)
	return srv.ListenAndServe()
}
