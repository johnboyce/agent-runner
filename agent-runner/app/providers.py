"""
LLM providers for agent execution.

This module contains provider implementations for various LLM services.
Providers implement the LLMProvider protocol for consistent interaction.
"""
import os
import time
import logging
import requests
import threading
from typing import Optional, Callable, Protocol, runtime_checkable
from enum import Enum

logger = logging.getLogger(__name__)


class EventType(str, Enum):
    """Event types for LLM generation"""
    LOADING_MODEL = "LOADING_MODEL"
    GENERATING = "GENERATING"
    HEARTBEAT = "HEARTBEAT"  # Periodic progress update during generation
    DONE = "DONE"
    ERROR = "ERROR"


@runtime_checkable
class LLMProvider(Protocol):
    """
    Protocol defining the interface for LLM providers.

    All LLM providers must implement these methods for consistent interaction.
    """

    def generate(
        self,
        prompt: str,
        model: str,
        event_callback: Optional[Callable[[EventType, str], None]] = None,
    ) -> str:
        """
        Generate text from a prompt.

        Args:
            prompt: The input prompt to generate from
            model: The model name to use
            event_callback: Optional callback for progress events

        Returns:
            The generated text response

        Raises:
            Exception: If generation fails
        """
        ...

    def check_health(self) -> bool:
        """
        Check if the provider service is available.

        Returns:
            True if service is healthy, False otherwise
        """
        ...

    def list_models(self) -> list[str]:
        """
        List available models for this provider.

        Returns:
            List of model names available for generation
        """
        ...


class OllamaProvider:
    """
    Provider for Ollama local LLM service.

    Uses Ollama API to generate text from prompts.
    Emits events during generation: loading model, generating, and done.
    """

    name = "ollama"
    default_model = "gemma3:27b"

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
        self._timeout = int(os.getenv("OLLAMA_TIMEOUT", "300"))
        self._heartbeat_interval = int(os.getenv("OLLAMA_HEARTBEAT_INTERVAL", "15"))
        logger.info(f"OllamaProvider initialized with base_url: {self.base_url}")

    def generate(
        self,
        prompt: str,
        model: str,
        event_callback: Optional[Callable[[EventType, str], None]] = None,
    ) -> str:
        """
        Generate text from a prompt using Ollama.

        Args:
            prompt: The input prompt to generate from
            model: The model name to use (e.g., "gemma3:27b", "qwen3-coder:latest")
            event_callback: Optional callback function that receives (EventType, message) tuples

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
            while not heartbeat_stop.wait(self._heartbeat_interval):
                elapsed = int(time.time() - start_time)
                if event_callback:
                    event_callback(EventType.HEARTBEAT,
                                 f"Still waiting on {model}... {elapsed}s elapsed")

        try:
            # Emit generating event
            if event_callback:
                event_callback(EventType.GENERATING, f"Generating response with {model}...")

            # Start heartbeat thread
            if event_callback and self._heartbeat_interval > 0:
                heartbeat_thread = threading.Thread(target=heartbeat_worker, daemon=True)
                heartbeat_thread.start()

            response = requests.post(url, json=payload, timeout=self._timeout)
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
            error_msg = f"Timeout waiting for Ollama response (timeout={self._timeout}s, elapsed={elapsed}s)"
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
            # Stop heartbeat thread if it was started
            if heartbeat_thread is not None:
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

    def list_models(self) -> list[str]:
        """
        List available models from Ollama.

        Dynamically queries the Ollama API for available models.
        Returns empty list if service is unavailable.
        """
        try:
            response = requests.get(f"{self.base_url}/api/tags", timeout=5)
            if response.status_code == 200:
                data = response.json()
                models = data.get("models", [])
                return [m.get("name", "") for m in models if m.get("name")]
            return []
        except Exception as e:
            logger.warning(f"Failed to list Ollama models: {e}")
            return []


class GeminiProvider:
    """
    Provider for Google Gemini LLM service.

    Uses the google-generativeai SDK to interact with Gemini models.
    Requires GEMINI_API_KEY environment variable.
    """

    name = "gemini"
    default_model = "gemini-1.5-flash"

    # Statically known Gemini models
    KNOWN_MODELS = [
        "gemini-1.5-flash",
        "gemini-1.5-flash-8b",
        "gemini-1.5-pro",
        "gemini-2.0-flash",
        "gemini-2.0-flash-lite",
    ]

    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Gemini provider.

        Args:
            api_key: Gemini API key. Defaults to GEMINI_API_KEY env var.
        """
        self.api_key = api_key or os.getenv("GEMINI_API_KEY")
        self._client = None
        self._heartbeat_interval = int(os.getenv("GEMINI_HEARTBEAT_INTERVAL", "15"))

        if self.api_key:
            try:
                import google.generativeai as genai
                genai.configure(api_key=self.api_key)
                self._genai = genai
                logger.info("GeminiProvider initialized with API key")
            except ImportError:
                logger.warning("google-generativeai package not installed")
                self._genai = None
        else:
            self._genai = None
            logger.info("GeminiProvider initialized without API key (unavailable)")

    def generate(
        self,
        prompt: str,
        model: str,
        event_callback: Optional[Callable[[EventType, str], None]] = None,
    ) -> str:
        """
        Generate text from a prompt using Gemini.

        Args:
            prompt: The input prompt to generate from
            model: The model name to use (e.g., "gemini-1.5-flash", "gemini-1.5-pro")
            event_callback: Optional callback function that receives (EventType, message) tuples

        Returns:
            The generated text response

        Raises:
            ValueError: If API key not configured or SDK not available
            Exception: If generation fails
        """
        if not self._genai:
            raise ValueError("Gemini provider not available: API key not configured or SDK not installed")

        logger.info(f"Generating with Gemini model: {model}")

        # Emit loading model event
        if event_callback:
            event_callback(EventType.LOADING_MODEL, f"Loading model: {model}")

        start_time = time.time()
        heartbeat_stop = threading.Event()
        heartbeat_thread = None

        def heartbeat_worker():
            """Background thread that emits heartbeat events"""
            while not heartbeat_stop.wait(self._heartbeat_interval):
                elapsed = int(time.time() - start_time)
                if event_callback:
                    event_callback(EventType.HEARTBEAT,
                                 f"Still waiting on {model}... {elapsed}s elapsed")

        try:
            # Emit generating event
            if event_callback:
                event_callback(EventType.GENERATING, f"Generating response with {model}...")

            # Start heartbeat thread
            if event_callback and self._heartbeat_interval > 0:
                heartbeat_thread = threading.Thread(target=heartbeat_worker, daemon=True)
                heartbeat_thread.start()

            # Create model and generate
            gemini_model = self._genai.GenerativeModel(model)
            response = gemini_model.generate_content(prompt)

            generated_text = response.text

            # Emit done event
            if event_callback:
                elapsed = int(time.time() - start_time)
                event_callback(EventType.DONE,
                             f"Generation complete ({len(generated_text)} chars, {elapsed}s)")

            logger.info(f"Generation successful: {len(generated_text)} characters")
            return generated_text

        except Exception as e:
            elapsed = int(time.time() - start_time)
            error_msg = f"Gemini generation failed after {elapsed}s: {str(e)}"
            logger.error(error_msg)
            if event_callback:
                event_callback(EventType.ERROR, error_msg)
            raise

        finally:
            # Stop heartbeat thread if it was started
            if heartbeat_thread is not None:
                heartbeat_stop.set()
                heartbeat_thread.join(timeout=1)

    def check_health(self) -> bool:
        """
        Check if Gemini service is available.

        Returns True if API key is configured and SDK is available.
        Does not make an actual API call to conserve quota.
        """
        return self._genai is not None and self.api_key is not None

    def list_models(self) -> list[str]:
        """
        List available Gemini models.

        Returns statically known models. API key not required.
        """
        return self.KNOWN_MODELS.copy()


