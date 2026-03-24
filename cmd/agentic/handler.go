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
		ID    string `json:"id"`
		Name  string `json:"name"`
		Email string `json:"email"`
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
		ID:        siteResult.ID,
		Name:      siteResult.Name,
		Timezone:  siteResult.Timezone,
		Currency:  siteResult.Currency,
		UserName:  me.Name,
		UserEmail: me.Email,
	})

	slog.InfoContext(ctx, "system prompt", "prompt", systemPrompt)

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
	v, _ := ctx.Value(ctxKeyUserID).(string)
	return v
}

type contextKey string

const ctxKeyUserID contextKey = "userID"
