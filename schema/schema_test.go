package schema_test

import (
	"context"
	"crypto/rand"
	"database/sql"
	"fmt"
	"math/big"
	"os"
	"testing"

	_ "github.com/lib/pq"
	"github.com/stretchr/testify/require"

	"github.com/anertic/anertic/schema"
)

func setupDB(t *testing.T) *sql.DB {
	t.Helper()

	dbSource := os.Getenv("TEST_DB_URL")
	if dbSource == "" {
		t.Skip("TEST_DB_URL env required")
	}

	n, err := rand.Int(rand.Reader, big.NewInt(1<<62))
	require.NoError(t, err)
	dbName := fmt.Sprintf("test_schema_%d", n.Int64())

	pDB, err := sql.Open("postgres", fmt.Sprintf(dbSource, "postgres"))
	require.NoError(t, err)

	_, err = pDB.Exec(`create database ` + dbName)
	require.NoError(t, err)

	t.Cleanup(func() {
		pDB.Exec(`drop database if exists ` + dbName)
		pDB.Close()
	})

	db, err := sql.Open("postgres", fmt.Sprintf(dbSource, dbName))
	require.NoError(t, err)

	t.Cleanup(func() {
		db.Close()
	})

	return db
}

func TestMigrate(t *testing.T) {
	db := setupDB(t)
	ctx := context.Background()

	t.Run("first run", func(t *testing.T) {
		err := schema.Migrate(ctx, db)
		require.NoError(t, err)
	})

	t.Run("idempotent", func(t *testing.T) {
		err := schema.Migrate(ctx, db)
		require.NoError(t, err)
	})
}
