"""
Unit tests for the background worker.
"""
import pytest
from unittest.mock import Mock, patch
from app.worker import BackgroundWorker, get_worker


class TestBackgroundWorker:
    """Test the BackgroundWorker class."""

    def test_worker_starts_thread(self):
        """Test that start() creates and starts a daemon thread."""
        worker = BackgroundWorker(check_interval=1)

        with patch.object(worker, '_worker_loop'):
            worker.start()

        # Should have started
        assert worker.running is True
        assert worker.thread is not None
        assert worker.thread.daemon is True

        # Clean up
        worker.stop()

    def test_worker_stops_cleanly(self):
        """Test that stop() terminates the worker thread."""
        worker = BackgroundWorker(check_interval=1)

        with patch.object(worker, '_worker_loop'):
            worker.start()
            worker.stop()

        # Should have stopped
        assert worker.running is False

    def test_worker_does_not_start_twice(self):
        """Test that calling start() twice doesn't create duplicate threads."""
        worker = BackgroundWorker(check_interval=1)

        with patch.object(worker, '_worker_loop'):
            worker.start()
            first_thread = worker.thread

            worker.start()  # Try to start again
            second_thread = worker.thread

        # Should be the same thread
        assert first_thread is second_thread

        # Clean up
        worker.stop()

    def test_worker_loop_processes_queued_runs(self):
        """Test that _worker_loop calls agent.process_queued_runs."""
        worker = BackgroundWorker(check_interval=0.1)

        # Mock the agent
        mock_agent = Mock()
        worker.agent = mock_agent

        # Run one iteration
        worker.running = True

        with patch('app.worker.time.sleep') as mock_sleep:
            # Make sleep stop the loop
            def stop_after_sleep(*args):
                worker.running = False
            mock_sleep.side_effect = stop_after_sleep

            worker._worker_loop()

        # Should have processed runs
        mock_agent.process_queued_runs.assert_called_once()

    def test_worker_loop_handles_errors(self):
        """Test that _worker_loop continues after errors."""
        worker = BackgroundWorker(check_interval=0.1)

        # Mock agent that raises error first time
        mock_agent = Mock()
        mock_agent.process_queued_runs.side_effect = [
            Exception("Test error"),
            None  # Succeeds second time
        ]
        worker.agent = mock_agent

        worker.running = True
        call_count = 0

        with patch('app.worker.time.sleep') as mock_sleep:
            def stop_after_two_calls(*args):
                nonlocal call_count
                call_count += 1
                if call_count >= 2:
                    worker.running = False
            mock_sleep.side_effect = stop_after_two_calls

            worker._worker_loop()

        # Should have tried twice despite error
        assert mock_agent.process_queued_runs.call_count == 2


class TestGetWorker:
    """Test the get_worker singleton function."""

    def test_get_worker_creates_singleton(self):
        """Test that get_worker returns the same instance."""
        # Reset the global
        import app.worker
        app.worker._worker = None

        worker1 = get_worker()
        worker2 = get_worker()

        # Should be the same instance
        assert worker1 is worker2

    def test_get_worker_respects_env_var(self):
        """Test that WORKER_CHECK_INTERVAL env var is used."""
        import app.worker
        app.worker._worker = None

        with patch.dict('os.environ', {'WORKER_CHECK_INTERVAL': '10'}):
            worker = get_worker()

        # Should have the configured interval
        assert worker.check_interval == 10

    def test_get_worker_uses_default_without_env(self):
        """Test that default check_interval is used when env var not set."""
        import app.worker
        app.worker._worker = None

        with patch.dict('os.environ', {}, clear=True):
            worker = get_worker()

        # Should use default of 5 seconds
        assert worker.check_interval == 5
