# Agentic Chat Service Design

**Date:** 2026-03-24
**Status:** Approved

## Overview

A standalone Go service (`cmd/agentic`) that provides an AI-powered chat interface for end users of the ANERTiC energy platform. Users can ask natural language questions about their energy usage, device status, EV chargers, and receive recommendations — all within the web app.

## Requirements

- **User:** End users (customers) interacting via chat in the React web app
- **Capabilities:** Read-only queries, actions, and recommendations
- **Transport:** REST endpoint with SSE streaming
- **LLM:** Configurable provider (Anthropic, OpenAI, Ollama via OpenAI-compatible API)
- **Auth:** Inherits user's existing Bearer token, scoped to their sites
- **History:** Persistent conversation history in PostgreSQL
- **Tools:** 7 plain Go function tools calling the ANERTiC API internally

## Architecture

```
┌─────────────┐    POST /chat (SSE)     ┌──────────────────┐
│  Frontend    │ ──────────────────────→ │  cmd/agentic     │
│  (React)     │ ←── SSE stream ──────── │  :8082           │
└─────────────┘                          │                  │
                                         │  ┌────────────┐  │
     User's Bearer token                 │  │ LLM Router │  │  ← Configurable provider
     forwarded on /chat                  │  └─────┬──────┘  │    (Anthropic, OpenAI/Ollama)
                                         │        │         │
                                         │  ┌─────▼──────┐  │
                                         │  │ Tool Exec  │──│──→ ANERTiC API (:8080)
                                         │  └────────────┘  │    (using user's token)
                                         │                  │
                                         │  ┌────────────┐  │
                                         │  │ Chat Store │──│──→ PostgreSQL
                                         │  └────────────┘  │    (conversations table)
                                         └──────────────────┘
```

- New binary: `cmd/agentic/main.go` on `:8082`
- Uses `parapet` for HTTP server (same as cmd/api)
- Tools call `API_URL` (default `localhost:8080`) with the user's Bearer token
- Chat history stored in PostgreSQL (new tables)
- LLM provider selected via `LLM_PROVIDER` env var
- Config read via `configfile.NewEnvReader()` (project convention)
- CORS middleware required (frontend at `APP_URL` calls this service)

## LLM Provider Abstraction

```go
// pkg/llm/llm.go

type Message struct {
    Role       string       // "user", "assistant", "tool_call", "tool_result"
    Content    string
    ToolCalls  []ToolCall   // populated when Role == "assistant" and LLM requests tools
    ToolResult *ToolResult  // populated when Role == "tool_result"
}

type ToolCall struct {
    ID    string
    Name  string
    Input json.RawMessage
}

type ToolResult struct {
    ToolCallID string
    Content    string
    IsError    bool
}

type StreamEvent struct {
    Type       string      // "text", "tool_call", "tool_result", "done", "error"
    Text       string
    ToolCall   *ToolCall
    ToolResult *ToolResult
}

type Tool struct {
    Name        string
    Description string
    InputSchema json.RawMessage // JSON Schema
}

type StreamOpts struct {
    Model     string
    System    string
    Messages  []Message
    Tools     []Tool
    MaxTokens int
}

type Provider interface {
    Stream(ctx context.Context, opts StreamOpts) (<-chan StreamEvent, error)
}
```

### Implementations

- **`pkg/llm/anthropic/provider.go`** — Uses `anthropic-sdk-go` with streaming and adaptive thinking
- **`pkg/llm/openai/provider.go`** — Uses `openai-go` with streaming. Supports OpenAI, Ollama, and any OpenAI-compatible API via `OPENAI_BASE_URL`

The agentic loop lives in `pkg/agent/agent.go`, not inside the provider. The provider handles a single LLM call; the agent orchestrates the tool-calling loop.

## Tools

7 tools to start, all calling the ANERTiC API with the user's token:

| Tool | Description | API Calls | Example Query |
|------|-------------|-----------|---------------|
| `get_sites` | List user's sites with basic info | `site.list` | "What sites do I have?" |
| `get_device_status` | Get devices and online/offline status for a site | `device.list` + `meter.list` | "Is my inverter online?" |
| `list_devices` | List all devices for a site with type, brand, model | `device.list` | "Show me all my devices" |
| `list_rooms` | List rooms for a site with assigned devices | `room.list` | "What rooms do I have?" |
| `query_energy` | Get energy data for a site over a time range | `reading.query` | "How much solar today?" |
| `get_insights` | Get AI-generated insights and anomalies | `insight.summary` + `insight.anomalies` | "Any issues with my system?" |
| `get_charger_status` | Get EV charger status and active sessions | `charger.list` + `connector.list` | "Is my charger available?" |

### Tool Interface

```go
// pkg/agent/tools/tools.go

type Tool interface {
    Name() string
    Description() string
    InputSchema() json.RawMessage
    Execute(ctx context.Context, token string, input json.RawMessage) (string, error)
}
```

- Tools receive the user's Bearer `token` and pass it to the API client
- API client in `cmd/agentic/apiclient.go` uses `net/http` with the invoke pattern (unwrap arpc `{ok, result, error}` envelope)
- Tool results are returned as JSON strings for the LLM to interpret
- Each tool has a **10-second execution timeout** — if the API call exceeds this, the tool returns an error result to the LLM

## Chat Persistence

### Schema (schema/0009_agentic.sql)

