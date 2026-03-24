# Agentic Chat Service Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Go service that provides AI-powered chat for ANERTiC end users, with configurable LLM providers and tools that call the existing API.

**Architecture:** New binary `cmd/agentic` using parapet HTTP server with SSE streaming. LLM provider abstraction in `pkg/llm/` with Anthropic and OpenAI implementations. Tools in `cmd/agentic/tools/` call the ANERTiC API via HTTP with the user's Bearer token. Chat history persisted in PostgreSQL.

**Tech Stack:** Go 1.25 (go.mod), Go 1.26 (Dockerfiles), parapet, configfile, pgctx/pgstmt, anthropic-sdk-go, openai-go, xid, SSE

**Spec:** `docs/superpowers/specs/2026-03-24-agentic-chat-service-design.md`

---

### Task 1: Database Schema

**Files:**
- Create: `schema/0009_agentic.sql`

- [ ] **Step 1: Create the schema file**

```sql
-- schema/0009_agentic.sql

create table if not exists conversations (
    id varchar(20) not null,
    site_id varchar(20) not null references sites (id),
    user_id varchar(20) not null references users (id),
    title text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (id)
);

create index if not exists idx_conversations_site_user
    on conversations (site_id, user_id, created_at desc);

create table if not exists conversation_messages (
    id varchar(20) not null,
    conversation_id varchar(20) not null references conversations (id),
    role text not null,
    content text not null,
    tool_name text,
    tool_call_id text,
    tool_input text,
    created_at timestamptz not null default now(),
    primary key (id)
);

create index if not exists idx_conversation_messages_conversation_id
    on conversation_messages (conversation_id, created_at);
```

- [ ] **Step 2: Verify schema applies cleanly**

Run: `make dev-up && go run ./cmd/api` (exits after migration)
Expected: No migration errors. Tables `conversations` and `conversation_messages` created.

- [ ] **Step 3: Commit**

```bash
git add schema/0009_agentic.sql
git commit -m "feat(agentic): add conversations schema"
```

---

### Task 2: LLM Provider Interface

**Files:**
- Create: `pkg/llm/llm.go`

- [ ] **Step 1: Create the provider interface and types**

```go
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
	Type       string      `json:"type"` // "text", "tool_call", "done", "error"
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
}

// Provider is the interface for LLM backends.
type Provider interface {
	Stream(ctx context.Context, opts StreamOpts) (<-chan StreamEvent, error)
}
```

- [ ] **Step 2: Verify it compiles**

Run: `go build ./pkg/llm/`
Expected: Success, no errors.

- [ ] **Step 3: Commit**

```bash
git add pkg/llm/llm.go
git commit -m "feat(llm): add provider interface and types"
```

---

### Task 3: Anthropic Provider

**Files:**
- Create: `pkg/llm/anthropic/provider.go`

- [ ] **Step 1: Install the Anthropic SDK**

Run: `go get github.com/anthropics/anthropic-sdk-go`

- [ ] **Step 2: Create the Anthropic provider**

```go
package anthropic

import (
	"context"
	"encoding/json"
	"fmt"

	anthropicv1 "github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"

	"github.com/anertic/anertic/pkg/llm"
)

type Provider struct {
	client *anthropicv1.Client
}

func New(apiKey string) *Provider {
	return &Provider{
		client: anthropicv1.NewClient(option.WithAPIKey(apiKey)),
	}
}

func (p *Provider) Stream(ctx context.Context, opts llm.StreamOpts) (<-chan llm.StreamEvent, error) {
	ch := make(chan llm.StreamEvent, 64)

	messages := convertMessages(opts.Messages)
	tools := convertTools(opts.Tools)

	params := anthropicv1.MessageNewParams{
		Model:     anthropicv1.Model(opts.Model),
		MaxTokens: int64(opts.MaxTokens),
		Messages:  messages,
		Tools:     tools,
	}
	if opts.System != "" {
		params.System = []anthropicv1.TextBlockParam{
			anthropicv1.NewTextBlock(opts.System),
		}
	}

	// Enable adaptive thinking for Claude 4.6 models
	adaptive := anthropicv1.NewThinkingConfigAdaptiveParam()
	params.Thinking = anthropicv1.ThinkingConfigParamUnion{OfAdaptive: &adaptive}

	go func() {
		defer close(ch)

		stream := p.client.Messages.NewStreaming(ctx, params)
		msg := anthropicv1.Message{}

		for stream.Next() {
			event := stream.Current()
			msg.Accumulate(event)

			switch ev := event.AsAny().(type) {
			case anthropicv1.ContentBlockDeltaEvent:
				switch delta := ev.Delta.AsAny().(type) {
				case anthropicv1.TextDelta:
					if delta.Text != "" {
						ch <- llm.StreamEvent{Type: "text", Text: delta.Text}
					}
				}
			}
		}

		if err := stream.Err(); err != nil {
			ch <- llm.StreamEvent{Type: "error", Error: err.Error()}
			return
		}

		// Extract tool calls from the accumulated message
		for _, block := range msg.Content {
			switch v := block.AsAny().(type) {
			case anthropicv1.ToolUseBlock:
				inputBytes, _ := json.Marshal(v.Input)
				ch <- llm.StreamEvent{
					Type: "tool_call",
					ToolCall: &llm.ToolCall{
						ID:    block.ID,
						Name:  v.Name,
						Input: inputBytes,
					},
				}
			}
		}

		if msg.StopReason == anthropicv1.StopReasonToolUse {
			return // caller will re-invoke after executing tools
		}

		ch <- llm.StreamEvent{Type: "done"}
	}()

	return ch, nil
}

func convertMessages(msgs []llm.Message) []anthropicv1.MessageParam {
	var out []anthropicv1.MessageParam
	for _, m := range msgs {
		switch m.Role {
		case "user":
			out = append(out, anthropicv1.NewUserMessage(anthropicv1.NewTextBlock(m.Content)))
		case "assistant":
			blocks := []anthropicv1.ContentBlockParamUnion{
				anthropicv1.NewTextBlock(m.Content),
			}
			for _, tc := range m.ToolCalls {
				var input any
				json.Unmarshal(tc.Input, &input)
				blocks = append(blocks, anthropicv1.ContentBlockParamUnion{
					OfToolUse: &anthropicv1.ToolUseBlockParam{
						ID:    tc.ID,
						Name:  tc.Name,
						Input: input,
					},
				})
			}
			out = append(out, anthropicv1.MessageParam{
				Role:    anthropicv1.MessageParamRoleAssistant,
				Content: blocks,
			})
		case "tool_result":
			if m.ToolResult != nil {
				out = append(out, anthropicv1.NewUserMessage(
					anthropicv1.NewToolResultBlock(m.ToolResult.ToolCallID, m.ToolResult.Content, m.ToolResult.IsError),
				))
			}
		}
	}
	return out
}

func convertTools(tools []llm.Tool) []anthropicv1.ToolUnionParam {
	var out []anthropicv1.ToolUnionParam
	for _, t := range tools {
		var props map[string]any
		json.Unmarshal(t.InputSchema, &props)

		out = append(out, anthropicv1.ToolUnionParam{
			OfTool: &anthropicv1.ToolParam{
				Name:        t.Name,
				Description: anthropicv1.String(t.Description),
				InputSchema: anthropicv1.ToolInputSchemaParam{
					Properties: props,
				},
			},
		})
	}
	return out
}
```

