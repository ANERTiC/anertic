package ingest

import (
	"database/sql"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"strings"

	"github.com/acoshift/pgsql/pgctx"

	"github.com/anertic/anertic/pkg/apikey"
	"github.com/anertic/anertic/pkg/ingest"
)

// Handler handles POST /ingest/{serial_number}
func Handler(w http.ResponseWriter, r *http.Request) {
	serialNumber := r.PathValue("serial_number")
	if serialNumber == "" {
		writeError(w, http.StatusBadRequest, "serial_number is required")
		return
	}

	ctx := r.Context()

	// Validate API key from Authorization header
	h := r.Header.Get("Authorization")
	if !strings.HasPrefix(h, "Bearer ") {
		writeError(w, http.StatusUnauthorized, "missing api key")
		return
	}
	rawKey := h[7:]
	if rawKey == "" {
		writeError(w, http.StatusUnauthorized, "missing api key")
		return
	}

	siteID, err := apikey.ValidateSite(ctx, rawKey)
	if errors.Is(err, apikey.ErrInvalid) {
		writeError(w, http.StatusUnauthorized, "invalid api key")
		return
	}
	if err != nil {
		slog.ErrorContext(ctx, "ingest: validate api key", "error", err)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	var reading ingest.Reading
	if err := json.NewDecoder(r.Body).Decode(&reading); err != nil {
		writeError(w, http.StatusBadRequest, "invalid json body")
		return
	}

	// Look up meter by serial_number within the site
	var meterID string
	err = pgctx.QueryRow(ctx, `
		select id
		from meters
		where serial_number = $1
		  and site_id = $2
	`, serialNumber, siteID).Scan(&meterID)
	if errors.Is(err, sql.ErrNoRows) {
		writeError(w, http.StatusNotFound, "meter not found")
		return
	}
	if err != nil {
		slog.ErrorContext(ctx, "ingest: lookup meter", "error", err, "serial_number", serialNumber)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	if err := ingest.ProcessReading(ctx, meterID, &reading); err != nil {
		slog.ErrorContext(ctx, "ingest: process reading", "error", err, "serial_number", serialNumber, "meter_id", meterID)
		writeError(w, http.StatusInternalServerError, "internal error")
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]any{
		"ok":      true,
		"meterId": meterID,
	})
}

func writeError(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(map[string]any{
		"ok":    false,
		"error": msg,
	})
}