```sql
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

IDs are generated application-side via `xid.New().String()` (matches existing project convention).

### Message roles and column usage

| Role | `content` | `tool_name` | `tool_call_id` | `tool_input` |
|------|-----------|-------------|----------------|--------------|
| `user` | User's message text | — | — | — |
| `assistant` | Assistant's text response | — | — | — |
| `tool_call` | — | Tool name | LLM-assigned ID | JSON input args |
| `tool_result` | Tool output (JSON string) | Tool name | Matching tool_call ID | — |

### Conversation ownership

All conversation access (list, get, delete) **must verify** that the requesting user's ID matches the conversation's `user_id`. This prevents users from reading or deleting other users' conversations by guessing IDs.

### Endpoints

All endpoints follow the project's RPC convention (POST, `{module}.{action}`):

| Route | Description |
|-------|-------------|
| `POST /chat` | Send message and stream response (SSE) |
| `POST /conversation.list` | List user's conversations for a site |
| `POST /conversation.get` | Get conversation with messages |
| `POST /conversation.delete` | Delete a conversation |

## Agentic Loop Flow

```
User sends POST /chat
  Body: { "conversation_id": "...", "site_id": "...", "message": "How much solar today?" }
  Header: Authorization: Bearer <token>

Server:
  1. Validate token (call auth.me on ANERTiC API, 5s timeout)
     - On failure: return 401 (not 500)
  2. Load or create conversation (verify ownership)
  3. Save user message to conversation_messages
  4. Build message history from conversation_messages
     - Context window management: load last 50 messages max
     - If conversation exceeds 50 messages, include only the most recent 50
  5. Build system prompt with site context (name, timezone, currency, current time)
  6. Call LLM provider.Stream() with LLM_TIMEOUT (default 60s)

SSE Stream:
  7. For each StreamEvent:
     - "text"        → SSE: { "type": "text", "content": "..." }
     - "tool_call"   → save tool_call message
                      → execute tool (call ANERTiC API with user's token, 10s timeout)
                      → save tool_result message
                      → SSE: { "type": "tool_use", "name": "query_energy", "status": "done" }
                            or { "type": "tool_use", "name": "query_energy", "status": "error", "error": "..." }
                      → re-call LLM with tool results (back to step 6)
     - "done"        → save full assistant message
                      → SSE: { "type": "done" }
     - "error"       → SSE: { "type": "error", "content": "..." }

  8. Auto-generate conversation title from first ~50 chars of first user message

Client disconnect:
  - Context cancellation aborts in-flight LLM call and tool execution
  - Partial assistant message is still saved (content accumulated so far)

Rate limit from LLM provider:
  - Return SSE error event with "rate_limited" type, do not retry
```

- **Max 5 tool call iterations** per request to prevent infinite loops
- **System prompt** includes site name, timezone, currency, current time for relative date resolution
- **Tool call status** streamed so frontend can show spinners
- **Graceful shutdown:** on SIGTERM, stop accepting new `/chat` requests but drain in-flight SSE streams (30s grace period via parapet)

## Project Structure

```
cmd/agentic/
  main.go                     # HTTP server, SSE handler, config
  agent.go                    # Agentic loop orchestrator
  system_prompt.go            # Build system prompt with site context
  apiclient.go                # HTTP client with invoke pattern for ANERTiC API
  handler.go                  # Handlers: chat SSE, conversation CRUD

cmd/agentic/tools/
  tools.go                    # Tool interface + registry
  get_sites.go
  get_device_status.go
  list_devices.go
  list_rooms.go
  query_energy.go
  get_insights.go
  get_charger_status.go

pkg/llm/
  llm.go                      # Provider interface, types

pkg/llm/anthropic/
  provider.go                 # Anthropic implementation using anthropic-sdk-go

pkg/llm/openai/
  provider.go                 # OpenAI/Ollama implementation

schema/
  0009_agentic.sql            # conversations + conversation_messages tables

build/
  agentic/
    Dockerfile                # Docker build for cmd/agentic
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENTIC_ADDR` | `:8082` | Service listen address |
| `API_URL` | `http://localhost:8080` | ANERTiC API base URL |
| `APP_URL` | `http://localhost:5173` | Frontend URL (for CORS) |
| `DB_URL` | (same as api) | PostgreSQL for chat persistence |
| `LLM_PROVIDER` | `anthropic` | Provider: `anthropic` or `openai` |
| `LLM_MODEL` | `claude-opus-4-6` | Model ID |
| `LLM_MAX_TOKENS` | `4096` | Max output tokens per LLM call |
| `LLM_TIMEOUT` | `60s` | Timeout for LLM API calls |
| `ANTHROPIC_API_KEY` | — | Anthropic API key |
| `OPENAI_API_KEY` | — | OpenAI API key |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Override for Ollama (`http://localhost:11434/v1`), Azure, etc. |

All env vars read via `configfile.NewEnvReader()`.

## Makefile Targets

Add to existing Makefile:

```makefile
run-agentic:
	go run ./cmd/agentic

deploy-agentic:
	nortezh deploy -f build/agentic/Dockerfile

release-agentic:
	nortezh release -f build/agentic/Dockerfile
```

## Usage Examples

```bash
# Anthropic (Claude)
LLM_PROVIDER=anthropic LLM_MODEL=claude-opus-4-6 ANTHROPIC_API_KEY=sk-...

# OpenAI
LLM_PROVIDER=openai LLM_MODEL=gpt-4o OPENAI_API_KEY=sk-...

# Ollama (local)
LLM_PROVIDER=openai LLM_MODEL=llama3.3 OPENAI_BASE_URL=http://localhost:11434/v1
```

## Future Expansion

- More tools (charger commands, reservation management, tariff queries)
- WebSocket support for real-time push alerts
- Operator/admin agent with elevated access
- MCP server layer for external agent clients
- Conversation summarization for long chats (replace 50-message truncation)
- Rate limiting per user (protect against LLM cost abuse)
