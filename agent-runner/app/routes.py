from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .database import SessionLocal
from .models import Project, Run, Event

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/projects")
def create_project(name: str, local_path: str, db: Session = Depends(get_db)):
    project = Project(name=name, local_path=local_path)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project

@router.get("/projects")
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).all()

@router.post("/runs")
def create_run(project_id: int, goal: str, db: Session = Depends(get_db)):
    run = Run(project_id=project_id, goal=goal)
    db.add(run)
    db.commit()
    db.refresh(run)

    event = Event(run_id=run.id, type="RUN_CREATED", payload=goal)
    db.add(event)
    db.commit()

    return run

@router.get("/runs/{run_id}")
def get_run(run_id: int, db: Session = Depends(get_db)):
    return db.query(Run).filter(Run.id == run_id).first()

@router.post("/runs/{run_id}/{action}")
def control_run(run_id: int, action: str, db: Session = Depends(get_db)):
    run = db.query(Run).filter(Run.id == run_id).first()
    run.status = action.upper()
    db.commit()

    event = Event(run_id=run.id, type=f"RUN_{action.upper()}", payload="")
    db.add(event)
    db.commit()

    return run
