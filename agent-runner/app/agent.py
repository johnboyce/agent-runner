"""
Simple agent executor that processes runs in the background.

This is a "dumb agent" - just proves the execution flow works.
Future versions will add real LLM integration, file operations, etc.
"""
import os
import time
import logging
from typing import Optional
from sqlalchemy.orm import Session
from .models import Run, Event
from .database import SessionLocal

logger = logging.getLogger(__name__)


class SimpleAgent:
    """
    A basic agent that processes runs through their lifecycle.

    This is intentionally simple to prove the architecture.
    It doesn't do real work yet - just simulates execution.
    """

    def __init__(self):
        self.running = False

    def execute_run(self, run_id: int) -> bool:
        """
        Execute a single run from start to finish.

        Returns True if successful, False otherwise.
        """
        db = SessionLocal()
        try:
            # Phase 1: Atomically claim the run
            # This prevents double-processing in multi-worker scenarios
            updated = db.query(Run).filter(
                Run.id == run_id,
                Run.status == "QUEUED"
            ).update(
                {"status": "RUNNING", "current_iteration": 0},
                synchronize_session=False
            )
            db.commit()

            if updated != 1:
                logger.info(f"Run {run_id} already claimed or not queued; skipping")
                return False

            # Re-fetch the run after claiming it
            run = db.query(Run).filter(Run.id == run_id).first()
            if not run:
                logger.error(f"Run {run_id} not found after claim")
                return False

            logger.info(f"Starting run {run_id}: {run.goal}")

            self._log_event(db, run_id, "RUN_STARTED", "Agent execution started")
            db.commit()  # Commit status change + event together

            # Phase 2: Simulate "thinking" about the goal
            time.sleep(1)  # Simulate processing time
            run.current_iteration = 1
            self._log_event(db, run_id, "AGENT_THINKING", f"Analyzing goal: {run.goal}")
            db.commit()  # Commit iteration update + event together

            # Phase 3: Simulate "planning"
            time.sleep(1)
            run.current_iteration = 2
            plan = f"Plan for '{run.goal}':\n1. Understand requirements\n2. Design solution\n3. Implement\n4. Test"
            self._log_event(db, run_id, "PLAN_GENERATED", plan)
            db.commit()  # Commit iteration update + event together

            # Phase 4: Simulate "execution"
            time.sleep(1)
            run.current_iteration = 3
            self._log_event(db, run_id, "EXECUTING", "Simulating work execution...")
            db.commit()  # Commit iteration update + event together

            # Phase 5: Complete
            time.sleep(0.5)
            run.status = "COMPLETED"
            run.current_iteration = 4
            self._log_event(db, run_id, "RUN_COMPLETED", "Agent execution completed successfully")
            db.commit()  # Final commit with completion status + event

            logger.info(f"Completed run {run_id}")
            return True

        except Exception as e:
            logger.error(f"Error executing run {run_id}: {e}")

            # Mark as failed
            try:
                run = db.query(Run).filter(Run.id == run_id).first()
                if run:
                    run.status = "FAILED"
                    self._log_event(db, run_id, "RUN_FAILED", f"Error: {str(e)}")
                    db.commit()  # Commit failed status + event together
            except Exception as e2:
                logger.error(f"Failed to mark run as failed: {e2}")
                db.rollback()

            return False

        finally:
            db.close()

    def _log_event(self, db: Session, run_id: int, event_type: str, payload: str):
        """
        Helper to log an event.

        Note: Does NOT commit - caller should commit when ready.
        This allows batching multiple events in one transaction.
        """
        try:
            event = Event(run_id=run_id, type=event_type, payload=payload)
            db.add(event)
            db.flush()  # Make it visible in this transaction
            logger.debug(f"Logged event {event_type} for run {run_id}")
        except Exception as e:
            logger.error(f"Failed to log event: {e}")
            # Don't rollback - let caller decide

    def process_queued_runs(self, max_runs: Optional[int] = None):
        """
        Process all queued runs (up to max_runs).

        This is called by the background worker.
        """
        if max_runs is None:
            max_runs = int(os.getenv("WORKER_BATCH_SIZE", "10"))
        
        db = SessionLocal()
        try:
            queued_runs = db.query(Run).filter(
                Run.status == "QUEUED"
            ).limit(max_runs).all()

            if not queued_runs:
                logger.debug("No queued runs to process")
                return

            logger.info(f"Found {len(queued_runs)} queued run(s)")

            for run in queued_runs:
                logger.info(f"Processing run {run.id}")
                self.execute_run(run.id)

        except Exception as e:
            logger.error(f"Error processing queued runs: {e}")
        finally:
            db.close()


# Global agent instance
_agent = SimpleAgent()


def get_agent() -> SimpleAgent:
    """Get the global agent instance"""
    return _agent
