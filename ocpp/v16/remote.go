package v16

import (
	"context"
	"encoding/json"

	"github.com/anertic/anertic/ocpp"
)

// Outbound command actions (server → charger)
const (
	ActionRemoteStart         = "RemoteStartTransaction"
	ActionRemoteStop          = "RemoteStopTransaction"
	ActionReset               = "Reset"
	ActionGetConfiguration    = "GetConfiguration"
	ActionChangeConfiguration = "ChangeConfiguration"
	ActionClearCache          = "ClearCache"
	ActionUnlockConnector     = "UnlockConnector"
	ActionChangeAvailability  = "ChangeAvailability"
	ActionSetChargingProfile  = "SetChargingProfile"
	ActionTriggerMessage      = "TriggerMessage"
	ActionGetDiagnostics      = "GetDiagnostics"
	ActionUpdateFirmware      = "UpdateFirmware"
	ActionDataTransfer        = "DataTransfer"
)

func executeRemoteCommand(ctx context.Context, cp *ocpp.ChargePoint, cmd *ocpp.Command) (*ocpp.CommandResponse, error) {
	switch cmd.Action {
	case ActionRemoteStart:
		return remoteStartTransaction(ctx, cp, cmd)
	case ActionRemoteStop:
		return remoteStopTransaction(ctx, cp, cmd)
	case ActionReset:
		return sendSimpleCommand(ctx, cp, cmd, "Reset")
	case ActionGetConfiguration:
		return sendSimpleCommand(ctx, cp, cmd, "GetConfiguration")
	case ActionChangeConfiguration:
		return sendSimpleCommand(ctx, cp, cmd, "ChangeConfiguration")
	case ActionClearCache:
		return sendSimpleCommand(ctx, cp, cmd, "ClearCache")
	case ActionUnlockConnector:
		return sendSimpleCommand(ctx, cp, cmd, "UnlockConnector")
	case ActionChangeAvailability:
		return sendSimpleCommand(ctx, cp, cmd, "ChangeAvailability")
	case ActionSetChargingProfile:
		return sendSimpleCommand(ctx, cp, cmd, "SetChargingProfile")
	case ActionTriggerMessage:
		return sendSimpleCommand(ctx, cp, cmd, "TriggerMessage")
	case ActionGetDiagnostics:
		return sendSimpleCommand(ctx, cp, cmd, "GetDiagnostics")
	case ActionUpdateFirmware:
		return sendSimpleCommand(ctx, cp, cmd, "UpdateFirmware")
	case ActionDataTransfer:
		return sendSimpleCommand(ctx, cp, cmd, "DataTransfer")
	default:
		return &ocpp.CommandResponse{
			RequestID: cmd.RequestID,
			Error:     "unsupported action: " + cmd.Action,
		}, nil
	}
}

func sendSimpleCommand(ctx context.Context, cp *ocpp.ChargePoint, cmd *ocpp.Command, action string) (*ocpp.CommandResponse, error) {
	raw, err := cp.Call(ctx, action, cmd.Payload)
	if err != nil {
		return nil, err
	}

	var result map[string]any
	json.Unmarshal(raw, &result)

	status, _ := result["status"].(string)
	return &ocpp.CommandResponse{
		RequestID: cmd.RequestID,
		Status:    status,
		Payload:   result,
	}, nil
}

func remoteStartTransaction(ctx context.Context, cp *ocpp.ChargePoint, cmd *ocpp.Command) (*ocpp.CommandResponse, error) {
	idTag, _ := cmd.Payload["idTag"].(string)
	if idTag == "" {
		idTag = "default"
	}

	connectorID, _ := cmd.Payload["connectorId"].(float64)

	payload := map[string]any{
		"idTag": idTag,
	}
	if connectorID > 0 {
		payload["connectorId"] = int(connectorID)
	}
	if profile, ok := cmd.Payload["chargingProfile"]; ok {
		payload["chargingProfile"] = profile
	}

	raw, err := cp.Call(ctx, "RemoteStartTransaction", payload)
	if err != nil {
		return nil, err
	}

	var result map[string]any
	json.Unmarshal(raw, &result)

	status, _ := result["status"].(string)
	return &ocpp.CommandResponse{
		RequestID: cmd.RequestID,
		Status:    status,
		Payload:   result,
	}, nil
}

func remoteStopTransaction(ctx context.Context, cp *ocpp.ChargePoint, cmd *ocpp.Command) (*ocpp.CommandResponse, error) {
	txID, _ := cmd.Payload["transactionId"].(float64)

	raw, err := cp.Call(ctx, "RemoteStopTransaction", map[string]any{
		"transactionId": int(txID),
	})
	if err != nil {
		return nil, err
	}

	var result map[string]any
	json.Unmarshal(raw, &result)

	status, _ := result["status"].(string)
	return &ocpp.CommandResponse{
		RequestID: cmd.RequestID,
		Status:    status,
		Payload:   result,
	}, nil
}
