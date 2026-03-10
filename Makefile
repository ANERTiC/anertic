.PHONY: generate fmt fmt-check dev-up dev-down

generate:
	go generate ./...

fmt:
	@echo "Formatting code and sorting imports..."
	gofmt -s -w .
	go run golang.org/x/tools/cmd/goimports@latest -w -local github.com/ANERTiC/anertic .

fmt-check:
	@echo "Checking formatting and import order..."
	@if [ -n "$$(gofmt -s -l .)" ]; then \
		echo 'Files need gofmt:'; \
		gofmt -s -l .; \
		exit 1; \
	fi
	@echo "All files formatted."

dev-up:
	docker compose -f deploy/docker-compose.yaml up -d

dev-down:
	docker compose -f deploy/docker-compose.yaml down

run-api:
	go run ./cmd/api

run-worker:
	go run ./cmd/worker

run-ingester:
	go run ./cmd/ingester
