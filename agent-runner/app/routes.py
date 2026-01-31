from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from .database import get_db
from .models import Project, Run, Event
from .worker import get_worker
from .agent import get_agent

router = APIRouter()

class DirectiveIn(BaseModel):
    text: str


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
def create_run(project_id: int, goal: str, db: Session = Depends(get_db)):
    run = Run(project_id=project_id, goal=goal)
    db.add(run)
    db.commit()
    db.refresh(run)

    event = Event(run_id=run.id, type="RUN_CREATED", payload=goal)
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
def get_run_events(run_id: int, db: Session = Depends(get_db)):
    return [e.to_dict() for e in db.query(Event).filter(Event.run_id == run_id).order_by(Event.id.asc()).all()]

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

