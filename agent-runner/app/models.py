from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
from .database import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    local_path = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Run(Base):
    __tablename__ = "runs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    goal = Column(Text)
    status = Column(String, default="QUEUED")
    current_iteration = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer)
    type = Column(String)
    payload = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
