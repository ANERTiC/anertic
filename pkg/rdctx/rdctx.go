package rdctx

import (
	"context"
	"net/http"

	"github.com/redis/go-redis/v9"
)

type ctxKey struct{}

func NewContext(ctx context.Context, rdb redis.UniversalClient) context.Context {
	return context.WithValue(ctx, ctxKey{}, rdb)
}

func From(ctx context.Context) redis.UniversalClient {
	return ctx.Value(ctxKey{}).(redis.UniversalClient)
}

func Middleware(rdb redis.UniversalClient) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			r = r.WithContext(NewContext(r.Context(), rdb))
			next.ServeHTTP(w, r)
		})
	}
}