Note: The `InputSchema` conversion may need adjustment based on exact JSON schema structure. The tool's `InputSchema` is a full JSON schema object with `type`, `properties`, `required` — it needs to be mapped to `ToolInputSchemaParam` fields. Verify at integration time.

- [ ] **Step 3: Verify it compiles**

Run: `go build ./pkg/llm/anthropic/`
Expected: Success after `go mod tidy`.

- [ ] **Step 4: Commit**

```bash
git add pkg/llm/anthropic/provider.go go.mod go.sum
git commit -m "feat(llm): add Anthropic streaming provider"
```

---

### Task 4: OpenAI Provider

**Files:**
- Create: `pkg/llm/openai/provider.go`

- [ ] **Step 1: Install the OpenAI SDK**

Run: `go get github.com/openai/openai-go`

- [ ] **Step 2: Create the OpenAI provider**

```go
package openai

import (
	"context"
	"encoding/json"

	openaiv1 "github.com/openai/openai-go"
	"github.com/openai/openai-go/option"

	"github.com/anertic/anertic/pkg/llm"
)

type Provider struct {
	client  *openaiv1.Client
	baseURL string
}

func New(apiKey string, baseURL string) *Provider {
	opts := []option.RequestOption{
		option.WithAPIKey(apiKey),
	}
	if baseURL != "" {
		opts = append(opts, option.WithBaseURL(baseURL))
	}
	return &Provider{
		client:  openaiv1.NewClient(opts...),
		baseURL: baseURL,
	}
}

func (p *Provider) Stream(ctx context.Context, opts llm.StreamOpts) (<-chan llm.StreamEvent, error) {
	ch := make(chan llm.StreamEvent, 64)

	messages := convertMessages(opts.System, opts.Messages)
	tools := convertTools(opts.Tools)

	params := openaiv1.ChatCompletionNewParams{
		Model:    openaiv1.ChatModel(opts.Model),
		Messages: messages,
	}
	if opts.MaxTokens > 0 {
		params.MaxCompletionTokens = openaiv1.Int(int64(opts.MaxTokens))
	}
	if len(tools) > 0 {
		params.Tools = tools
	}

	go func() {
		defer close(ch)

		stream := p.client.Chat.Completions.NewStreaming(ctx, params)
		acc := openaiv1.ChatCompletionAccumulator{}

		for stream.Next() {
			chunk := stream.Current()
			acc.AddChunk(chunk)

			for _, choice := range chunk.Choices {
				if choice.Delta.Content != "" {
					ch <- llm.StreamEvent{Type: "text", Text: choice.Delta.Content}
				}
			}
		}

		if err := stream.Err(); err != nil {
			ch <- llm.StreamEvent{Type: "error", Error: err.Error()}
			return
		}

		// Extract tool calls from accumulated response
		if len(acc.Choices) > 0 {
			for _, tc := range acc.Choices[0].Message.ToolCalls {
				ch <- llm.StreamEvent{
					Type: "tool_call",
					ToolCall: &llm.ToolCall{
						ID:    tc.ID,
						Name:  tc.Function.Name,
						Input: json.RawMessage(tc.Function.Arguments),
					},
				}
			}

			if acc.Choices[0].FinishReason == "tool_calls" {
				return // caller will re-invoke after executing tools
			}
		}

		ch <- llm.StreamEvent{Type: "done"}
	}()

	return ch, nil
}

func convertMessages(system string, msgs []llm.Message) []openaiv1.ChatCompletionMessageParamUnion {
	var out []openaiv1.ChatCompletionMessageParamUnion

	if system != "" {
		out = append(out, openaiv1.SystemMessage(system))
	}

	for _, m := range msgs {
		switch m.Role {
		case "user":
			out = append(out, openaiv1.UserMessage(m.Content))
		case "assistant":
			if len(m.ToolCalls) > 0 {
				var tcs []openaiv1.ChatCompletionMessageToolCall
				for _, tc := range m.ToolCalls {
					tcs = append(tcs, openaiv1.ChatCompletionMessageToolCall{
						ID:   tc.ID,
						Type: "function",
						Function: openaiv1.ChatCompletionMessageToolCallFunction{
							Name:      tc.Name,
							Arguments: string(tc.Input),
						},
					})
				}
				out = append(out, openaiv1.ChatCompletionMessageParamUnion{
					OfAssistant: &openaiv1.ChatCompletionAssistantMessageParam{
						Content: openaiv1.ChatCompletionAssistantMessageParamContentUnion{
							OfString: openaiv1.String(m.Content),
						},
						ToolCalls: tcs,
					},
				})
			} else {
				out = append(out, openaiv1.AssistantMessage(m.Content))
			}
		case "tool_result":
			if m.ToolResult != nil {
				out = append(out, openaiv1.ToolMessage(m.ToolResult.ToolCallID, m.ToolResult.Content))
			}
		}
	}
	return out
}

func convertTools(tools []llm.Tool) []openaiv1.ChatCompletionToolParam {
	var out []openaiv1.ChatCompletionToolParam
	for _, t := range tools {
		var schema map[string]any
		json.Unmarshal(t.InputSchema, &schema)

		out = append(out, openaiv1.ChatCompletionToolParam{
			Type: "function",
			Function: openaiv1.FunctionDefinitionParam{
				Name:        t.Name,
				Description: openaiv1.String(t.Description),
				Parameters:  openaiv1.FunctionParameters(schema),
			},
		})
	}
	return out
}
```

Note: The OpenAI SDK types may vary slightly from what's shown. The `openai-go` SDK uses union types similar to Anthropic's. Verify exact field names and constructors at compile time and adjust.

- [ ] **Step 3: Verify it compiles**

Run: `go build ./pkg/llm/openai/`
Expected: Success after `go mod tidy`.

- [ ] **Step 4: Commit**

```bash
git add pkg/llm/openai/provider.go go.mod go.sum
git commit -m "feat(llm): add OpenAI/Ollama streaming provider"
```

---

### Task 5: API Client (Invoke Pattern)

**Files:**
- Create: `cmd/agentic/apiclient.go`

This is the HTTP client that tools use to call the ANERTiC API. It wraps the arpc envelope `{ok: true, result: ...}`.

- [ ] **Step 1: Create the API client**

```go
package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

type APIClient struct {
	baseURL    string
	httpClient *http.Client
}

func NewAPIClient(baseURL string) *APIClient {
	return &APIClient{
		baseURL: baseURL,
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}
}

type envelope struct {
	OK     bool            `json:"ok"`
	Result json.RawMessage `json:"result"`
	Error  *envelopeError  `json:"error"`
}

type envelopeError struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// Invoke calls an arpc endpoint (POST /{method}) with the given token and body,
// and unmarshals the result from the arpc envelope into out.
func (c *APIClient) Invoke(ctx context.Context, token string, method string, body any, out any) error {
	var reqBody io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request: %w", err)
		}
		reqBody = bytes.NewReader(b)
	} else {
		reqBody = bytes.NewReader([]byte("{}"))
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/"+method, reqBody)
	if err != nil {
		return fmt.Errorf("create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("do request: %w", err)
	}
	defer resp.Body.Close()

	var env envelope
	if err := json.NewDecoder(resp.Body).Decode(&env); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}

	if !env.OK {
		if env.Error != nil {
			return fmt.Errorf("api error: %s: %s", env.Error.Code, env.Error.Message)
		}
		return fmt.Errorf("api error: unknown")
	}

	if out != nil {
		if err := json.Unmarshal(env.Result, out); err != nil {
			return fmt.Errorf("unmarshal result: %w", err)
		}
	}

	return nil
}
```

