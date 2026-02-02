"""
Workflow definitions and execution engine.

This module contains workflow definitions and the engine to execute them.
Each workflow is a sequence of steps with specific tools and models.
"""
import os
import logging
import subprocess
from typing import Dict, List, Optional, Callable, Any
from pathlib import Path
from dataclasses import dataclass
from enum import Enum

from .providers import get_ollama_provider, EventType

logger = logging.getLogger(__name__)


class WorkflowStepType(str, Enum):
    """Types of workflow steps"""
    LLM_GENERATE = "llm_generate"  # Use LLM to generate content
    FILE_WRITE = "file_write"  # Write content to a file
    SHELL_COMMAND = "shell_command"  # Execute a shell command
    MAVEN_COMMAND = "maven_command"  # Execute a Maven command


@dataclass
class WorkflowStep:
    """Definition of a single workflow step"""
    name: str
    step_type: WorkflowStepType
    description: str
    model: Optional[str] = None  # For LLM steps
    prompt: Optional[str] = None  # For LLM steps
    output_file: Optional[str] = None  # For file write steps
    command: Optional[str] = None  # For shell/maven commands
    save_artifact: bool = False  # Whether to save output as artifact


@dataclass
class Workflow:
    """Definition of a complete workflow"""
    name: str
    version: str
    description: str
    steps: List[WorkflowStep]


