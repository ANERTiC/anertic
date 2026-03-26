package supermemory

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// Client is a Supermemory API client.
type Client struct {
	baseURL    string
	token      string
	httpClient *http.Client
}

// New creates a new Supermemory client.
func New(baseURL, token string) *Client {
	return &Client{
		baseURL: baseURL,
		token:   token,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

type ctxKey struct{}

// NewContext injects a Supermemory client into context.
func NewContext(ctx context.Context, c *Client) context.Context {
	return context.WithValue(ctx, ctxKey{}, c)
}

// From retrieves the Supermemory client from context.
func From(ctx context.Context) *Client {
	return ctx.Value(ctxKey{}).(*Client)
}

// --- Documents ---

type AddDocumentParams struct {
	Content       string            `json:"content"`
	ContainerTag  string            `json:"containerTag,omitempty"`
	EntityContext string            `json:"entityContext,omitempty"`
	CustomID      string            `json:"customId,omitempty"`
	Metadata      map[string]any    `json:"metadata,omitempty"`
}

type DocumentResult struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

func AddDocument(ctx context.Context, p *AddDocumentParams) (*DocumentResult, error) {
	var r DocumentResult
	if err := From(ctx).invoke(ctx, http.MethodPost, "/v3/documents", p, &r); err != nil {
		return nil, err
	}
	return &r, nil
}

type BatchDocumentItem struct {
	Content       string         `json:"content"`
	ContainerTag  string         `json:"containerTag,omitempty"`
	EntityContext string         `json:"entityContext,omitempty"`
	CustomID      string         `json:"customId,omitempty"`
	Metadata      map[string]any `json:"metadata,omitempty"`
}

type AddDocumentBatchParams struct {
	Documents []BatchDocumentItem `json:"documents"`
}

func AddDocumentBatch(ctx context.Context, p *AddDocumentBatchParams) ([]DocumentResult, error) {
	var r []DocumentResult
	if err := From(ctx).invoke(ctx, http.MethodPost, "/v3/documents/batch", p, &r); err != nil {
		return nil, err
	}
	return r, nil
}

type Document struct {
	ID           string         `json:"id"`
	Title        *string        `json:"title"`
	Content      *string        `json:"content"`
	Raw          *string        `json:"raw"`
	Summary      *string        `json:"summary"`
	Type         string         `json:"type"`
	Status       string         `json:"status"`
	Metadata     map[string]any `json:"metadata"`
	CustomID     *string        `json:"customId"`
	ConnectionID *string        `json:"connectionId"`
	URL          *string        `json:"url"`
	Source       *string        `json:"source"`
	CreatedAt    time.Time      `json:"createdAt"`
	UpdatedAt    time.Time      `json:"updatedAt"`
	OgImage      *string        `json:"ogImage"`
}

func GetDocument(ctx context.Context, id string) (*Document, error) {
	var r Document
	if err := From(ctx).invoke(ctx, http.MethodGet, "/v3/documents/"+id, nil, &r); err != nil {
		return nil, err
	}
	return &r, nil
}

type UpdateDocumentParams struct {
	Content      string         `json:"content,omitempty"`
	ContainerTag string         `json:"containerTag,omitempty"`
	CustomID     string         `json:"customId,omitempty"`
	Metadata     map[string]any `json:"metadata,omitempty"`
}

func UpdateDocument(ctx context.Context, id string, p *UpdateDocumentParams) (*DocumentResult, error) {
	var r DocumentResult
	if err := From(ctx).invoke(ctx, http.MethodPatch, "/v3/documents/"+id, p, &r); err != nil {
		return nil, err
	}
	return &r, nil
}

func DeleteDocument(ctx context.Context, id string) error {
	return From(ctx).invoke(ctx, http.MethodDelete, "/v3/documents/"+id, nil, nil)
}

type FilterCondition struct {
	FilterType      string `json:"filterType,omitempty"`
	Key             string `json:"key"`
	Value           string `json:"value"`
	NumericOperator string `json:"numericOperator,omitempty"`
	Negate          bool   `json:"negate,omitempty"`
	IgnoreCase      bool   `json:"ignoreCase,omitempty"`
}

type Filter struct {
	AND        []Filter         `json:"AND,omitempty"`
	OR         []Filter         `json:"OR,omitempty"`
	*FilterCondition
}

type ListDocumentsParams struct {
	ContainerTags []string `json:"containerTags,omitempty"`
	Filters       *Filter  `json:"filters,omitempty"`
}

type ListDocumentsResult struct {
	Documents []Document `json:"documents"`
}

func ListDocuments(ctx context.Context, p *ListDocumentsParams) (*ListDocumentsResult, error) {
	var r ListDocumentsResult
	if err := From(ctx).invoke(ctx, http.MethodPost, "/v3/documents/list", p, &r); err != nil {
		return nil, err
	}
	return &r, nil
}

// --- Search ---

type SearchParams struct {
	Query          string   `json:"q"`
	ChunkThreshold float64  `json:"chunkThreshold,omitempty"`
	DocID          string   `json:"docId,omitempty"`
	ContainerTags  []string `json:"containerTags,omitempty"`
	Filters        *Filter  `json:"filters,omitempty"`
}

type SearchChunk struct {
	DocumentID string  `json:"documentId"`
	Content    string  `json:"content"`
	Score      float64 `json:"score"`
}

type SearchResult struct {
	Results []SearchChunk `json:"results"`
}

func Search(ctx context.Context, p *SearchParams) (*SearchResult, error) {
	var r SearchResult
	if err := From(ctx).invoke(ctx, http.MethodPost, "/v3/search", p, &r); err != nil {
		return nil, err
	}
	return &r, nil
}

// --- Memories ---

type MemoryItem struct {
	Content  string         `json:"content"`
	IsStatic bool           `json:"isStatic,omitempty"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

type CreateMemoriesParams struct {
	Memories     []MemoryItem `json:"memories"`
	ContainerTag string       `json:"containerTag"`
}

type MemoryResult struct {
	ID        string    `json:"id"`
	Memory    string    `json:"memory"`
	IsStatic  bool      `json:"isStatic"`
	CreatedAt time.Time `json:"createdAt"`
}

type CreateMemoriesResult struct {
	DocumentID *string        `json:"documentId"`
	Memories   []MemoryResult `json:"memories"`
}

func CreateMemories(ctx context.Context, p *CreateMemoriesParams) (*CreateMemoriesResult, error) {
	var r CreateMemoriesResult
	if err := From(ctx).invoke(ctx, http.MethodPost, "/v4/memories", p, &r); err != nil {
		return nil, err
	}
	return &r, nil
}

// --- internal ---

type apiError struct {
	Error   string `json:"error"`
	Details string `json:"details"`
}

func (c *Client) invoke(ctx context.Context, method, path string, body any, out any) error {
	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("supermemory: marshal: %w", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	req, err := http.NewRequestWithContext(ctx, method, c.baseURL+path, bodyReader)
	if err != nil {
		return fmt.Errorf("supermemory: new request: %w", err)
	}
	req.Header.Set("Authorization", "Bearer "+c.token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("supermemory: do: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		var ae apiError
		json.NewDecoder(resp.Body).Decode(&ae)
		return fmt.Errorf("supermemory: %d: %s: %s", resp.StatusCode, ae.Error, ae.Details)
	}

	if out != nil {
		if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
			return fmt.Errorf("supermemory: decode: %w", err)
		}
	}

	return nil
}