- [ ] **Step 2: Verify it compiles**

Run: `go build ./cmd/agentic/`
Expected: Success.

- [ ] **Step 3: Commit**

```bash
git add cmd/agentic/apiclient.go
git commit -m "feat(agentic): add API client with invoke pattern"
```

---

### Task 6: Tool Interface & Registry

**Files:**
- Create: `cmd/agentic/tools/tools.go`

- [ ] **Step 1: Create the tool interface and registry**

```go
package tools

import (
	"context"
	"encoding/json"

	"github.com/anertic/anertic/pkg/llm"
)

// Tool defines a callable tool for the agent.
type Tool interface {
	Name() string
	Description() string
	InputSchema() json.RawMessage
	Execute(ctx context.Context, token string, input json.RawMessage) (string, error)
}

// Registry holds all registered tools.
type Registry struct {
	tools []Tool
}

func NewRegistry(tools ...Tool) *Registry {
	return &Registry{tools: tools}
}

// LLMTools converts registered tools to the LLM tool format.
func (r *Registry) LLMTools() []llm.Tool {
	out := make([]llm.Tool, len(r.tools))
	for i, t := range r.tools {
		out[i] = llm.Tool{
			Name:        t.Name(),
			Description: t.Description(),
			InputSchema: t.InputSchema(),
		}
	}
	return out
}

// Get returns a tool by name, or nil if not found.
func (r *Registry) Get(name string) Tool {
	for _, t := range r.tools {
		if t.Name() == name {
			return t
		}
	}
	return nil
}
```

- [ ] **Step 2: Verify it compiles**

Run: `go build ./cmd/agentic/tools/`
Expected: Success.

- [ ] **Step 3: Commit**

```bash
git add cmd/agentic/tools/tools.go
git commit -m "feat(agentic): add tool interface and registry"
```

---

### Task 7: Implement 7 Tools

**Files:**
- Create: `cmd/agentic/tools/get_sites.go`
- Create: `cmd/agentic/tools/get_device_status.go`
- Create: `cmd/agentic/tools/list_devices.go`
- Create: `cmd/agentic/tools/list_rooms.go`
- Create: `cmd/agentic/tools/query_energy.go`
- Create: `cmd/agentic/tools/get_insights.go`
- Create: `cmd/agentic/tools/get_charger_status.go`

Each tool needs access to the API client. Since `APIClient` is in package `main` (cmd/agentic), tools can't import it directly. Tools should accept an `Invoker` interface:

- [ ] **Step 1: Add Invoker interface to tools package**

Add to `cmd/agentic/tools/tools.go`:

```go
// Invoker calls the ANERTiC API.
type Invoker interface {
	Invoke(ctx context.Context, token string, method string, body any, out any) error
}
```

- [ ] **Step 2: Create get_sites tool**

```go
// cmd/agentic/tools/get_sites.go
package tools

import (
	"context"
	"encoding/json"
)

type getSitesTool struct {
	api Invoker
}

func NewGetSites(api Invoker) Tool {
	return &getSitesTool{api: api}
}

func (t *getSitesTool) Name() string { return "get_sites" }

func (t *getSitesTool) Description() string {
	return "List all sites the user has access to. Returns site name, address, timezone, and ID."
}

func (t *getSitesTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {},
		"required": []
	}`)
}

func (t *getSitesTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var result json.RawMessage
	if err := t.api.Invoke(ctx, token, "site.list", map[string]any{}, &result); err != nil {
		return "", err
	}
	return string(result), nil
}
```

- [ ] **Step 3: Create get_device_status tool**

```go
// cmd/agentic/tools/get_device_status.go
package tools

import (
	"context"
	"encoding/json"
)

type getDeviceStatusTool struct {
	api Invoker
}

func NewGetDeviceStatus(api Invoker) Tool {
	return &getDeviceStatusTool{api: api}
}

func (t *getDeviceStatusTool) Name() string { return "get_device_status" }

func (t *getDeviceStatusTool) Description() string {
	return "Get all devices and their online/offline status for a site. Includes meter readings and last seen time. Requires site_id."
}

func (t *getDeviceStatusTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"site_id": {
				"type": "string",
				"description": "The site ID to get device status for"
			}
		},
		"required": ["site_id"]
	}`)
}

func (t *getDeviceStatusTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p struct {
		SiteID string `json:"site_id"`
	}
	if err := json.Unmarshal(input, &p); err != nil {
		return "", err
	}

	var devices json.RawMessage
	if err := t.api.Invoke(ctx, token, "device.list", map[string]any{"siteId": p.SiteID}, &devices); err != nil {
		return "", err
	}

	var meters json.RawMessage
	if err := t.api.Invoke(ctx, token, "meter.list", map[string]any{"siteId": p.SiteID}, &meters); err != nil {
		return "", err
	}

	result, _ := json.Marshal(map[string]json.RawMessage{
		"devices": devices,
		"meters":  meters,
	})
	return string(result), nil
}
```

- [ ] **Step 4: Create list_devices tool**

```go
// cmd/agentic/tools/list_devices.go
package tools

import (
	"context"
	"encoding/json"
)

type listDevicesTool struct {
	api Invoker
}

func NewListDevices(api Invoker) Tool {
	return &listDevicesTool{api: api}
}

func (t *listDevicesTool) Name() string { return "list_devices" }

func (t *listDevicesTool) Description() string {
	return "List all devices for a site with type, brand, model, and active status. Requires site_id."
}

func (t *listDevicesTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"site_id": {
				"type": "string",
				"description": "The site ID to list devices for"
			}
		},
		"required": ["site_id"]
	}`)
}

func (t *listDevicesTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p struct {
		SiteID string `json:"site_id"`
	}
	if err := json.Unmarshal(input, &p); err != nil {
		return "", err
	}

	var result json.RawMessage
	if err := t.api.Invoke(ctx, token, "device.list", map[string]any{"siteId": p.SiteID}, &result); err != nil {
		return "", err
	}
	return string(result), nil
}
```

- [ ] **Step 5: Create list_rooms tool**

```go
// cmd/agentic/tools/list_rooms.go
package tools

import (
	"context"
	"encoding/json"
)

type listRoomsTool struct {
	api Invoker
}

func NewListRooms(api Invoker) Tool {
	return &listRoomsTool{api: api}
}

func (t *listRoomsTool) Name() string { return "list_rooms" }

func (t *listRoomsTool) Description() string {
	return "List all rooms for a site with their assigned devices. Requires site_id."
}

func (t *listRoomsTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"site_id": {
				"type": "string",
				"description": "The site ID to list rooms for"
			}
		},
		"required": ["site_id"]
	}`)
}

func (t *listRoomsTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p struct {
		SiteID string `json:"site_id"`
	}
	if err := json.Unmarshal(input, &p); err != nil {
		return "", err
	}

	var result json.RawMessage
	if err := t.api.Invoke(ctx, token, "room.list", map[string]any{"siteId": p.SiteID}, &result); err != nil {
		return "", err
	}
	return string(result), nil
}
```

