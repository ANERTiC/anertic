package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/configfile"
	"github.com/acoshift/pgsql/pgctx"
	_ "github.com/lib/pq"
	"github.com/moonrhythm/httpmux"
	"github.com/moonrhythm/parapet"
	"github.com/moonrhythm/parapet/pkg/cors"

	"github.com/anertic/anertic/cmd/agentic/tools"
	"github.com/anertic/anertic/pkg/llm"
	"github.com/anertic/anertic/pkg/llm/anthropic"
	"github.com/anertic/anertic/pkg/llm/openai"
)

func main() {
	if err := run(); err != nil {
		slog.Error("agentic: exited", "error", err)
	}
}

func run() error {
	if err := configfile.LoadDotEnv("./.env"); err != nil {
		slog.Warn("load .env", "error", err)
	}

	cfg := configfile.NewEnvReader()

	// Database
	db, err := sql.Open("postgres", cfg.StringDefault("DB_URL", "postgres://anertic:anertic@localhost:5432/anertic?sslmode=disable"))
	if err != nil {
		return err
	}
	defer db.Close()

	// Config
	apiURL := cfg.StringDefault("API_URL", "http://localhost:8080")
	llmProvider := cfg.StringDefault("LLM_PROVIDER", "anthropic")
	llmModel := cfg.StringDefault("LLM_MODEL", "claude-opus-4-6")
	maxTokensStr := cfg.StringDefault("LLM_MAX_TOKENS", "16384")
	maxTokens, _ := strconv.Atoi(maxTokensStr)
	if maxTokens <= 0 {
		maxTokens = 16384
	}
	llmTimeoutStr := cfg.StringDefault("LLM_TIMEOUT", "60s")
	llmTimeout, _ := time.ParseDuration(llmTimeoutStr)
	if llmTimeout <= 0 {
		llmTimeout = 60 * time.Second
	}
	_ = llmTimeout // used by Agent when wrapping provider.Stream context

	// LLM Provider
	var provider llm.Provider
	switch llmProvider {
	case "anthropic":
		provider = anthropic.New(cfg.String("ANTHROPIC_API_KEY"))
	case "openai":
		provider = openai.New(
			cfg.String("OPENAI_API_KEY"),
			cfg.StringDefault("OPENAI_BASE_URL", ""),
		)
	default:
		return fmt.Errorf("unknown LLM_PROVIDER: %s", llmProvider)
	}

	// API Client
	apiClient := NewAPIClient(apiURL)

	// Tools
	registry := tools.NewRegistry(
		tools.NewGetUserProfile(apiClient),
		tools.NewGetSites(apiClient),
		tools.NewGetDevice(apiClient),
		tools.NewGetDeviceStatus(apiClient),
		tools.NewListDevices(apiClient),
		tools.NewCreateDevice(apiClient),
		tools.NewCreateMeter(apiClient),
		tools.NewGetLatestReading(apiClient),
		tools.NewListRooms(apiClient),
		tools.NewListFloors(apiClient),
		tools.NewQueryEnergy(apiClient),
		tools.NewGetInsights(apiClient),
		tools.NewGetChargerStatus(apiClient),
	)

	// Agent
	agent := NewAgent(provider, registry, llmModel, maxTokens)

	// Handlers
	h := &Handlers{agent: agent, apiClient: apiClient}

	// Auth middleware for conversation CRUD
	am := arpc.New()
	am.Encoder = func(w http.ResponseWriter, r *http.Request, v any) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(struct {
			OK     bool `json:"ok"`
			Result any  `json:"result"`
		}{true, v})
	}

	authMW := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := r.Header.Get("Authorization")
			if !strings.HasPrefix(token, "Bearer ") {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			bearer := token[7:]

			var me struct {
				ID string `json:"id"`
			}
			if err := apiClient.Invoke(r.Context(), bearer, "auth.me", nil, &me); err != nil {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), ctxKeyUserID, me.ID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}

	// Routes
	mux := httpmux.New()
	mux.HandleFunc("POST /chat", h.Chat)

	a := mux.Group("", authMW)
	a.Handle("POST /conversation.list", am.Handler(h.ConversationList))
	a.Handle("POST /conversation.get", am.Handler(h.ConversationGet))
	a.Handle("POST /conversation.delete", am.Handler(h.ConversationDelete))

	// Server
	srv := parapet.NewBackend()
	srv.Handler = mux
	srv.Use(cors.New())
	srv.UseFunc(pgctx.Middleware(db))
	srv.Addr = cfg.StringDefault("AGENTIC_ADDR", ":8082")

	slog.Info("starting agentic server", "addr", srv.Addr, "provider", llmProvider, "model", llmModel)
	return srv.ListenAndServe()
}
