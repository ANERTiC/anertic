package main

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/anertic/anertic/cmd/agentic/tools"
	"github.com/anertic/anertic/pkg/llm"
)

const maxToolIterations = 15

type Agent struct {
	provider  llm.Provider
	registry  *tools.Registry
	model     string
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
	Type         string   `json:"type"`
	Content      string   `json:"content"`
	Name         string   `json:"name"`
	Status       string   `json:"status"`
	Error        string   `json:"error"`
	QuickReplies []string `json:"quickReplies"`
}

// RunCallback is called for each SSE event during the agent loop.
type RunCallback func(event SSEEvent)

// Run executes the agentic loop: call LLM, execute tools, repeat until done.
func (a *Agent) Run(ctx context.Context, token string, systemPrompt string, history []llm.Message, cb RunCallback, prefill ...string) (string, []llm.Message, error) {
	messages := make([]llm.Message, len(history))
	copy(messages, history)

	var fullText string
	var newMessages []llm.Message

	var prefillText string
	if len(prefill) > 0 {
		prefillText = prefill[0]
	}

	for i := 0; i < maxToolIterations; i++ {
		streamOpts := llm.StreamOpts{
			Model:     a.model,
			System:    systemPrompt,
			Messages:  messages,
			Tools:     a.registry.LLMTools(),
			MaxTokens: a.maxTokens,
		}
		// Only use prefill on the first iteration.
		if i == 0 && prefillText != "" {
			streamOpts.Prefill = prefillText
		}

		ch, err := a.provider.Stream(ctx, streamOpts)
		if err != nil {
			return "", nil, fmt.Errorf("stream: %w", err)
		}

		var iterText string
		var toolCalls []llm.ToolCall

		// Emit prefill text to the client on the first iteration.
		if i == 0 && prefillText != "" {
			iterText = prefillText
			fullText = prefillText
			cb(SSEEvent{Type: "text", Content: prefillText})
		}

		for event := range ch {
			slog.DebugContext(ctx, "stream event", "iteration", i, "type", event.Type, "text_len", len(event.Text), "has_tool_call", event.ToolCall != nil)
			switch event.Type {
			case "text":
				iterText += event.Text
				fullText += event.Text
				cb(SSEEvent{Type: "text", Content: event.Text})
			case "tool_call":
				if event.ToolCall != nil {
					toolCalls = append(toolCalls, *event.ToolCall)
				}
			case "error":
				cb(SSEEvent{Type: "error", Error: event.Error})
				return fullText, newMessages, fmt.Errorf("llm error: %s", event.Error)
			}
		}

		slog.DebugContext(ctx, "iteration done", "iteration", i, "text_len", len(iterText), "tool_calls", len(toolCalls), "messages_count", len(messages))

		if len(toolCalls) > 0 {
			assistantMsg := llm.Message{
				Role:      "assistant",
				Content:   iterText,
				ToolCalls: toolCalls,
			}
			messages = append(messages, assistantMsg)
			newMessages = append(newMessages, assistantMsg)

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

				output, execErr := tool.Execute(ctx, token, tc.Input)
				isError := execErr != nil
				content := output
				if isError {
					slog.ErrorContext(ctx, "tool execution failed", "name", tc.Name, "error", execErr)
					content = execErr.Error()
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
			continue
		}

		// Stream ended — either explicit done or channel closed without tool calls.
		if iterText != "" {
			newMessages = append(newMessages, llm.Message{
				Role:    "assistant",
				Content: iterText,
			})
		}
		cb(SSEEvent{Type: "done"})
		return fullText, newMessages, nil
	}

	cb(SSEEvent{Type: "done"})
	return fullText, newMessages, nil
}

// detectQuickReplies checks the assistant's response for confirmation patterns
// and returns suggested quick reply options.
func detectQuickReplies(text string) []string {
	lower := strings.ToLower(text)

	// Check last 200 chars for confirmation patterns
	tail := lower
	if len(tail) > 200 {
		tail = tail[len(tail)-200:]
	}

	confirmPatterns := []string{
		"is that correct",
		"shall i",
		"should i",
		"would you like me to",
		"want me to",
		"do you want",
		"ready to proceed",
		"go ahead",
		"confirm",
	}
	for _, p := range confirmPatterns {
		if strings.Contains(tail, p) {
			return []string{"Yes", "No"}
		}
	}

	// "would you like to ..." (open-ended follow-up)
	if strings.Contains(tail, "would you like") || strings.Contains(tail, "anything else") {
		return []string{"Yes", "No, thanks"}
	}

	return nil
}
