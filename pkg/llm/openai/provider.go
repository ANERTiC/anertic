package openai

import (
	"context"
	"encoding/json"
	"log/slog"

	openaiv1 "github.com/openai/openai-go"
	"github.com/openai/openai-go/option"
	"github.com/openai/openai-go/packages/param"
	"github.com/openai/openai-go/shared"

	"github.com/anertic/anertic/pkg/llm"
)

// Provider implements llm.Provider using the OpenAI API.
type Provider struct {
	client *openaiv1.Client
}

// New creates an OpenAI provider. baseURL allows overriding the API endpoint
// for Ollama, Azure, or other compatible services.
func New(apiKey string, baseURL string) *Provider {
	opts := []option.RequestOption{
		option.WithAPIKey(apiKey),
	}
	if baseURL != "" {
		opts = append(opts, option.WithBaseURL(baseURL))
	}
	client := openaiv1.NewClient(opts...)
	return &Provider{client: &client}
}

// Stream starts a streaming chat completion and returns a channel of events.
func (p *Provider) Stream(ctx context.Context, opts llm.StreamOpts) (<-chan llm.StreamEvent, error) {
	messages := convertMessages(opts.System, opts.Messages)
	tools := convertTools(opts.Tools)

	params := openaiv1.ChatCompletionNewParams{
		Model:    shared.ChatModel(opts.Model),
		Messages: messages,
	}
	if len(tools) > 0 {
		params.Tools = tools
	}
	if opts.MaxTokens > 0 {
		params.MaxTokens = param.NewOpt(int64(opts.MaxTokens))
	}

	stream := p.client.Chat.Completions.NewStreaming(ctx, params)

	ch := make(chan llm.StreamEvent, 64)
	go func() {
		defer close(ch)
		defer stream.Close()

		var acc openaiv1.ChatCompletionAccumulator
		emittedToolCalls := make(map[string]bool)

		for stream.Next() {
			chunk := stream.Current()
			acc.AddChunk(chunk)

			// Send text content deltas.
			if len(chunk.Choices) > 0 {
				delta := chunk.Choices[0].Delta
				if delta.Content != "" {
					ch <- llm.StreamEvent{
						Type: "text",
						Text: delta.Content,
					}
				}
			}

			// Emit tool calls as they finish accumulating.
			for {
				tc, ok := acc.JustFinishedToolCall()
				if !ok {
					break
				}
				emittedToolCalls[tc.ID] = true
				ch <- llm.StreamEvent{
					Type: "tool_call",
					ToolCall: &llm.ToolCall{
						ID:    tc.ID,
						Name:  tc.Name,
						Input: json.RawMessage(tc.Arguments),
					},
				}
			}
		}

		if err := stream.Err(); err != nil {
			slog.ErrorContext(ctx, "openai stream error", "error", err)
			ch <- llm.StreamEvent{
				Type:  "error",
				Error: err.Error(),
			}
			return
		}

		// Determine finish reason from accumulated response.
		finishReason := ""
		if len(acc.Choices) > 0 {
			finishReason = acc.Choices[0].FinishReason
		}

		// If the model stopped because it wants to call tools, emit any
		// accumulated tool calls that JustFinishedToolCall() missed.
		// This handles Ollama which sends complete tool calls in a single
		// chunk rather than streaming incrementally like OpenAI.
		if finishReason == "tool_calls" {
			// Emit any tool calls that JustFinishedToolCall() missed.
			// Ollama sends complete tool calls in a single chunk rather
			// than streaming incrementally like OpenAI.
			if len(acc.Choices) > 0 {
				for _, tc := range acc.Choices[0].Message.ToolCalls {
					if emittedToolCalls[tc.ID] {
						continue
					}
					ch <- llm.StreamEvent{
						Type: "tool_call",
						ToolCall: &llm.ToolCall{
							ID:    tc.ID,
							Name:  tc.Function.Name,
							Input: json.RawMessage(tc.Function.Arguments),
						},
					}
				}
			}
			return
		}

		ch <- llm.StreamEvent{
			Type: "done",
		}
	}()

	return ch, nil
}

// convertMessages builds the OpenAI message list from the system prompt and
// conversation messages.
func convertMessages(system string, messages []llm.Message) []openaiv1.ChatCompletionMessageParamUnion {
	var out []openaiv1.ChatCompletionMessageParamUnion

	if system != "" {
		out = append(out, openaiv1.SystemMessage(system))
	}

	for _, m := range messages {
		switch {
		case m.ToolResult != nil:
			out = append(out, openaiv1.ToolMessage(m.ToolResult.Content, m.ToolResult.ToolCallID))

		case m.Role == "assistant" && len(m.ToolCalls) > 0:
			toolCalls := make([]openaiv1.ChatCompletionMessageToolCallParam, len(m.ToolCalls))
			for i, tc := range m.ToolCalls {
				toolCalls[i] = openaiv1.ChatCompletionMessageToolCallParam{
					ID: tc.ID,
					Function: openaiv1.ChatCompletionMessageToolCallFunctionParam{
						Name:      tc.Name,
						Arguments: string(tc.Input),
					},
				}
			}
			out = append(out, openaiv1.ChatCompletionMessageParamUnion{
				OfAssistant: &openaiv1.ChatCompletionAssistantMessageParam{
					Content: openaiv1.ChatCompletionAssistantMessageParamContentUnion{
						OfString: param.NewOpt(m.Content),
					},
					ToolCalls: toolCalls,
				},
			})

		case m.Role == "assistant":
			out = append(out, openaiv1.AssistantMessage(m.Content))

		case m.Role == "user":
			out = append(out, openaiv1.UserMessage(m.Content))
		}
	}

	return out
}

// convertTools maps llm.Tool definitions to OpenAI tool parameters.
func convertTools(tools []llm.Tool) []openaiv1.ChatCompletionToolParam {
	if len(tools) == 0 {
		return nil
	}

	out := make([]openaiv1.ChatCompletionToolParam, len(tools))
	for i, t := range tools {
		var schema shared.FunctionParameters
		if len(t.InputSchema) > 0 {
			_ = json.Unmarshal(t.InputSchema, &schema)
		}

		out[i] = openaiv1.ChatCompletionToolParam{
			Function: shared.FunctionDefinitionParam{
				Name:        t.Name,
				Description: param.NewOpt(t.Description),
				Parameters:  schema,
			},
		}
	}

	return out
}
