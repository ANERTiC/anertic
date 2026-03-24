package tools

import (
	"context"
	"encoding/json"
	"fmt"
)

type getUserProfileTool struct {
	api Invoker
}

// NewGetUserProfile creates a tool that returns the authenticated user's profile.
func NewGetUserProfile(api Invoker) Tool {
	return &getUserProfileTool{api: api}
}

func (t *getUserProfileTool) Name() string { return "get_user_profile" }

func (t *getUserProfileTool) Description() string {
	return "Returns the authenticated user's profile including name, email, and role."
}

func (t *getUserProfileTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {},
		"required": []
	}`)
}

func (t *getUserProfileTool) Execute(ctx context.Context, token string, _ json.RawMessage) (string, error) {
	var result json.RawMessage
	if err := t.api.Invoke(ctx, token, "auth.me", nil, &result); err != nil {
		return "", fmt.Errorf("get_user_profile: %w", err)
	}
	return string(result), nil
}
