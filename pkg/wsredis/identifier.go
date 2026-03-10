package wsredis

import "net/http"

// TopicFromQuery returns an Identifier that reads from a query parameter.
func TopicFromQuery(key string) Identifier {
	return func(r *http.Request) string {
		return r.URL.Query().Get(key)
	}
}

// TopicFromPath returns an Identifier that reads from a path value.
// e.g. "GET /ocpp/{id}" → TopicFromPath("id")
func TopicFromPath(key string) Identifier {
	return func(r *http.Request) string {
		return r.PathValue(key)
	}
}

// TopicFromHeader returns an Identifier that reads from a request header.
func TopicFromHeader(key string) Identifier {
	return func(r *http.Request) string {
		return r.Header.Get(key)
	}
}
