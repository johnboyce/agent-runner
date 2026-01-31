"""
Unit tests for the agent execution system.
"""
import pytest
from unittest.mock import Mock, patch
from app.agent import SimpleAgent
from app.models import Run, Event


class TestSimpleAgent:
    """Test the SimpleAgent class."""

    def test_execute_run_claims_atomically(self):
        """Test that execute_run uses atomic claim to prevent double execution."""
        agent = SimpleAgent()

        # Mock the database session
        mock_db = Mock()
        mock_query = Mock()

        # Simulate another worker already claimed the run
        mock_query.filter.return_value.update.return_value = 0
        mock_db.query.return_value = mock_query

        with patch('app.agent.SessionLocal', return_value=mock_db):
            result = agent.execute_run(1)

        # Should return False when claim fails
        assert result is False

        # Should have attempted atomic update
        mock_query.filter.return_value.update.assert_called_once()

    def test_execute_run_success_flow(self):
        """Test successful run execution logs all expected events."""
        agent = SimpleAgent()

        # Mock database and run
        mock_db = Mock()
        mock_query = Mock()
        mock_run = Mock(spec=Run)
        mock_run.id = 1
        mock_run.goal = "Test goal"
        mock_run.status = "QUEUED"
        mock_run.current_iteration = 0

        # Mock successful claim
        mock_query.filter.return_value.update.return_value = 1
        mock_query.filter.return_value.first.return_value = mock_run
        mock_db.query.return_value = mock_query

        with patch('app.agent.SessionLocal', return_value=mock_db):
            with patch('app.agent.time.sleep'):  # Skip actual sleep
                result = agent.execute_run(1)

        # Should succeed
        assert result is True

        # Should have set status to COMPLETED
        assert mock_run.status == "COMPLETED"

        # Should have committed multiple times (once per phase)
        assert mock_db.commit.call_count >= 5

    def test_execute_run_handles_errors(self):
        """Test that execute_run marks run as FAILED on exceptions."""
        agent = SimpleAgent()

        mock_db = Mock()
        mock_query = Mock()
        mock_run = Mock(spec=Run)
        mock_run.id = 1
        mock_run.goal = "Test goal"

        # Mock successful claim
        mock_query.filter.return_value.update.return_value = 1

        # First call for claim succeeds, second call after re-fetch raises error
        mock_query.filter.return_value.first.side_effect = [
            mock_run,  # First call during execute succeeds
            mock_run   # Call during error handler succeeds
        ]

        # Make the execution fail by raising error during time.sleep
        mock_db.query.return_value = mock_query

        with patch('app.agent.SessionLocal', return_value=mock_db):
            with patch('app.agent.time.sleep', side_effect=Exception("Simulated error")):
                result = agent.execute_run(1)

        # Should return False on error
        assert result is False

        # Should have attempted to mark as FAILED
        assert mock_run.status == "FAILED"


class TestEventLogging:
    """Test event logging behavior."""

    def test_log_event_does_not_commit(self):
        """Test that _log_event doesn't commit (caller controls transaction)."""
        agent = SimpleAgent()
        mock_db = Mock()

        agent._log_event(mock_db, run_id=1, event_type="TEST", payload="test")

        # Should add event to session
        mock_db.add.assert_called_once()

        # Should flush but NOT commit
        mock_db.flush.assert_called_once()
        mock_db.commit.assert_not_called()

    def test_log_event_handles_errors_gracefully(self):
        """Test that _log_event doesn't crash on errors."""
        agent = SimpleAgent()
        mock_db = Mock()
        mock_db.add.side_effect = Exception("DB error")

        # Should not raise exception
        agent._log_event(mock_db, run_id=1, event_type="TEST", payload="test")

        # Should have attempted to add
        mock_db.add.assert_called_once()
