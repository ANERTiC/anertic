package transaction

import (
	"context"
	"log/slog"
	"time"

	"github.com/acoshift/pgsql/pgctx"
	"github.com/rs/xid"
	"github.com/shopspring/decimal"

	"github.com/anertic/anertic/ocpp"
	"github.com/anertic/anertic/ocpp/v16/authorize"
)

// IdTagInfo is a common OCPP 1.6 type.
type IdTagInfo struct {
	Status      string `json:"status"` // Accepted, Blocked, Expired, Invalid, ConcurrentTx
	ExpiryDate  string `json:"expiryDate,omitempty"`
	ParentIdTag string `json:"parentIdTag,omitempty"`
}

// MeterValue embedded in StopTransaction
type MeterValue struct {
	Timestamp    string         `json:"timestamp"`
	SampledValue []SampledValue `json:"sampledValue"`
}

type SampledValue struct {
	Value     string `json:"value"`
	Context   string `json:"context,omitempty"`
	Format    string `json:"format,omitempty"`
	Measurand string `json:"measurand,omitempty"`
	Phase     string `json:"phase,omitempty"`
	Location  string `json:"location,omitempty"`
	Unit      string `json:"unit,omitempty"`
}

// StartParams matches OCPP 1.6 StartTransaction.req
type StartParams struct {
	ConnectorID   int    `json:"connectorId"`
	IdTag         string `json:"idTag"`
	MeterStart    int    `json:"meterStart"`
	Timestamp     string `json:"timestamp"`
	ReservationID *int   `json:"reservationId,omitempty"`
}

// StartResult matches OCPP 1.6 StartTransaction.conf
type StartResult struct {
	TransactionID int       `json:"transactionId"`
	IdTagInfo     IdTagInfo `json:"idTagInfo"`
}

func Start(ctx context.Context, p *StartParams) (*StartResult, error) {
	chargePointID := ocpp.ChargePointID(ctx)

	// validate idTag
	authResult, err := authorize.Authorize(ctx, &authorize.Params{IdTag: p.IdTag})
	if err != nil {
		return nil, err
	}
	if authResult.IdTagInfo.Status != "Accepted" {
		return &StartResult{
			TransactionID: 0,
			IdTagInfo: IdTagInfo{
				Status:      authResult.IdTagInfo.Status,
				ExpiryDate:  authResult.IdTagInfo.ExpiryDate,
				ParentIdTag: authResult.IdTagInfo.ParentIdTag,
			},
		}, nil
	}

	startTime := time.Now()
	if p.Timestamp != "" {
		if parsed, err := time.Parse(time.RFC3339, p.Timestamp); err == nil {
			startTime = parsed
		}
	}

	// create charging session, update connector, and reservation atomically
	id := xid.New().String()
	var transactionID int
	err = pgctx.RunInTx(ctx, func(ctx context.Context) error {
		err := pgctx.QueryRow(ctx, `
			insert into ev_charging_sessions (
				id,
				charger_id,
				connector_id,
				id_tag,
				reservation_id,
				start_time,
				meter_start
			)
			select
				$1,
				ec.id,
				$2,
				$3,
				$4,
				$5,
				$6
			from ev_chargers ec
			where ec.charge_point_id = $7
			returning transaction_id
		`,
			id,
			p.ConnectorID,
			p.IdTag,
			p.ReservationID,
			startTime,
			p.MeterStart,
			chargePointID,
		).Scan(
			&transactionID,
		)
		if err != nil {
			return err
		}

		// update connector status to Charging
		_, err = pgctx.Exec(ctx, `
			update ev_connectors
			set status = 'Charging',
				updated_at = now()
			where charger_id = (select id from ev_chargers where charge_point_id = $1)
				and connector_id = $2
		`,
			chargePointID,
			p.ConnectorID,
		)
		if err != nil {
			return err
		}

		// if reservation was used, mark it as Used
		if p.ReservationID != nil {
			_, err = pgctx.Exec(ctx, `
				update ev_reservations
				set status = 'Used',
					updated_at = now()
				where charger_id = (select id from ev_chargers where charge_point_id = $1)
					and reservation_id = $2
					and status = 'Reserved'
			`,
				chargePointID,
				*p.ReservationID,
			)
			if err != nil {
				return err
			}
		}

		return nil
	})

	slog.InfoContext(ctx, "start transaction",
		"chargePointID", chargePointID,
		"transactionId", transactionID,
		"connectorId", p.ConnectorID,
		"idTag", p.IdTag,
		"meterStart", p.MeterStart,
	)

	return &StartResult{
		TransactionID: transactionID,
		IdTagInfo: IdTagInfo{
			Status:      authResult.IdTagInfo.Status,
			ExpiryDate:  authResult.IdTagInfo.ExpiryDate,
			ParentIdTag: authResult.IdTagInfo.ParentIdTag,
		},
	}, nil
}

