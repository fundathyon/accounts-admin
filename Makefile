.PHONY: help install dev up mock dev-mock build start lint clean reset docker-build docker-up docker-down

help:
	@echo "Available targets:"
	@echo "  make install      Install dependencies (bun)"
	@echo "  make dev          Run the Next.js dev server against the real accounts API (alias: up)"
	@echo "  make mock         Run only the mock accounts backend (http://localhost:8099)"
	@echo "  make dev-mock     Run Next.js + mock backend together — no Go service needed"
	@echo "                    (MOCK_NO_APPS=1 starts with no apps, to test onboarding)"
	@echo "  make build        Build the production bundle"
	@echo "  make start        Run the production server (after build)"
	@echo "  make lint         Run eslint"
	@echo "  make clean        Remove build artifacts (.next, tsconfig.tsbuildinfo)"
	@echo "  make reset        Clean + remove node_modules and reinstall"
	@echo "  make docker-build Build the Docker image"
	@echo "  make docker-up    Run via docker compose (detached)"
	@echo "  make docker-down  Stop the docker compose stack"

install:
	bun install

dev:
	bun run dev

up: dev

mock:
	bun run mock-server/server.ts

dev-mock:
	@trap 'kill 0' EXIT INT TERM; \
	bun run mock-server/server.ts & \
	ENVIRONMENT=mock bun run dev & \
	wait

build:
	bun run build

start:
	bun run start

lint:
	bun run lint

clean:
	rm -rf .next tsconfig.tsbuildinfo

reset: clean
	rm -rf node_modules
	bun install

docker-build:
	docker compose build

docker-up:
	docker compose up -d

docker-down:
	docker compose down

.DEFAULT_GOAL := help
