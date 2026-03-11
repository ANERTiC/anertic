package api

import (
	"github.com/acoshift/arpc/v2"
	"github.com/moonrhythm/httpmux"

	"github.com/anertic/anertic/api/device"
	"github.com/anertic/anertic/api/insight"
	"github.com/anertic/anertic/api/reading"
	"github.com/anertic/anertic/api/site"
)

func Mount(mux *httpmux.Mux, am *arpc.Manager) {
	// Sites
	mux.Handle("POST /site.list", am.Handler(site.List))
	mux.Handle("POST /site.create", am.Handler(site.Create))
	mux.Handle("POST /site.get", am.Handler(site.Get))
	mux.Handle("POST /site.update", am.Handler(site.Update))

	// Devices
	mux.Handle("POST /device.list", am.Handler(device.List))
	mux.Handle("POST /device.create", am.Handler(device.Create))
	mux.Handle("POST /device.get", am.Handler(device.Get))
	mux.Handle("POST /device.update", am.Handler(device.Update))

	// Readings
	mux.Handle("POST /reading.query", am.Handler(reading.Query))
	mux.Handle("POST /reading.latest", am.Handler(reading.Latest))

	// Insights
	mux.Handle("POST /insight.list", am.Handler(insight.List))
	mux.Handle("POST /insight.get", am.Handler(insight.Get))
}
