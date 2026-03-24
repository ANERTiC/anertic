package weather

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/redis/go-redis/v9"
)

const cacheTTL = 15 * time.Minute

// Cache wraps weather fetching with Redis caching.
type Cache struct {
	rdb redis.UniversalClient
}

// NewCache creates a new weather cache backed by Redis.
func NewCache(rdb redis.UniversalClient) *Cache {
	return &Cache{rdb: rdb}
}

// coordKey returns a cache key for coordinates rounded to ~1km precision.
func coordKey(lat, lon float64, days int) string {
	return fmt.Sprintf("weather:%.2f:%.2f:%d", lat, lon, days)
}

// geocodeKey returns a cache key for geocode results.
func geocodeKey(location string) string {
	return fmt.Sprintf("weather:geo:%s", location)
}

type geocodeCacheEntry struct {
	Lat  float64 `json:"lat"`
	Lon  float64 `json:"lon"`
	Name string  `json:"name"`
}

// Geocode resolves a location name to coordinates, caching the result.
func (c *Cache) Geocode(ctx context.Context, location string) (lat, lon float64, name string, err error) {
	key := geocodeKey(location)

	data, err := c.rdb.Get(ctx, key).Bytes()
	if err == nil {
		var entry geocodeCacheEntry
		if json.Unmarshal(data, &entry) == nil {
			return entry.Lat, entry.Lon, entry.Name, nil
		}
	}

	lat, lon, name, err = Geocode(ctx, location)
	if err != nil {
		return 0, 0, "", err
	}

	if raw, e := json.Marshal(geocodeCacheEntry{Lat: lat, Lon: lon, Name: name}); e == nil {
		c.rdb.Set(ctx, key, raw, 24*time.Hour)
	}

	return lat, lon, name, nil
}

// Fetch gets weather for a location name, caching both geocode and weather results.
func (c *Cache) Fetch(ctx context.Context, location string, days int) (*Result, error) {
	if days <= 0 {
		days = 1
	}
	if days > 7 {
		days = 7
	}

	lat, lon, locName, err := c.Geocode(ctx, location)
	if err != nil {
		return nil, err
	}

	return c.FetchByCoords(ctx, lat, lon, locName, days)
}

// FetchByCoords gets weather using lat/lon, caching the result.
func (c *Cache) FetchByCoords(ctx context.Context, lat, lon float64, locationName string, days int) (*Result, error) {
	if days <= 0 {
		days = 1
	}
	if days > 7 {
		days = 7
	}

	key := coordKey(lat, lon, days)

	data, err := c.rdb.Get(ctx, key).Bytes()
	if err == nil {
		var result Result
		if json.Unmarshal(data, &result) == nil {
			return &result, nil
		}
	}

	result, err := FetchByCoords(ctx, lat, lon, locationName, days)
	if err != nil {
		return nil, err
	}

	if raw, e := json.Marshal(result); e == nil {
		c.rdb.Set(ctx, key, raw, cacheTTL)
	}

	return result, nil
}

// RawJSON returns weather JSON for a location, caching the result.
func (c *Cache) RawJSON(ctx context.Context, location string, days int) (string, error) {
	if days <= 0 {
		days = 1
	}
	if days > 7 {
		days = 7
	}

	lat, lon, locName, err := c.Geocode(ctx, location)
	if err != nil {
		return "", err
	}

	key := fmt.Sprintf("weather:raw:%.2f:%.2f:%d", lat, lon, days)

	data, err := c.rdb.Get(ctx, key).Result()
	if err == nil {
		return data, nil
	}

	raw, err := RawJSONByCoords(ctx, lat, lon, locName, days)
	if err != nil {
		return "", err
	}

	c.rdb.Set(ctx, key, raw, cacheTTL)

	return raw, nil
}
