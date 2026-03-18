package schema_test

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/anertic/anertic/pkg/tu"
	"github.com/anertic/anertic/schema"
)

func TestMigrate(t *testing.T) {
	tc := tu.Setup()
	defer tc.Teardown()

	// tu.Setup() already runs Migrate once; verify it is idempotent.
	t.Run("idempotent", func(t *testing.T) {
		err := schema.Migrate(tc.Ctx(), tc.DB)
		require.NoError(t, err)
	})
}
