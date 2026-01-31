.PHONY: help install start stop restart clean test status logs git-diff

# Default target
help:
	@echo "AI Dev Factory - Development Commands"
	@echo ""
	@echo "Service Management:"
	@echo "  make install          Install all dependencies"
	@echo "  make start            Start all services (agent-runner + console)"
	@echo "  make stop             Stop all services"
	@echo "  make restart          Restart all services"
	@echo "  make status           Check service status"
	@echo ""
	@echo "Individual Services:"
	@echo "  make start-agent      Start agent runner only"
	@echo "  make start-console    Start console only"
	@echo "  make stop-agent       Stop agent runner only"
	@echo "  make stop-console     Stop console only"
	@echo ""
	@echo "Development:"
	@echo "  make clean            Clean build artifacts and caches"
	@echo "  make test             Run unit tests"
	@echo "  make test-verbose     Run tests with verbose output"
	@echo "  make test-coverage    Run tests with coverage report"
	@echo "  make test-agent       Test agent execution end-to-end"
	@echo "  make logs             Show service logs"
	@echo "  make git-diff         Show git diff and copy to clipboard"
	@echo ""
	@echo "Infrastructure:"
	@echo "  make start-forgejo    Start Forgejo (Git)"
	@echo "  make start-taiga      Start Taiga (PM)"
	@echo "  make stop-forgejo     Stop Forgejo"
	@echo "  make stop-taiga       Stop Taiga"
	@echo ""
	@echo "Database:"
	@echo "  make db-reset         Reset agent runner database"
	@echo "  make db-shell         Open SQLite shell"

# Installation
install: install-agent install-console
	@echo "✅ All dependencies installed"

install-agent:
	@echo "📦 Installing agent runner dependencies..."
	cd agent-runner && python -m venv .venv && \
		. .venv/bin/activate && \
		pip install -r requirements.txt

install-console:
	@echo "📦 Installing console dependencies..."
	cd console && npm install

# Service Management
start:
	@echo "🚀 Starting all services..."
	@$(MAKE) start-agent-bg
	@sleep 3
	@$(MAKE) start-console-bg
	@echo "✅ Services started"
	@echo "   Agent Runner: http://localhost:8000"
	@echo "   Console:      http://localhost:3001"

start-agent:
	@echo "🚀 Starting agent runner..."
	cd agent-runner && . .venv/bin/activate && \
		python -m uvicorn app.main:app --reload --port 8000

start-agent-bg:
	@echo "🚀 Starting agent runner (background)..."
	@cd agent-runner && . .venv/bin/activate && \
		python -m uvicorn app.main:app --reload --port 8000 > /tmp/agent-runner.log 2>&1 & \
		echo $$! > /tmp/agent-runner.pid
	@echo "   PID: $$(cat /tmp/agent-runner.pid)"
	@echo "   Logs: tail -f /tmp/agent-runner.log"

start-console:
	@echo "🚀 Starting console..."
	cd console && npm run dev -- -p 3001

start-console-bg:
	@echo "🚀 Starting console (background)..."
	@cd console && npm run dev -- -p 3001 > /tmp/console.log 2>&1 & \
		echo $$! > /tmp/console.pid
	@echo "   PID: $$(cat /tmp/console.pid)"
	@echo "   Logs: tail -f /tmp/console.log"

stop:
	@echo "🛑 Stopping all services..."
	@$(MAKE) stop-agent
	@$(MAKE) stop-console
	@echo "✅ All services stopped"

stop-agent:
	@echo "🛑 Stopping agent runner..."
	@pkill -f "uvicorn app.main:app" 2>/dev/null || true
	@rm -f /tmp/agent-runner.pid /tmp/agent-runner.log

stop-console:
	@echo "🛑 Stopping console..."
	@pkill -f "next dev" 2>/dev/null || true
	@rm -f /tmp/console.pid /tmp/console.log

restart: stop start

