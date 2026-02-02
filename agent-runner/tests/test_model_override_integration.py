"""
Integration test for model override functionality.

This test validates that model overrides work end-to-end from API request
through workflow execution.
"""
import pytest
import json
import tempfile
import shutil
from unittest.mock import Mock, patch, MagicMock

from app.agent import SimpleAgent
from app.models import Run, Project
from app.workflows import get_workflow, apply_model_overrides


class TestModelOverrideIntegration:
    """Integration tests for model override feature"""
    
    @pytest.fixture
    def temp_workspace(self):
        """Create a temporary workspace for tests"""
        temp_dir = tempfile.mkdtemp()
        yield temp_dir
        shutil.rmtree(temp_dir, ignore_errors=True)
    
    @patch('app.agent.SessionLocal')
    @patch('app.agent.WorkflowEngine')
    def test_model_override_from_run_options(self, mock_engine_class, mock_session_local, temp_workspace):
        """Test that model overrides from run options are applied during workflow execution"""
        
        # Setup agent
        agent = SimpleAgent()
        
        # Setup mock database
        mock_db = Mock()
        mock_session_local.return_value = mock_db
        
        # Setup mock run with model overrides
        mock_run = Mock()
        mock_run.id = 1
        mock_run.goal = "Test workflow with overrides"
        mock_run.status = "QUEUED"
        mock_run.run_type = "workflow"
        mock_run.project_id = 1
        mock_run.options = json.dumps({
            "workflow": "quarkus-bootstrap-v1",
            "models": {
                "planner": "llama2:latest",
                "coder": "codellama:latest"
            },
            "timeout_seconds": 600
        })
        
        # Setup mock project
        mock_project = Mock()
        mock_project.id = 1
        mock_project.local_path = temp_workspace
        
        # Configure database queries
        def query_side_effect(model):
            query_mock = Mock()
            filter_mock = Mock()
            
            if model == Run:
                filter_mock.update.return_value = 1
                filter_mock.first.return_value = mock_run
                query_mock.filter.return_value = filter_mock
            elif model == Project:
                filter_mock.first.return_value = mock_project
                query_mock.filter.return_value = filter_mock
            
            return query_mock
        
        mock_db.query.side_effect = query_side_effect
        
        # Setup mock workflow engine
        mock_engine = Mock()
        mock_engine.execute_workflow.return_value = {
            "workflow_name": "quarkus-bootstrap-v1",
            "steps": [{"step": 1}],
            "artifacts": []
        }
        mock_engine_class.return_value = mock_engine
        
        # Track applied workflow
        applied_workflow = None
        
        def capture_workflow(workflow, **kwargs):
            nonlocal applied_workflow
            applied_workflow = workflow
            return {
                "workflow_name": "quarkus-bootstrap-v1",
                "steps": [{"step": 1}],
                "artifacts": []
            }
        
        mock_engine.execute_workflow.side_effect = capture_workflow
        
        # Execute run
        result = agent.execute_run(1)
        
        # Verify execution succeeded
        assert result is True
        
        # Verify engine was created with correct timeout
        mock_engine_class.assert_called_once()
        call_kwargs = mock_engine_class.call_args[1]
        assert call_kwargs['timeout'] == 600
        
        # Verify workflow was executed
        mock_engine.execute_workflow.assert_called_once()
        
        # Verify model overrides were applied
        assert applied_workflow is not None
        assert applied_workflow.steps[0].model == "llama2:latest"
        assert applied_workflow.steps[1].model == "codellama:latest"
        
        # Verify descriptions were updated
        assert "llama2" in applied_workflow.steps[0].description.lower()
    
    def test_workflow_model_override_description_update(self):
        """Test that step descriptions are updated to reflect overridden models"""
        workflow = get_workflow("quarkus-bootstrap-v1")
        
        # Original descriptions
        assert "Gemma3" in workflow.steps[0].description
        assert "Qwen3" in workflow.steps[1].description
        
        # Apply overrides
        overridden = apply_model_overrides(workflow, {
            "planner": "llama2:latest",
            "coder": "codellama:latest"
        })
        
        # Descriptions should be updated
        assert "llama2" in overridden.steps[0].description.lower()
        assert "gemma3" not in overridden.steps[0].description.lower()
        
        # Verify models are correct
        assert overridden.steps[0].model == "llama2:latest"
        assert overridden.steps[1].model == "codellama:latest"
    
    @patch('app.workflows.get_ollama_provider')
    def test_model_override_passed_to_ollama(self, mock_get_provider, temp_workspace):
        """Test that overridden model is passed to Ollama provider"""
        from app.workflows import WorkflowEngine, Workflow, WorkflowStep, WorkflowStepType
        
        # Setup mock provider
        mock_provider = Mock()
        mock_provider.generate.return_value = "Generated content"
        mock_get_provider.return_value = mock_provider
        
        # Create simple workflow
        workflow = Workflow(
            name="test",
            version="1.0.0",
            description="Test",
            steps=[
                WorkflowStep(
                    name="planner",
                    step_type=WorkflowStepType.LLM_GENERATE,
                    description="Test planner",
                    model="original-model:latest",
                    prompt="Test prompt"
                )
            ]
        )
        
        # Apply override
        overridden = apply_model_overrides(workflow, {"planner": "overridden-model:latest"})
        
        # Execute workflow
        engine = WorkflowEngine(temp_workspace, timeout=300)
        engine.execute_workflow(overridden)
        
        # Verify provider was called with overridden model
        mock_provider.generate.assert_called_once()
        call_kwargs = mock_provider.generate.call_args[1]
        assert call_kwargs['model'] == "overridden-model:latest"
        assert call_kwargs['timeout'] == 300
    
    @patch('app.agent.SessionLocal')
    @patch('app.agent.WorkflowEngine')
    def test_no_override_uses_defaults(self, mock_engine_class, mock_session_local, temp_workspace):
        """Test that without overrides, default models are used"""
        
        agent = SimpleAgent()
        
        # Setup mock database
        mock_db = Mock()
        mock_session_local.return_value = mock_db
        
        # Setup mock run WITHOUT model overrides
        mock_run = Mock()
        mock_run.id = 1
        mock_run.goal = "Test workflow"
        mock_run.status = "QUEUED"
        mock_run.run_type = "workflow"
        mock_run.project_id = 1
        mock_run.options = json.dumps({
            "workflow": "quarkus-bootstrap-v1"
        })
        
        mock_project = Mock()
        mock_project.id = 1
        mock_project.local_path = temp_workspace
        
        def query_side_effect(model):
            query_mock = Mock()
            filter_mock = Mock()
            
            if model == Run:
                filter_mock.update.return_value = 1
                filter_mock.first.return_value = mock_run
                query_mock.filter.return_value = filter_mock
            elif model == Project:
                filter_mock.first.return_value = mock_project
                query_mock.filter.return_value = filter_mock
            
            return query_mock
        
        mock_db.query.side_effect = query_side_effect
        
        mock_engine = Mock()
        mock_engine.execute_workflow.return_value = {
            "workflow_name": "quarkus-bootstrap-v1",
            "steps": [],
            "artifacts": []
        }
        mock_engine_class.return_value = mock_engine
        
        applied_workflow = None
        
        def capture_workflow(workflow, **kwargs):
            nonlocal applied_workflow
            applied_workflow = workflow
            return {"workflow_name": "test", "steps": [], "artifacts": []}
        
        mock_engine.execute_workflow.side_effect = capture_workflow
        
        # Execute
        result = agent.execute_run(1)
        
        assert result is True
        assert applied_workflow is not None
        
        # Should use default models (no override)
        assert applied_workflow.steps[0].model == "gemma3:27b"
        assert applied_workflow.steps[1].model == "qwen3-coder:latest"
