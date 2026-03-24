package llm

import (
	"context"
	"encoding/json"
)

// Message represents a conversation message for the LLM.
type Message struct {
	Role       string      `json:"role"`
	Content    string      `json:"content"`
	ToolCalls  []ToolCall  `json:"toolCalls"`
	ToolResult *ToolResult `json:"toolResult"`
}

// ToolCall represents an LLM request to call a tool.
type ToolCall struct {
	ID    string          `json:"id"`
	Name  string          `json:"name"`
	Input json.RawMessage `json:"input"`
}

// ToolResult represents the output of a tool execution.
type ToolResult struct {
	ToolCallID string `json:"toolCallId"`
	Content    string `json:"content"`
	IsError    bool   `json:"isError"`
}

// StreamEvent is emitted during streaming.
type StreamEvent struct {
	Type       string      `json:"type"`
	Text       string      `json:"text"`
	ToolCall   *ToolCall   `json:"toolCall"`
	ToolResult *ToolResult `json:"toolResult"`
	Error      string      `json:"error"`
}

// Tool defines a tool the LLM can call.
type Tool struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	InputSchema json.RawMessage `json:"inputSchema"`
}

// StreamOpts configures a streaming LLM call.
type StreamOpts struct {
	Model     string
	System    string
	Messages  []Message
	Tools     []Tool
	MaxTokens int
	Prefill   string
}

// Provider is the interface for LLM backends.
type Provider interface {
	Stream(ctx context.Context, opts StreamOpts) (<-chan StreamEvent, error)
}