status:
	@echo "📊 Service Status:"
	@echo ""
	@echo "Agent Runner (port 8000):"
	@lsof -i :8000 2>/dev/null || echo "  Not running"
	@echo ""
	@echo "Console (port 3001):"
	@lsof -i :3001 2>/dev/null || echo "  Not running"
	@echo ""
	@echo "Forgejo (port 3000):"
	@lsof -i :3000 2>/dev/null || echo "  Not running"
	@echo ""
	@echo "Taiga (port 9000):"
	@lsof -i :9000 2>/dev/null || echo "  Not running"

logs:
	@echo "📝 Recent logs (Ctrl+C to exit):"
	@echo ""
	@tail -f /tmp/agent-runner.log /tmp/console.log 2>/dev/null || \
		echo "No log files found. Services may not be running in background mode."

# Infrastructure
start-forgejo:
	@echo "🚀 Starting Forgejo..."
	cd docker/forgejo && docker compose up -d
	@echo "✅ Forgejo started at http://localhost:3000"

stop-forgejo:
	@echo "🛑 Stopping Forgejo..."
	cd docker/forgejo && docker compose down

start-taiga:
	@echo "🚀 Starting Taiga..."
	cd docker/taiga && docker compose up -d
	@echo "✅ Taiga started at http://localhost:9000"

stop-taiga:
	@echo "🛑 Stopping Taiga..."
	cd docker/taiga && docker compose down

# Database
db-reset:
	@echo "⚠️  Resetting agent runner database..."
	@read -p "Are you sure? This will delete all data. [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		rm -f agent-runner/db/platform.db; \
		echo "✅ Database reset. It will be recreated on next start."; \
	else \
		echo "❌ Cancelled."; \
	fi

db-shell:
	@echo "🔍 Opening SQLite shell..."
	@echo "   Type .tables to list tables"
	@echo "   Type .quit to exit"
	@sqlite3 agent-runner/db/platform.db

# Development
clean:
	@echo "🧹 Cleaning build artifacts..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type f -name "*.pyo" -delete 2>/dev/null || true
	find . -type d -name ".next" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "node_modules/.cache" -exec rm -rf {} + 2>/dev/null || true
	rm -f /tmp/agent-runner.pid /tmp/agent-runner.log
	rm -f /tmp/console.pid /tmp/console.log
	@echo "✅ Cleaned"

test:
	@echo "🧪 Running unit tests..."
	cd agent-runner && . .venv/bin/activate && pytest

test-verbose:
	@echo "🧪 Running unit tests (verbose)..."
	cd agent-runner && . .venv/bin/activate && pytest -v

test-coverage:
	@echo "🧪 Running tests with coverage..."
	cd agent-runner && . .venv/bin/activate && pytest --cov=app --cov-report=term-missing

test-agent:
	@echo "🧪 Testing agent execution..."
	@./scripts/test-agent-execution.sh

# Quick development commands
dev: start
	@echo ""
	@echo "🎯 Development environment ready!"
	@echo ""
	@echo "   Agent Runner API: http://localhost:8000"
	@echo "   Console UI:       http://localhost:3001"
	@echo ""
	@echo "   Run 'make logs' to view logs"
	@echo "   Run 'make stop' to stop services"

# Create test data
seed:
	@echo "🌱 Creating test data..."
	@curl -X POST "http://localhost:8000/projects?name=demo-project&local_path=/tmp/demo" 2>/dev/null
	@echo ""
	@curl -X POST "http://localhost:8000/runs?project_id=1&goal=Create%20a%20README%20file" 2>/dev/null
	@echo ""
	@echo "✅ Test data created"
	@echo "   View at: http://localhost:3001"

# Git diff helper
git-diff:
	@echo "📊 Git diff (staged changes):"
	@echo ""
	@git diff --cached --stat
	@echo ""
	@echo "Copying full diff to clipboard and saving to file..."
	@git diff --cached > /tmp/git-diff-latest.txt
	@git diff --cached | (pbcopy 2>/dev/null || xclip -selection clipboard 2>/dev/null || true)
	@LINES=$$(git diff --cached | wc -l | tr -d ' '); \
	echo "✅ Copied $$LINES lines to clipboard (or saved to /tmp/git-diff-latest.txt)"
	@echo ""
	@echo "💡 Paste with Cmd+V (macOS) or Ctrl+V (Linux)"
	@echo "💡 Or view file: cat /tmp/git-diff-latest.txt"

