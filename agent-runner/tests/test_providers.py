"""
Tests for LLM providers.
"""
import pytest
from unittest.mock import Mock, patch, MagicMock
import os
from app.providers import (
    OllamaProvider,
    GeminiProvider,
    EventType,
    LLMProvider,
    get_provider,
    list_providers,
    validate_provider_model,
    get_default_provider_name,
    get_default_model,
    _providers,
    _init_providers,
)


class TestLLMProviderProtocol:
    """Tests for LLMProvider protocol compliance"""

    def test_ollama_provider_implements_protocol(self):
        """Test OllamaProvider implements LLMProvider protocol"""
        provider = OllamaProvider()
        assert isinstance(provider, LLMProvider)

    def test_gemini_provider_implements_protocol(self):
        """Test GeminiProvider implements LLMProvider protocol"""
        provider = GeminiProvider()
        assert isinstance(provider, LLMProvider)


class TestOllamaProvider:
    """Tests for OllamaProvider"""

    def test_init_with_default_url(self):
        """Test initialization with default URL"""
        provider = OllamaProvider()
        assert provider.base_url == "http://localhost:11434"

    def test_init_with_custom_url(self):
        """Test initialization with custom URL"""
        provider = OllamaProvider(base_url="http://custom:8080")
        assert provider.base_url == "http://custom:8080"

    def test_init_removes_trailing_slash(self):
        """Test that trailing slash is removed from base URL"""
        provider = OllamaProvider(base_url="http://localhost:11434/")
        assert provider.base_url == "http://localhost:11434"

    def test_name_and_default_model(self):
        """Test provider has name and default_model attributes"""
        provider = OllamaProvider()
        assert provider.name == "ollama"
        assert provider.default_model == "gemma3:27b"

    @patch('app.providers.requests.post')
    def test_generate_success(self, mock_post):
        """Test successful text generation"""
        # Setup mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"response": "Generated text here"}
        mock_post.return_value = mock_response

        provider = OllamaProvider()
        result = provider.generate("Test prompt", model="gemma3:27b")

        assert result == "Generated text here"
        mock_post.assert_called_once()
        call_args = mock_post.call_args
        assert call_args[1]['json']['model'] == "gemma3:27b"
        assert call_args[1]['json']['prompt'] == "Test prompt"
        assert call_args[1]['json']['stream'] is False

    @patch('app.providers.requests.post')
    def test_generate_with_events(self, mock_post):
        """Test generation with event callbacks"""
        # Setup mock response
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"response": "Test output"}
        mock_post.return_value = mock_response

        # Track events
        events = []
        def event_callback(event_type, message):
            events.append((event_type, message))

        provider = OllamaProvider()
        result = provider.generate(
            "Test prompt",
            model="test-model",
            event_callback=event_callback
        )

        assert result == "Test output"
        assert len(events) == 3
        assert events[0][0] == EventType.LOADING_MODEL
        assert "test-model" in events[0][1]
        assert events[1][0] == EventType.GENERATING
        assert events[2][0] == EventType.DONE

    @patch('app.providers.requests.post')
    def test_generate_handles_request_exception(self, mock_post):
        """Test that request exceptions are handled properly"""
        import requests
        mock_post.side_effect = requests.exceptions.ConnectionError("Connection failed")

        provider = OllamaProvider()

        with pytest.raises(requests.exceptions.RequestException):
            provider.generate("Test prompt", model="test-model")

    @patch('app.providers.requests.post')
    def test_generate_handles_timeout(self, mock_post):
        """Test that timeout exceptions are handled properly"""
        import requests
        mock_post.side_effect = requests.exceptions.Timeout("Request timed out")

        provider = OllamaProvider()

        with pytest.raises(requests.exceptions.Timeout):
            provider.generate("Test prompt", model="test-model")

    @patch('app.providers.requests.post')
    def test_generate_handles_invalid_response(self, mock_post):
        """Test that invalid response format raises ValueError"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"invalid": "format"}  # Missing 'response' key
        mock_post.return_value = mock_response

        provider = OllamaProvider()

        with pytest.raises(ValueError, match="Invalid Ollama response format"):
            provider.generate("Test prompt", model="test-model")

    @patch('app.providers.requests.get')
    def test_check_health_success(self, mock_get):
        """Test health check returns True when service is available"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_get.return_value = mock_response

        provider = OllamaProvider()
        assert provider.check_health() is True

    @patch('app.providers.requests.get')
    def test_check_health_failure(self, mock_get):
        """Test health check returns False when service is unavailable"""
        import requests
        mock_get.side_effect = requests.exceptions.ConnectionError("Connection failed")

        provider = OllamaProvider()
        assert provider.check_health() is False

    @patch('app.providers.requests.get')
    def test_list_models_success(self, mock_get):
        """Test listing models from Ollama API"""
        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "models": [
                {"name": "gemma3:27b"},
                {"name": "llama2:7b"},
            ]
        }
        mock_get.return_value = mock_response

        provider = OllamaProvider()
        models = provider.list_models()

        assert models == ["gemma3:27b", "llama2:7b"]

    @patch('app.providers.requests.get')
    def test_list_models_failure(self, mock_get):
        """Test listing models returns empty list on failure"""
        import requests
        mock_get.side_effect = requests.exceptions.ConnectionError("Connection failed")

        provider = OllamaProvider()
        models = provider.list_models()

        assert models == []