- [ ] **Step 6: Create query_energy tool**

```go
// cmd/agentic/tools/query_energy.go
package tools

import (
	"context"
	"encoding/json"
)

type queryEnergyTool struct {
	api Invoker
}

func NewQueryEnergy(api Invoker) Tool {
	return &queryEnergyTool{api: api}
}

func (t *queryEnergyTool) Name() string { return "query_energy" }

func (t *queryEnergyTool) Description() string {
	return "Query energy reading data for a site over a time range. Returns power, energy, voltage, current readings. Requires site_id. Optional: device_id, meter_id, start_time (RFC3339), end_time (RFC3339), interval (raw, hourly, daily)."
}

func (t *queryEnergyTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"site_id": {
				"type": "string",
				"description": "The site ID"
			},
			"device_id": {
				"type": "string",
				"description": "Optional device ID to filter readings"
			},
			"meter_id": {
				"type": "string",
				"description": "Optional meter ID to filter readings"
			},
			"start_time": {
				"type": "string",
				"description": "Start time in RFC3339 format (e.g. 2026-03-24T00:00:00Z)"
			},
			"end_time": {
				"type": "string",
				"description": "End time in RFC3339 format (e.g. 2026-03-24T23:59:59Z)"
			},
			"interval": {
				"type": "string",
				"enum": ["raw", "hourly", "daily"],
				"description": "Aggregation interval. Default: hourly"
			}
		},
		"required": ["site_id"]
	}`)
}

func (t *queryEnergyTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p map[string]any
	if err := json.Unmarshal(input, &p); err != nil {
		return "", err
	}

	// Map snake_case tool params to camelCase API params
	body := map[string]any{"siteId": p["site_id"]}
	if v, ok := p["device_id"]; ok {
		body["deviceId"] = v
	}
	if v, ok := p["meter_id"]; ok {
		body["meterId"] = v
	}
	if v, ok := p["start_time"]; ok {
		body["startTime"] = v
	}
	if v, ok := p["end_time"]; ok {
		body["endTime"] = v
	}
	if v, ok := p["interval"]; ok {
		body["interval"] = v
	}

	var result json.RawMessage
	if err := t.api.Invoke(ctx, token, "reading.query", body, &result); err != nil {
		return "", err
	}
	return string(result), nil
}
```

- [ ] **Step 7: Create get_insights tool**

```go
// cmd/agentic/tools/get_insights.go
package tools

import (
	"context"
	"encoding/json"
)

type getInsightsTool struct {
	api Invoker
}

func NewGetInsights(api Invoker) Tool {
	return &getInsightsTool{api: api}
}

func (t *getInsightsTool) Name() string { return "get_insights" }

func (t *getInsightsTool) Description() string {
	return "Get AI-generated insights, anomalies, energy summary, and recommendations for a site. Includes daily energy breakdown, CO2 savings, energy score, and detected anomalies. Requires site_id."
}

func (t *getInsightsTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"site_id": {
				"type": "string",
				"description": "The site ID to get insights for"
			}
		},
		"required": ["site_id"]
	}`)
}

func (t *getInsightsTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p struct {
		SiteID string `json:"site_id"`
	}
	if err := json.Unmarshal(input, &p); err != nil {
		return "", err
	}

	var summary json.RawMessage
	if err := t.api.Invoke(ctx, token, "insight.summary", map[string]any{"siteId": p.SiteID}, &summary); err != nil {
		return "", err
	}

	var anomalies json.RawMessage
	if err := t.api.Invoke(ctx, token, "insight.anomalies", map[string]any{"siteId": p.SiteID}, &anomalies); err != nil {
		return "", err
	}

	result, _ := json.Marshal(map[string]json.RawMessage{
		"summary":   summary,
		"anomalies": anomalies,
	})
	return string(result), nil
}
```

- [ ] **Step 8: Create get_charger_status tool**

```go
// cmd/agentic/tools/get_charger_status.go
package tools

import (
	"context"
	"encoding/json"
)

type getChargerStatusTool struct {
	api Invoker
}

func NewGetChargerStatus(api Invoker) Tool {
	return &getChargerStatusTool{api: api}
}

func (t *getChargerStatusTool) Name() string { return "get_charger_status" }

func (t *getChargerStatusTool) Description() string {
	return "Get EV charger status and connector info for a site. Shows charger availability, active sessions, and connector states. Requires site_id."
}

func (t *getChargerStatusTool) InputSchema() json.RawMessage {
	return json.RawMessage(`{
		"type": "object",
		"properties": {
			"site_id": {
				"type": "string",
				"description": "The site ID to get charger status for"
			}
		},
		"required": ["site_id"]
	}`)
}

func (t *getChargerStatusTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	var p struct {
		SiteID string `json:"site_id"`
	}
	if err := json.Unmarshal(input, &p); err != nil {
		return "", err
	}

	var chargers json.RawMessage
	if err := t.api.Invoke(ctx, token, "charger.list", map[string]any{"siteId": p.SiteID}, &chargers); err != nil {
		return "", err
	}

	var connectors json.RawMessage
	if err := t.api.Invoke(ctx, token, "connector.list", map[string]any{"siteId": p.SiteID}, &connectors); err != nil {
		return "", err
	}

	result, _ := json.Marshal(map[string]json.RawMessage{
		"chargers":   chargers,
		"connectors": connectors,
	})
	return string(result), nil
}
```

- [ ] **Step 9: Verify all tools compile**

Run: `go build ./cmd/agentic/tools/`
Expected: Success.

- [ ] **Step 10: Commit**

```bash
git add cmd/agentic/tools/
git commit -m "feat(agentic): implement 7 tools (sites, devices, rooms, energy, insights, chargers)"
```

---

### Task 8: System Prompt

**Files:**
- Create: `cmd/agentic/system_prompt.go`

- [ ] **Step 1: Create the system prompt builder**

```go
package main

import (
	"fmt"
	"time"
)

type SiteContext struct {
	ID       string
	Name     string
	Timezone string
	Currency string
}

func buildSystemPrompt(site *SiteContext) string {
	now := time.Now()
	if site.Timezone != "" {
		if loc, err := time.LoadLocation(site.Timezone); err == nil {
			now = now.In(loc)
		}
	}

	return fmt.Sprintf(`You are an AI energy assistant for ANERTiC, an energy monitoring platform.
You help users understand their energy usage, device status, EV chargers, and provide recommendations to optimize energy consumption and reduce costs.

Current context:
- Site: %s (ID: %s)
- Timezone: %s
- Currency: %s
- Current time: %s

Guidelines:
- Be concise and helpful
- Use the available tools to fetch real data before answering questions
- When discussing energy, use kWh for energy and kW for power
- Format numbers with appropriate precision (e.g. 12.5 kWh, not 12.456789 kWh)
- When users ask about time periods like "today" or "last week", calculate the correct dates based on the current time above
- If you don't have enough data to answer, say so and suggest what the user can check
- Proactively suggest energy-saving recommendations when relevant`,
		site.Name, site.ID, site.Timezone, site.Currency,
		now.Format("2006-01-02 15:04:05 MST"))
}
```

- [ ] **Step 2: Verify it compiles**

Run: `go build ./cmd/agentic/`
Expected: Success.

- [ ] **Step 3: Commit**

```bash
git add cmd/agentic/system_prompt.go
git commit -m "feat(agentic): add system prompt builder with site context"
```

