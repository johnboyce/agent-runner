"""
LLM providers for agent execution.

This module contains provider implementations for various LLM services.
"""
import os
import time
import logging
import requests
import threading
from typing import Optional, Callable, Any
from enum import Enum

logger = logging.getLogger(__name__)


class EventType(str, Enum):
    """Event types for LLM generation"""
    LOADING_MODEL = "LOADING_MODEL"
    GENERATING = "GENERATING"
    HEARTBEAT = "HEARTBEAT"  # Periodic progress update during generation
    DONE = "DONE"
    ERROR = "ERROR"


class OllamaProvider:
    """
    Provider for Ollama local LLM service.
    
    Uses Ollama API to generate text from prompts.
    Emits events during generation: loading model, generating, and done.
    """
    
    def __init__(self, base_url: Optional[str] = None):
        """
        Initialize Ollama provider.
        
        Args:
            base_url: Base URL for Ollama API. Defaults to OLLAMA_BASE_URL env var
                     or http://localhost:11434 if not set.
        """
        self.base_url = base_url or os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        # Remove trailing slash if present
        self.base_url = self.base_url.rstrip("/")
        logger.info(f"OllamaProvider initialized with base_url: {self.base_url}")
    
    def generate(
        self,
        prompt: str,
        model: str,
        event_callback: Optional[Callable[[EventType, str], None]] = None,
        timeout: int = 300,
        heartbeat_interval: int = 15
    ) -> str:
        """
        Generate text from a prompt using Ollama.
        
        Args:
            prompt: The input prompt to generate from
            model: The model name to use (e.g., "gemma3:27b", "qwen3-coder:latest")
            event_callback: Optional callback function that receives (EventType, message) tuples
            timeout: Request timeout in seconds (default: 300)
            heartbeat_interval: Interval in seconds for heartbeat events (default: 15)
        
        Returns:
            The generated text response
            
        Raises:
            requests.exceptions.RequestException: If the API request fails
            ValueError: If the response format is invalid
        """
        logger.info(f"Generating with model: {model}")
        
        # Emit loading model event
        if event_callback:
            event_callback(EventType.LOADING_MODEL, f"Loading model: {model}")
        
        url = f"{self.base_url}/api/generate"
        payload = {
            "model": model,
            "prompt": prompt,
            "stream": False  # Non-streaming for now
        }
        
        # Track start time for elapsed time reporting
        start_time = time.time()
        heartbeat_stop = threading.Event()
        heartbeat_thread = None
        
        def heartbeat_worker():
            """Background thread that emits heartbeat events"""
            while not heartbeat_stop.wait(heartbeat_interval):
                elapsed = int(time.time() - start_time)
                if event_callback:
                    event_callback(EventType.HEARTBEAT, 
                                 f"Still waiting on {model}... {elapsed}s elapsed")
        
        try:
            # Emit generating event
            if event_callback:
                event_callback(EventType.GENERATING, f"Generating response with {model}...")
            
            # Start heartbeat thread
            if event_callback and heartbeat_interval > 0:
                heartbeat_thread = threading.Thread(target=heartbeat_worker, daemon=True)
                heartbeat_thread.start()
            
            response = requests.post(url, json=payload, timeout=timeout)
            response.raise_for_status()
            
            data = response.json()
            
            # Validate response format
            if "response" not in data:
                raise ValueError(f"Invalid Ollama response format: {data}")
            
            generated_text = data["response"]
            
            # Emit done event
            if event_callback:
                elapsed = int(time.time() - start_time)
                event_callback(EventType.DONE, 
                             f"Generation complete ({len(generated_text)} chars, {elapsed}s)")
            
            logger.info(f"Generation successful: {len(generated_text)} characters")
            return generated_text
            
        except requests.exceptions.Timeout:
            elapsed = int(time.time() - start_time)
            error_msg = f"Timeout waiting for Ollama response (timeout={timeout}s, elapsed={elapsed}s)"
            logger.error(error_msg)
            if event_callback:
                event_callback(EventType.ERROR, error_msg)
            raise
            
        except requests.exceptions.RequestException as e:
            elapsed = int(time.time() - start_time)
            error_msg = f"Ollama API request failed after {elapsed}s: {str(e)}"
            logger.error(error_msg)
            if event_callback:
                event_callback(EventType.ERROR, error_msg)
            raise
            
        except Exception as e:
            elapsed = int(time.time() - start_time)
            error_msg = f"Unexpected error during generation after {elapsed}s: {str(e)}"
            logger.error(error_msg)
            if event_callback:
                event_callback(EventType.ERROR, error_msg)
            raise
        
        finally:
            # Stop heartbeat thread
            if heartbeat_thread:
                heartbeat_stop.set()
                heartbeat_thread.join(timeout=1)
    
    def check_health(self) -> bool:
        """
        Check if Ollama service is available.
        
        Returns:
            True if service is healthy, False otherwise
        """
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return response.status_code == 200
        except Exception as e:
            logger.warning(f"Ollama health check failed: {e}")
            return False


# Global provider instance
_ollama_provider: Optional[OllamaProvider] = None


def get_ollama_provider() -> OllamaProvider:
    """Get or create the global Ollama provider instance"""
    global _ollama_provider
    if _ollama_provider is None:
        _ollama_provider = OllamaProvider()
    return _ollama_provider
