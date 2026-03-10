package restful

import (
	"encoding/json"
	"errors"

	"github.com/acoshift/arpc/v2"
	"github.com/acoshift/pgsql/pgstmt"
)

func NewPaginate(page, limit int64) *Paginate {
	if page <= 0 {
		page = 1
	}
	if limit <= 0 {
		limit = 10
	}
	return &Paginate{
		page:  uint64(page),
		limit: uint64(limit),
	}
}

type Paginate struct {
	page  uint64
	limit uint64
	count int64
}

func (p *Paginate) Count(f func() (n int64, err error)) error {
	n, err := f()
	if err != nil {
		return err
	}
	p.count = n
	return nil
}

func (p *Paginate) Offset() int64 {
	return int64((p.page - 1) * p.limit)
}

func (p *Paginate) Limit() int64 {
	return int64(p.limit)
}

func (p Paginate) MarshalJSON() ([]byte, error) {
	return json.Marshal(map[string]interface{}{
		"page":       p.page,
		"limit":      p.limit,
		"totalItems": p.count,
		"totalPages": (p.count + int64(p.limit) - 1) / int64(p.limit),
		"firstPage":  p.page == 1,
		"lastPage":   p.page*p.limit >= uint64(p.count),
	})
}

type v struct {
	Page  uint64 `json:"page"`
	Limit uint64 `json:"limit"`
}

func (p *Paginate) UnmarshalJSON(b []byte) error {
	if b == nil {
		return errors.New("paginate: invalid json")
	}
	var x v
	if err := json.Unmarshal(b, &x); err != nil {
		return err
	}
	if x.Page < 1 {
		return arpc.NewErrorCode("paginate-invalid", "page must be greater than or equal to 1")
	}
	if x.Limit <= 0 {
		return arpc.NewErrorCode("paginate-invalid", "limit must be greater than 0")
	}
	p.page = x.Page
	p.limit = x.Limit
	return nil
}

func (p *Paginate) Total() int64 {
	return p.count
}

func (p *Paginate) Do(b pgstmt.SelectStatement) {
	b.Limit(p.Limit())
	b.Offset(p.Offset())
}