---

### Task 9: Agent Loop

**Files:**
- Create: `cmd/agentic/agent.go`

- [ ] **Step 1: Create the agentic loop orchestrator**

```go
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"

	"github.com/anertic/anertic/cmd/agentic/tools"
	"github.com/anertic/anertic/pkg/llm"
)

const maxToolIterations = 5

type Agent struct {
	provider llm.Provider
	registry *tools.Registry
	model    string
	maxTokens int
}

func NewAgent(provider llm.Provider, registry *tools.Registry, model string, maxTokens int) *Agent {
	return &Agent{
		provider:  provider,
		registry:  registry,
		model:     model,
		maxTokens: maxTokens,
	}
}

// SSEEvent is written to the SSE response stream.
type SSEEvent struct {
	Type    string `json:"type"`
	Content string `json:"content"`
	Name    string `json:"name"`
	Status  string `json:"status"`
	Error   string `json:"error"`
}

// RunCallback is called for each SSE event during the agent loop.
type RunCallback func(event SSEEvent)

// Run executes the agentic loop: call LLM, execute tools, repeat until done.
// It calls cb for each SSE event to stream to the client.
// Returns the full assistant text and all messages produced during this run.
func (a *Agent) Run(ctx context.Context, token string, systemPrompt string, history []llm.Message, cb RunCallback) (string, []llm.Message, error) {
	messages := make([]llm.Message, len(history))
	copy(messages, history)

	var fullText string
	var newMessages []llm.Message

	for i := 0; i < maxToolIterations; i++ {
		ch, err := a.provider.Stream(ctx, llm.StreamOpts{
			Model:     a.model,
			System:    systemPrompt,
			Messages:  messages,
			Tools:     a.registry.LLMTools(),
			MaxTokens: a.maxTokens,
		})
		if err != nil {
			return "", nil, fmt.Errorf("stream: %w", err)
		}

		var iterText string
		var toolCalls []llm.ToolCall
		done := false

		for event := range ch {
			switch event.Type {
			case "text":
				iterText += event.Text
				fullText += event.Text
				cb(SSEEvent{Type: "text", Content: event.Text})

			case "tool_call":
				if event.ToolCall != nil {
					toolCalls = append(toolCalls, *event.ToolCall)
				}

			case "done":
				done = true

			case "error":
				cb(SSEEvent{Type: "error", Error: event.Error})
				return fullText, newMessages, fmt.Errorf("llm error: %s", event.Error)
			}
		}

		if len(toolCalls) > 0 {
			// Add assistant message with tool calls
			assistantMsg := llm.Message{
				Role:      "assistant",
				Content:   iterText,
				ToolCalls: toolCalls,
			}
			messages = append(messages, assistantMsg)
			newMessages = append(newMessages, assistantMsg)

			// Execute each tool and add results
			for _, tc := range toolCalls {
				tool := a.registry.Get(tc.Name)
				if tool == nil {
					result := llm.Message{
						Role: "tool_result",
						ToolResult: &llm.ToolResult{
							ToolCallID: tc.ID,
							Content:    fmt.Sprintf("tool %q not found", tc.Name),
							IsError:    true,
						},
					}
					messages = append(messages, result)
					newMessages = append(newMessages, result)
					cb(SSEEvent{Type: "tool_use", Name: tc.Name, Status: "error", Error: "tool not found"})
					continue
				}

				slog.InfoContext(ctx, "executing tool", "name", tc.Name)
				cb(SSEEvent{Type: "tool_use", Name: tc.Name, Status: "running"})

				output, err := tool.Execute(ctx, token, tc.Input)
				isError := err != nil
				content := output
				if isError {
					content = err.Error()
				}

				result := llm.Message{
					Role: "tool_result",
					ToolResult: &llm.ToolResult{
						ToolCallID: tc.ID,
						Content:    content,
						IsError:    isError,
					},
				}
				messages = append(messages, result)
				newMessages = append(newMessages, result)

				status := "done"
				errMsg := ""
				if isError {
					status = "error"
					errMsg = content
				}
				cb(SSEEvent{Type: "tool_use", Name: tc.Name, Status: status, Error: errMsg})
			}

			continue // re-call LLM with tool results
		}

		if done {
			if iterText != "" {
				newMessages = append(newMessages, llm.Message{
					Role:    "assistant",
					Content: iterText,
				})
			}
			cb(SSEEvent{Type: "done"})
			return fullText, newMessages, nil
		}
	}

	cb(SSEEvent{Type: "done"})
	return fullText, newMessages, nil
}
```

- [ ] **Step 2: Verify it compiles**

Run: `go build ./cmd/agentic/`
Expected: Success.

- [ ] **Step 3: Commit**

```bash
git add cmd/agentic/agent.go
git commit -m "feat(agentic): add agent loop orchestrator with tool execution"
```

---

### Task 10: HTTP Handlers (Chat SSE + Conversation CRUD)

**Files:**
- Create: `cmd/agentic/handler.go`

- [ ] **Step 1: Create the handlers**

