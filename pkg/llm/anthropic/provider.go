package anthropic

import (
	"context"
	"encoding/json"
	"log/slog"

	anthropicv1 "github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"

	"github.com/anertic/anertic/pkg/llm"
)

var _ llm.Provider = (*Provider)(nil)

// Provider implements llm.Provider using the Anthropic API.
type Provider struct {
	client anthropicv1.Client
}

// New creates a new Anthropic provider with the given API key.
func New(apiKey string) *Provider {
	client := anthropicv1.NewClient(option.WithAPIKey(apiKey))
	return &Provider{client: client}
}

// Stream creates a streaming request to the Anthropic API and returns a channel
// of StreamEvents.
func (p *Provider) Stream(ctx context.Context, opts llm.StreamOpts) (<-chan llm.StreamEvent, error) {
	messages := convertMessages(opts.Messages)
	tools := convertTools(opts.Tools)

	maxTokens := int64(opts.MaxTokens)
	if maxTokens <= 0 {
		maxTokens = 16384
	}

	params := anthropicv1.MessageNewParams{
		Model:     anthropicv1.Model(opts.Model),
		MaxTokens: maxTokens,
		Messages:  messages,
		Thinking: anthropicv1.ThinkingConfigParamUnion{
			OfAdaptive: &anthropicv1.ThinkingConfigAdaptiveParam{},
		},
	}

	if opts.System != "" {
		params.System = []anthropicv1.TextBlockParam{
			{Text: opts.System},
		}
	}

	if len(tools) > 0 {
		params.Tools = tools
	}

	stream := p.client.Messages.NewStreaming(ctx, params)

	ch := make(chan llm.StreamEvent, 64)

	go func() {
		defer close(ch)
		defer stream.Close()

		var acc anthropicv1.Message

		for stream.Next() {
			event := stream.Current()

			if err := acc.Accumulate(event); err != nil {
				ch <- llm.StreamEvent{
					Type:  "error",
					Error: err.Error(),
				}
				return
			}

			switch event.AsAny().(type) {
			case anthropicv1.ContentBlockDeltaEvent:
				delta := event.Delta
				switch delta.Type {
				case "text_delta":
					ch <- llm.StreamEvent{
						Type: "text",
						Text: delta.Text,
					}
				}
			}
		}

		if err := stream.Err(); err != nil {
			slog.ErrorContext(ctx, "anthropic stream error", "error", err)
			ch <- llm.StreamEvent{
				Type:  "error",
				Error: err.Error(),
			}
			return
		}

		// Extract tool use blocks from the accumulated message.
		for _, block := range acc.Content {
			switch variant := block.AsAny().(type) {
			case anthropicv1.ToolUseBlock:
				ch <- llm.StreamEvent{
					Type: "tool_call",
					ToolCall: &llm.ToolCall{
						ID:    variant.ID,
						Name:  variant.Name,
						Input: variant.Input,
					},
				}
			}
		}

		if acc.StopReason == anthropicv1.StopReasonEndTurn || acc.StopReason == anthropicv1.StopReasonMaxTokens {
			ch <- llm.StreamEvent{
				Type: "done",
			}
		}
	}()

	return ch, nil
}

// convertMessages converts llm.Message slices to Anthropic API MessageParams.
func convertMessages(messages []llm.Message) []anthropicv1.MessageParam {
	var result []anthropicv1.MessageParam

	for _, msg := range messages {
		switch {
		case msg.ToolResult != nil:
			result = append(result, anthropicv1.NewUserMessage(
				anthropicv1.NewToolResultBlock(
					msg.ToolResult.ToolCallID,
					msg.ToolResult.Content,
					msg.ToolResult.IsError,
				),
			))

		case msg.Role == "assistant" && len(msg.ToolCalls) > 0:
			var blocks []anthropicv1.ContentBlockParamUnion
			if msg.Content != "" {
				blocks = append(blocks, anthropicv1.NewTextBlock(msg.Content))
			}
			for _, tc := range msg.ToolCalls {
				var input any
				if len(tc.Input) > 0 {
					if err := json.Unmarshal(tc.Input, &input); err != nil {
						slog.Error("unmarshal tool call input", "error", err, "tool", tc.Name)
					}
				}
				blocks = append(blocks, anthropicv1.NewToolUseBlock(tc.ID, input, tc.Name))
			}
			result = append(result, anthropicv1.NewAssistantMessage(blocks...))

		case msg.Role == "assistant":
			result = append(result, anthropicv1.NewAssistantMessage(
				anthropicv1.NewTextBlock(msg.Content),
			))

		default:
			result = append(result, anthropicv1.NewUserMessage(
				anthropicv1.NewTextBlock(msg.Content),
			))
		}
	}

	return result
}

// convertTools converts llm.Tool slices to Anthropic API ToolUnionParams.
func convertTools(tools []llm.Tool) []anthropicv1.ToolUnionParam {
	var result []anthropicv1.ToolUnionParam

	for _, t := range tools {
		inputSchema := parseInputSchema(t.InputSchema)

		toolParam := anthropicv1.ToolParam{
			Name:        t.Name,
			Description: anthropicv1.String(t.Description),
			InputSchema: inputSchema,
		}

		result = append(result, anthropicv1.ToolUnionParam{
			OfTool: &toolParam,
		})
	}

	return result
}

// parseInputSchema extracts properties and required fields from a JSON schema
// to build a ToolInputSchemaParam.
func parseInputSchema(raw json.RawMessage) anthropicv1.ToolInputSchemaParam {
	var schema struct {
		Properties any      `json:"properties"`
		Required   []string `json:"required"`
	}

	if len(raw) > 0 {
		json.Unmarshal(raw, &schema)
	}

	return anthropicv1.ToolInputSchemaParam{
		Properties: schema.Properties,
		Required:   schema.Required,
	}
}