class TestGeminiProvider:
    """Tests for GeminiProvider"""

    def test_init_without_api_key(self):
        """Test initialization without API key"""
        with patch.dict(os.environ, {}, clear=True):
            # Remove GEMINI_API_KEY if present
            os.environ.pop("GEMINI_API_KEY", None)
            provider = GeminiProvider()
            assert provider._genai is None
            assert provider.check_health() is False

    def test_name_and_default_model(self):
        """Test provider has name and default_model attributes"""
        provider = GeminiProvider()
        assert provider.name == "gemini"
        assert provider.default_model == "gemini-1.5-flash"

    def test_known_models(self):
        """Test provider returns known models"""
        provider = GeminiProvider()
        models = provider.list_models()
        assert "gemini-1.5-flash" in models
        assert "gemini-1.5-pro" in models
        assert "gemini-2.0-flash" in models

    def test_list_models_returns_copy(self):
        """Test list_models returns a copy, not the original list"""
        provider = GeminiProvider()
        models1 = provider.list_models()
        models2 = provider.list_models()
        assert models1 is not models2
        assert models1 == models2

    def test_generate_without_api_key_raises(self):
        """Test generate raises when API key not configured"""
        provider = GeminiProvider()
        provider._genai = None

        with pytest.raises(ValueError, match="not available"):
            provider.generate("Test prompt", model="gemini-1.5-flash")

    def test_check_health_without_api_key(self):
        """Test health check returns False without API key"""
        provider = GeminiProvider()
        provider._genai = None
        provider.api_key = None
        assert provider.check_health() is False

    def test_generate_success(self):
        """Test successful generation with Gemini"""
        # Setup mock
        mock_genai = Mock()
        mock_model = Mock()
        mock_response = Mock()
        mock_response.text = "Generated response"
        mock_model.generate_content.return_value = mock_response
        mock_genai.GenerativeModel.return_value = mock_model

        provider = GeminiProvider()
        provider._genai = mock_genai
        provider.api_key = "test-key"

        result = provider.generate("Test prompt", model="gemini-1.5-flash")

        assert result == "Generated response"
        mock_genai.GenerativeModel.assert_called_once_with("gemini-1.5-flash")
        mock_model.generate_content.assert_called_once_with("Test prompt")

    def test_generate_with_events(self):
        """Test generation with event callbacks"""
        mock_genai = Mock()
        mock_model = Mock()
        mock_response = Mock()
        mock_response.text = "Test output"
        mock_model.generate_content.return_value = mock_response
        mock_genai.GenerativeModel.return_value = mock_model

        events = []
        def event_callback(event_type, message):
            events.append((event_type, message))

        provider = GeminiProvider()
        provider._genai = mock_genai
        provider.api_key = "test-key"

        result = provider.generate(
            "Test prompt",
            model="gemini-1.5-flash",
            event_callback=event_callback
        )

        assert result == "Test output"
        assert len(events) == 3
        assert events[0][0] == EventType.LOADING_MODEL
        assert events[1][0] == EventType.GENERATING
        assert events[2][0] == EventType.DONE

    def test_generate_handles_error(self):
        """Test generation handles errors properly"""
        mock_genai = Mock()
        mock_model = Mock()
        mock_model.generate_content.side_effect = Exception("API Error")
        mock_genai.GenerativeModel.return_value = mock_model

        events = []
        def event_callback(event_type, message):
            events.append((event_type, message))

        provider = GeminiProvider()
        provider._genai = mock_genai
        provider.api_key = "test-key"

        with pytest.raises(Exception, match="API Error"):
            provider.generate(
                "Test prompt",
                model="gemini-1.5-flash",
                event_callback=event_callback
            )

        error_events = [e for e in events if e[0] == EventType.ERROR]
        assert len(error_events) == 1