```go
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/pgsql/pgctx"
	"github.com/moonrhythm/validator"
	"github.com/rs/xid"

	"github.com/anertic/anertic/pkg/llm"
)

var (
	errConversationNotFound = arpc.NewErrorCode("conversation/not-found", "conversation not found")
	errForbidden            = arpc.NewErrorCode("forbidden", "forbidden")
)

type Handlers struct {
	agent     *Agent
	apiClient *APIClient
}

// ChatParams is the request body for POST /chat.
type ChatParams struct {
	ConversationID string `json:"conversationId"`
	SiteID         string `json:"siteId"`
	Message        string `json:"message"`
}

// Chat handles POST /chat with SSE streaming.
func (h *Handlers) Chat(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()

	// Parse request
	var p ChatParams
	if err := json.NewDecoder(r.Body).Decode(&p); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}
	if p.SiteID == "" || p.Message == "" {
		http.Error(w, "siteId and message are required", http.StatusBadRequest)
		return
	}

	// Get user token from header
	token := r.Header.Get("Authorization")
	if len(token) > 7 {
		token = token[7:] // strip "Bearer "
	} else {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	// Validate token by calling auth.me
	var me struct {
		ID string `json:"id"`
	}
	authCtx, authCancel := context.WithTimeout(ctx, 5*time.Second)
	defer authCancel()
	if err := h.apiClient.Invoke(authCtx, token, "auth.me", nil, &me); err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	userID := me.ID

	// Get site context
	var siteResult struct {
		ID       string `json:"id"`
		Name     string `json:"name"`
		Timezone string `json:"timezone"`
		Currency string `json:"currency"`
	}
	if err := h.apiClient.Invoke(ctx, token, "site.get", map[string]any{"id": p.SiteID}, &siteResult); err != nil {
		http.Error(w, "site not found", http.StatusNotFound)
		return
	}

	// Load or create conversation
	conversationID := p.ConversationID
	if conversationID == "" {
		conversationID = xid.New().String()
		title := p.Message
		if len(title) > 50 {
			title = title[:50]
		}
		_, err := pgctx.Exec(ctx,
			`insert into conversations (id, site_id, user_id, title) values ($1, $2, $3, $4)`,
			conversationID, p.SiteID, userID, title,
		)
		if err != nil {
			slog.ErrorContext(ctx, "create conversation", "error", err)
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
	} else {
		// Verify ownership
		var ownerID string
		err := pgctx.QueryRow(ctx,
			`select user_id from conversations where id = $1 and site_id = $2`,
			conversationID, p.SiteID,
		).Scan(&ownerID)
		if err == sql.ErrNoRows {
			http.Error(w, "conversation not found", http.StatusNotFound)
			return
		}
		if err != nil {
			http.Error(w, "internal error", http.StatusInternalServerError)
			return
		}
		if ownerID != userID {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}
	}

	// Save user message
	_, err := pgctx.Exec(ctx,
		`insert into conversation_messages (id, conversation_id, role, content) values ($1, $2, $3, $4)`,
		xid.New().String(), conversationID, "user", p.Message,
	)
	if err != nil {
		slog.ErrorContext(ctx, "save user message", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Load history (last 50 messages)
	history, err := loadHistory(ctx, conversationID)
	if err != nil {
		slog.ErrorContext(ctx, "load history", "error", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}

	// Setup SSE
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("Connection", "keep-alive")

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	// Send conversation ID first
	writeSSE(w, flusher, SSEEvent{Type: "conversation_id", Content: conversationID})

	// Build system prompt
	systemPrompt := buildSystemPrompt(&SiteContext{
		ID:       siteResult.ID,
		Name:     siteResult.Name,
		Timezone: siteResult.Timezone,
		Currency: siteResult.Currency,
	})

	// Run agent loop
	_, newMessages, err := h.agent.Run(ctx, token, systemPrompt, history, func(event SSEEvent) {
		writeSSE(w, flusher, event)
	})
	if err != nil {
		slog.ErrorContext(ctx, "agent run", "error", err)
	}

	// Save new messages to DB
	for _, msg := range newMessages {
		switch msg.Role {
		case "assistant":
			if len(msg.ToolCalls) > 0 {
				for _, tc := range msg.ToolCalls {
					if _, err := pgctx.Exec(ctx,
						`insert into conversation_messages (id, conversation_id, role, content, tool_name, tool_call_id, tool_input)
						 values ($1, $2, $3, $4, $5, $6, $7)`,
						xid.New().String(), conversationID, "tool_call", "", tc.Name, tc.ID, string(tc.Input),
					); err != nil {
						slog.ErrorContext(ctx, "save tool_call message", "error", err)
					}
				}
				if msg.Content != "" {
					if _, err := pgctx.Exec(ctx,
						`insert into conversation_messages (id, conversation_id, role, content)
						 values ($1, $2, $3, $4)`,
						xid.New().String(), conversationID, "assistant", msg.Content,
					); err != nil {
						slog.ErrorContext(ctx, "save assistant message", "error", err)
					}
				}
			} else {
				if _, err := pgctx.Exec(ctx,
					`insert into conversation_messages (id, conversation_id, role, content)
					 values ($1, $2, $3, $4)`,
					xid.New().String(), conversationID, "assistant", msg.Content,
				); err != nil {
					slog.ErrorContext(ctx, "save assistant message", "error", err)
				}
			}
		case "tool_result":
			if msg.ToolResult != nil {
				if _, err := pgctx.Exec(ctx,
					`insert into conversation_messages (id, conversation_id, role, content, tool_call_id)
					 values ($1, $2, $3, $4, $5)`,
					xid.New().String(), conversationID, "tool_result", msg.ToolResult.Content, msg.ToolResult.ToolCallID,
				); err != nil {
					slog.ErrorContext(ctx, "save tool_result message", "error", err)
				}
			}
		}
	}

	if _, err := pgctx.Exec(ctx,
		`update conversations set updated_at = now() where id = $1`,
		conversationID,
	); err != nil {
		slog.ErrorContext(ctx, "update conversation timestamp", "error", err)
	}
}

func writeSSE(w http.ResponseWriter, flusher http.Flusher, event SSEEvent) {
	data, _ := json.Marshal(event)
	fmt.Fprintf(w, "data: %s\n\n", data)
	flusher.Flush()
}

func loadHistory(ctx context.Context, conversationID string) ([]llm.Message, error) {
	// Subquery selects the last 50 messages (DESC), then outer query orders them ASC
	rows, err := pgctx.Query(ctx,
		`select role, content, tool_name, tool_call_id, tool_input
		 from (
		     select role, content, tool_name, tool_call_id, tool_input, created_at
		     from conversation_messages
		     where conversation_id = $1
		     order by created_at desc
		     limit 50
		 ) sub
		 order by created_at asc`,
		conversationID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var msgs []llm.Message
	for rows.Next() {
		var (
			role       string
			content    string
			toolName   sql.NullString
			toolCallID sql.NullString
			toolInput  sql.NullString
		)
		if err := rows.Scan(&role, &content, &toolName, &toolCallID, &toolInput); err != nil {
			return nil, err
		}

		switch role {
		case "user", "assistant":
			msgs = append(msgs, llm.Message{Role: role, Content: content})
		case "tool_call":
			// Attach tool call to the preceding assistant message
			if len(msgs) > 0 && msgs[len(msgs)-1].Role == "assistant" {
				msgs[len(msgs)-1].ToolCalls = append(msgs[len(msgs)-1].ToolCalls, llm.ToolCall{
					ID:    toolCallID.String,
					Name:  toolName.String,
					Input: json.RawMessage(toolInput.String),
				})
			}
		case "tool_result":
			msgs = append(msgs, llm.Message{
				Role: "tool_result",
				ToolResult: &llm.ToolResult{
					ToolCallID: toolCallID.String,
					Content:    content,
				},
			})
		}
	}

	return msgs, nil
}

// ConversationListParams is the request body for POST /conversation.list.
type ConversationListParams struct {
	SiteID string `json:"siteId"`
}

func (p *ConversationListParams) Valid() error {
	v := validator.New()
	v.Must(p.SiteID != "", "siteId is required")
	return v.Error()
}

type ConversationItem struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	CreatedAt time.Time `json:"createdAt"`
	UpdatedAt time.Time `json:"updatedAt"`
}

type ConversationListResult struct {
	Items []ConversationItem `json:"items"`
}

func (h *Handlers) ConversationList(ctx context.Context, p *ConversationListParams) (*ConversationListResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	userID := getUserID(ctx)
	items := make([]ConversationItem, 0)

	rows, err := pgctx.Query(ctx,
		`select id, title, created_at, updated_at
		 from conversations
		 where site_id = $1 and user_id = $2
		 order by updated_at desc`,
		p.SiteID, userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	for rows.Next() {
		var item ConversationItem
		if err := rows.Scan(&item.ID, &item.Title, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		items = append(items, item)
	}

	return &ConversationListResult{Items: items}, nil
}

// ConversationGetParams is the request body for POST /conversation.get.
type ConversationGetParams struct {
	ID string `json:"id"`
}

func (p *ConversationGetParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

type MessageItem struct {
	ID         string    `json:"id"`
	Role       string    `json:"role"`
	Content    string    `json:"content"`
	ToolName   string    `json:"toolName"`
	ToolCallID string    `json:"toolCallId"`
	CreatedAt  time.Time `json:"createdAt"`
}

type ConversationGetResult struct {
	ID       string        `json:"id"`
	Title    string        `json:"title"`
	Messages []MessageItem `json:"messages"`
}

func (h *Handlers) ConversationGet(ctx context.Context, p *ConversationGetParams) (*ConversationGetResult, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	userID := getUserID(ctx)

	var conv ConversationGetResult
	err := pgctx.QueryRow(ctx,
		`select id, title from conversations where id = $1 and user_id = $2`,
		p.ID, userID,
	).Scan(&conv.ID, &conv.Title)
	if err == sql.ErrNoRows {
		return nil, errConversationNotFound
	}
	if err != nil {
		return nil, err
	}

	rows, err := pgctx.Query(ctx,
		`select id, role, content, coalesce(tool_name, ''), coalesce(tool_call_id, ''), created_at
		 from conversation_messages
		 where conversation_id = $1
		 order by created_at`,
		p.ID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	conv.Messages = make([]MessageItem, 0)
	for rows.Next() {
		var m MessageItem
		if err := rows.Scan(&m.ID, &m.Role, &m.Content, &m.ToolName, &m.ToolCallID, &m.CreatedAt); err != nil {
			return nil, err
		}
		conv.Messages = append(conv.Messages, m)
	}

	return &conv, nil
}

// ConversationDeleteParams is the request body for POST /conversation.delete.
type ConversationDeleteParams struct {
	ID string `json:"id"`
}

func (p *ConversationDeleteParams) Valid() error {
	v := validator.New()
	v.Must(p.ID != "", "id is required")
	return v.Error()
}

func (h *Handlers) ConversationDelete(ctx context.Context, p *ConversationDeleteParams) (*struct{}, error) {
	if err := p.Valid(); err != nil {
		return nil, err
	}
	userID := getUserID(ctx)

	// Verify ownership
	var ownerID string
	err := pgctx.QueryRow(ctx,
		`select user_id from conversations where id = $1`,
		p.ID,
	).Scan(&ownerID)
	if err == sql.ErrNoRows {
		return nil, errConversationNotFound
	}
	if err != nil {
		return nil, err
	}
	if ownerID != userID {
		return nil, errForbidden
	}

	// Delete messages first (FK constraint)
	if _, err := pgctx.Exec(ctx, `delete from conversation_messages where conversation_id = $1`, p.ID); err != nil {
		return nil, err
	}
	if _, err := pgctx.Exec(ctx, `delete from conversations where id = $1`, p.ID); err != nil {
		return nil, err
	}

	return &struct{}{}, nil
}

// getUserID extracts user ID from context (set by auth middleware).
// For /chat handler, user ID comes from auth.me API call.
// For conversation CRUD, it comes from the arpc auth middleware.
func getUserID(ctx context.Context) string {
	// This will be set by the auth middleware in main.go
	v, _ := ctx.Value(ctxKeyUserID).(string)
	return v
}

type contextKey string

const ctxKeyUserID contextKey = "userID"
```

