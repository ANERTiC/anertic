package ocpp

import (
	"context"
	"encoding/json"
	"log/slog"
	"sync"

	"github.com/acoshift/pgsql/pgctx"
	"github.com/redis/go-redis/v9"
)

// Command status constants — mirrors pkg/ocpp.CommandStatusXxx.
// Duplicated here because this package cannot import pkg/ocpp (same package name).
const (
	commandStatusPending int16 = 0
	commandStatusOk      int16 = 1
	commandStatusError   int16 = 2
)

// Hub manages OCPP charge point connections and inbound message routing.
// Each charge point subscribes to its own Redis pub/sub channel for external commands.
type Hub struct {
	mu          sync.RWMutex
	connections map[string]*ChargePoint // chargePointID → connection

	rdb redis.UniversalClient

	routers map[string]Router // ocpp version → router
}

func NewHub(rdb redis.UniversalClient) *Hub {
	return &Hub{
		connections: make(map[string]*ChargePoint),
		rdb:         rdb,
		routers:     make(map[string]Router),
	}
}

// RegisterRouter registers a version-specific router.
func (h *Hub) RegisterRouter(version string, router Router) {
	h.routers[version] = router
}

// RouterFor returns the router for the given OCPP version.
func (h *Hub) RouterFor(version string) Router {
	return h.routers[version]
}

// Register adds a charge point connection to this replica.
func (h *Hub) Register(ctx context.Context, cp *ChargePoint) {
	h.mu.Lock()
	h.connections[cp.Identity] = cp
	h.mu.Unlock()

	slog.InfoContext(ctx, "charger registered", "chargePointID", cp.Identity)
}

// Unregister removes a charge point connection from this replica.
func (h *Hub) Unregister(ctx context.Context, chargePointID string) {
	h.mu.Lock()
	delete(h.connections, chargePointID)
	h.mu.Unlock()

	slog.InfoContext(ctx, "charger unregistered", "chargePointID", chargePointID)
}

// GetLocal returns a locally connected charge point, or nil.
func (h *Hub) GetLocal(chargePointID string) *ChargePoint {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.connections[chargePointID]
}

// ListLocal returns all locally connected charge point IDs.
func (h *Hub) ListLocal() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()

	ids := make([]string, 0, len(h.connections))
	for id := range h.connections {
		ids = append(ids, id)
	}
	return ids
}