class TestProviderRegistry:
    """Tests for provider registry functions"""

    def setup_method(self):
        """Reset providers before each test"""
        # Import at module level won't work for clearing, need to access via module
        import app.providers as providers_module
        providers_module._providers.clear()

    @patch('app.providers.OllamaProvider')
    @patch('app.providers.GeminiProvider')
    def test_init_providers(self, mock_gemini_cls, mock_ollama_cls):
        """Test provider initialization"""
        mock_ollama = Mock()
        mock_gemini = Mock()
        mock_ollama_cls.return_value = mock_ollama
        mock_gemini_cls.return_value = mock_gemini

        _init_providers()

        mock_ollama_cls.assert_called_once()
        mock_gemini_cls.assert_called_once()

    def test_get_provider_ollama(self):
        """Test getting Ollama provider"""
        provider = get_provider("ollama")
        assert isinstance(provider, OllamaProvider)

    def test_get_provider_gemini(self):
        """Test getting Gemini provider"""
        provider = get_provider("gemini")
        assert isinstance(provider, GeminiProvider)

    def test_get_provider_unknown_raises(self):
        """Test getting unknown provider raises ValueError"""
        with pytest.raises(ValueError, match="Unknown provider"):
            get_provider("unknown")

    @patch.object(OllamaProvider, 'check_health', return_value=True)
    @patch.object(OllamaProvider, 'list_models', return_value=["gemma3:27b"])
    @patch.object(GeminiProvider, 'check_health', return_value=False)
    @patch.object(GeminiProvider, 'list_models', return_value=["gemini-1.5-flash"])
    def test_list_providers(self, *mocks):
        """Test listing all providers"""
        providers = list_providers()

        assert len(providers) == 2

        ollama = next(p for p in providers if p["name"] == "ollama")
        assert ollama["available"] is True
        assert "gemma3:27b" in ollama["models"]
        assert ollama["default_model"] == "gemma3:27b"

        gemini = next(p for p in providers if p["name"] == "gemini")
        assert gemini["available"] is False
        assert "gemini-1.5-flash" in gemini["models"]
        assert gemini["default_model"] == "gemini-1.5-flash"

    def test_get_default_provider_name(self):
        """Test getting default provider name"""
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop("DEFAULT_LLM_PROVIDER", None)
            assert get_default_provider_name() == "ollama"

        with patch.dict(os.environ, {"DEFAULT_LLM_PROVIDER": "gemini"}):
            assert get_default_provider_name() == "gemini"

    def test_get_default_model(self):
        """Test getting default model for provider"""
        with patch.dict(os.environ, {}, clear=True):
            os.environ.pop("DEFAULT_LLM_MODEL", None)
            assert get_default_model("ollama") == "gemma3:27b"
            assert get_default_model("gemini") == "gemini-1.5-flash"

        with patch.dict(os.environ, {"DEFAULT_LLM_MODEL": "custom-model"}):
            assert get_default_model("ollama") == "custom-model"

    @patch.object(OllamaProvider, 'check_health', return_value=True)
    def test_validate_provider_model_success(self, mock_health):
        """Test successful provider/model validation"""
        provider, model = validate_provider_model("ollama", "gemma3:27b")
        assert provider == "ollama"
        assert model == "gemma3:27b"

    @patch.object(OllamaProvider, 'check_health', return_value=True)
    def test_validate_provider_model_uses_defaults(self, mock_health):
        """Test validation uses defaults when not specified"""
        provider, model = validate_provider_model(None, None)
        assert provider == "ollama"
        assert model == "gemma3:27b"

    def test_validate_provider_model_unknown_provider(self):
        """Test validation raises for unknown provider"""
        with pytest.raises(ValueError, match="Unknown provider"):
            validate_provider_model("unknown", "model")

    @patch.object(OllamaProvider, 'check_health', return_value=False)
    def test_validate_provider_model_unavailable_provider(self, mock_health):
        """Test validation raises for unavailable provider"""
        with pytest.raises(ValueError, match="not available"):
            validate_provider_model("ollama", "model")


