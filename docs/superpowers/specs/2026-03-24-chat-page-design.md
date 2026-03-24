# Chat Page Design Spec

**Date**: 2026-03-24
**Status**: Approved

## Overview

Add a dedicated AI chat page to the ANERTiC frontend at `/chat?site=ID`. The page provides a ChatGPT-style interface for users to interact with the agentic chat service — asking about energy usage, device status, insights, and more. The AI agent has 8 tools (`get_user_profile`, `get_sites`, `list_devices`, `list_rooms`, `get_device_status`, `query_energy`, `get_charger_status`, `get_insights`) and streams responses via SSE.

## Decisions

| Decision | Choice |
|----------|--------|
| Page placement | Dedicated route `/chat` under site layout |
| Tool call display | Thinking steps (collapsed, expandable) |
| Empty state | Suggested prompts grid (4 cards) |
| Conversation sidebar | Collapsible, starts hidden |
| API routing | Proxy through frontend `/api/chat/*` → `:8082` |
| Implementation | Vanilla SSE + SWR, custom `useChat` hook |
| Markdown rendering | `react-markdown` + `remark-gfm` for assistant messages |

## Route & Proxy

### New Frontend Route

Add `/chat` to `app/routes.ts` under `layouts/site.tsx` (requires site context via `?site=ID`).

Route file: `app/routes/chat.tsx`

### Proxy Route

New resource route at `app/routes/api.chat.$.tsx` that forwards requests to the agentic service.

**Route ordering**: In `routes.ts`, `route('api/chat/*', ...)` must be placed BEFORE the generic `route('api/*', ...)` catch-all. React Router 7 matches by specificity, but explicit ordering avoids ambiguity.

```typescript
// routes.ts — top level
route('api/chat/*', 'routes/api.chat.$.tsx'),  // Chat proxy (must be before generic)
route('api/*', 'routes/api.$.ts'),              // Generic API proxy
```

**Endpoints:**

| Frontend path | Backend target | Response handling |
|--------------|---------------|-------------------|
| `POST /api/chat/stream` | `POST :8082/chat` | SSE passthrough (stream body directly) |
| `POST /api/chat/conversation.list` | `POST :8082/conversation.list` | JSON forward |
| `POST /api/chat/conversation.get` | `POST :8082/conversation.get` | JSON forward |
| `POST /api/chat/conversation.delete` | `POST :8082/conversation.delete` | JSON forward |

**SSE proxy implementation**: The `/stream` endpoint must NOT buffer the response. It returns a raw `Response` with the upstream `ReadableStream` as the body:

```typescript
// For SSE streaming — passthrough, no buffering
const upstreamRes = await fetch(`${AGENTIC_URL}/chat`, { method: 'POST', headers, body })
return new Response(upstreamRes.body, {
  headers: {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  },
})
```

For RPC endpoints (conversation.*), the proxy reads the JSON and returns via `data()`, with the same token refresh logic as `api.$.ts`.

**Auth**: Reads `accessToken` from the session cookie. Sets `Authorization: Bearer <token>` on forwarded requests. For the SSE stream endpoint, token refresh cannot happen mid-stream — if the token is expired, the proxy attempts one refresh before starting the stream, and returns 401 if refresh fails.

**Env var**: `AGENTIC_URL` (default `http://localhost:8082`). Must be documented in frontend env table.

### Chat-specific Fetcher

Since the existing `fetcher` always POSTs to `/api/${method}`, a `chatFetcher` is needed for conversation management:

