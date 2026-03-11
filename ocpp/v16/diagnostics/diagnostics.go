package diagnostics

import (
	"context"

	"github.com/anertic/anertic/ocpp"
)

// StatusParams matches OCPP 1.6 DiagnosticsStatusNotification.req
type StatusParams struct {
	Status string `json:"status"` // Idle, Uploaded, UploadFailed, Uploading
}

// StatusResult matches OCPP 1.6 DiagnosticsStatusNotification.conf
type StatusResult struct{}

func StatusNotification(ctx context.Context, p *StatusParams) (*StatusResult, error) {
	_ = ocpp.ChargePointID(ctx)

	// TODO: update diagnostics upload status

	return &StatusResult{}, nil
}
