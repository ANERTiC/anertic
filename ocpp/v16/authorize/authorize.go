package authorize

import (
	"context"
	"database/sql"
	"errors"
	"time"

	"github.com/acoshift/pgsql/pgctx"

	"github.com/anertic/anertic/ocpp"
)

// Params matches OCPP 1.6 Authorize.req
type Params struct {
	IdTag string `json:"idTag"`
}

// Result matches OCPP 1.6 Authorize.conf
type Result struct {
	IdTagInfo IdTagInfo `json:"idTagInfo"`
}

type IdTagInfo struct {
	Status      string `json:"status"` // Accepted, Blocked, Expired, Invalid, ConcurrentTx
	ExpiryDate  string `json:"expiryDate,omitempty"`
	ParentIdTag string `json:"parentIdTag,omitempty"`
}

func Authorize(ctx context.Context, p *Params) (*Result, error) {
	_ = ocpp.ChargePointID(ctx)

	info, err := validateIdTag(ctx, p.IdTag)
	if err != nil {
		return nil, err
	}

	return &Result{
		IdTagInfo: *info,
	}, nil
}

// validateIdTag looks up an idTag in ev_authorization_tags and returns its status.
// Returns Invalid if the tag does not exist.
func validateIdTag(ctx context.Context, idTag string) (*IdTagInfo, error) {
	var status string
	var expiryDate sql.NullTime
	var parentIdTag sql.NullString

	err := pgctx.QueryRow(ctx, `
		select
			status,
			expiry_date,
			parent_id_tag
		from ev_authorization_tags
		where id_tag = $1
	`,
		idTag,
	).Scan(
		&status,
		&expiryDate,
		&parentIdTag,
	)

	if errors.Is(err, sql.ErrNoRows) {
		return &IdTagInfo{Status: "Invalid"}, nil
	}
	if err != nil {
		return nil, err
	}

	// check expiry
	if expiryDate.Valid && expiryDate.Time.Before(time.Now()) {
		status = "Expired"
	}

	info := &IdTagInfo{
		Status: status,
	}
	if expiryDate.Valid {
		info.ExpiryDate = expiryDate.Time.UTC().Format(time.RFC3339)
	}
	if parentIdTag.Valid {
		info.ParentIdTag = parentIdTag.String
	}

	return info, nil
}
