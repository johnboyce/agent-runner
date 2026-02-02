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
        mock_run.run_type = "agent"
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
        mock_run.run_type = "agent"

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

    def test_execute_workflow_run(self):
        """Test workflow run execution"""
        agent = SimpleAgent()

        # Mock database and run
        mock_db = Mock()
        mock_run = Mock(spec=Run)
        mock_run.id = 1
        mock_run.goal = "Generate Quarkus project"
        mock_run.status = "QUEUED"
        mock_run.run_type = "workflow"
        mock_run.project_id = 1
        mock_run.options = '{"workflow_name": "quarkus-bootstrap-v1"}'

        mock_project = Mock()
        mock_project.id = 1
        mock_project.local_path = "/tmp/test-project"

        # Setup queries to return correct results
        from app.models import Project
        
        def query_side_effect(model):
            query_mock = Mock()
            filter_mock = Mock()
            
            if model == Run:
                # For the update query
                filter_mock.update.return_value = 1
                # For the select queries
                filter_mock.first.return_value = mock_run
                query_mock.filter.return_value = filter_mock
            elif model == Project:
                filter_mock.first.return_value = mock_project
                query_mock.filter.return_value = filter_mock
            else:
                query_mock.filter.return_value = filter_mock
                
            return query_mock
        
        mock_db.query.side_effect = query_side_effect

        # Mock workflow engine
        mock_engine = Mock()
        mock_engine.execute_workflow.return_value = {
            "workflow_name": "quarkus-bootstrap-v1",
            "steps": [{"step": 1}],
            "artifacts": []
        }

        with patch('app.agent.SessionLocal', return_value=mock_db):
            with patch('app.agent.WorkflowEngine', return_value=mock_engine):
                with patch('app.agent.get_workflow') as mock_get_workflow:
                    with patch('app.agent.apply_model_overrides') as mock_apply_overrides:
                        mock_workflow = Mock()
                        mock_workflow.name = "quarkus-bootstrap-v1"
                        mock_workflow.version = "1.0.0"
                        mock_get_workflow.return_value = mock_workflow
                        
                        # apply_model_overrides should return the same mock workflow
                        mock_apply_overrides.return_value = mock_workflow
                        
                        result = agent.execute_run(1)

        # Should succeed
        assert result is True

        # Should have executed workflow
        mock_engine.execute_workflow.assert_called_once()


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
