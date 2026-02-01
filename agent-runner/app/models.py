from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
import json
from .database import Base

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True)
    local_path = Column(String)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "local_path": self.local_path,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class Run(Base):
    __tablename__ = "runs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String, nullable=True)  # Optional run name
    goal = Column(Text)
    run_type = Column(String, default="agent")  # agent, workflow, pipeline, etc.
    status = Column(String, default="QUEUED")
    current_iteration = Column(Integer, default=0)
    options = Column(Text, nullable=True)  # JSON string for options (dry_run, verbose, max_steps)
    run_metadata = Column(Text, nullable=True)  # JSON string for custom metadata
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        # Safe JSON parsing with fallback
        options_parsed = None
        if self.options:
            try:
                options_parsed = json.loads(self.options)
            except (json.JSONDecodeError, TypeError):
                options_parsed = None  # Return None if corrupt

        metadata_parsed = None
        if self.run_metadata:
            try:
                metadata_parsed = json.loads(self.run_metadata)
            except (json.JSONDecodeError, TypeError):
                metadata_parsed = None  # Return None if corrupt

        return {
            "id": self.id,
            "project_id": self.project_id,
            "name": self.name,
            "goal": self.goal,
            "run_type": self.run_type,
            "status": self.status,
            "current_iteration": self.current_iteration,
            "options": options_parsed,
            "metadata": metadata_parsed,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }

class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    run_id = Column(Integer)
    type = Column(String)
    payload = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "run_id": self.run_id,
            "type": self.type,
            "payload": self.payload,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