// HandleResponse processes the charger's CallResult for a CSMS-initiated command
// and persists relevant data (e.g. status columns) back to the database.
//
// This is called inside SubscribeChargePoint right after cp.Call() returns.
// cp.Call() is a blocking request-response: it sends the OCPP Call [2, ...],
// then waits (up to 30s) for the charger's CallResult [3, ...] to arrive
// via the WebSocket. Once cp.Call() unblocks, the response is already in hand,
// so we process it here as a normal return value — not as an async event.
func (h *Hub) HandleResponse(ctx context.Context, chargePointID string, action string, requestPayload json.RawMessage, responsePayload json.RawMessage) {
	switch action {
	case "GetLocalListVersion":
		var resp struct {
			ListVersion int `json:"listVersion"`
		}
		if err := json.Unmarshal(responsePayload, &resp); err != nil {
			slog.ErrorContext(ctx, "failed to parse GetLocalListVersion response", "error", err, "chargePointID", chargePointID)
			return
		}
		_, err := pgctx.Exec(ctx, `
			update ev_chargers
			set local_list_version = $2,
			    get_local_list_version_status = $3,
			    updated_at = now()
			where charge_point_id = $1
		`, chargePointID, resp.ListVersion, commandStatusOk)
		if err != nil {
			slog.ErrorContext(ctx, "failed to update local_list_version", "error", err, "chargePointID", chargePointID)
			return
		}
		slog.InfoContext(ctx, "updated local_list_version from charger", "chargePointID", chargePointID, "listVersion", resp.ListVersion)

	case "SendLocalList":
		var resp struct {
			Status string `json:"status"`
		}
		if err := json.Unmarshal(responsePayload, &resp); err != nil {
			slog.ErrorContext(ctx, "failed to parse SendLocalList response", "error", err, "chargePointID", chargePointID)
			return
		}
		status := commandStatusOk
		if resp.Status != "Accepted" {
			status = commandStatusError
			slog.WarnContext(ctx, "SendLocalList not accepted by charger", "chargePointID", chargePointID, "status", resp.Status)
			_, err := pgctx.Exec(ctx, `
				update ev_chargers
				set send_local_list_status = $2,
				    updated_at = now()
				where charge_point_id = $1
			`, chargePointID, status)
			if err != nil {
				slog.ErrorContext(ctx, "failed to update send_local_list_status", "error", err, "chargePointID", chargePointID)
			}
			return
		}
		var req struct {
			ListVersion int `json:"listVersion"`
		}
		if err := json.Unmarshal(requestPayload, &req); err != nil {
			slog.ErrorContext(ctx, "failed to parse SendLocalList request payload", "error", err, "chargePointID", chargePointID)
			return
		}
		_, err := pgctx.Exec(ctx, `
			update ev_chargers
			set local_list_version = $2,
			    send_local_list_status = $3,
			    updated_at = now()
			where charge_point_id = $1
		`, chargePointID, req.ListVersion, status)
		if err != nil {
			slog.ErrorContext(ctx, "failed to update local_list_version after SendLocalList", "error", err, "chargePointID", chargePointID)
			return
		}
		slog.InfoContext(ctx, "updated local_list_version after SendLocalList accepted", "chargePointID", chargePointID, "listVersion", req.ListVersion)

	case "UnlockConnector":
		var resp struct {
			Status string `json:"status"`
		}
		if err := json.Unmarshal(responsePayload, &resp); err != nil {
			slog.ErrorContext(ctx, "failed to parse UnlockConnector response", "error", err, "chargePointID", chargePointID)
			return
		}
		status := commandStatusOk
		if resp.Status != "Unlocked" {
			status = commandStatusError
		}
		_, err := pgctx.Exec(ctx, `
			update ev_chargers
			set unlock_connector_status = $2,
			    updated_at = now()
			where charge_point_id = $1
		`, chargePointID, status)
		if err != nil {
			slog.ErrorContext(ctx, "failed to update unlock_connector_status", "error", err, "chargePointID", chargePointID)
		}
		slog.InfoContext(ctx, "UnlockConnector response", "chargePointID", chargePointID, "status", resp.Status)

	case "ChangeAvailability":
		var resp struct {
			Status string `json:"status"`
		}
		if err := json.Unmarshal(responsePayload, &resp); err != nil {
			slog.ErrorContext(ctx, "failed to parse ChangeAvailability response", "error", err, "chargePointID", chargePointID)
			return
		}
		status := commandStatusOk
		if resp.Status != "Accepted" && resp.Status != "Scheduled" {
			status = commandStatusError
		}
		_, err := pgctx.Exec(ctx, `
			update ev_chargers
			set change_availability_status = $2,
			    updated_at = now()
			where charge_point_id = $1
		`, chargePointID, status)
		if err != nil {
			slog.ErrorContext(ctx, "failed to update change_availability_status", "error", err, "chargePointID", chargePointID)
		}
		slog.InfoContext(ctx, "ChangeAvailability response", "chargePointID", chargePointID, "status", resp.Status)

	case "ClearCache":
		var resp struct {
			Status string `json:"status"`
		}
		if err := json.Unmarshal(responsePayload, &resp); err != nil {
			slog.ErrorContext(ctx, "failed to parse ClearCache response", "error", err, "chargePointID", chargePointID)
			return
		}
		status := commandStatusOk
		if resp.Status != "Accepted" {
			status = commandStatusError
		}
		_, err := pgctx.Exec(ctx, `
			update ev_chargers
			set clear_cache_status = $2,
			    updated_at = now()
			where charge_point_id = $1
		`, chargePointID, status)
		if err != nil {
			slog.ErrorContext(ctx, "failed to update clear_cache_status", "error", err, "chargePointID", chargePointID)
		}
		slog.InfoContext(ctx, "ClearCache response", "chargePointID", chargePointID, "status", resp.Status)

	case "ChangeConfiguration":
		var resp struct {
			Status string `json:"status"`
		}
		if err := json.Unmarshal(responsePayload, &resp); err != nil {
			slog.ErrorContext(ctx, "failed to parse ChangeConfiguration response", "error", err, "chargePointID", chargePointID)
			return
		}
		status := commandStatusOk
		if resp.Status != "Accepted" && resp.Status != "RebootRequired" {
			status = commandStatusError
		}
		if resp.Status == "RebootRequired" {
			slog.WarnContext(ctx, "ChangeConfiguration requires reboot", "chargePointID", chargePointID, "status", resp.Status)
		}
		_, err := pgctx.Exec(ctx, `
			update ev_chargers
			set change_configuration_status = $2,
			    updated_at = now()
			where charge_point_id = $1
		`, chargePointID, status)
		if err != nil {
			slog.ErrorContext(ctx, "failed to update change_configuration_status", "error", err, "chargePointID", chargePointID)
		}
		slog.InfoContext(ctx, "ChangeConfiguration response", "chargePointID", chargePointID, "status", resp.Status)

	case "UpdateFirmware":
		_, err := pgctx.Exec(ctx, `
			update ev_chargers
			set update_firmware_status = $2,
			    updated_at = now()
			where charge_point_id = $1
		`, chargePointID, commandStatusOk)
		if err != nil {
			slog.ErrorContext(ctx, "failed to update update_firmware_status", "error", err, "chargePointID", chargePointID)
		}
		slog.InfoContext(ctx, "UpdateFirmware response", "chargePointID", chargePointID)

	case "GetDiagnostics":
		_, err := pgctx.Exec(ctx, `
			update ev_chargers
			set get_diagnostics_status = $2,
			    updated_at = now()
			where charge_point_id = $1
		`, chargePointID, commandStatusOk)
		if err != nil {
			slog.ErrorContext(ctx, "failed to update get_diagnostics_status", "error", err, "chargePointID", chargePointID)
		}
		slog.InfoContext(ctx, "GetDiagnostics response", "chargePointID", chargePointID)

	case "SetChargingProfile":
		var resp struct {
			Status string `json:"status"`
		}
		if err := json.Unmarshal(responsePayload, &resp); err != nil {
			slog.ErrorContext(ctx, "failed to parse SetChargingProfile response", "error", err, "chargePointID", chargePointID)
			return
		}
		status := commandStatusOk
		if resp.Status != "Accepted" {
			status = commandStatusError
		}
		_, err := pgctx.Exec(ctx, `
			update ev_chargers
			set set_charging_profile_status = $2,
			    updated_at = now()
			where charge_point_id = $1
		`, chargePointID, status)
		if err != nil {
			slog.ErrorContext(ctx, "failed to update set_charging_profile_status", "error", err, "chargePointID", chargePointID)
		}
		slog.InfoContext(ctx, "SetChargingProfile response", "chargePointID", chargePointID, "status", resp.Status)

	case "ClearChargingProfile":
		var resp struct {
			Status string `json:"status"`
		}
		if err := json.Unmarshal(responsePayload, &resp); err != nil {
			slog.ErrorContext(ctx, "failed to parse ClearChargingProfile response", "error", err, "chargePointID", chargePointID)
			return
		}
		status := commandStatusOk
		if resp.Status != "Accepted" {
			status = commandStatusError
		}
		_, err := pgctx.Exec(ctx, `
			update ev_chargers
			set clear_charging_profile_status = $2,
			    updated_at = now()
			where charge_point_id = $1
		`, chargePointID, status)
		if err != nil {
			slog.ErrorContext(ctx, "failed to update clear_charging_profile_status", "error", err, "chargePointID", chargePointID)
		}
		slog.InfoContext(ctx, "ClearChargingProfile response", "chargePointID", chargePointID, "status", resp.Status)

	case "GetCompositeSchedule":
		var resp struct {
			Status string `json:"status"`
		}
		if err := json.Unmarshal(responsePayload, &resp); err != nil {
			slog.ErrorContext(ctx, "failed to parse GetCompositeSchedule response", "error", err, "chargePointID", chargePointID)
			return
		}
		status := commandStatusOk
		if resp.Status != "Accepted" {
			status = commandStatusError
		}
		_, err := pgctx.Exec(ctx, `
			update ev_chargers
			set get_composite_schedule_status = $2,
			    updated_at = now()
			where charge_point_id = $1
		`, chargePointID, status)
		if err != nil {
			slog.ErrorContext(ctx, "failed to update get_composite_schedule_status", "error", err, "chargePointID", chargePointID)
		}
		slog.InfoContext(ctx, "GetCompositeSchedule response", "chargePointID", chargePointID, "status", resp.Status)

	case "ReserveNow":
		var resp struct {
			Status string `json:"status"`
		}
		if err := json.Unmarshal(responsePayload, &resp); err != nil {
			slog.ErrorContext(ctx, "failed to parse ReserveNow response", "error", err, "chargePointID", chargePointID)
			return
		}
		var req struct {
			ReservationID int `json:"reservationId"`
		}
		if err := json.Unmarshal(requestPayload, &req); err != nil {
			slog.ErrorContext(ctx, "failed to parse ReserveNow request payload", "error", err, "chargePointID", chargePointID)
			return
		}
		if resp.Status != "Accepted" {
			// mark reservation as cancelled if charger rejected it
			_, err := pgctx.Exec(ctx, `
				update ev_reservations
				set status = 'Cancelled',
				    updated_at = now()
				where charger_id = (select id from ev_chargers where charge_point_id = $1)
				  and reservation_id = $2
				  and status = 'Reserved'
			`, chargePointID, req.ReservationID)
			if err != nil {
				slog.ErrorContext(ctx, "failed to cancel rejected reservation", "error", err, "chargePointID", chargePointID)
			}
			slog.WarnContext(ctx, "ReserveNow not accepted by charger", "chargePointID", chargePointID, "status", resp.Status, "reservationId", req.ReservationID)
			return
		}
		slog.InfoContext(ctx, "ReserveNow accepted by charger", "chargePointID", chargePointID, "reservationId", req.ReservationID, "status", resp.Status)

	case "TriggerMessage":
		var resp struct {
			Status string `json:"status"`
		}
		if err := json.Unmarshal(responsePayload, &resp); err != nil {
			slog.ErrorContext(ctx, "failed to parse TriggerMessage response", "error", err, "chargePointID", chargePointID)
			return
		}
		status := commandStatusOk
		if resp.Status != "Accepted" {
			status = commandStatusError
		}
		_, err := pgctx.Exec(ctx, `
			update ev_chargers
			set trigger_message_status = $2,
			    updated_at = now()
			where charge_point_id = $1
		`, chargePointID, status)
		if err != nil {
			slog.ErrorContext(ctx, "failed to update trigger_message_status", "error", err, "chargePointID", chargePointID)
		}
		slog.InfoContext(ctx, "TriggerMessage response", "chargePointID", chargePointID, "status", resp.Status)

	case "CancelReservation":
		var resp struct {
			Status string `json:"status"`
		}
		if err := json.Unmarshal(responsePayload, &resp); err != nil {
			slog.ErrorContext(ctx, "failed to parse CancelReservation response", "error", err, "chargePointID", chargePointID)
			return
		}
		var req struct {
			ReservationID int `json:"reservationId"`
		}
		if err := json.Unmarshal(requestPayload, &req); err != nil {
			slog.ErrorContext(ctx, "failed to parse CancelReservation request payload", "error", err, "chargePointID", chargePointID)
			return
		}
		if resp.Status != "Accepted" {
			slog.WarnContext(ctx, "CancelReservation not accepted by charger", "chargePointID", chargePointID, "status", resp.Status, "reservationId", req.ReservationID)
			return
		}
		_, err := pgctx.Exec(ctx, `
			update ev_reservations
			set status = 'Cancelled',
			    updated_at = now()
			where charger_id = (select id from ev_chargers where charge_point_id = $1)
			  and reservation_id = $2
			  and status = 'Reserved'
		`, chargePointID, req.ReservationID)
		if err != nil {
			slog.ErrorContext(ctx, "failed to update reservation status after cancel", "error", err, "chargePointID", chargePointID)
		}
		slog.InfoContext(ctx, "CancelReservation accepted by charger", "chargePointID", chargePointID, "reservationId", req.ReservationID)
	}
}

