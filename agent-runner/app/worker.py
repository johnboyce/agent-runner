"""
Background worker that continuously processes queued runs.

This runs in a separate thread and checks for new runs periodically.
"""
import threading
import time
import logging
import os
from .agent import get_agent

logger = logging.getLogger(__name__)


class BackgroundWorker:
    """
    Background thread that processes queued runs.
    """

    def __init__(self, check_interval: int = 5):
        """
        Args:
            check_interval: Seconds between checking for queued runs
        """
        self.check_interval = check_interval
        self.running = False
        self.thread = None
        self.agent = get_agent()

    def start(self):
        """Start the background worker thread"""
        if self.running:
            logger.warning("Worker already running")
            return

        self.running = True
        self.thread = threading.Thread(target=self._worker_loop, daemon=True)
        self.thread.start()
        logger.info(f"Background worker started (check interval: {self.check_interval}s)")

    def stop(self):
        """Stop the background worker thread"""
        self.running = False
        if self.thread:
            self.thread.join(timeout=10)
            logger.info("Background worker stopped")

    def _worker_loop(self):
        """Main worker loop that runs in background thread"""
        logger.info("Worker loop started")

        while self.running:
            try:
                # Process any queued runs
                self.agent.process_queued_runs()

                # Sleep before next check
                time.sleep(self.check_interval)

            except Exception as e:
                logger.error(f"Error in worker loop: {e}")
                time.sleep(self.check_interval)

        logger.info("Worker loop exited")


# Global worker instance
_worker = None


def get_worker() -> BackgroundWorker:
    """Get or create the global worker instance"""
    global _worker
    if _worker is None:
        # Allow configuring check interval via environment variable
        check_interval = int(os.getenv("WORKER_CHECK_INTERVAL", "5"))
        _worker = BackgroundWorker(check_interval=check_interval)
        logger.info(f"Worker configured with check_interval={check_interval}s")
    return _worker


def start_worker():
    """Start the background worker"""
    worker = get_worker()
    worker.start()


def stop_worker():
    """Stop the background worker"""
    worker = get_worker()
    worker.stop()
