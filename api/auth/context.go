package auth

import (
	"context"
)

type accountCtxKey struct{}

// AccountID returns the account ID from context, or empty string if not set.
func AccountID(ctx context.Context) string {
	v, _ := ctx.Value(accountCtxKey{}).(string)
	return v
}

func WithAccountID(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, accountCtxKey{}, id)
}
