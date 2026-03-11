.PHONY: generate fmt fmt-check dev-up dev-down

generate:
	go generate ./...

fmt:
	@echo "Formatting code and sorting imports..."
	gofmt -s -w .
	go run golang.org/x/tools/cmd/goimports@latest -w -local github.com/anertic/anertic .

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

run-ocpp:
	go run ./cmd/ocpp

# Deployment
GIT_REV := $(shell git rev-parse --short HEAD)
IMAGE_BASE := ghcr.io/anertic/anertic
DEPLOY_API := https://console.nortezh.com/api/deployment.deploy
NT_USER ?=
NT_PASS ?=

define deploy
	curl -X POST $(DEPLOY_API) \
		-H "Content-Type: application/json" \
		-u "$(NT_USER):$(NT_PASS)" \
		-d '{"image":"$(1)","project":"$(2)","name":"$(3)","location":"$(4)"}'
endef

deploy-api:
	docker buildx build \
		--platform linux/amd64 \
		-t $(IMAGE_BASE)/api:$(GIT_REV) \
		-f build/api/Dockerfile \
		--push \
		.
	$(call deploy,$(IMAGE_BASE)/api:$(GIT_REV),anertic,staging-api,olufy-0)

deploy-ocpp:
	docker buildx build \
		--platform linux/amd64 \
		-t $(IMAGE_BASE)/ocpp:$(GIT_REV) \
		-f build/ocpp/Dockerfile \
		--push \
		.
	$(call deploy,$(IMAGE_BASE)/ocpp:$(GIT_REV),anertic,staging-ocpp,olufy-0)

deploy-worker:
	docker buildx build \
		--platform linux/amd64 \
		-t $(IMAGE_BASE)/worker:$(GIT_REV) \
		-f build/worker/Dockerfile \
		--push \
		.
	$(call deploy,$(IMAGE_BASE)/worker:$(GIT_REV),anertic,staging-worker,olufy-0)

deploy-ingester:
	docker buildx build \
		--platform linux/amd64 \
		-t $(IMAGE_BASE)/ingester:$(GIT_REV) \
		-f build/ingester/Dockerfile \
		--push \
		.
	$(call deploy,$(IMAGE_BASE)/ingester:$(GIT_REV),anertic,staging-ingester,olufy-0)

release-api:
	$(call deploy,$(IMAGE_BASE)/api:$(GIT_REV),anertic,api,olufy-0)

release-ocpp:
	$(call deploy,$(IMAGE_BASE)/ocpp:$(GIT_REV),anertic,ocpp,olufy-0)

release-worker:
	$(call deploy,$(IMAGE_BASE)/worker:$(GIT_REV),anertic,worker,olufy-0)

release-ingester:
	$(call deploy,$(IMAGE_BASE)/ingester:$(GIT_REV),anertic,ingester,olufy-0)

deploy-web:
	docker buildx build \
		--platform linux/amd64 \
		-t $(IMAGE_BASE)/web:$(GIT_REV) \
		-f web/app.anertic.com/Dockerfile \
		--push \
		web/app.anertic.com
	$(call deploy,$(IMAGE_BASE)/web:$(GIT_REV),anertic,staging-web,olufy-0)

release-web:
	$(call deploy,$(IMAGE_BASE)/web:$(GIT_REV),anertic,web,olufy-0)
