"""
Agent executor that processes runs in the background.

Supports both simple agent execution and workflow-based execution.
"""
import os
import time
import logging
import json
from typing import Optional
from sqlalchemy.orm import Session
from .models import Run, Event, Project
from .database import SessionLocal
from .workflows import WorkflowEngine, get_workflow

logger = logging.getLogger(__name__)


class SimpleAgent:
    """
    Agent that processes runs through their lifecycle.

    Supports both simple agent execution and workflow-based execution.
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

            logger.info(f"Starting run {run_id}: {run.goal} (type: {run.run_type})")

            self._log_event(db, run_id, "RUN_STARTED", "Agent execution started")
            db.commit()

            # Route to appropriate execution method based on run type
            if run.run_type == "workflow":
                success = self._execute_workflow_run(db, run)
            else:
                success = self._execute_simple_run(db, run)
            
            if success:
                run.status = "COMPLETED"
                self._log_event(db, run_id, "RUN_COMPLETED", "Agent execution completed successfully")
            else:
                run.status = "FAILED"
                self._log_event(db, run_id, "RUN_FAILED", "Agent execution failed")
            
            db.commit()
            logger.info(f"Completed run {run_id} with status: {run.status}")
            return success

        except Exception as e:
            logger.error(f"Error executing run {run_id}: {e}")

            # Mark as failed
            try:
                run = db.query(Run).filter(Run.id == run_id).first()
                if run:
                    run.status = "FAILED"
                    self._log_event(db, run_id, "RUN_FAILED", f"Error: {str(e)}")
                    db.commit()
            except Exception as e2:
                logger.error(f"Failed to mark run as failed: {e2}")
                db.rollback()

            return False

        finally:
            db.close()
    
    def _execute_workflow_run(self, db: Session, run: Run) -> bool:
        """Execute a workflow-based run"""
        
        try:
            # Parse options to get workflow name
            options = {}
            if run.options:
                try:
                    options = json.loads(run.options)
                except json.JSONDecodeError:
                    logger.warning(f"Failed to parse options for run {run.id}")
            
            workflow_name = options.get("workflow_name")
            if not workflow_name:
                # Default to quarkus-bootstrap-v1 if not specified
                workflow_name = "quarkus-bootstrap-v1"
            
            self._log_event(db, run.id, "WORKFLOW_LOOKUP", f"Looking up workflow: {workflow_name}")
            db.commit()
            
            workflow = get_workflow(workflow_name)
            if not workflow:
                error_msg = f"Workflow not found: {workflow_name}"
                logger.error(error_msg)
                self._log_event(db, run.id, "WORKFLOW_NOT_FOUND", error_msg)
                db.commit()
                return False
            
            # Get project to determine workspace path
            project = db.query(Project).filter(Project.id == run.project_id).first()
            if not project:
                error_msg = f"Project not found: {run.project_id}"
                logger.error(error_msg)
                self._log_event(db, run.id, "PROJECT_NOT_FOUND", error_msg)
                db.commit()
                return False
            
            self._log_event(db, run.id, "WORKFLOW_START", 
                          f"Starting workflow: {workflow.name} v{workflow.version}")
            db.commit()
            
            # Create workflow engine with project workspace
            engine = WorkflowEngine(workspace_path=project.local_path)
            
            # Create event callback that logs to database
            def event_callback(event_type: str, message: str, artifact_path: Optional[str]):
                self._log_event(db, run.id, event_type, message)
                if artifact_path:
                    self._log_event(db, run.id, "ARTIFACT_CREATED", f"Artifact: {artifact_path}")
                db.commit()
            
            # Execute workflow
            results = engine.execute_workflow(workflow, event_callback=event_callback)
            
            # Log summary
            summary = f"Workflow completed: {len(results['steps'])} steps, {len(results['artifacts'])} artifacts"
            self._log_event(db, run.id, "WORKFLOW_SUMMARY", summary)
            db.commit()
            
            return True
            
        except Exception as e:
            error_msg = f"Workflow execution failed: {str(e)}"
            logger.error(error_msg, exc_info=True)
            self._log_event(db, run.id, "WORKFLOW_ERROR", error_msg)
            db.commit()
            return False
    
    def _execute_simple_run(self, db: Session, run: Run) -> bool:
        """Execute a simple (non-workflow) run with simulated behavior"""
        
        try:
            # Phase 2: Simulate "thinking" about the goal
            time.sleep(1)
            run.current_iteration = 1
            self._log_event(db, run.id, "AGENT_THINKING", f"Analyzing goal: {run.goal}")
            db.commit()

            # Phase 3: Simulate "planning"
            time.sleep(1)
            run.current_iteration = 2
            plan = f"Plan for '{run.goal}':\n1. Understand requirements\n2. Design solution\n3. Implement\n4. Test"
            self._log_event(db, run.id, "PLAN_GENERATED", plan)
            db.commit()

            # Phase 4: Simulate "execution"
            time.sleep(1)
            run.current_iteration = 3
            self._log_event(db, run.id, "EXECUTING", "Simulating work execution...")
            db.commit()

            # Phase 5: Complete
            time.sleep(0.5)
            run.current_iteration = 4
            
            return True
            
        except Exception as e:
            logger.error(f"Simple run execution failed: {e}")
            return False

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