# =============================================================================
# Provider Registry
# =============================================================================

# Global provider instances (lazy initialization)
_providers: dict[str, LLMProvider] = {}


def _init_providers() -> None:
    """Initialize all provider instances."""
    global _providers
    if not _providers:
        _providers = {
            "ollama": OllamaProvider(),
            "gemini": GeminiProvider(),
        }


def get_provider(name: str) -> LLMProvider:
    """
    Get a provider by name.

    Args:
        name: Provider name (e.g., "ollama", "gemini")

    Returns:
        The provider instance

    Raises:
        ValueError: If provider name is not recognized
    """
    _init_providers()

    if name not in _providers:
        available = list(_providers.keys())
        raise ValueError(f"Unknown provider '{name}'. Available providers: {available}")

    return _providers[name]


def list_providers() -> list[dict]:
    """
    List all available providers with their status.

    Returns:
        List of provider info dicts with name, available, and models
    """
    _init_providers()

    result = []
    for name, provider in _providers.items():
        result.append({
            "name": name,
            "available": provider.check_health(),
            "models": provider.list_models(),
            "default_model": getattr(provider, "default_model", None),
        })

    return result


def get_default_provider_name() -> str:
    """Get the default provider name from environment or fallback to ollama."""
    return os.getenv("DEFAULT_LLM_PROVIDER", "ollama")


def get_default_model(provider_name: str) -> str:
    """
    Get the default model for a provider.

    Args:
        provider_name: The provider name

    Returns:
        Default model name for the provider
    """
    # Check environment variable first
    env_model = os.getenv("DEFAULT_LLM_MODEL")
    if env_model:
        return env_model

    # Fall back to provider's default
    provider = get_provider(provider_name)
    return getattr(provider, "default_model", "")


def validate_provider_model(provider_name: Optional[str], model: Optional[str]) -> tuple[str, str]:
    """
    Validate and resolve provider/model configuration.

    Args:
        provider_name: Provider name (optional, uses default if None)
        model: Model name (optional, uses provider default if None)

    Returns:
        Tuple of (resolved_provider_name, resolved_model)

    Raises:
        ValueError: If provider is invalid or unavailable
    """
    _init_providers()

    # Resolve provider
    resolved_provider = provider_name or get_default_provider_name()

    if resolved_provider not in _providers:
        available = list(_providers.keys())
        raise ValueError(f"Unknown provider '{resolved_provider}'. Available providers: {available}")

    provider = _providers[resolved_provider]

    # Check if provider is available (health check)
    if not provider.check_health():
        raise ValueError(f"Provider '{resolved_provider}' is not available. Check configuration and service status.")

    # Resolve model
    resolved_model = model or get_default_model(resolved_provider)

    return resolved_provider, resolved_model


# Legacy function for backwards compatibility
def get_ollama_provider() -> OllamaProvider:
    """Get the global Ollama provider instance (legacy)."""
    return get_provider("ollama")  # type: ignore
