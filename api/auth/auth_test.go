package auth

import (
	"testing"
	"time"

	"github.com/acoshift/pgsql/pgctx"

	"github.com/anertic/anertic/pkg/tu"
)

func TestUpsertUser(t *testing.T) {
	tc := tu.Setup()
	defer tc.Teardown()
	ctx := tc.Ctx()

	t.Run("insert new user", func(t *testing.T) {
		id, err := upsertUser(ctx, "google", "g-123", "alice@example.com", "Alice", "https://example.com/alice.png")
		if err != nil {
			t.Fatal(err)
		}
		if id == "" {
			t.Fatal("expected non-empty id")
		}

		var (
			email      string
			name       string
			picture    string
			provider   string
			providerID string
			createdAt  time.Time
			updatedAt  time.Time
		)
		err = pgctx.QueryRow(ctx, `
			select
				email,
				name,
				picture,
				provider,
				provider_id,
				created_at,
				updated_at
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
			&createdAt,
			&updatedAt,
		)
		if err != nil {
			t.Fatal(err)
		}
		if email != "alice@example.com" {
			t.Errorf("expected email alice@example.com, got %s", email)
		}
		if name != "Alice" {
			t.Errorf("expected name Alice, got %s", name)
		}
		if picture != "https://example.com/alice.png" {
			t.Errorf("expected picture https://example.com/alice.png, got %s", picture)
		}
		if provider != "google" {
			t.Errorf("expected provider google, got %s", provider)
		}
		if providerID != "g-123" {
			t.Errorf("expected provider_id g-123, got %s", providerID)
		}
	})

	t.Run("upsert existing user updates fields", func(t *testing.T) {
		// First insert
		id1, err := upsertUser(ctx, "google", "g-456", "bob@example.com", "Bob", "https://example.com/bob.png")
		if err != nil {
			t.Fatal(err)
		}

		// Upsert same email with updated fields
		id2, err := upsertUser(ctx, "google", "g-789", "bob@example.com", "Bobby", "https://example.com/bobby.png")
		if err != nil {
			t.Fatal(err)
		}

		if id1 != id2 {
			t.Errorf("expected same id on upsert, got %s and %s", id1, id2)
		}

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
		if err != nil {
			t.Fatal(err)
		}
		if name != "Bobby" {
			t.Errorf("expected updated name Bobby, got %s", name)
		}
		if picture != "https://example.com/bobby.png" {
			t.Errorf("expected updated picture, got %s", picture)
		}
		if providerID != "g-789" {
			t.Errorf("expected updated provider_id g-789, got %s", providerID)
		}
	})

	t.Run("different emails return different ids", func(t *testing.T) {
		id1, err := upsertUser(ctx, "google", "g-aaa", "carol@example.com", "Carol", "")
		if err != nil {
			t.Fatal(err)
		}

		id2, err := upsertUser(ctx, "google", "g-bbb", "dave@example.com", "Dave", "")
		if err != nil {
			t.Fatal(err)
		}

		if id1 == id2 {
			t.Errorf("expected different ids for different emails, got %s for both", id1)
		}
	})
}
