package charger

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"time"

	"github.com/acoshift/pgsql"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/acoshift/pgsql/pgstmt"
	"github.com/moonrhythm/validator"
	"github.com/rs/xid"

	"github.com/anertic/anertic/api/iam"
	"github.com/anertic/anertic/pkg/ocpp"
)

// ReserveNow

type ReserveNowParams struct {
	ID            string    `json:"id"`
	ConnectorID   int       `json:"connectorId"`
	ExpiryDate    time.Time `json:"expiryDate"`
	IdTag         string    `json:"idTag"`
	ParentIdTag   string    `json:"parentIdTag"`
	ReservationID int       `json:"reservationId"`
}

func (p *ReserveNowParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	v.Must(p.ConnectorID >= 0, "connectorId must be >= 0")
	v.Must(!p.ExpiryDate.IsZero(), "expiryDate is required")
	v.Must(p.ExpiryDate.After(time.Now()), "expiryDate must be in the future")
	v.Must(p.IdTag != "", "idTag is required")
	v.Must(p.ReservationID > 0, "reservationId must be > 0")
	return v.Error()
}

type ReserveNowResult struct {
	ID string `json:"id"`
}

func ReserveNow(ctx context.Context, p *ReserveNowParams) (*ReserveNowResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var chargePointID, siteID, chargerID string
	err := pgctx.QueryRow(ctx, `
		select
			charge_point_id,
			site_id,
			id
		from ev_chargers
		where id = $1
	`, p.ID).Scan(
		&chargePointID,
		&siteID,
		&chargerID,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, siteID); err != nil {
		return nil, err
	}

	recordID := xid.New().String()
	_, err = pgctx.Exec(ctx, `
		insert into ev_reservations (
			id,
			charger_id,
			connector_id,
			reservation_id,
			id_tag,
			parent_id_tag,
			expiry_date,
			status
		) values ($1, $2, $3, $4, $5, $6, $7, 'Reserved')
		on conflict (charger_id, reservation_id) do update set
			connector_id = excluded.connector_id,
			id_tag = excluded.id_tag,
			parent_id_tag = excluded.parent_id_tag,
			expiry_date = excluded.expiry_date,
			status = 'Reserved',
			updated_at = now()
	`,
		recordID,
		chargerID,
		p.ConnectorID,
		p.ReservationID,
		p.IdTag,
		nullableString(p.ParentIdTag),
		p.ExpiryDate,
	)
	if err != nil {
		return nil, err
	}

	type reserveNowPayload struct {
		ConnectorID   int    `json:"connectorId"`
		ExpiryDate    string `json:"expiryDate"`
		IdTag         string `json:"idTag"`
		ParentIdTag   string `json:"parentIdTag,omitempty"`
		ReservationID int    `json:"reservationId"`
	}

	pl := reserveNowPayload{
		ConnectorID:   p.ConnectorID,
		ExpiryDate:    p.ExpiryDate.UTC().Format(time.RFC3339),
		IdTag:         p.IdTag,
		ReservationID: p.ReservationID,
	}
	if p.ParentIdTag != "" {
		pl.ParentIdTag = p.ParentIdTag
	}

	payload, err := json.Marshal(pl)
	if err != nil {
		return nil, err
	}

	if err := ocpp.SendCommand(ctx, chargePointID, "ReserveNow", payload); err != nil {
		return nil, err
	}

	return &ReserveNowResult{ID: recordID}, nil
}

// CancelReservation

type CancelReservationParams struct {
	ID            string `json:"id"`
	ReservationID int    `json:"reservationId"`
}

func (p *CancelReservationParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	v.Must(p.ReservationID > 0, "reservationId must be > 0")
	return v.Error()
}

type CancelReservationResult struct{}

func CancelReservation(ctx context.Context, p *CancelReservationParams) (*CancelReservationResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var chargePointID, siteID string
	err := pgctx.QueryRow(ctx, `
		select
			charge_point_id,
			site_id
		from ev_chargers
		where id = $1
	`, p.ID).Scan(
		&chargePointID,
		&siteID,
	)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, siteID); err != nil {
		return nil, err
	}

	payload, err := json.Marshal(struct {
		ReservationID int `json:"reservationId"`
	}{
		ReservationID: p.ReservationID,
	})
	if err != nil {
		return nil, err
	}

	if err := ocpp.SendCommand(ctx, chargePointID, "CancelReservation", payload); err != nil {
		return nil, err
	}

	return &CancelReservationResult{}, nil
}

// ListReservations

type ListReservationsParams struct {
	ID string `json:"id"`
}

func (p *ListReservationsParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

type ReservationItem struct {
	ID            string    `json:"id"`
	ConnectorID   int       `json:"connectorId"`
	ReservationID int       `json:"reservationId"`
	IdTag         string    `json:"idTag"`
	ParentIdTag   string    `json:"parentIdTag"`
	ExpiryDate    time.Time `json:"expiryDate"`
	Status        string    `json:"status"`
	CreatedAt     time.Time `json:"createdAt"`
	UpdatedAt     time.Time `json:"updatedAt"`
}

type ListReservationsResult struct {
	Items []ReservationItem `json:"items"`
}

func ListReservations(ctx context.Context, p *ListReservationsParams) (*ListReservationsResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}

	var siteID string
	err := pgctx.QueryRow(ctx, `
		select site_id
		from ev_chargers
		where id = $1
	`, p.ID).Scan(&siteID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}

	if err := iam.InSite(ctx, siteID); err != nil {
		return nil, err
	}

	items := make([]ReservationItem, 0)
	err = pgstmt.Select(func(b pgstmt.SelectStatement) {
		b.Columns(
			"r.id",
			"r.connector_id",
			"r.reservation_id",
			"r.id_tag",
			"r.parent_id_tag",
			"r.expiry_date",
			"r.status",
			"r.created_at",
			"r.updated_at",
		)
		b.From("ev_reservations r")
		b.Where(func(c pgstmt.Cond) {
			c.Eq("r.charger_id", p.ID)
		})
		b.OrderBy("r.created_at DESC")
	}).IterWith(ctx, func(scan pgsql.Scanner) error {
		var it ReservationItem
		if err := scan(
			&it.ID,
			&it.ConnectorID,
			&it.ReservationID,
			&it.IdTag,
			pgsql.NullString(&it.ParentIdTag),
			&it.ExpiryDate,
			&it.Status,
			&it.CreatedAt,
			&it.UpdatedAt,
		); err != nil {
			return err
		}
		items = append(items, it)
		return nil
	})
	if err != nil {
		return nil, err
	}

	return &ListReservationsResult{Items: items}, nil
}

// nullableString returns nil if s is empty, or a pointer to s otherwise.
// Used to store optional string fields as NULL in the database.
func nullableString(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}
