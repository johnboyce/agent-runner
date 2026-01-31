"""
pytest configuration for agent-runner tests.

Sets up test environment before any tests run.
"""
import os

# Disable worker during all tests to prevent background thread from starting
os.environ["DISABLE_WORKER"] = "1"