// command is a message received from Redis pub/sub to execute on a charge point.
type command struct {
	Action  string          `json:"action"`
	Payload json.RawMessage `json:"payload"`
}

// SubscribeChargePoint subscribes to the Redis channel for a specific charge point
// and forwards incoming commands to the charger via ChargePoint.Call.
// Blocks until ctx is cancelled.
func (h *Hub) SubscribeChargePoint(ctx context.Context, cp *ChargePoint) {
	channel := "ocpp:cp:" + cp.Identity
	sub := h.rdb.Subscribe(ctx, channel)
	defer sub.Close()

	slog.InfoContext(ctx, "subscribed to chargepoint channel", "chargePointID", cp.Identity, "channel", channel)

	for msg := range sub.Channel() {
		var cmd command
		if err := json.Unmarshal([]byte(msg.Payload), &cmd); err != nil {
			slog.ErrorContext(ctx, "invalid command on chargepoint channel", "error", err, "chargePointID", cp.Identity)
			continue
		}

		go func() {
			raw, err := cp.Call(ctx, cmd.Action, cmd.Payload)
			if err != nil {
				slog.ErrorContext(ctx, "command failed", "error", err, "chargePointID", cp.Identity, "action", cmd.Action)
				return
			}
			slog.InfoContext(ctx, "command executed", "chargePointID", cp.Identity, "action", cmd.Action, "response", string(raw))

			h.HandleResponse(ctx, cp.Identity, cmd.Action, cmd.Payload, raw)
		}()
	}
}
