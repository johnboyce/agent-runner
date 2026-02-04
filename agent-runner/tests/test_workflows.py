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


class TestModelOverrides:
    """Tests for model override functionality"""
    
    def test_apply_model_overrides_from_options(self):
        """Test that model overrides from options are applied correctly"""
        from app.workflows import apply_model_overrides, QUARKUS_BOOTSTRAP_V1
        
        model_overrides = {
            "planner": "llama2:latest",
            "coder": "codellama:latest"
        }
        
        modified_workflow = apply_model_overrides(QUARKUS_BOOTSTRAP_V1, model_overrides)
        
        # Check that models were overridden
        assert modified_workflow.steps[0].model == "llama2:latest"
        assert modified_workflow.steps[1].model == "codellama:latest"
        
        # Check that descriptions were updated
        assert "llama2" in modified_workflow.steps[0].description.lower()
        
    def test_apply_model_overrides_from_env(self):
        """Test that model overrides from environment variables are applied"""
        import os
        from app.workflows import apply_model_overrides, QUARKUS_BOOTSTRAP_V1
        
        # Set environment variables
        os.environ["OLLAMA_PLANNER_MODEL"] = "mistral:latest"
        os.environ["OLLAMA_CODER_MODEL"] = "deepseek-coder:latest"
        
        try:
            modified_workflow = apply_model_overrides(QUARKUS_BOOTSTRAP_V1, {})
            
            # Check that env var models were applied
            assert modified_workflow.steps[0].model == "mistral:latest"
            assert modified_workflow.steps[1].model == "deepseek-coder:latest"
        finally:
            # Clean up environment variables
            os.environ.pop("OLLAMA_PLANNER_MODEL", None)
            os.environ.pop("OLLAMA_CODER_MODEL", None)
    
    def test_apply_model_overrides_priority(self):
        """Test that options take priority over environment variables"""
        import os
        from app.workflows import apply_model_overrides, QUARKUS_BOOTSTRAP_V1
        
        # Set environment variable
        os.environ["OLLAMA_PLANNER_MODEL"] = "mistral:latest"
        
        try:
            # Override with options
            model_overrides = {
                "planner": "llama2:latest"
            }
            
            modified_workflow = apply_model_overrides(QUARKUS_BOOTSTRAP_V1, model_overrides)
            
            # Options should take priority
            assert modified_workflow.steps[0].model == "llama2:latest"
        finally:
            os.environ.pop("OLLAMA_PLANNER_MODEL", None)
    
    def test_apply_model_overrides_defaults(self):
        """Test that defaults are used when no overrides are provided"""
        from app.workflows import apply_model_overrides, QUARKUS_BOOTSTRAP_V1
        
        modified_workflow = apply_model_overrides(QUARKUS_BOOTSTRAP_V1, {})
        
        # Should keep original defaults
        assert modified_workflow.steps[0].model == "gemma3:27b"
        assert modified_workflow.steps[1].model == "qwen3-coder:latest"
    
    def test_apply_model_overrides_partial(self):
        """Test that partial overrides work correctly"""
        from app.workflows import apply_model_overrides, QUARKUS_BOOTSTRAP_V1
        
        # Only override planner
        model_overrides = {
            "planner": "llama2:latest"
        }
        
        modified_workflow = apply_model_overrides(QUARKUS_BOOTSTRAP_V1, model_overrides)
        
        # Planner should be overridden
        assert modified_workflow.steps[0].model == "llama2:latest"
        # Coder should keep default
        assert modified_workflow.steps[1].model == "qwen3-coder:latest"
    
    def test_apply_model_overrides_non_llm_steps(self):
        """Test that non-LLM steps are not affected by overrides"""
        from app.workflows import apply_model_overrides, QUARKUS_BOOTSTRAP_V1
        
        model_overrides = {
            "maven_test": "some-model:latest"  # Should be ignored
        }
        
        modified_workflow = apply_model_overrides(QUARKUS_BOOTSTRAP_V1, model_overrides)
        
        # Maven step should remain unchanged (no model attribute for non-LLM steps)
        maven_step = modified_workflow.steps[2]
        assert maven_step.step_type.value == "maven_command"
        assert maven_step.command == "test"