class WorkflowEngine:
    """
    Engine for executing workflows.
    
    Executes workflow steps in sequence and emits events for progress tracking.
    """
    
    def __init__(self, workspace_path: str, timeout: Optional[int] = None):
        """
        Initialize workflow engine.
        
        Args:
            workspace_path: Base path where all file operations happen
            timeout: Optional timeout in seconds for LLM operations
        """
        self.workspace_path = Path(workspace_path)
        self.workspace_path.mkdir(parents=True, exist_ok=True)
        self.ollama = get_ollama_provider()
        self.timeout = timeout or int(os.getenv("OLLAMA_TIMEOUT_SECONDS", "300"))
        logger.info(f"WorkflowEngine initialized with workspace: {self.workspace_path}, timeout: {self.timeout}s")
    
    def execute_workflow(
        self,
        workflow: Workflow,
        event_callback: Optional[Callable[[str, str, Optional[str]], None]] = None
    ) -> Dict[str, Any]:
        """
        Execute a workflow from start to finish.
        
        Args:
            workflow: The workflow to execute
            event_callback: Optional callback(event_type, message, artifact_path)
        
        Returns:
            Dictionary containing execution results and artifacts
        """
        logger.info(f"Executing workflow: {workflow.name} v{workflow.version}")
        
        if event_callback:
            event_callback("WORKFLOW_STARTED", f"Starting {workflow.name} v{workflow.version}", None)
        
        results = {
            "workflow_name": workflow.name,
            "workflow_version": workflow.version,
            "steps": [],
            "artifacts": []
        }
        
        try:
            for i, step in enumerate(workflow.steps, 1):
                logger.info(f"Executing step {i}/{len(workflow.steps)}: {step.name}")
                
                if event_callback:
                    event_callback("STEP_STARTED", f"Step {i}: {step.name} - {step.description}", None)
                
                step_result = self._execute_step(step, event_callback)
                results["steps"].append({
                    "step_number": i,
                    "name": step.name,
                    "type": step.step_type,
                    "status": "completed",
                    "result": step_result
                })
                
                # Save artifact if requested
                if step.save_artifact and "artifact_path" in step_result:
                    results["artifacts"].append({
                        "step": step.name,
                        "path": step_result["artifact_path"],
                        "type": step_result.get("artifact_type", "file")
                    })
                
                if event_callback:
                    event_callback("STEP_COMPLETED", f"Step {i} completed: {step.name}", 
                                 step_result.get("artifact_path"))
            
            if event_callback:
                event_callback("WORKFLOW_COMPLETED", 
                             f"Workflow completed successfully with {len(results['artifacts'])} artifacts", 
                             None)
            
            return results
            
        except Exception as e:
            error_msg = f"Workflow execution failed: {str(e)}"
            logger.error(error_msg)
            if event_callback:
                event_callback("WORKFLOW_FAILED", error_msg, None)
            raise
    
    def _execute_step(
        self,
        step: WorkflowStep,
        event_callback: Optional[Callable[[str, str, Optional[str]], None]] = None
    ) -> Dict[str, Any]:
        """Execute a single workflow step"""
        
        if step.step_type == WorkflowStepType.LLM_GENERATE:
            return self._execute_llm_step(step, event_callback)
        elif step.step_type == WorkflowStepType.SHELL_COMMAND:
            return self._execute_shell_step(step, event_callback)
        elif step.step_type == WorkflowStepType.MAVEN_COMMAND:
            return self._execute_maven_step(step, event_callback)
        else:
            raise ValueError(f"Unsupported step type: {step.step_type}")
    
    def _execute_llm_step(
        self,
        step: WorkflowStep,
        event_callback: Optional[Callable[[str, str, Optional[str]], None]] = None
    ) -> Dict[str, Any]:
        """Execute an LLM generation step"""
        
        if not step.model or not step.prompt:
            raise ValueError(f"LLM step requires model and prompt: {step.name}")
        
        # Create event wrapper for Ollama events
        def ollama_event_wrapper(event_type: EventType, message: str):
            if event_callback:
                event_callback(f"LLM_{event_type.value}", message, None)
        
        # Generate content using Ollama
        generated_content = self.ollama.generate(
            prompt=step.prompt,
            model=step.model,
            event_callback=ollama_event_wrapper,
            timeout=self.timeout
        )
        
        result = {
            "generated_content": generated_content,
            "model": step.model,
            "content_length": len(generated_content)
        }
        
        # Write to file if specified
        if step.output_file:
            output_path = self.workspace_path / step.output_file
            output_path.parent.mkdir(parents=True, exist_ok=True)
            output_path.write_text(generated_content)
            result["artifact_path"] = str(output_path)
            result["artifact_type"] = "generated_file"
            logger.info(f"Wrote generated content to: {output_path}")
        
        return result
    
    def _execute_shell_step(
        self,
        step: WorkflowStep,
        event_callback: Optional[Callable[[str, str, Optional[str]], None]] = None
    ) -> Dict[str, Any]:
        """Execute a shell command step"""
        
        if not step.command:
            raise ValueError(f"Shell step requires command: {step.name}")
        
        if event_callback:
            event_callback("SHELL_EXECUTING", f"Running: {step.command}", None)
        
        try:
            result = subprocess.run(
                step.command,
                shell=True,
                cwd=str(self.workspace_path),
                capture_output=True,
                text=True,
                timeout=600  # 10 minute timeout
            )
            
            output = {
                "command": step.command,
                "returncode": result.returncode,
                "stdout": result.stdout,
                "stderr": result.stderr,
                "success": result.returncode == 0
            }
            
            # Save output as artifact if requested
            if step.save_artifact:
                artifact_path = self.workspace_path / f"{step.name.replace(' ', '_')}_output.txt"
                artifact_content = f"Command: {step.command}\n"
                artifact_content += f"Return code: {result.returncode}\n"
                artifact_content += f"\n=== STDOUT ===\n{result.stdout}\n"
                artifact_content += f"\n=== STDERR ===\n{result.stderr}\n"
                artifact_path.write_text(artifact_content)
                output["artifact_path"] = str(artifact_path)
                output["artifact_type"] = "command_output"
            
            if result.returncode != 0:
                logger.warning(f"Command failed with code {result.returncode}: {step.command}")
            else:
                logger.info(f"Command succeeded: {step.command}")
            
            return output
            
        except subprocess.TimeoutExpired as e:
            error_msg = f"Command timed out: {step.command}"
            logger.error(error_msg)
            raise RuntimeError(error_msg) from e
    
    def _execute_maven_step(
        self,
        step: WorkflowStep,
        event_callback: Optional[Callable[[str, str, Optional[str]], None]] = None
    ) -> Dict[str, Any]:
        """Execute a Maven command step"""
        
        if not step.command:
            raise ValueError(f"Maven step requires command: {step.name}")
        
        # Prepend 'mvn' if not already present
        command = step.command if step.command.startswith("mvn ") else f"mvn {step.command}"
        
        # Create a modified step for shell execution
        maven_step = WorkflowStep(
            name=step.name,
            step_type=WorkflowStepType.SHELL_COMMAND,
            description=step.description,
            command=command,
            save_artifact=step.save_artifact
        )
        
        return self._execute_shell_step(maven_step, event_callback)


