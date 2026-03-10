package core

import (
	"context"
	"time"
)

// StatusNotificationParams matches OCPP 1.6 StatusNotification.req
type StatusNotificationParams struct {
	ConnectorID int    `json:"connectorId"`
	ErrorCode   string `json:"errorCode"`
	Status      string `json:"status"`
	Info        string `json:"info"`
	Timestamp   string `json:"timestamp"`

	ChargePointID string `json:"-"`
}

// StatusNotificationResult matches OCPP 1.6 StatusNotification.conf
type StatusNotificationResult struct{}

func StatusNotification(ctx context.Context, p StatusNotificationParams) (*StatusNotificationResult, error) {
	ts := time.Now()
	if p.Timestamp != "" {
		if parsed, err := time.Parse(time.RFC3339, p.Timestamp); err == nil {
			ts = parsed
		}
	}

	// connectorId 0 = charge point itself, update ev_chargers.status
	if p.ConnectorID == 0 {
		if err := UpdateChargerStatus(ctx, p.ChargePointID, p.Status); err != nil {
			return nil, err
		}
	} else {
		if err := UpsertConnectorStatus(ctx, p.ChargePointID, p.ConnectorID, p.Status, p.ErrorCode, p.Info, ts); err != nil {
			return nil, err
		}
	}

	return &StatusNotificationResult{}, nil
}

// BootNotificationParams matches OCPP 1.6 BootNotification.req
type BootNotificationParams struct {
	ChargePointVendor       string `json:"chargePointVendor"`
	ChargePointModel        string `json:"chargePointModel"`
	ChargePointSerialNumber string `json:"chargePointSerialNumber"`
	FirmwareVersion         string `json:"firmwareVersion"`

	ChargePointID string `json:"-"`
}

// BootNotificationResult matches OCPP 1.6 BootNotification.conf
type BootNotificationResult struct {
	Status      string `json:"status"`
	CurrentTime string `json:"currentTime"`
	Interval    int    `json:"interval"`
}

func BootNotification(ctx context.Context, p BootNotificationParams) (*BootNotificationResult, error) {
	return &BootNotificationResult{
		Status:   "Accepted",
		Interval: 60,
	}, nil
}

// HeartbeatParams matches OCPP 1.6 Heartbeat.req
type HeartbeatParams struct {
	ChargePointID string `json:"-"`
}

// HeartbeatResult matches OCPP 1.6 Heartbeat.conf
type HeartbeatResult struct {
	CurrentTime string `json:"currentTime"`
}

func Heartbeat(ctx context.Context, p HeartbeatParams) (*HeartbeatResult, error) {
	return &HeartbeatResult{}, nil
}

// StartTransactionParams matches OCPP 1.6 StartTransaction.req
type StartTransactionParams struct {
	ConnectorID   int    `json:"connectorId"`
	IdTag         string `json:"idTag"`
	MeterStart    int    `json:"meterStart"`
	Timestamp     string `json:"timestamp"`
	ReservationID *int   `json:"reservationId,omitempty"`

	ChargePointID string `json:"-"`
}

// StartTransactionResult matches OCPP 1.6 StartTransaction.conf
type StartTransactionResult struct {
	TransactionID int       `json:"transactionId"`
	IdTagInfo     IdTagInfo `json:"idTagInfo"`
}

func StartTransaction(ctx context.Context, p StartTransactionParams) (*StartTransactionResult, error) {
	// TODO: create charging session, return transactionId
	return &StartTransactionResult{
		TransactionID: 1,
		IdTagInfo:     IdTagInfo{Status: "Accepted"},
	}, nil
}

// StopTransactionParams matches OCPP 1.6 StopTransaction.req
type StopTransactionParams struct {
	TransactionID int    `json:"transactionId"`
	IdTag         string `json:"idTag"`
	MeterStop     int    `json:"meterStop"`
	Timestamp     string `json:"timestamp"`
	Reason        string `json:"reason"`

	ChargePointID string `json:"-"`
}

// StopTransactionResult matches OCPP 1.6 StopTransaction.conf
type StopTransactionResult struct {
	IdTagInfo IdTagInfo `json:"idTagInfo"`
}

func StopTransaction(ctx context.Context, p StopTransactionParams) (*StopTransactionResult, error) {
	// TODO: close charging session
	return &StopTransactionResult{
		IdTagInfo: IdTagInfo{Status: "Accepted"},
	}, nil
}

// MeterValuesParams matches OCPP 1.6 MeterValues.req
type MeterValuesParams struct {
	ConnectorID   int              `json:"connectorId"`
	TransactionID *int             `json:"transactionId,omitempty"`
	MeterValue    []MeterValueItem `json:"meterValue"`

	ChargePointID string `json:"-"`
}

type MeterValueItem struct {
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

// MeterValuesResult matches OCPP 1.6 MeterValues.conf
type MeterValuesResult struct{}

func MeterValues(ctx context.Context, p MeterValuesParams) (*MeterValuesResult, error) {
	// TODO: parse meter values, insert into readings via Redis publish
	return &MeterValuesResult{}, nil
}

// IdTagInfo is a common OCPP 1.6 type
type IdTagInfo struct {
	Status string `json:"status"`
}
