package api

import (
	"database/sql"
	"errors"
	"strings"

	"github.com/acoshift/arpc/v2"
	"github.com/moonrhythm/httpmux"

	"github.com/anertic/anertic/api/auth"
	"github.com/anertic/anertic/api/charger"
	"github.com/anertic/anertic/api/connector"
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
	mux.Handle("POST /auth.refreshToken", am.Handler(auth.RefreshToken))

	// Protected API routes
	a := mux.Group("", am.Middleware(authMiddleware))
	a.Handle("POST /auth.me", am.Handler(auth.Me))

	// Sites
	a.Handle("POST /site.list", am.Handler(site.List))
	a.Handle("POST /site.create", am.Handler(site.Create))
	a.Handle("POST /site.get", am.Handler(site.Get))
	a.Handle("POST /site.update", am.Handler(site.Update))

	// Devices
	a.Handle("POST /device.list", am.Handler(device.List))
	a.Handle("POST /device.create", am.Handler(device.Create))
	a.Handle("POST /device.get", am.Handler(device.Get))
	a.Handle("POST /device.update", am.Handler(device.Update))

	// Chargers
	a.Handle("POST /charger.list", am.Handler(charger.List))
	a.Handle("POST /charger.create", am.Handler(charger.Create))
	a.Handle("POST /charger.get", am.Handler(charger.Get))
	a.Handle("POST /charger.update", am.Handler(charger.Update))
	a.Handle("POST /charger.delete", am.Handler(charger.Delete))

	// Connectors
	a.Handle("POST /connector.list", am.Handler(connector.List))

	// Readings
	a.Handle("POST /reading.query", am.Handler(reading.Query))
	a.Handle("POST /reading.latest", am.Handler(reading.Latest))

	// Insights
	a.Handle("POST /insight.list", am.Handler(insight.List))
	a.Handle("POST /insight.get", am.Handler(insight.Get))
}
