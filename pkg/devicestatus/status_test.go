package devicestatus

import (
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
)

func TestDerive(t *testing.T) {
	now := time.Now()
	old := now.Add(-1 * time.Hour)

	t.Run("no_meters_is_offline", func(t *testing.T) {
		t.Parallel()
		assert.Equal(t, "offline", Derive(0, 0, nil))
	})

	t.Run("some_online_is_online", func(t *testing.T) {
		t.Parallel()
		assert.Equal(t, "online", Derive(3, 1, &now))
	})

	t.Run("all_online_is_online", func(t *testing.T) {
		t.Parallel()
		assert.Equal(t, "online", Derive(2, 2, &now))
	})

	t.Run("none_online_but_recent_is_degraded", func(t *testing.T) {
		t.Parallel()
		recent := time.Now().Add(-10 * time.Minute)
		assert.Equal(t, "degraded", Derive(2, 0, &recent))
	})

	t.Run("none_online_at_boundary_30m_is_offline", func(t *testing.T) {
		t.Parallel()
		boundary := time.Now().Add(-30 * time.Minute)
		assert.Equal(t, "offline", Derive(2, 0, &boundary))
	})

	t.Run("none_online_and_stale_is_offline", func(t *testing.T) {
		t.Parallel()
		assert.Equal(t, "offline", Derive(2, 0, &old))
	})

	t.Run("none_online_and_nil_last_seen_is_offline", func(t *testing.T) {
		t.Parallel()
		assert.Equal(t, "offline", Derive(1, 0, nil))
	})
}
