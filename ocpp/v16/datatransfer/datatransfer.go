package datatransfer

import (
	"context"

	"github.com/anertic/anertic/ocpp"
)

// Params matches OCPP 1.6 DataTransfer.req
type Params struct {
	VendorID  string `json:"vendorId"`
	MessageID string `json:"messageId,omitempty"`
	Data      string `json:"data,omitempty"`
}

// Result matches OCPP 1.6 DataTransfer.conf
type Result struct {
	Status string `json:"status"` // Accepted, Rejected, UnknownMessageId, UnknownVendorId
	Data   string `json:"data,omitempty"`
}

func DataTransfer(ctx context.Context, p *Params) (*Result, error) {
	_ = ocpp.ChargePointID(ctx)

	// TODO: handle vendor-specific data transfer

	return &Result{
		Status: "Accepted",
	}, nil
}
