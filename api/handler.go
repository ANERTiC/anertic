package api

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/acoshift/arpc/v2"
	"github.com/moonrhythm/httpmux"

	"github.com/anertic/anertic/api/auth"
	"github.com/anertic/anertic/api/device"
	"github.com/anertic/anertic/api/insight"
	"github.com/anertic/anertic/api/reading"
	"github.com/anertic/anertic/api/site"
)

var errUnauthorized = arpc.NewErrorCode("unauthorized", "unauthorized")

func authMiddleware(actx *arpc.MiddlewareContext) error {
	h := actx.Request().Header.Get("Authorization")
	if !strings.HasPrefix(h, "Bearer ") {
		return errUnauthorized
	}
	token := h[7:]
	if token == "" {
		return errUnauthorized
	}
	ctx := actx.Request().Context()

	userID, err := auth.ValidateToken(ctx, auth.HashToken(token))
	if errors.Is(err, sql.ErrNoRows) {
		return errUnauthorized
	}
	if err != nil {
		return err
	}

	ctx = auth.WithAccountID(ctx, userID)
	actx.SetRequest(actx.Request().WithContext(ctx))
	return nil
}

func Mount(mux *httpmux.Mux, am *arpc.Manager) {
	// OAuth routes (public, raw HTTP)
	mux.HandleFunc("GET /auth/{provider}", auth.ProviderRedirect)
	mux.HandleFunc("GET /auth/callback", auth.ProviderCallback)

	// Public API routes
	mux.Handle("POST /api/v1/auth.refreshToken", am.Handler(auth.RefreshToken))

	// Protected API routes
	a := mux.Group("", am.Middleware(authMiddleware))
	a.Handle("POST /api/v1/auth.me", am.Handler(auth.Me))

	// Sites
	a.Handle("POST /api/v1/site.list", am.Handler(site.List))
	a.Handle("POST /api/v1/site.create", am.Handler(site.Create))
	a.Handle("POST /api/v1/site.get", am.Handler(site.Get))
	a.Handle("POST /api/v1/site.update", am.Handler(site.Update))

	// Devices
	a.Handle("POST /api/v1/device.list", am.Handler(device.List))
	a.Handle("POST /api/v1/device.create", am.Handler(device.Create))
	a.Handle("POST /api/v1/device.get", am.Handler(device.Get))
	a.Handle("POST /api/v1/device.update", am.Handler(device.Update))

	// Readings
	a.Handle("POST /api/v1/reading.query", am.Handler(reading.Query))
	a.Handle("POST /api/v1/reading.latest", am.Handler(reading.Latest))

	// Insights
	a.Handle("POST /api/v1/insight.list", am.Handler(insight.List))
	a.Handle("POST /api/v1/insight.get", am.Handler(insight.Get))
}