class TestHeartbeatFunctionality:
    """Tests for heartbeat events during generation"""

    @patch('app.providers.requests.post')
    @patch('app.providers.time.time')
    def test_heartbeat_includes_elapsed_time(self, mock_time, mock_post):
        """Test that DONE event messages include elapsed time"""
        import time
        import itertools

        # Mock time progression: start at 0, then 10s for done event
        time_values = itertools.cycle([0.0, 10.0])
        mock_time.side_effect = lambda: next(time_values)

        mock_response = Mock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"response": "Generated text"}

        # Simulate delay for heartbeat to trigger
        def delayed_post(*args, **kwargs):
            time.sleep(0.05)
            return mock_response

        mock_post.side_effect = delayed_post

        events = []
        def event_callback(event_type, message):
            events.append((event_type, message))

        provider = OllamaProvider()
        result = provider.generate(
            "Test prompt",
            model="test-model",
            event_callback=event_callback
        )

        assert result == "Generated text"

        # Check that DONE event includes elapsed time
        done_events = [e for e in events if e[0] == EventType.DONE]
        assert len(done_events) == 1
        assert "10s" in done_events[0][1]

    @patch('app.providers.requests.post')
    def test_timeout_error_includes_elapsed_time(self, mock_post):
        """Test that timeout errors include elapsed time"""
        import requests

        mock_post.side_effect = requests.exceptions.Timeout("Request timed out")

        events = []
        def event_callback(event_type, message):
            events.append((event_type, message))

        provider = OllamaProvider()

        with pytest.raises(requests.exceptions.Timeout):
            provider.generate(
                "Test prompt",
                model="test-model",
                event_callback=event_callback
            )

        # Check that ERROR event includes elapsed time
        error_events = [e for e in events if e[0] == EventType.ERROR]
        assert len(error_events) == 1
        assert "elapsed=" in error_events[0][1]

    @patch('app.providers.requests.post')
    def test_request_error_includes_elapsed_time(self, mock_post):
        """Test that request errors include elapsed time"""
        import requests

        mock_post.side_effect = requests.exceptions.ConnectionError("Connection failed")

        events = []
        def event_callback(event_type, message):
            events.append((event_type, message))

        provider = OllamaProvider()

        with pytest.raises(requests.exceptions.RequestException):
            provider.generate(
                "Test prompt",
                model="test-model",
                event_callback=event_callback
            )

        # Check that ERROR event includes elapsed time
        error_events = [e for e in events if e[0] == EventType.ERROR]
        assert len(error_events) == 1
        assert "after" in error_events[0][1].lower() and "s" in error_events[0][1]
