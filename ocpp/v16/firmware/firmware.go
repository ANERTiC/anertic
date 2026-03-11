package firmware

import (
	"context"

	"github.com/anertic/anertic/ocpp"
)

// StatusParams matches OCPP 1.6 FirmwareStatusNotification.req
type StatusParams struct {
	Status string `json:"status"` // Downloaded, DownloadFailed, Downloading, Idle, InstallationFailed, Installing, Installed
}

// StatusResult matches OCPP 1.6 FirmwareStatusNotification.conf
type StatusResult struct{}

func StatusNotification(ctx context.Context, p *StatusParams) (*StatusResult, error) {
	_ = ocpp.ChargePointID(ctx)

	// TODO: update firmware update status

	return &StatusResult{}, nil
}
