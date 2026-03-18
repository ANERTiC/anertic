package charger

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"

	"github.com/acoshift/pgsql/pgctx"
	"github.com/moonrhythm/validator"

	"github.com/anertic/anertic/api/iam"
	"github.com/anertic/anertic/pkg/ocpp"
)

// GetLocalListVersion

type GetLocalListVersionParams struct {
	ID string `json:"id"`
}

func (p *GetLocalListVersionParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

type GetLocalListVersionResult struct {
	ListVersion int `json:"listVersion"`
}

func GetLocalListVersion(ctx context.Context, p *GetLocalListVersionParams) (*GetLocalListVersionResult, error) {
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

	payload, err := json.Marshal(struct{}{})
	if err != nil {
		return nil, err
	}

	if err := ocpp.SendCommand(ctx, chargePointID, "GetLocalListVersion", payload); err != nil {
		return nil, err
	}

	var listVersion int
	err = pgctx.QueryRow(ctx, `
		select
			local_list_version
		from ev_chargers
		where id = $1
	`, p.ID).Scan(&listVersion)
	if err != nil {
		return nil, err
	}

	return &GetLocalListVersionResult{ListVersion: listVersion}, nil
}

// SendLocalList

type IdTagInfo struct {
	Status      string  `json:"status"`
	ExpiryDate  *string `json:"expiryDate"`
	ParentIdTag *string `json:"parentIdTag"`
}

type AuthorizationData struct {
	IdTag     string     `json:"idTag"`
	IdTagInfo *IdTagInfo `json:"idTagInfo"`
}

type SendLocalListParams struct {
	ID                     string              `json:"id"`
	ListVersion            int                 `json:"listVersion"`
	UpdateType             string              `json:"updateType"`
	LocalAuthorizationList []AuthorizationData `json:"localAuthorizationList"`
}

func (p *SendLocalListParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	v.Must(p.ListVersion >= 0, "listVersion must be >= 0")
	v.Must(p.UpdateType == "Full" || p.UpdateType == "Differential", "updateType must be Full or Differential")
	return v.Error()
}

type SendLocalListResult struct {
	Status string `json:"status"`
}

func SendLocalList(ctx context.Context, p *SendLocalListParams) (*SendLocalListResult, error) {
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

	type sendLocalListPayload struct {
		ListVersion            int                 `json:"listVersion"`
		UpdateType             string              `json:"updateType"`
		LocalAuthorizationList []AuthorizationData `json:"localAuthorizationList"`
	}

	list := p.LocalAuthorizationList
	if list == nil {
		list = []AuthorizationData{}
	}

	payload, err := json.Marshal(sendLocalListPayload{
		ListVersion:            p.ListVersion,
		UpdateType:             p.UpdateType,
		LocalAuthorizationList: list,
	})
	if err != nil {
		return nil, err
	}

	if err := ocpp.SendCommand(ctx, chargePointID, "SendLocalList", payload); err != nil {
		return nil, err
	}

	return &SendLocalListResult{Status: "Accepted"}, nil
}
