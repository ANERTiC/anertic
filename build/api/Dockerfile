FROM golang:1.26-alpine AS build

ENV GOOS=linux
ENV GOARCH=amd64
ENV CGO_ENABLED=0
RUN apk add --no-cache git
RUN mkdir -p /workspace
WORKDIR /workspace
ADD go.mod go.sum ./
RUN --mount=type=cache,target=/go/pkg/mod go mod download
ADD . .
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    go build -o .build/api -ldflags "-w -s" ./cmd/api
RUN --mount=type=cache,target=/go/pkg/mod --mount=type=cache,target=/root/.cache/go-build \
    go run ./cmd/docgen

FROM gcr.io/distroless/static

WORKDIR /app

COPY --from=build --link /workspace/.build/* ./
COPY --from=build --link /workspace/docs.json ./
ENTRYPOINT ["/app/api"]
