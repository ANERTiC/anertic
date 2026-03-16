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
	"github.com/anertic/anertic/api/meter"
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
	a.Handle("POST /site.updateTariff", am.Handler(site.UpdateTariff))
	a.Handle("POST /site.listRole", am.Handler(site.ListRoles))
	a.Handle("POST /site.listMembers", am.Handler(site.ListMembers))
	a.Handle("POST /site.addMember", am.Handler(site.AddMember))
	a.Handle("POST /site.updateMemberRole", am.Handler(site.UpdateMemberRole))
	a.Handle("POST /site.removeMember", am.Handler(site.RemoveMember))
	a.Handle("POST /site.inviteMember", am.Handler(site.InviteMember))
	a.Handle("POST /site.listInvites", am.Handler(site.ListInvites))
	a.Handle("POST /site.revokeInvite", am.Handler(site.RevokeInvite))
	a.Handle("POST /site.acceptInvite", am.Handler(site.AcceptInvite))
	a.Handle("POST /site.declineInvite", am.Handler(site.DeclineInvite))
	a.Handle("POST /site.myInvites", am.Handler(site.MyInvites))
	a.Handle("POST /site.getApiKey", am.Handler(site.GetApiKey))
	a.Handle("POST /site.regenerateApiKey", am.Handler(site.RegenerateApiKey))

	// Devices
	a.Handle("POST /device.list", am.Handler(device.List))
	a.Handle("POST /device.create", am.Handler(device.Create))
	a.Handle("POST /device.get", am.Handler(device.Get))
	a.Handle("POST /device.update", am.Handler(device.Update))
	a.Handle("POST /device.delete", am.Handler(device.Delete))

	// Meters
	a.Handle("POST /meter.list", am.Handler(meter.List))
	a.Handle("POST /meter.create", am.Handler(meter.Create))
	a.Handle("POST /meter.get", am.Handler(meter.Get))
	a.Handle("POST /meter.update", am.Handler(meter.Update))
	a.Handle("POST /meter.delete", am.Handler(meter.Delete))

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
	a.Handle("POST /insight.summary", am.Handler(insight.Summary))
	a.Handle("POST /insight.list", am.Handler(insight.List))
	a.Handle("POST /insight.get", am.Handler(insight.Get))
	a.Handle("POST /insight.updateStatus", am.Handler(insight.UpdateStatus))
	a.Handle("POST /insight.savingsHistory", am.Handler(insight.SavingsHistory))
	a.Handle("POST /insight.weeklyPattern", am.Handler(insight.WeeklyPattern))
	a.Handle("POST /insight.anomalies", am.Handler(insight.Anomalies))
}