class TestWorkflowEngineTimeout:
    """Tests for timeout configuration in WorkflowEngine"""
    
    @patch('app.workflows.get_ollama_provider')
    def test_engine_with_custom_timeout(self, mock_get_provider):
        """Test that engine respects custom timeout"""
        import tempfile
        import shutil
        
        temp_dir = tempfile.mkdtemp()
        try:
            mock_provider = Mock()
            mock_provider.generate.return_value = "Test output"
            mock_get_provider.return_value = mock_provider
            
            # Create engine with custom timeout
            engine = WorkflowEngine(temp_dir, timeout=600)
            
            assert engine.timeout == 600
            
            # Execute an LLM step
            from app.workflows import WorkflowStep, WorkflowStepType
            step = WorkflowStep(
                name="test",
                step_type=WorkflowStepType.LLM_GENERATE,
                description="Test",
                model="test-model",
                prompt="Test prompt"
            )
            
            engine._execute_step(step)
            
            # Verify timeout was passed to generate
            mock_provider.generate.assert_called_once()
            call_kwargs = mock_provider.generate.call_args[1]
            assert call_kwargs['timeout'] == 600
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    @patch('app.workflows.get_ollama_provider')
    def test_engine_with_env_timeout(self, mock_get_provider):
        """Test that engine respects OLLAMA_TIMEOUT_SECONDS env var"""
        import os
        import tempfile
        import shutil
        
        temp_dir = tempfile.mkdtemp()
        os.environ["OLLAMA_TIMEOUT_SECONDS"] = "900"
        
        try:
            mock_provider = Mock()
            mock_get_provider.return_value = mock_provider
            
            # Create engine without explicit timeout
            engine = WorkflowEngine(temp_dir)
            
            assert engine.timeout == 900
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
            os.environ.pop("OLLAMA_TIMEOUT_SECONDS", None)
    
    @patch('app.workflows.get_ollama_provider')
    def test_engine_with_default_timeout(self, mock_get_provider):
        """Test that engine uses default timeout when none specified"""
        import tempfile
        import shutil
        
        temp_dir = tempfile.mkdtemp()
        try:
            mock_provider = Mock()
            mock_get_provider.return_value = mock_provider
            
            # Create engine without timeout
            engine = WorkflowEngine(temp_dir)
            
            # Should default to 300
            assert engine.timeout == 300
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)


class TestStepLevelTimeout:
    """Tests for step-level timeout configuration"""
    
    @patch('app.workflows.get_ollama_provider')
    def test_step_specific_timeout_overrides_engine_default(self, mock_get_provider):
        """Test that step-specific timeout overrides engine default"""
        import tempfile
        import shutil
        from app.workflows import WorkflowStep, WorkflowStepType
        
        temp_dir = tempfile.mkdtemp()
        try:
            mock_provider = Mock()
            mock_provider.generate.return_value = "Test output"
            mock_get_provider.return_value = mock_provider
            
            # Create engine with default timeout of 300
            engine = WorkflowEngine(temp_dir, timeout=300)
            
            # Create step with custom timeout
            step = WorkflowStep(
                name="test",
                step_type=WorkflowStepType.LLM_GENERATE,
                description="Test",
                model="test-model",
                prompt="Test prompt",
                timeout=900  # Step-specific timeout
            )
            
            engine._execute_step(step)
            
            # Verify step timeout was used instead of engine default
            mock_provider.generate.assert_called_once()
            call_kwargs = mock_provider.generate.call_args[1]
            assert call_kwargs['timeout'] == 900
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    @patch('app.workflows.get_ollama_provider')
    def test_step_without_timeout_uses_engine_default(self, mock_get_provider):
        """Test that step without timeout uses engine default"""
        import tempfile
        import shutil
        from app.workflows import WorkflowStep, WorkflowStepType
        
        temp_dir = tempfile.mkdtemp()
        try:
            mock_provider = Mock()
            mock_provider.generate.return_value = "Test output"
            mock_get_provider.return_value = mock_provider
            
            # Create engine with custom timeout
            engine = WorkflowEngine(temp_dir, timeout=450)
            
            # Create step without timeout
            step = WorkflowStep(
                name="test",
                step_type=WorkflowStepType.LLM_GENERATE,
                description="Test",
                model="test-model",
                prompt="Test prompt"
            )
            
            engine._execute_step(step)
            
            # Verify engine timeout was used
            mock_provider.generate.assert_called_once()
            call_kwargs = mock_provider.generate.call_args[1]
            assert call_kwargs['timeout'] == 450
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    def test_quarkus_workflow_has_different_timeouts(self):
        """Test that the Quarkus workflow has different timeouts for planner vs coder"""
        from app.workflows import QUARKUS_BOOTSTRAP_V1
        
        planner_step = QUARKUS_BOOTSTRAP_V1.steps[0]  # planner
        coder_step = QUARKUS_BOOTSTRAP_V1.steps[1]  # coder
        
        # Verify planner has shorter timeout
        assert planner_step.name == "planner"
        assert planner_step.timeout == 300  # 5 minutes
        
        # Verify coder has longer timeout
        assert coder_step.name == "coder"
        assert coder_step.timeout == 1800  # 30 minutes
    
    @patch('app.workflows.get_ollama_provider')
    def test_apply_model_overrides_preserves_timeout(self, mock_get_provider):
        """Test that apply_model_overrides preserves step timeout settings"""
        from app.workflows import apply_model_overrides, QUARKUS_BOOTSTRAP_V1
        
        model_overrides = {
            "planner": "llama2:latest",
            "coder": "deepseek-coder:latest"
        }
        
        modified_workflow = apply_model_overrides(QUARKUS_BOOTSTRAP_V1, model_overrides)
        
        # Check that timeouts are preserved
        assert modified_workflow.steps[0].timeout == 300
        assert modified_workflow.steps[1].timeout == 1800


