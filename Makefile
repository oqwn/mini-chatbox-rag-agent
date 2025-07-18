.PHONY: help install dev build start stop clean test lint

help:
	@echo "Available commands:"
	@echo "  make install    - Install all dependencies"
	@echo "  make dev        - Start development environment with Docker"
	@echo "  make build      - Build production Docker images"
	@echo "  make start      - Start production environment"
	@echo "  make stop       - Stop all containers"
	@echo "  make clean      - Clean up containers and volumes"
	@echo "  make test       - Run all tests"
	@echo "  make lint       - Run linters"

install:
	cd backend && npm install
	cd frontend && npm install

dev:
	docker-compose -f docker-compose.dev.yml up -d
	@echo "Development environment started!"
	@echo "Frontend: http://localhost:3001"
	@echo "Backend: http://localhost:3000"
	@echo "pgAdmin: http://localhost:5050"
	@echo "Qdrant: http://localhost:6333"

build:
	docker-compose build

start:
	docker-compose up -d
	@echo "Production environment started!"
	@echo "Application: http://localhost"

stop:
	docker-compose down
	docker-compose -f docker-compose.dev.yml down

clean:
	docker-compose down -v
	docker-compose -f docker-compose.dev.yml down -v
	rm -rf backend/node_modules frontend/node_modules
	rm -rf backend/dist frontend/dist

test:
	cd backend && npm test
	cd frontend && npm test

lint:
	cd backend && npm run lint
	cd frontend && npm run lint

logs:
	docker-compose logs -f

logs-dev:
	docker-compose -f docker-compose.dev.yml logs -f