Note: The `loadHistory` function queries DESC + reverses for the LIMIT 50 window. The `tool_call` reconstruction assumes tool_call messages follow their assistant message. This is correct given chronological insertion order.

- [ ] **Step 2: Verify it compiles**

Run: `go build ./cmd/agentic/`
Expected: Success.

- [ ] **Step 3: Commit**

```bash
git add cmd/agentic/handler.go
git commit -m "feat(agentic): add chat SSE handler and conversation CRUD"
```

---

### Task 11: Main Entry Point

**Files:**
- Modify: `cmd/agentic/main.go`

- [ ] **Step 1: Write main.go**

```go
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/configfile"
	"github.com/acoshift/pgsql/pgctx"
	_ "github.com/lib/pq"
	"github.com/moonrhythm/httpmux"
	"github.com/moonrhythm/parapet"
	"github.com/moonrhythm/parapet/pkg/cors"

	"github.com/anertic/anertic/cmd/agentic/tools"
	"github.com/anertic/anertic/pkg/llm"
	"github.com/anertic/anertic/pkg/llm/anthropic"
	"github.com/anertic/anertic/pkg/llm/openai"
	"github.com/anertic/anertic/schema"
)

func main() {
	if err := run(); err != nil {
		slog.Error("agentic: exited", "error", err)
	}
}

func run() error {
	if err := configfile.LoadDotEnv("./.env"); err != nil {
		slog.Warn("load .env", "error", err)
	}

	cfg := configfile.NewEnvReader()

	// Database
	db, err := sql.Open("postgres", cfg.StringDefault("DB_URL", "postgres://anertic:anertic@localhost:5432/anertic?sslmode=disable"))
	if err != nil {
		return err
	}
	defer db.Close()

	ctx := context.Background()
	if err := schema.Migrate(ctx, db); err != nil {
		return err
	}

	// Config
	apiURL := cfg.StringDefault("API_URL", "http://localhost:8080")
	llmProvider := cfg.StringDefault("LLM_PROVIDER", "anthropic")
	llmModel := cfg.StringDefault("LLM_MODEL", "claude-opus-4-6")
	maxTokensStr := cfg.StringDefault("LLM_MAX_TOKENS", "4096")
	maxTokens, _ := strconv.Atoi(maxTokensStr)
	if maxTokens <= 0 {
		maxTokens = 4096
	}
	llmTimeoutStr := cfg.StringDefault("LLM_TIMEOUT", "60s")
	llmTimeout, _ := time.ParseDuration(llmTimeoutStr)
	if llmTimeout <= 0 {
		llmTimeout = 60 * time.Second
	}
	_ = llmTimeout // used by Agent when wrapping provider.Stream context

	// LLM Provider
	var provider llm.Provider
	switch llmProvider {
	case "anthropic":
		provider = anthropic.New(cfg.String("ANTHROPIC_API_KEY"))
	case "openai":
		provider = openai.New(
			cfg.String("OPENAI_API_KEY"),
			cfg.StringDefault("OPENAI_BASE_URL", ""),
		)
	default:
		return fmt.Errorf("unknown LLM_PROVIDER: %s", llmProvider)
	}

	// API Client
	apiClient := NewAPIClient(apiURL)

	// Tools
	registry := tools.NewRegistry(
		tools.NewGetSites(apiClient),
		tools.NewGetDeviceStatus(apiClient),
		tools.NewListDevices(apiClient),
		tools.NewListRooms(apiClient),
		tools.NewQueryEnergy(apiClient),
		tools.NewGetInsights(apiClient),
		tools.NewGetChargerStatus(apiClient),
	)

	// Agent
	agent := NewAgent(provider, registry, llmModel, maxTokens)

	// Handlers
	h := &Handlers{agent: agent, apiClient: apiClient}

	// Auth middleware for conversation CRUD
	am := arpc.New()
	am.Encoder = func(w http.ResponseWriter, r *http.Request, v any) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(struct {
			OK     bool `json:"ok"`
			Result any  `json:"result"`
		}{true, v})
	}

	authMW := func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := r.Header.Get("Authorization")
			if !strings.HasPrefix(token, "Bearer ") {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}
			bearer := token[7:]

			var me struct {
				ID string `json:"id"`
			}
			if err := apiClient.Invoke(r.Context(), bearer, "auth.me", nil, &me); err != nil {
				http.Error(w, "unauthorized", http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), ctxKeyUserID, me.ID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}

	// Routes
	mux := httpmux.New()
	mux.HandleFunc("POST /chat", h.Chat)

	a := mux.Group("", authMW)
	a.Handle("POST /conversation.list", am.Handler(h.ConversationList))
	a.Handle("POST /conversation.get", am.Handler(h.ConversationGet))
	a.Handle("POST /conversation.delete", am.Handler(h.ConversationDelete))

	// Server
	srv := parapet.NewBackend()
	srv.Handler = mux
	srv.Use(cors.New())
	srv.UseFunc(pgctx.Middleware(db))
	srv.Addr = cfg.StringDefault("AGENTIC_ADDR", ":8082")

	slog.Info("starting agentic server", "addr", srv.Addr, "provider", llmProvider, "model", llmModel)
	return srv.ListenAndServe()
}
```