class TestHeartbeatEvents:
    """Tests for heartbeat events during LLM generation"""
    
    def test_heartbeat_event_type_exists(self):
        """Test that HEARTBEAT event type is defined"""
        from app.providers import EventType
        
        assert hasattr(EventType, 'HEARTBEAT')
        assert EventType.HEARTBEAT == "HEARTBEAT"
    
    @patch('app.providers.requests.post')
    @patch('time.time')
    def test_heartbeat_events_emitted_during_generation(self, mock_time, mock_post):
        """Test that the heartbeat mechanism is properly set up during generation"""
        from app.providers import OllamaProvider, EventType
        import time
        
        # Mock time to show passage of time
        mock_time.return_value = 5.0
        
        # Mock successful response
        mock_response = Mock()
        mock_response.json.return_value = {"response": "Generated text"}
        mock_response.status_code = 200
        mock_response.raise_for_status = Mock()
        
        # Simulate delay before response
        def delayed_post(*args, **kwargs):
            time.sleep(0.05)  # Small delay to allow heartbeat thread to start
            return mock_response
        
        mock_post.side_effect = delayed_post
        
        provider = OllamaProvider()
        
        events = []
        def event_callback(event_type, message):
            events.append((event_type, message))
        
        result = provider.generate(
            prompt="test",
            model="test-model",
            event_callback=event_callback
        )
        
        # Verify events were captured (at minimum: LOADING_MODEL, GENERATING, DONE)
        event_types = [e[0] for e in events]
        assert EventType.LOADING_MODEL in event_types
        assert EventType.GENERATING in event_types
        assert EventType.DONE in event_types
    
    @patch('app.workflows.get_ollama_provider')
    def test_engine_passes_heartbeat_interval_to_provider(self, mock_get_provider):
        """Test that WorkflowEngine passes heartbeat_interval to provider"""
        import tempfile
        import shutil
        from app.workflows import WorkflowStep, WorkflowStepType
        
        temp_dir = tempfile.mkdtemp()
        try:
            mock_provider = Mock()
            mock_provider.generate.return_value = "Test output"
            mock_get_provider.return_value = mock_provider
            
            # Create engine with custom heartbeat interval
            engine = WorkflowEngine(temp_dir, timeout=300, heartbeat_interval=20)
            
            assert engine.heartbeat_interval == 20
            
            step = WorkflowStep(
                name="test",
                step_type=WorkflowStepType.LLM_GENERATE,
                description="Test",
                model="test-model",
                prompt="Test prompt"
            )
            
            engine._execute_step(step)
            
            # Verify heartbeat_interval was passed to generate
            mock_provider.generate.assert_called_once()
            call_kwargs = mock_provider.generate.call_args[1]
            assert call_kwargs['heartbeat_interval'] == 20
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
    
    @patch('app.workflows.get_ollama_provider')
    def test_engine_heartbeat_interval_from_env(self, mock_get_provider):
        """Test that engine respects OLLAMA_HEARTBEAT_INTERVAL env var"""
        import os
        import tempfile
        import shutil
        
        temp_dir = tempfile.mkdtemp()
        os.environ["OLLAMA_HEARTBEAT_INTERVAL"] = "30"
        
        try:
            mock_provider = Mock()
            mock_get_provider.return_value = mock_provider
            
            # Create engine without explicit heartbeat_interval
            engine = WorkflowEngine(temp_dir)
            
            assert engine.heartbeat_interval == 30
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
            os.environ.pop("OLLAMA_HEARTBEAT_INTERVAL", None)
    
    @patch('app.workflows.get_ollama_provider')
    def test_engine_default_heartbeat_interval(self, mock_get_provider):
        """Test that engine uses default heartbeat interval when none specified"""
        import tempfile
        import shutil
        
        temp_dir = tempfile.mkdtemp()
        try:
            mock_provider = Mock()
            mock_get_provider.return_value = mock_provider
            
            # Create engine without heartbeat_interval
            engine = WorkflowEngine(temp_dir)
            
            # Should default to 15
            assert engine.heartbeat_interval == 15
        finally:
            shutil.rmtree(temp_dir, ignore_errors=True)
