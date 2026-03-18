package devicestatus

import "time"

// Derive returns the connection status based on meter counts and last seen time.
func Derive(meterCount, onlineCount int, lastSeenAt *time.Time) string {
	if meterCount == 0 {
		return "offline"
	}
	if onlineCount > 0 {
		return "online"
	}
	if lastSeenAt != nil && time.Since(*lastSeenAt) < 30*time.Minute {
		return "degraded"
	}
	return "offline"
}
