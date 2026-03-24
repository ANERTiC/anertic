package tools

import (
	"context"
	"encoding/json"

	"github.com/anertic/anertic/pkg/llm"
)

// Invoker is the interface for calling the ANERTiC API.
type Invoker interface {
	Invoke(ctx context.Context, token, method string, body any, out any) error
}

// Tool is the interface that every agentic tool must implement.
type Tool interface {
	Name() string
	Description() string
	InputSchema() json.RawMessage
	Execute(ctx context.Context, token string, input json.RawMessage) (string, error)
}

// Registry holds a set of tools available to the agent.
type Registry struct {
	tools []Tool
}

// NewRegistry creates a Registry containing the given tools.
func NewRegistry(tools ...Tool) *Registry {
	return &Registry{tools: tools}
}

// LLMTools returns the tools in the LLM format expected by the provider.
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

// Get returns the tool with the given name, or nil if not found.
func (r *Registry) Get(name string) Tool {
	for _, t := range r.tools {
		if t.Name() == name {
			return t
		}
	}
	return nil
}