# Workflow definitions
QUARKUS_BOOTSTRAP_V1 = Workflow(
    name="quarkus-bootstrap-v1",
    version="1.0.0",
    description="Generate a Quarkus GraphQL + OpenTelemetry project scaffold",
    steps=[
        WorkflowStep(
            name="planner",
            step_type=WorkflowStepType.LLM_GENERATE,
            description="Create project plan using Gemma3",
            model="gemma3:27b",
            prompt="""You are a software architect planning a Quarkus project with GraphQL and OpenTelemetry.

Create a detailed project plan that includes:
1. Project structure overview
2. Key dependencies needed (Quarkus, GraphQL, OpenTelemetry, etc.)
3. Main components to implement (GraphQL resources, telemetry configuration)
4. Testing strategy
5. Build and deployment notes

Write the plan in Markdown format with clear sections.""",
            output_file="PLAN.md",
            save_artifact=False
        ),
        WorkflowStep(
            name="coder",
            step_type=WorkflowStepType.LLM_GENERATE,
            description="Generate Maven Quarkus project using Qwen3",
            model="qwen3-coder:latest",
            prompt="""You are an expert Java developer. Create a complete Maven Quarkus project with:
- Quarkus framework
- GraphQL API support (using quarkus-smallrye-graphql)
- OpenTelemetry integration (using quarkus-opentelemetry)
- A simple GraphQL query endpoint that returns a greeting
- Basic application properties configuration
- Unit tests

Generate a pom.xml file with all necessary dependencies.
Also generate:
1. src/main/java/com/example/GreetingResource.java (GraphQL resource)
2. src/main/resources/application.properties (with telemetry config)
3. src/test/java/com/example/GreetingResourceTest.java (basic test)

Output each file with clear markers like:
=== FILE: pom.xml ===
<content>
=== END FILE ===

Make sure to use Quarkus BOM version 3.x and compatible dependencies.""",
            output_file="project_files.txt",
            save_artifact=True
        ),
        WorkflowStep(
            name="maven_test",
            step_type=WorkflowStepType.MAVEN_COMMAND,
            description="Run Maven test to verify project builds",
            command="test",
            save_artifact=True
        )
    ]
)


# Registry of available workflows
WORKFLOW_REGISTRY: Dict[str, Workflow] = {
    "quarkus-bootstrap-v1": QUARKUS_BOOTSTRAP_V1
}


def get_workflow(name: str) -> Optional[Workflow]:
    """Get a workflow by name from the registry"""
    return WORKFLOW_REGISTRY.get(name)


def list_workflows() -> List[str]:
    """List all available workflow names"""
    return list(WORKFLOW_REGISTRY.keys())


def apply_model_overrides(
    workflow: Workflow,
    model_overrides: Optional[Dict[str, str]] = None
) -> Workflow:
    """
    Apply model overrides to a workflow based on options and environment variables.
    
    Priority order:
    1. model_overrides dict (from run options)
    2. Environment variables (OLLAMA_PLANNER_MODEL, OLLAMA_CODER_MODEL)
    3. Original workflow defaults
    
    Args:
        workflow: The original workflow to modify
        model_overrides: Optional dict with keys like "planner", "coder" mapping to model names
    
    Returns:
        A new Workflow instance with updated models and descriptions
    """
    if model_overrides is None:
        model_overrides = {}
    
    # Get environment variable defaults
    env_models = {
        "planner": os.getenv("OLLAMA_PLANNER_MODEL"),
        "coder": os.getenv("OLLAMA_CODER_MODEL")
    }
    
    # Create new steps with overridden models
    new_steps = []
    for step in workflow.steps:
        if step.step_type != WorkflowStepType.LLM_GENERATE:
            # Non-LLM steps pass through unchanged
            new_steps.append(step)
            continue
        
        # Determine the model to use based on priority
        original_model = step.model
        new_model = original_model
        
        # Check if this step has an override based on its name
        step_name = step.name.lower()
        if step_name in model_overrides and model_overrides[step_name]:
            new_model = model_overrides[step_name]
            logger.info(f"Overriding {step.name} model from options: {original_model} -> {new_model}")
        elif step_name in env_models and env_models[step_name]:
            new_model = env_models[step_name]
            logger.info(f"Overriding {step.name} model from env: {original_model} -> {new_model}")
        
        # Update description to reflect the actual model if it changed
        new_description = step.description
        if new_model != original_model:
            # Try to update model reference in description
            # Match patterns like "using Gemma3" or "using Qwen3"
            import re
            # Replace model mentions in description
            new_description = re.sub(
                r'using \w+',
                f'using {new_model.split(":")[0]}',
                step.description,
                flags=re.IGNORECASE
            )
            if new_description == step.description:
                # If no pattern matched, append the model info
                new_description = f"{step.description} (model: {new_model})"
        
        # Create new step with updated model and description
        new_step = WorkflowStep(
            name=step.name,
            step_type=step.step_type,
            description=new_description,
            model=new_model,
            prompt=step.prompt,
            output_file=step.output_file,
            command=step.command,
            save_artifact=step.save_artifact
        )
        new_steps.append(new_step)
    
    # Return new workflow with updated steps
    return Workflow(
        name=workflow.name,
        version=workflow.version,
        description=workflow.description,
        steps=new_steps
    )
