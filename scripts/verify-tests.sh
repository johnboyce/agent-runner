#!/bin/bash
# Verify all tests pass before committing

set -e

echo "🧪 Running all tests to verify fixes..."
echo ""

cd agent-runner
source .venv/bin/activate

# Run tests with verbose output
pytest -v --tb=short

echo ""
echo "✅ All tests passed!"
echo ""
echo "Summary:"
echo "  - Unit tests: test_agent.py, test_worker.py"
echo "  - Integration tests: test_routes.py"
echo ""
echo "Ready to commit!"
