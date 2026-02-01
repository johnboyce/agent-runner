"""
Integration tests for app.routes (FastAPI).

This file is designed to avoid the common SQLite in-memory pitfalls:
- Uses StaticPool so all sessions share the same in-memory DB connection.
- Creates the TestClient inside the fixture after dependency overrides.

It also avoids KeyError failures by asserting status codes and printing
response bodies when unexpected payloads come back (e.g., 422 detail).
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool


from app.database import Base, get_db
from app.main import app


def _assert_ok(resp, expected=(200, 201)):
    assert resp.status_code in expected, f"Unexpected status {resp.status_code}\nBody: {resp.text}"


def _json(resp):
    # If response isn't JSON, this will raise a clear error
    return resp.json()


def create_project(client: TestClient, name="test-project", local_path="/tmp/test"):
    resp = client.post("/projects", params={"name": name, "local_path": local_path})
    _assert_ok(resp)
    data = _json(resp)
    assert "id" in data, f"Create project response missing 'id': {data}"
    assert data["name"] == name
    assert data["local_path"] == local_path
    return data


def create_run(client: TestClient, project_id: int, goal="Test goal"):
    resp = client.post("/runs", json={"project_id": project_id, "goal": goal})
    _assert_ok(resp)
    data = _json(resp)
    # Guard rails so you see what you actually got back
    assert "id" in data, f"Create run response missing 'id': {data}"
    assert "project_id" in data, f"Create run response missing 'project_id': {data}"
    assert "status" in data, f"Create run response missing 'status': {data}"
    assert "goal" in data, f"Create run response missing 'goal': {data}"

    assert data["project_id"] == project_id
    assert data["goal"] == goal
    assert data["status"] == "QUEUED"
    return data


@pytest.fixture(scope="function")
def client():
    """
    Fresh in-memory DB per test, but shared connection via StaticPool.
    """
    engine = create_engine(
        "sqlite:///:memory:",  # Explicitly use :memory:
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,  # Critical: ensures all connections share the same DB
    )
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db

    with TestClient(app) as test_client:
        yield test_client

    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)


class TestHealthEndpoint:
    def test_health_returns_ok(self, client):
        resp = client.get("/health")
        _assert_ok(resp, expected=(200,))
        assert _json(resp) == {"status": "ok"}


class TestProjectEndpoints:
    def test_create_project(self, client):
        data = create_project(client, name="test-project", local_path="/tmp/test")
        assert data["name"] == "test-project"

    def test_list_projects(self, client):
        create_project(client, name="test", local_path="/tmp/test")
        resp = client.get("/projects")
        _assert_ok(resp, expected=(200,))
        data = _json(resp)
        assert isinstance(data, list)
        assert any(p.get("name") == "test" for p in data), f"Expected project not found. Got: {data}"


class TestRunEndpoints:
    def test_create_run(self, client):
        project = create_project(client)
        run = create_run(client, project_id=project["id"], goal="Test goal")
        assert run["goal"] == "Test goal"
        assert run["status"] == "QUEUED"

    def test_get_run(self, client):
        project = create_project(client)
        run = create_run(client, project_id=project["id"], goal="Test")
        run_id = run["id"]

        resp = client.get(f"/runs/{run_id}")
        _assert_ok(resp, expected=(200,))
        data = _json(resp)
        assert data["id"] == run_id
        assert data["goal"] == "Test"

    def test_get_nonexistent_run_returns_404(self, client):
        resp = client.get("/runs/99999")
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}. Body: {resp.text}"
        assert "not found" in _json(resp)["detail"].lower()

    def test_list_runs(self, client):
        project = create_project(client)
        create_run(client, project_id=project["id"], goal="Test 1")
        create_run(client, project_id=project["id"], goal="Test 2")

        resp = client.get("/runs")
        _assert_ok(resp, expected=(200,))
        data = _json(resp)
        assert isinstance(data, list)
        assert len(data) >= 2


class TestRunControlEndpoints:
    def test_pause_run(self, client):
        project = create_project(client)
        run = create_run(client, project_id=project["id"], goal="Test")
        run_id = run["id"]

        resp = client.post(f"/runs/{run_id}/pause")
        _assert_ok(resp, expected=(200,))
        data = _json(resp)
        assert data["status"] == "PAUSED"

    def test_control_nonexistent_run_returns_404(self, client):
        resp = client.post("/runs/99999/pause")
        assert resp.status_code == 404, f"Expected 404, got {resp.status_code}. Body: {resp.text}"
        assert "not found" in _json(resp)["detail"].lower()

    def test_invalid_action_returns_400(self, client):
        project = create_project(client)
        run = create_run(client, project_id=project["id"], goal="Test")
        run_id = run["id"]

        resp = client.post(f"/runs/{run_id}/invalid_action")
        assert resp.status_code == 400, f"Expected 400, got {resp.status_code}. Body: {resp.text}"
        detail = _json(resp)["detail"]
        assert "Invalid action" in detail


class TestEventEndpoints:
    def test_get_run_events(self, client):
        project = create_project(client)
        run = create_run(client, project_id=project["id"], goal="Test")
        run_id = run["id"]

        resp = client.get(f"/runs/{run_id}/events")
        _assert_ok(resp, expected=(200,))
        data = _json(resp)
        assert isinstance(data, list)
        assert len(data) >= 1
        assert data[0]["type"] == "RUN_CREATED"

    def test_create_directive(self, client):
        project = create_project(client)
        run = create_run(client, project_id=project["id"], goal="Test")
        run_id = run["id"]

        resp = client.post(f"/runs/{run_id}/directive", json={"text": "Do something"})
        _assert_ok(resp, expected=(200, 201))
        data = _json(resp)
        assert data["type"] == "DIRECTIVE"
        assert data["payload"] == "Do something"
        assert data["run_id"] == run_id


class TestWorkerEndpoints:
    def test_worker_status(self, client):
        resp = client.get("/worker/status")
        _assert_ok(resp, expected=(200,))
        data = _json(resp)
        assert "running" in data
        assert "check_interval" in data

    def test_trigger_processing(self, client):
        resp = client.post("/worker/process")
        _assert_ok(resp, expected=(200,))
        data = _json(resp)
        assert data["message"] == "Processing triggered"