// StopParams matches OCPP 1.6 StopTransaction.req
type StopParams struct {
	TransactionID   int          `json:"transactionId"`
	IdTag           string       `json:"idTag"`
	MeterStop       int          `json:"meterStop"`
	Timestamp       string       `json:"timestamp"`
	Reason          string       `json:"reason"` // EmergencyStop, EVDisconnected, HardReset, Local, Other, PowerLoss, Reboot, Remote, SoftReset, UnlockCommand, DeAuthorized
	TransactionData []MeterValue `json:"transactionData,omitempty"`
}

// StopResult matches OCPP 1.6 StopTransaction.conf
type StopResult struct {
	IdTagInfo *IdTagInfo `json:"idTagInfo,omitempty"`
}

func Stop(ctx context.Context, p *StopParams) (*StopResult, error) {
	chargePointID := ocpp.ChargePointID(ctx)

	endTime := time.Now()
	if p.Timestamp != "" {
		if parsed, err := time.Parse(time.RFC3339, p.Timestamp); err == nil {
			endTime = parsed
		}
	}

	// close charging session
	var meterStart int
	var chargerID string
	var connectorID int
	err := pgctx.QueryRow(ctx, `
		update ev_charging_sessions
		set end_time = $1,
			meter_stop = $2,
			energy_kwh = ($2 - meter_start)::numeric / 1000.0,
			stop_reason = $3,
			metadata = metadata
		where transaction_id = $4
		returning meter_start, charger_id, connector_id
	`,
		endTime,
		p.MeterStop,
		p.Reason,
		p.TransactionID,
	).Scan(
		&meterStart,
		&chargerID,
		&connectorID,
	)
	if err != nil {
		return nil, err
	}

	energyKwh := decimal.NewFromInt(int64(p.MeterStop - meterStart)).Div(decimal.NewFromInt(1000))

	// update connector status to Available
	_, err = pgctx.Exec(ctx, `
		update ev_connectors
		set status = 'Available',
			updated_at = now()
		where charger_id = $1
			and connector_id = $2
	`,
		chargerID,
		connectorID,
	)
	if err != nil {
		slog.ErrorContext(ctx, "failed to update connector status",
			"error", err,
			"chargePointID", chargePointID,
			"connectorId", connectorID,
		)
	}

	// store transactionData meter values
	if len(p.TransactionData) > 0 {
		insertMeterValues(ctx, chargerID, connectorID, p.TransactionID, p.TransactionData)
	}

	// validate idTag if provided
	var idTagInfo *IdTagInfo
	if p.IdTag != "" {
		authResult, err := authorize.Authorize(ctx, &authorize.Params{IdTag: p.IdTag})
		if err != nil {
			slog.ErrorContext(ctx, "failed to validate idTag on stop",
				"error", err,
				"chargePointID", chargePointID,
				"idTag", p.IdTag,
			)
		} else {
			idTagInfo = &IdTagInfo{
				Status:      authResult.IdTagInfo.Status,
				ExpiryDate:  authResult.IdTagInfo.ExpiryDate,
				ParentIdTag: authResult.IdTagInfo.ParentIdTag,
			}
		}
	}

	slog.InfoContext(ctx, "stop transaction",
		"chargePointID", chargePointID,
		"transactionId", p.TransactionID,
		"meterStop", p.MeterStop,
		"energyKwh", energyKwh,
		"reason", p.Reason,
	)

	return &StopResult{
		IdTagInfo: idTagInfo,
	}, nil
}

func insertMeterValues(ctx context.Context, chargerID string, connectorID, transactionID int, meterValues []MeterValue) {
	for _, mv := range meterValues {
		ts := time.Now()
		if mv.Timestamp != "" {
			if parsed, err := time.Parse(time.RFC3339, mv.Timestamp); err == nil {
				ts = parsed
			}
		}

		for _, sv := range mv.SampledValue {
			value, err := decimal.NewFromString(sv.Value)
			if err != nil {
				slog.ErrorContext(ctx, "invalid meter value",
					"error", err,
					"value", sv.Value,
					"measurand", sv.Measurand,
				)
				continue
			}

			measurand := sv.Measurand
			if measurand == "" {
				measurand = "Energy.Active.Import.Register"
			}

			unit := sv.Unit
			if unit == "" {
				unit = "Wh"
			}

			context_ := sv.Context
			if context_ == "" {
				context_ = "Sample.Periodic"
			}

			location := sv.Location
			if location == "" {
				location = "Outlet"
			}

			format := sv.Format
			if format == "" {
				format = "Raw"
			}

			_, err = pgctx.Exec(ctx, `
				insert into ev_meter_values (
					time,
					charger_id,
					connector_id,
					transaction_id,
					measurand,
					phase,
					value,
					unit,
					context,
					location,
					format
				)
				values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
			`,
				ts,
				chargerID,
				connectorID,
				transactionID,
				measurand,
				sv.Phase,
				value,
				unit,
				context_,
				location,
				format,
			)
			if err != nil {
				slog.ErrorContext(ctx, "failed to insert meter value",
					"error", err,
					"chargerID", chargerID,
					"measurand", measurand,
				)
			}
		}
	}
}
