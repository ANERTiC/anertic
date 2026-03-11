package authorize

import (
	"context"

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

	// TODO: validate idTag against authorization list / backend
	// TODO: check if tag is blocked, expired, etc.

	return &Result{
		IdTagInfo: IdTagInfo{Status: "Accepted"},
	}, nil
}
