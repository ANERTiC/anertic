package ocpp

import "context"

type ctxKey struct{}

// NewContext returns a new context with the charge point ID.
func NewContext(ctx context.Context, id string) context.Context {
	return context.WithValue(ctx, ctxKey{}, id)
}

// ChargePointID returns the charge point ID from the context.
func ChargePointID(ctx context.Context) string {
	v, _ := ctx.Value(ctxKey{}).(string)
	return v
}
