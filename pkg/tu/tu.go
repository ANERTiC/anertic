// Package tu is the test utility
package tu

import (
	"cmp"
	"context"
	"crypto/rand"
	"database/sql"
	"flag"
	"fmt"
	"math"
	"math/big"
	"os"
	"sync"

	"github.com/acoshift/pgsql/pgctx"
	_ "github.com/lib/pq"
	"github.com/redis/go-redis/v9"

	"github.com/anertic/anertic/pkg/rdctx"
	"github.com/anertic/anertic/schema"
)

type Context struct {
	database       string
	databaseSource string
	pDB            *sql.DB
	cleanupHooks   []func()

	DB  *sql.DB
	RDB *redis.Client
	ctx context.Context
}

func Setup() *Context {
	dbSource := os.Getenv("TEST_DB_URL")
	if dbSource == "" {
		panic("TEST_DB_URL env required")
	}

	redisURL := cmp.Or(os.Getenv("TEST_REDIS_URL"), "redis://localhost:6379")
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		panic(err)
	}
	rdb := redis.NewClient(opt)

	ctx := &Context{
		database:       fmt.Sprintf("test_%d", randInt()),
		databaseSource: dbSource,
		RDB:            rdb,
		ctx:            context.Background(),
	}
	ctx.setup()

	return ctx
}

func (c *Context) setup() {
	var err error

	defer func() {
		if err != nil {
			c.Teardown()
			panic(err)
		}
	}()

	c.pDB, err = sql.Open("postgres", fmt.Sprintf(c.databaseSource, "postgres"))
	if err != nil {
		return
	}

	_, err = c.pDB.Exec(`create database ` + c.database)
	if err != nil {
		return
	}

	c.DB, err = sql.Open("postgres", fmt.Sprintf(c.databaseSource, c.database))
	if err != nil {
		return
	}

	err = schema.Migrate(context.Background(), c.DB)
	if err != nil {
		return
	}
}

func (c *Context) Teardown() {
	for _, f := range c.cleanupHooks {
		f()
	}

	if c.RDB != nil {
		c.RDB.Close()
	}

	if c.DB != nil {
		c.DB.Close()
	}

	if c.pDB != nil {
		c.pDB.Exec(`drop database if exists ` + c.database)
		c.pDB.Close()
	}
}

func (c *Context) Ctx() context.Context {
	ctx := c.ctx
	ctx = pgctx.NewContext(ctx, c.DB)
	ctx = rdctx.NewContext(ctx, c.RDB)
	return ctx
}

func (c *Context) OnCleanup(f func()) {
	c.cleanupHooks = append(c.cleanupHooks, f)
}

var (
	inTest     bool
	inTestOnce sync.Once
)

func InTest() bool {
	inTestOnce.Do(func() {
		inTest = flag.Lookup("test.v") != nil
	})
	return inTest
}

func randInt() int {
	n, err := rand.Int(rand.Reader, big.NewInt(math.MaxInt64))
	if err != nil {
		panic(err)
	}
	return int(n.Int64())
}