Note: The `authMW` middleware calls `auth.me` via the API client to validate the user's token for conversation CRUD endpoints. The `/chat` endpoint handles its own auth inline since it needs the token for tool calls too.

- [ ] **Step 2: Run go mod tidy**

Run: `go mod tidy`

- [ ] **Step 3: Verify it compiles**

Run: `go build ./cmd/agentic/`
Expected: Success.

- [ ] **Step 4: Commit**

```bash
git add cmd/agentic/main.go go.mod go.sum
git commit -m "feat(agentic): add main entry point with provider routing and HTTP server"
```

---

### Task 12: Dockerfile & Makefile

**Files:**
- Create: `build/agentic/Dockerfile`
- Modify: `Makefile`

- [ ] **Step 1: Create Dockerfile**

```dockerfile
FROM golang:1.26-alpine AS build

ENV GOOS=linux
ENV GOARCH=amd64
ENV CGO_ENABLED=0
RUN apk add --no-cache git
RUN mkdir -p /workspace
WORKDIR /workspace
ADD go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
ADD . .
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    go build -o .build/agentic -ldflags "-w -s" ./cmd/agentic

FROM gcr.io/distroless/static

WORKDIR /app

COPY --from=build --link /workspace/.build/* ./
ENTRYPOINT ["/app/agentic"]
```

- [ ] **Step 2: Add Makefile targets**

Add to `Makefile` after `run-ocpp:`:

```makefile
run-agentic:
	go run ./cmd/agentic
```

Add after `deploy-ingester:`:

```makefile
deploy-agentic:
	docker buildx build \
		--platform linux/amd64 \
		-t $(IMAGE_BASE)/agentic:$(GIT_REV) \
		-f build/agentic/Dockerfile \
		--push \
		.
	$(call deploy,$(IMAGE_BASE)/agentic:$(GIT_REV),anertic,staging-agentic,olufy-0)
```

Add after `release-ingester:`:

```makefile
release-agentic:
	$(call deploy,$(IMAGE_BASE)/agentic:$(GIT_REV),anertic,agentic,olufy-0)
```

- [ ] **Step 3: Verify Docker build**

Run: `docker build -f build/agentic/Dockerfile -t anertic-agentic:test .`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add build/agentic/Dockerfile Makefile
git commit -m "feat(agentic): add Dockerfile and Makefile targets"
```

---

### Task 13: Integration Test — End to End

**Files:**
- Create: `cmd/agentic/agent_test.go`

- [ ] **Step 1: Create a mock provider for testing**

```go
package main

import (
	"context"
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/anertic/anertic/cmd/agentic/tools"
	"github.com/anertic/anertic/pkg/llm"
)

type mockProvider struct {
	responses [][]llm.StreamEvent
	callIndex int
}

func (m *mockProvider) Stream(ctx context.Context, opts llm.StreamOpts) (<-chan llm.StreamEvent, error) {
	ch := make(chan llm.StreamEvent, 64)
	go func() {
		defer close(ch)
		if m.callIndex < len(m.responses) {
			for _, ev := range m.responses[m.callIndex] {
				ch <- ev
			}
			m.callIndex++
		}
	}()
	return ch, nil
}

type mockTool struct {
	name   string
	output string
}

func (t *mockTool) Name() string        { return t.name }
func (t *mockTool) Description() string  { return "mock tool" }
func (t *mockTool) InputSchema() json.RawMessage { return json.RawMessage(`{"type":"object","properties":{}}`) }
func (t *mockTool) Execute(ctx context.Context, token string, input json.RawMessage) (string, error) {
	return t.output, nil
}

func TestAgentRun_SimpleText(t *testing.T) {
	provider := &mockProvider{
		responses: [][]llm.StreamEvent{
			{
				{Type: "text", Text: "Hello! "},
				{Type: "text", Text: "I can help you."},
				{Type: "done"},
			},
		},
	}

	registry := tools.NewRegistry()
	agent := NewAgent(provider, registry, "test-model", 4096)

	var events []SSEEvent
	text, msgs, err := agent.Run(context.Background(), "token", "system", nil, func(ev SSEEvent) {
		events = append(events, ev)
	})

	assert.NoError(t, err)
	assert.Equal(t, "Hello! I can help you.", text)
	assert.Len(t, msgs, 1)
	assert.Equal(t, "assistant", msgs[0].Role)
	assert.Equal(t, "done", events[len(events)-1].Type)
}

func TestAgentRun_WithToolCall(t *testing.T) {
	provider := &mockProvider{
		responses: [][]llm.StreamEvent{
			// First call: LLM requests a tool
			{
				{Type: "text", Text: "Let me check. "},
				{Type: "tool_call", ToolCall: &llm.ToolCall{
					ID:    "tc_1",
					Name:  "get_sites",
					Input: json.RawMessage(`{}`),
				}},
			},
			// Second call: LLM responds with final text
			{
				{Type: "text", Text: "You have 2 sites."},
				{Type: "done"},
			},
		},
	}

	registry := tools.NewRegistry(&mockTool{name: "get_sites", output: `{"items":[{"id":"s1"},{"id":"s2"}]}`})
	agent := NewAgent(provider, registry, "test-model", 4096)

	var events []SSEEvent
	text, msgs, err := agent.Run(context.Background(), "token", "system", nil, func(ev SSEEvent) {
		events = append(events, ev)
	})

	assert.NoError(t, err)
	assert.Contains(t, text, "You have 2 sites.")
	assert.True(t, len(msgs) > 1) // assistant + tool_result + assistant
}
```

- [ ] **Step 2: Run the test**

Run: `go test ./cmd/agentic/ -v -run TestAgent`
Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add cmd/agentic/agent_test.go
git commit -m "test(agentic): add agent loop unit tests with mock provider"
```

---

### Task 14: Manual Smoke Test

- [ ] **Step 1: Start dependencies**

Run: `make dev-up`

- [ ] **Step 2: Start the API server in one terminal**

Run: `make run-api`

- [ ] **Step 3: Start the agentic server in another terminal**

Set up `.env` with `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`, then:

Run: `make run-agentic`
Expected: Logs "starting agentic server addr=:8082 provider=anthropic model=claude-opus-4-6"

- [ ] **Step 4: Test with curl**

First get a valid auth token (login via the web app or use an existing one).

```bash
curl -N -X POST http://localhost:8082/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"siteId":"YOUR_SITE_ID","message":"What sites do I have?"}'
```

Expected: SSE events stream back with `conversation_id`, tool usage, and final text response.

- [ ] **Step 5: Test conversation list**

```bash
curl -X POST http://localhost:8082/conversation.list \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"siteId":"YOUR_SITE_ID"}'
```

Expected: Returns `{"ok": true, "result": {"items": [...]}}` with the conversation from step 4.
