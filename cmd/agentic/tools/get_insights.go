package tools

import (
	"context"
	"encoding/json"
	"fmt"
)

type getInsightsTool struct {
	api Invoker
}

// NewGetInsights creates a tool that retrieves AI insights for a site.
func NewGetInsights(api Invoker) Tool {
	return &getInsightsTool{api: api}
}

func (t *getInsightsTool) Name() string { return "get_insights" }

func (t *getInsightsTool) Description() string {
	return "Returns AI-generated energy insights summary and detected anomalies for a specific site."
}

func (t *getInsightsTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"site_id": {
				"type": "string",
				"description": "The ID of the site to query"
			}
		},
		"required": ["site_id"]
	}`)
}

type getInsightsInput struct {
	SiteID string `json:"site_id"`
}

func (t *getInsightsTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p getInsightsInput
	if err := json.Unmarshal(input, &p); err != nil {
		return "", fmt.Errorf("get_insights: invalid input: %w", err)
	}
	if p.SiteID == "" {
		return "", fmt.Errorf("get_insights: site_id is required")
	}

	body := map[string]any{"siteId": p.SiteID}

	var summary json.RawMessage
	if err := t.api.Invoke(ctx, token, "insight.summary", body, &summary); err != nil {
		return "", fmt.Errorf("get_insights: insight.summary: %w", err)
	}

	var anomalies json.RawMessage
	if err := t.api.Invoke(ctx, token, "insight.anomalies", body, &anomalies); err != nil {
		return "", fmt.Errorf("get_insights: insight.anomalies: %w", err)
	}

	out, err := json.Marshal(map[string]json.RawMessage{
		"summary":   summary,
		"anomalies": anomalies,
	})
	if err != nil {
		return "", fmt.Errorf("get_insights: marshal result: %w", err)
	}
	return string(out), nil
}
