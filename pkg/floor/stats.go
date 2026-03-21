package floor

import (
	"context"
	"encoding/json"

	"github.com/acoshift/pgsql/pgctx"
	"github.com/shopspring/decimal"
)

type Stats struct {
	DeviceCount      int             `json:"deviceCount"`
	LivePowerW       decimal.Decimal `json:"livePowerW"`
	ConnectionStatus string          `json:"connectionStatus"`
}

func UpdateStats(ctx context.Context, siteID string, level int, stats *Stats) error {
	b, err := json.Marshal(stats)
	if err != nil {
		return err
	}

	_, err = pgctx.Exec(ctx, `
		update floors
		set stats = $3,
		    updated_at = now()
		where site_id = $1
		  and level = $2
	`,
		siteID,
		level,
		b,
	)
	return err
}
