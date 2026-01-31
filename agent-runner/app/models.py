from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey
from sqlalchemy.sql import func
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
    goal = Column(Text)
    status = Column(String, default="QUEUED")
    current_iteration = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    def to_dict(self):
        return {
            "id": self.id,
            "project_id": self.project_id,
            "goal": self.goal,
            "status": self.status,
            "current_iteration": self.current_iteration,
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
