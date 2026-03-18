package ingest

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/acoshift/pgsql/pgctx"
	"github.com/rs/xid"
	"github.com/shopspring/decimal"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/anertic/anertic/pkg/apikey"
	"github.com/anertic/anertic/pkg/ingest"
	"github.com/anertic/anertic/pkg/rdctx"
	"github.com/anertic/anertic/pkg/tu"
)

func TestHandler(t *testing.T) {
	tc := tu.Setup()
	defer tc.Teardown()

	ctx := tc.Ctx()
	rawKey, meterID, serialNumber := seedTestData(t, tc)

	mux := http.NewServeMux()
	mux.HandleFunc("POST /ingest/{serial_number}", Handler)
	handler := pgctx.Middleware(tc.DB)(rdctx.Middleware(tc.RDB)(mux))

	t.Run("success", func(t *testing.T) {
		body := ingest.Reading{
			PowerW:    decimal.NewFromFloat(1500.5),
			EnergyKWh: decimal.NewFromFloat(42.123),
			VoltageV:  decimal.NewFromFloat(230.1),
			CurrentA:  decimal.NewFromFloat(6.52),
			Timestamp: "2026-03-18T10:00:00Z",
		}
		b, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/ingest/"+serialNumber, bytes.NewReader(b))
		req.Header.Set("Authorization", "Bearer "+rawKey)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)

		var resp map[string]any
		err := json.Unmarshal(rec.Body.Bytes(), &resp)
		require.NoError(t, err)
		assert.Equal(t, true, resp["ok"])
		assert.Equal(t, meterID, resp["meterId"])

		// Verify reading was inserted
		var count int
		err = pgctx.QueryRow(ctx, `
			select count(*)
			from meter_readings
			where meter_id = $1
		`, meterID).Scan(&count)
		require.NoError(t, err)
		assert.Equal(t, 1, count)

		// Verify meter was updated
		var isOnline bool
		err = pgctx.QueryRow(ctx, `
			select is_online
			from meters
			where id = $1
		`, meterID).Scan(&isOnline)
		require.NoError(t, err)
		assert.True(t, isOnline)
	})

	t.Run("missing authorization header", func(t *testing.T) {
		body := ingest.Reading{PowerW: decimal.NewFromFloat(100)}
		b, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/ingest/"+serialNumber, bytes.NewReader(b))
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	t.Run("invalid api key", func(t *testing.T) {
		body := ingest.Reading{PowerW: decimal.NewFromFloat(100)}
		b, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/ingest/"+serialNumber, bytes.NewReader(b))
		req.Header.Set("Authorization", "Bearer anr_invalid_key_here")
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusUnauthorized, rec.Code)
	})

	t.Run("meter not found for site", func(t *testing.T) {
		body := ingest.Reading{PowerW: decimal.NewFromFloat(100)}
		b, _ := json.Marshal(body)

		req := httptest.NewRequest("POST", "/ingest/NONEXISTENT-SN", bytes.NewReader(b))
		req.Header.Set("Authorization", "Bearer "+rawKey)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
	})

	t.Run("meter belongs to different site", func(t *testing.T) {
		// Create another site with its own API key
		otherSiteID := xid.New().String()
		otherRawKey := apikey.Generate()
		_, err := pgctx.Exec(ctx, `
			insert into sites (id, name, api_key) values ($1, $2, $3)
		`, otherSiteID, "Other Site", apikey.Hash(otherRawKey))
		require.NoError(t, err)

		body := ingest.Reading{PowerW: decimal.NewFromFloat(100)}
		b, _ := json.Marshal(body)

		// Use other site's key to try to access first site's meter
		req := httptest.NewRequest("POST", "/ingest/"+serialNumber, bytes.NewReader(b))
		req.Header.Set("Authorization", "Bearer "+otherRawKey)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusNotFound, rec.Code)
	})

	t.Run("invalid json body", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/ingest/"+serialNumber, bytes.NewReader([]byte("not json")))
		req.Header.Set("Authorization", "Bearer "+rawKey)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusBadRequest, rec.Code)
	})

	t.Run("empty body defaults to zero values", func(t *testing.T) {
		req := httptest.NewRequest("POST", "/ingest/"+serialNumber, bytes.NewReader([]byte("{}")))
		req.Header.Set("Authorization", "Bearer "+rawKey)
		rec := httptest.NewRecorder()

		handler.ServeHTTP(rec, req)

		assert.Equal(t, http.StatusOK, rec.Code)
	})
}

// seedTestData creates a site with an API key, a device, and a meter.
// Returns the raw API key, meter ID, and serial number.
func seedTestData(t *testing.T, tc *tu.Context) (rawKey, meterID, serialNumber string) {
	t.Helper()
	ctx := tc.Ctx()

	siteID := xid.New().String()
	deviceID := xid.New().String()
	meterID = xid.New().String()
	serialNumber = "TEST-SN-" + xid.New().String()
	rawKey = apikey.Generate()

	_, err := pgctx.Exec(ctx, `
		insert into sites (id, name, api_key) values ($1, $2, $3)
	`, siteID, "Test Site", apikey.Hash(rawKey))
	require.NoError(t, err)

	_, err = pgctx.Exec(ctx, `
		insert into devices (id, site_id, name, type) values ($1, $2, $3, $4)
	`, deviceID, siteID, "Test Device", "meter")
	require.NoError(t, err)

	_, err = pgctx.Exec(ctx, `
		insert into meters (id, site_id, device_id, serial_number, protocol)
		values ($1, $2, $3, $4, $5)
	`, meterID, siteID, deviceID, serialNumber, "http")
	require.NoError(t, err)

	return rawKey, meterID, serialNumber
}
