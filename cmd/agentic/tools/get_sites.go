package tools

import (
	"context"
	"encoding/json"
	"fmt"
)

type getSitesTool struct {
	api Invoker
}

// NewGetSites creates a tool that lists all sites the user has access to.
func NewGetSites(api Invoker) Tool {
	return &getSitesTool{api: api}
}

func (t *getSitesTool) Name() string { return "get_sites" }

func (t *getSitesTool) Description() string {
	return "Returns all energy monitoring sites the authenticated user has access to."
}

func (t *getSitesTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {},
		"required": []
	}`)
}

func (t *getSitesTool) Execute(ctx context.Context, token string, _ json.RawMessage) (string, error) {
	var result json.RawMessage
	if err := t.api.Invoke(ctx, token, "site.list", map[string]any{}, &result); err != nil {
		return "", fmt.Errorf("get_sites: %w", err)
	}
	return string(result), nil
}
