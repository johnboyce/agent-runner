"""
Integration tests for workflow execution.
"""
import pytest
import tempfile
import shutil
from pathlib import Path
from unittest.mock import Mock, patch

from app.workflows import WorkflowEngine, QUARKUS_BOOTSTRAP_V1, WorkflowStep, WorkflowStepType


class TestWorkflowEngine:
    """Tests for WorkflowEngine"""
    
    @pytest.fixture
    def temp_workspace(self):
        """Create a temporary workspace for tests"""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir, ignore_errors=True)
    
    def test_engine_creates_workspace(self, temp_workspace):
        """Test that engine creates workspace directory if it doesn't exist"""
        workspace_path = Path(temp_workspace) / "new_workspace"
        engine = WorkflowEngine(str(workspace_path))
        assert workspace_path.exists()
        assert engine.workspace_path == workspace_path
    
    @patch('app.workflows.get_ollama_provider')
    def test_execute_llm_step(self, mock_get_provider, temp_workspace):
        """Test executing an LLM generation step"""
        # Setup mock provider
        mock_provider = Mock()
        mock_provider.generate.return_value = "# Generated Plan\n\nThis is a test plan."
        mock_get_provider.return_value = mock_provider
        
        engine = WorkflowEngine(temp_workspace)
        
        step = WorkflowStep(
            name="test_llm",
            step_type=WorkflowStepType.LLM_GENERATE,
            description="Test LLM step",
            model="test-model",
            prompt="Test prompt",
            output_file="output.md"
        )
        
        result = engine._execute_step(step)
        
        assert "generated_content" in result
        assert result["generated_content"] == "# Generated Plan\n\nThis is a test plan."
        assert result["model"] == "test-model"
        assert "artifact_path" in result
        
        # Verify file was written
        output_path = Path(temp_workspace) / "output.md"
        assert output_path.exists()
        assert output_path.read_text() == "# Generated Plan\n\nThis is a test plan."
    
    def test_execute_shell_step(self, temp_workspace):
        """Test executing a shell command step"""
        engine = WorkflowEngine(temp_workspace)
        
        step = WorkflowStep(
            name="test_shell",
            step_type=WorkflowStepType.SHELL_COMMAND,
            description="Test shell command",
            command="echo 'Hello World'",
            save_artifact=True
        )
        
        result = engine._execute_step(step)
        
        assert result["success"] is True
        assert result["returncode"] == 0
        assert "Hello World" in result["stdout"]
        assert "artifact_path" in result
    
    @patch('app.workflows.get_ollama_provider')
    def test_execute_workflow_with_events(self, mock_get_provider, temp_workspace):
        """Test executing a complete workflow with event callbacks"""
        # Setup mock provider
        mock_provider = Mock()
        mock_provider.generate.side_effect = [
            "# Project Plan\nStep 1: Setup\nStep 2: Implement",
            "=== FILE: pom.xml ===\n<project>...</project>\n=== END FILE ==="
        ]
        mock_get_provider.return_value = mock_provider
        
        engine = WorkflowEngine(temp_workspace)
        
        # Track events
        events = []
        def event_callback(event_type, message, artifact_path):
            events.append((event_type, message, artifact_path))
        
        # Create a simple workflow
        from app.workflows import Workflow
        test_workflow = Workflow(
            name="test-workflow",
            version="1.0.0",
            description="Test workflow",
            steps=[
                WorkflowStep(
                    name="planner",
                    step_type=WorkflowStepType.LLM_GENERATE,
                    description="Create plan",
                    model="test-model",
                    prompt="Create a plan",
                    output_file="PLAN.md",
                    save_artifact=False
                ),
                WorkflowStep(
                    name="coder",
                    step_type=WorkflowStepType.LLM_GENERATE,
                    description="Generate code",
                    model="test-coder",
                    prompt="Generate code",
                    output_file="code.txt",
                    save_artifact=True
                )
            ]
        )
        
        result = engine.execute_workflow(test_workflow, event_callback=event_callback)
        
        assert result["workflow_name"] == "test-workflow"
        assert len(result["steps"]) == 2
        assert len(result["artifacts"]) == 1
        
        # Verify events were emitted
        event_types = [e[0] for e in events]
        assert "WORKFLOW_STARTED" in event_types
        assert "STEP_STARTED" in event_types
        assert "STEP_COMPLETED" in event_types
        assert "WORKFLOW_COMPLETED" in event_types
    
    @patch('app.workflows.get_ollama_provider')
    def test_workflow_failure_handling(self, mock_get_provider, temp_workspace):
        """Test that workflow failures are handled properly"""
        # Setup mock provider to fail
        mock_provider = Mock()
        mock_provider.generate.side_effect = Exception("Ollama connection failed")
        mock_get_provider.return_value = mock_provider
        
        engine = WorkflowEngine(temp_workspace)
        
        step = WorkflowStep(
            name="failing_step",
            step_type=WorkflowStepType.LLM_GENERATE,
            description="This will fail",
            model="test-model",
            prompt="Test prompt",
            output_file="output.md"
        )
        
        from app.workflows import Workflow
        test_workflow = Workflow(
            name="failing-workflow",
            version="1.0.0",
            description="Workflow that fails",
            steps=[step]
        )
        
        with pytest.raises(Exception):
            engine.execute_workflow(test_workflow)


class TestQuarkusBootstrapWorkflow:
    """Tests for the Quarkus Bootstrap workflow definition"""
    
    def test_workflow_structure(self):
        """Test that quarkus-bootstrap-v1 has correct structure"""
        workflow = QUARKUS_BOOTSTRAP_V1
        
        assert workflow.name == "quarkus-bootstrap-v1"
        assert workflow.version == "1.0.0"
        assert len(workflow.steps) == 3
        
        # Step 1: Planner
        step1 = workflow.steps[0]
        assert step1.name == "planner"
        assert step1.step_type == WorkflowStepType.LLM_GENERATE
        assert step1.model == "gemma3:27b"
        assert step1.output_file == "PLAN.md"
        
        # Step 2: Coder
        step2 = workflow.steps[1]
        assert step2.name == "coder"
        assert step2.step_type == WorkflowStepType.LLM_GENERATE
        assert step2.model == "qwen3-coder:latest"
        assert step2.output_file == "project_files.txt"
        assert step2.save_artifact is True
        
        # Step 3: Maven test
        step3 = workflow.steps[2]
        assert step3.name == "maven_test"
        assert step3.step_type == WorkflowStepType.MAVEN_COMMAND
        assert step3.command == "test"
        assert step3.save_artifact is True
    
    def test_workflow_prompts(self):
        """Test that workflow prompts mention required technologies"""
        workflow = QUARKUS_BOOTSTRAP_V1
        
        planner_prompt = workflow.steps[0].prompt
        assert "Quarkus" in planner_prompt
        assert "GraphQL" in planner_prompt
        assert "OpenTelemetry" in planner_prompt
        
        coder_prompt = workflow.steps[1].prompt
        assert "Maven" in coder_prompt
        assert "Quarkus" in coder_prompt
        assert "GraphQL" in coder_prompt
        assert "OpenTelemetry" in coder_prompt
        assert "pom.xml" in coder_prompt
