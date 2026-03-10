package wsredis

import (
	"context"

	"github.com/redis/go-redis/v9"
)

type redisBroker struct {
	rdb     *redis.Client
	channel string
}

// NewRedisBroker wraps a Redis client as a Broker implementation.
func NewRedisBroker(rdb *redis.Client, channel string) Broker {
	return &redisBroker{rdb: rdb, channel: channel}
}

func (r *redisBroker) Publish(ctx context.Context, message any) error {
	return r.rdb.Publish(ctx, r.channel, message).Err()
}

func (r *redisBroker) Subscribe(ctx context.Context) Subscription {
	return &redisSubscription{sub: r.rdb.Subscribe(ctx, r.channel)}
}

type redisSubscription struct {
	sub *redis.PubSub
}

func (s *redisSubscription) Channel() <-chan string {
	ch := make(chan string)
	go func() {
		defer close(ch)
		for msg := range s.sub.Channel() {
			ch <- msg.Payload
		}
	}()
	return ch
}

func (s *redisSubscription) Close() error {
	return s.sub.Close()
}
