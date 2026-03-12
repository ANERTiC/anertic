package ops

import (
	"context"
	"log/slog"
	"os"

	"github.com/samber/go-quickwit"
	slogcommon "github.com/samber/slog-common"
	slogquickwit "github.com/samber/slog-quickwit"
)

type qwHandlers struct {
	h   slog.Handler
	std slog.Handler
}

func (q qwHandlers) Enabled(ctx context.Context, level slog.Level) bool {
	return q.h.Enabled(ctx, level)
}

func (q qwHandlers) Handle(ctx context.Context, record slog.Record) error {
	go q.std.Handle(ctx, record)
	return q.h.Handle(ctx, record)
}

func (q qwHandlers) WithAttrs(attrs []slog.Attr) slog.Handler {
	return qwHandlers{h: q.h.WithAttrs(attrs), std: q.std.WithAttrs(attrs)}
}

func (q qwHandlers) WithGroup(name string) slog.Handler {
	return qwHandlers{h: q.h.WithGroup(name), std: q.std.WithGroup(name)}
}

var _ slog.Handler = (*qwHandlers)(nil)

func quickwitHandler(client *quickwit.Client) *slog.Logger {
	return slog.New(
		qwHandlers{
			slogquickwit.Option{
				Level:     slog.LevelDebug,
				Client:    client,
				Converter: converter,
			}.NewQuickwitHandler(),
			slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{
				AddSource:   false,
				Level:       slog.LevelDebug,
				ReplaceAttr: nil,
			}),
		},
	)
}

func converter(addSource bool, replaceAttr func(groups []string, a slog.Attr) slog.Attr, loggerAttr []slog.Attr, groups []string, record *slog.Record) map[string]any {
	attrs := slogcommon.AppendRecordAttrsToAttrs(loggerAttr, groups, record)
	attrs = slogcommon.ReplaceAttrs(replaceAttr, []string{}, attrs...)
	attrs = slogcommon.RemoveEmptyAttrs(attrs)

	log := map[string]any{
		"name":      serviceName,
		"timestamp": record.Time.UnixMilli(),
		"level":     record.Level.String(),
		"message":   record.Message,
	}

	if addSource {
		attrs = append(attrs, slogcommon.Source(slogquickwit.SourceKey, record))
	}

	Context := slogcommon.AttrsToMap(attrs...)

	for _, errorKey := range slogquickwit.ErrorKeys {
		if err, ok := Context[errorKey]; ok {
			if e, ok := err.(error); ok {
				log[errorKey] = slogcommon.FormatError(e)
				delete(Context, errorKey)
				break
			}
		}
	}

	log[slogquickwit.ContextKey] = Context

	return log
}