```typescript
// lib/chat-api.ts
export async function chatFetcher<T>([method, body]: [string, unknown?]): Promise<T> {
  const res = await fetch(`/api/chat/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  })
  if (res.status === 401) {
    window.location.href = '/login'
    throw new Error('Session expired')
  }
  const data: { ok: boolean; result: T; error?: { code?: string; message?: string } } = await res.json()
  if (!data.ok) {
    throw new ApiError(data.error?.code || '', data.error?.message || 'Unknown error')
  }
  return data.result
}
```

Used by SWR for conversation CRUD:
```typescript
useSWR(['conversation.list', { siteId }], chatFetcher)
```

## Components

```
app/routes/chat.tsx                    — Page component, conversation state management
app/lib/chat-api.ts                    — Chat-specific fetcher for /api/chat/* endpoints
app/components/chat/
  use-chat.ts                          — Custom hook: SSE streaming, message state, send/stop
  conversation-sidebar.tsx             — Collapsible conversation list panel
  message-list.tsx                     — Scrollable message area with auto-scroll
  message-bubble.tsx                   — Single message render (user or assistant, markdown for assistant)
  thinking-steps.tsx                   — Collapsible tool call group indicator
  suggested-prompts.tsx                — Empty state prompt grid
  chat-input.tsx                       — Textarea with send/stop button, Enter to send, Shift+Enter newline
```

### New Dependencies

- `react-markdown` + `remark-gfm` — render assistant messages as markdown (headings, lists, code, bold, etc.)

No new shadcn components needed. The chat input uses a plain `<textarea>` styled with Tailwind (auto-resize).

## Page Layout

### Layout Considerations

The chat page is rendered under `layouts/site.tsx`, which wraps content in `<div className="flex-1 overflow-y-auto p-6">`. The chat page needs full-height layout with its own scroll and a pinned input bar. The chat route must override this by using `className="!p-0 !overflow-hidden"` or applying negative margins on the chat container, and managing its own scroll within the messages area.

Alternatively, `site.tsx` can conditionally omit the `p-6` padding when the outlet signals a full-bleed layout (e.g., via outlet context flag).

### App Sidebar vs Conversation Sidebar

The app sidebar (left nav with Overview, Devices, Chat, etc.) is always present in its collapsed icon form. The conversation sidebar is a separate panel WITHIN the chat page content area — it does not replace or overlap the app sidebar. On desktop with both open, the layout is: app sidebar (48px icons) + conversation list (~240px) + chat area (remaining). This is acceptable since the app sidebar is narrow in icon mode.

### Empty State (New Conversation)

- Hamburger toggle (top-left) to open conversation sidebar
- Centered greeting: ANERTiC Assistant icon + title + subtitle
- 2×2 grid of suggested prompt cards:
  - "⚡ Energy — How's my energy usage today?"
  - "📊 Insights — Any anomalies this week?"
  - "🔌 Devices — Show device status"
  - "🔋 Compare — This month vs last month"
- Clicking a prompt sends it as the first message
- Input bar pinned to bottom

### Active Conversation

- Conversation sidebar (when open): left panel showing conversation list with title + relative time, active item highlighted, new conversation (+) and close (✕) buttons
- Messages area: scrollable, auto-scrolls to bottom on new messages
  - User messages: right-aligned, purple bubble, rounded corners
  - Assistant messages: left-aligned, white card with border, AI avatar (purple gradient with ✦), content rendered as markdown
  - Thinking steps: gray pill between messages, shows "Retrieved energy data · 2 steps", click to expand individual tool names
  - Running tool: indigo pill with pulsing dot, shows "Querying daily energy..."
- Input bar: pinned bottom, textarea with send button (↑), changes to stop button (■) while streaming
- Keyboard: Enter to send, Shift+Enter for newline

### Conversation Sidebar

- Starts hidden (collapsed)
- Toggle via hamburger button (top-left of chat area)
- Shows list of past conversations: title + relative timestamp
- Active conversation highlighted in purple
- Header: "Conversations" label + new conversation (+) button + close (✕) button
- On mobile: renders as a Sheet/drawer overlay (existing shadcn Sheet component)

### Conversation Rename

Not included in this iteration. Titles are auto-generated from the first 50 characters of the initial message. Rename can be added later as a separate feature.

## `useChat` Hook

Custom React hook that manages the chat state and SSE streaming.

### Interface

```typescript
interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  thinkingSteps?: ThinkingStep[]
}

interface ThinkingStep {
  name: string
  status: "running" | "done" | "error"
  error?: string
}

interface UseChatReturn {
  messages: ChatMessage[]
  send: (message: string) => void
  stop: () => void
  isStreaming: boolean
  conversationId: string | null
  setConversationId: (id: string | null) => void
  setMessages: (messages: ChatMessage[]) => void
}

function useChat(siteId: string): UseChatReturn
```

### SSE Parsing

The backend emits standard SSE format with `data: ` prefix and double-newline delimiters:

```
data: {"type":"conversation_id","content":"conv_abc123"}

data: {"type":"text","content":"Your"}

data: {"type":"text","content":" solar"}

data: {"type":"tool_use","name":"query_energy","status":"running"}

data: {"type":"tool_use","name":"query_energy","status":"done"}

data: {"type":"done"}

```

Since `EventSource` does not support POST requests, the hook uses `fetch()` + `ReadableStream` reader with manual SSE line parsing:

1. `fetch('/api/chat/stream', { method: 'POST', body, signal })` with `AbortController`
2. Get `reader = response.body.getReader()`
3. Read chunks via `TextDecoder`, split on `\n\n`, strip `data: ` prefix
4. JSON-parse each payload and dispatch by `type`

### Event Handling

| Event type | Action |
|-----------|--------|
| `conversation_id` | Store the conversation ID, mutate conversation list SWR cache |
| `text` | Append `content` to the current assistant message |
| `tool_use` (status: `running`) | Add a thinking step with name + running status |
| `tool_use` (status: `done`) | Mark the thinking step as done |
| `tool_use` (status: `error`) | Mark the thinking step as error, store error message |
| `error` | Display error in the chat as a system message |
| `done` | Finalize message, set `isStreaming = false` |

### Guards

- `send()` is a no-op when `isStreaming` is true (prevents rapid-fire messages)
- Switching conversations while streaming: `stop()` is called automatically (aborts the in-flight stream), then the new conversation loads

### Abort

`stop()` calls `AbortController.abort()` on the in-flight fetch request, then sets `isStreaming = false`.

## Data Flow

### Sending a Message

```
User types → chat-input.tsx → useChat.send(message)
  → Guard: if isStreaming, return (no-op)
  → Optimistic: add user message to messages array
  → POST /api/chat/stream { conversationId, siteId, message }
  → Proxy reads session cookie, adds Bearer token, forwards to agentic :8082 /chat
  → SSE events stream back through proxy (raw Response passthrough)
  → useChat reads ReadableStream, parses SSE lines, updates messages state
  → message-list re-renders incrementally
  → On "done" event: isStreaming = false, mutate conversation list SWR cache
```

### Conversation Management

```
Conversation list  → useSWR(['conversation.list', { siteId }], chatFetcher)
Load conversation  → chatFetcher(['conversation.get', { id }]) (on-demand, not SWR)
Delete             → chatFetcher(['conversation.delete', { id }]) → mutate list
New conversation   → Reset messages, clear conversationId
```

### Loading a Past Conversation

When user clicks a conversation in the sidebar:
1. If streaming, call `stop()` first
2. Fetch via `chatFetcher(['conversation.get', { id }])`
3. Reconstruct `ChatMessage[]` from the raw messages:
   - `user` role → user message
   - `assistant` role → assistant message, collect subsequent `tool_call` rows as `thinkingSteps`
   - `tool_result` role → link back to thinking step via `toolCallId`, mark as done/error
4. Set as current messages via `setMessages()`, set conversationId via `setConversationId()`

## Sidebar Navigation

Add a chat icon to `app-sidebar.tsx` nav items:

```typescript
{ title: "Chat", url: "/chat", icon: RiChat1Line }
```

Placed after "Insights" in the sidebar nav order. Uses Remixicon (consistent with existing nav icons).

## Error Handling

- Network error during streaming: show error toast via Sonner, set `isStreaming = false`
- 401 from proxy: redirect to `/login` (consistent with existing pattern)
- Tool execution error: displayed as a red thinking step (expandable to see error message from `ThinkingStep.error`)
- Empty response: show "No response received" in chat
- Conversation not found: show error toast, remove from sidebar list

## Accessibility

- Message list: `role="log"` and `aria-live="polite"` for screen reader announcements
- Send button: `aria-label="Send message"`, changes to `aria-label="Stop generating"` while streaming
- Conversation sidebar toggle: `aria-label="Toggle conversation history"`
- Thinking steps expand/collapse: `aria-expanded` attribute
- Input textarea: `aria-label="Message input"`

## Mobile

- Chat page is full-width (no conversation sidebar visible by default)
- Conversation sidebar opens as a Sheet overlay (existing shadcn Sheet component)
- Input bar stays pinned to bottom with proper viewport handling (`dvh` units)
- Messages area scrollable with momentum (`-webkit-overflow-scrolling: touch`)
- Suggested prompts stack vertically (single column on small screens)

## Environment Variables

Add to frontend env table:

| Variable | Default | Description |
|----------|---------|-------------|
| `AGENTIC_URL` | `http://localhost:8082` | Agentic chat service URL |
