package schema

import (
	"context"
	"database/sql"
	"embed"
	"io/fs"
	"sort"
)

//go:embed *.sql
var FS embed.FS

func Migrate(ctx context.Context, db *sql.DB) error {
	entries, err := fs.ReadDir(FS, ".")
	if err != nil {
		return err
	}

	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Name() < entries[j].Name()
	})

	for _, e := range entries {
		if e.IsDir() {
			continue
		}

		data, err := fs.ReadFile(FS, e.Name())
		if err != nil {
			return err
		}

		if _, err := db.ExecContext(ctx, string(data)); err != nil {
			return err
		}
	}

	return nil
}
