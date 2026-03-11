package auth

import (
	"testing"

	"github.com/acoshift/pgsql/pgctx"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/anertic/anertic/pkg/tu"
)

func TestUpsertUser(t *testing.T) {
	tc := tu.Setup()
	defer tc.Teardown()
	ctx := tc.Ctx()

	t.Run("insert new user", func(t *testing.T) {
		id, err := upsertUser(ctx, "google", "g-123", "alice@example.com", "Alice", "https://example.com/alice.png")
		require.NoError(t, err)
		require.NotEmpty(t, id)

		var (
			email      string
			name       string
			picture    string
			provider   string
			providerID string
		)
		err = pgctx.QueryRow(ctx, `
			select
				email,
				name,
				picture,
				provider,
				provider_id
			from users
			where id = $1
		`,
			id,
		).Scan(
			&email,
			&name,
			&picture,
			&provider,
			&providerID,
		)
		require.NoError(t, err)
		assert.Equal(t, "alice@example.com", email)
		assert.Equal(t, "Alice", name)
		assert.Equal(t, "https://example.com/alice.png", picture)
		assert.Equal(t, "google", provider)
		assert.Equal(t, "g-123", providerID)
	})

	t.Run("upsert existing user updates fields", func(t *testing.T) {
		id1, err := upsertUser(ctx, "google", "g-456", "bob@example.com", "Bob", "https://example.com/bob.png")
		require.NoError(t, err)

		// Upsert same email with updated fields
		id2, err := upsertUser(ctx, "google", "g-789", "bob@example.com", "Bobby", "https://example.com/bobby.png")
		require.NoError(t, err)
		assert.Equal(t, id1, id2)

		var (
			name       string
			picture    string
			providerID string
		)
		err = pgctx.QueryRow(ctx, `
			select
				name,
				picture,
				provider_id
			from users
			where id = $1
		`,
			id1,
		).Scan(
			&name,
			&picture,
			&providerID,
		)
		require.NoError(t, err)
		assert.Equal(t, "Bobby", name)
		assert.Equal(t, "https://example.com/bobby.png", picture)
		assert.Equal(t, "g-789", providerID)
	})

	t.Run("different emails return different ids", func(t *testing.T) {
		id1, err := upsertUser(ctx, "google", "g-aaa", "carol@example.com", "Carol", "")
		require.NoError(t, err)

		id2, err := upsertUser(ctx, "google", "g-bbb", "dave@example.com", "Dave", "")
		require.NoError(t, err)

		assert.NotEqual(t, id1, id2)
	})
}
