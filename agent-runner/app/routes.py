from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional
from enum import Enum
import json
from datetime import datetime
import asyncio
from .database import get_db
from .models import Project, Run, Event
from .worker import get_worker
from .agent import get_agent
from .providers import list_providers, validate_provider_model

router = APIRouter()

class RunType(str, Enum):
    agent = "agent"
    workflow = "workflow"
    pipeline = "pipeline"
    task = "task"

class DirectiveIn(BaseModel):
    text: str

class CreateRunRequest(BaseModel):
    model_config = {"extra": "ignore"}
    
    project_id: int
    goal: str
    name: Optional[str] = None
    run_type: RunType = RunType.agent  # Has default, doesn't need Optional
    options: Optional[dict] = None  # e.g., {"dry_run": false, "verbose": true, "max_steps": 10}
    metadata: Optional[dict] = None  # Custom key-value pairs

@router.post("/projects")
def create_project(name: str, local_path: str, db: Session = Depends(get_db)):
    project = Project(name=name, local_path=local_path)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project.to_dict()

@router.get("/projects")
def list_projects(db: Session = Depends(get_db)):
    return [p.to_dict() for p in db.query(Project).all()]

@router.post("/runs")
def create_run(request: CreateRunRequest, db: Session = Depends(get_db)):
    # Verify project exists
    project = db.query(Project).filter(Project.id == request.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail=f"Project with id {request.project_id} not found")

    # Validate provider/model if specified in options
    options = request.options or {}
    provider_name = options.get("provider")
    model_name = options.get("model")

    # Validate provider/model configuration
    try:
        resolved_provider, resolved_model = validate_provider_model(provider_name, model_name)
        # Store resolved values back into options
        options["provider"] = resolved_provider
        options["model"] = resolved_model
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Generate default name if not provided
    run_name = request.name
    if not run_name:
        run_name = f"Run - {datetime.now().strftime('%Y-%m-%d %H:%M')}"

    # Serialize options and metadata to JSON strings
    options_json = json.dumps(options) if options else None
    metadata_json = json.dumps(request.metadata) if request.metadata else None

    run = Run(
        project_id=request.project_id,
        name=run_name,
        goal=request.goal,
        run_type=request.run_type.value,  # Always has a value (default or provided)
        options=options_json,
        run_metadata=metadata_json  # Use run_metadata column
    )
    db.add(run)
    db.commit()
    db.refresh(run)

    event = Event(run_id=run.id, type="RUN_CREATED", payload=request.goal)
    db.add(event)
    db.commit()

    return run.to_dict()

@router.get("/runs/{run_id}")
def get_run(run_id: int, db: Session = Depends(get_db)):
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    return run.to_dict()

@router.get("/runs")
def list_runs(db: Session = Depends(get_db)):
    return [r.to_dict() for r in db.query(Run).order_by(Run.id.desc()).all()]

@router.get("/runs/{run_id}/events")
def get_run_events(run_id: int, after_id: Optional[int] = None, db: Session = Depends(get_db)):
    """
    REST endpoint to fetch events for a run.
    Supports cursor-based pagination via after_id query parameter.
    """
    query = db.query(Event).filter(Event.run_id == run_id)
    if after_id is not None and after_id > 0:
        query = query.filter(Event.id > after_id)
    return [e.to_dict() for e in query.order_by(Event.id.asc()).all()]


@router.get("/runs/{run_id}/events/stream")
async def stream_run_events(
    run_id: int,
    request: Request,
    after_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    """
    SSE endpoint to stream events for a run in real-time.
    Supports resuming via Last-Event-ID header or after_id query parameter.
    """
    # Verify run exists
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")
    
    # Get starting cursor from Last-Event-ID header or after_id query param
    last_event_id = request.headers.get("Last-Event-ID")
    cursor = 0
    if last_event_id and last_event_id.isdigit():
        cursor = int(last_event_id)
    elif after_id is not None:
        cursor = after_id
    
    async def event_generator():
        """Generator that polls DB for new events and yields SSE frames"""
        nonlocal cursor
        keepalive_counter = 0
        poll_interval = 1.0  # Poll DB every 1 second
        keepalive_interval = 15  # Send keepalive every 15 seconds
        
        try:
            while True:
                # Check if client disconnected
                if await request.is_disconnected():
                    break
                
                # Fetch new events from DB
                # Refresh session to get latest data
                db.expire_all()
                new_events = db.query(Event).filter(
                    Event.run_id == run_id,
                    Event.id > cursor
                ).order_by(Event.id.asc()).all()
                
                # Send each new event as SSE frame
                for event in new_events:
                    event_data = event.to_dict()
                    # Format as SSE: id, event (optional), data, blank line
                    yield f"id: {event.id}\n"
                    yield f"event: {event.type}\n"
                    yield f"data: {json.dumps(event_data)}\n\n"
                    cursor = event.id
                
                # Send keepalive comment if no events
                keepalive_counter += 1
                if keepalive_counter >= keepalive_interval:
                    yield ": keepalive\n\n"
                    keepalive_counter = 0
                
                # Wait before next poll
                await asyncio.sleep(poll_interval)
                
        except asyncio.CancelledError:
            # Client disconnected gracefully
            pass
        except Exception as e:
            # Log error but don't crash
            print(f"SSE stream error for run {run_id}: {e}")
        # Note: DB session cleanup handled by FastAPI dependency injection
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )

@router.post("/runs/{run_id}/directive")
def create_directive(run_id: int, body: DirectiveIn, db: Session = Depends(get_db)):
    # Ensure run exists
    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    event = Event(run_id=run_id, type="DIRECTIVE", payload=body.text)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event.to_dict()

@router.post("/runs/{run_id}/{action}")
def control_run(run_id: int, action: str, db: Session = Depends(get_db)):
    # Restrict actions to pause|resume|stop
    valid_actions = {"pause", "resume", "stop"}
    action = action.lower()
    if action not in valid_actions:
        raise HTTPException(status_code=400, detail=f"Invalid action. Must be one of: {sorted(valid_actions)}")

    run = db.query(Run).filter(Run.id == run_id).first()
    if not run:
        raise HTTPException(status_code=404, detail="Run not found")

    # Map action to proper status
    status_map = {"pause": "PAUSED", "resume": "RUNNING", "stop": "STOPPED"}
    run.status = status_map[action]
    db.commit()
    db.refresh(run)

    event = Event(run_id=run.id, type=f"RUN_{action.upper()}", payload="")
    db.add(event)
    db.commit()

    return run.to_dict()


@router.get("/worker/status")
def get_worker_status():
    """Get background worker status"""
    worker = get_worker()
    return {
        "running": worker.running,
        "check_interval": worker.check_interval
    }

@router.post("/worker/process")
def trigger_processing():
    """Manually trigger processing of queued runs"""
    agent = get_agent()
    agent.process_queued_runs()
    return {"message": "Processing triggered"}


@router.get("/providers")
def get_providers():
    """
    List all available LLM providers with their status and models.

    Returns:
        List of provider info with name, available status, and models.
    """
    return list_providers()

