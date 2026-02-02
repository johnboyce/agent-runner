"""
Tests for LLM providers.
"""
import pytest
from unittest.mock import Mock, patch
from app.providers import OllamaProvider, EventType


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
            provider.generate("Test prompt", model="test-model", timeout=30)
    
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
