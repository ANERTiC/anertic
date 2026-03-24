package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/acoshift/arpc/v2"
)

// APIClient calls the ANERTiC REST API.
type APIClient struct {
	baseURL    string
	httpClient *http.Client
}

// NewAPIClient creates an APIClient targeting baseURL.
func NewAPIClient(baseURL string) *APIClient {
	return &APIClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

// Invoke POSTs to baseURL/method with the given body and decodes the result into out.
func (c *APIClient) Invoke(ctx context.Context, token, method string, body any, out any) error {
	var bodyBytes []byte
	var err error
	if body == nil {
		bodyBytes = []byte("{}")
	} else {
		bodyBytes, err = json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request: %w", err)
		}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/"+method, bytes.NewReader(bodyBytes))
	if err != nil {
		return fmt.Errorf("new request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Authorization", "Bearer "+token)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	var envelope struct {
		OK     bool            `json:"ok"`
		Result json.RawMessage `json:"result"`
		Error  json.RawMessage `json:"error"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&envelope); err != nil {
		return fmt.Errorf("decode response (status %d): %w", resp.StatusCode, err)
	}
	if !envelope.OK {
		// arpc error can be {"code":"...","message":"..."} or {"message":"..."} or {}
		var errObj struct {
			Code    string `json:"code"`
			Message string `json:"message"`
		}
		json.Unmarshal(envelope.Error, &errObj)
		if errObj.Code != "" {
			msg := errObj.Message
			if msg == "" {
				msg = errObj.Code
			}
			return arpc.NewErrorCode(errObj.Code, msg)
		}
		if errObj.Message != "" {
			return arpc.NewErrorCode("unknown", errObj.Message)
		}
		return arpc.NewErrorCode("unknown", fmt.Sprintf("api error: %s", string(envelope.Error)))
	}
	if out != nil && len(envelope.Result) > 0 {
		if err := json.Unmarshal(envelope.Result, out); err != nil {
			return fmt.Errorf("unmarshal result: %w", err)
		}
	}
	return nil
}
