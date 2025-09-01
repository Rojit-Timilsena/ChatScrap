#!/usr/bin/env python3
"""
Unit tests for G4F Wrapper
"""

import unittest
from unittest.mock import Mock, patch, MagicMock
from datetime import datetime
import json

from g4f_wrapper import G4FWrapper, ProviderStatus, ProviderInfo, ChatResponse


class TestG4FWrapper(unittest.TestCase):
    """Test cases for G4FWrapper class"""
    
    def setUp(self):
        """Set up test fixtures"""
        with patch('g4f_wrapper.g4f') as mock_g4f:
            mock_g4f.Provider = Mock()
            self.wrapper = G4FWrapper()
    
    @patch('g4f_wrapper.g4f')
    def test_init_without_g4f(self, mock_g4f):
        """Test initialization when g4f is not available"""
        mock_g4f = None
        with patch('g4f_wrapper.g4f', None):
            with self.assertRaises(ImportError):
                G4FWrapper()
    
    @patch('g4f_wrapper.Provider')
    @patch('g4f_wrapper.g4f')
    def test_get_available_providers_success(self, mock_g4f, mock_provider_class):
        """Test successful provider retrieval"""
        # Mock provider objects
        mock_provider1 = Mock()
        mock_provider1.__name__ = 'Provider.Bing'
        mock_provider2 = Mock()
        mock_provider2.__name__ = 'Provider.ChatgptAi'
        
        mock_provider_class.Bing = mock_provider1
        mock_provider_class.ChatgptAi = mock_provider2
        mock_provider_class.FreeGpt = Mock()
        mock_provider_class.Liaobots = Mock()
        mock_provider_class.You = Mock()
        mock_provider_class.Yqcloud = Mock()
        
        # Mock the test provider health method
        with patch.object(self.wrapper, '_test_provider_health') as mock_test:
            mock_test.return_value = ProviderStatus.AVAILABLE
            
            providers = self.wrapper.get_available_providers()
            
            self.assertIsInstance(providers, list)
            self.assertGreater(len(providers), 0)
            
            # Check first provider structure
            if providers:
                provider = providers[0]
                self.assertIn('id', provider)
                self.assertIn('name', provider)
                self.assertIn('status', provider)
                self.assertIn('last_checked', provider)
    
    @patch('g4f_wrapper.g4f')
    def test_test_provider_health_available(self, mock_g4f):
        """Test provider health check when provider is available"""
        mock_provider = Mock()
        mock_g4f.ChatCompletion.create.return_value = "Test response"
        
        status = self.wrapper._test_provider_health(mock_provider)
        
        self.assertEqual(status, ProviderStatus.AVAILABLE)
        mock_g4f.ChatCompletion.create.assert_called_once()
    
    @patch('g4f_wrapper.g4f')
    def test_test_provider_health_rate_limited(self, mock_g4f):
        """Test provider health check when rate limited"""
        mock_provider = Mock()
        mock_g4f.ChatCompletion.create.side_effect = Exception("Rate limit exceeded")
        
        status = self.wrapper._test_provider_health(mock_provider)
        
        self.assertEqual(status, ProviderStatus.RATE_LIMITED)
    
    @patch('g4f_wrapper.g4f')
    def test_test_provider_health_unavailable(self, mock_g4f):
        """Test provider health check when provider is unavailable"""
        mock_provider = Mock()
        mock_g4f.ChatCompletion.create.side_effect = Exception("Connection error")
        
        status = self.wrapper._test_provider_health(mock_provider)
        
        self.assertEqual(status, ProviderStatus.UNAVAILABLE)
    
    @patch('g4f_wrapper.g4f')
    def test_send_message_success(self, mock_g4f):
        """Test successful message sending"""
        mock_response = "Hello! How can I help you?"
        mock_g4f.ChatCompletion.create.return_value = mock_response
        
        with patch.object(self.wrapper, '_get_provider_by_name') as mock_get_provider:
            mock_get_provider.return_value = Mock()
            
            response = self.wrapper.send_message("Hello", "bing")
            
            self.assertIsInstance(response, ChatResponse)
            self.assertTrue(response.success)
            self.assertEqual(response.message, mock_response)
            self.assertEqual(response.provider, "bing")
            self.assertIsNotNone(response.timestamp)
    
    @patch('g4f_wrapper.g4f')
    def test_send_message_failure(self, mock_g4f):
        """Test message sending failure"""
        mock_g4f.ChatCompletion.create.side_effect = Exception("API Error")
        
        with patch.object(self.wrapper, '_get_provider_by_name') as mock_get_provider:
            mock_get_provider.return_value = Mock()
            
            response = self.wrapper.send_message("Hello", "bing")
            
            self.assertIsInstance(response, ChatResponse)
            self.assertFalse(response.success)
            self.assertIsNotNone(response.error)
            self.assertEqual(response.provider, "bing")
    
    @patch('g4f_wrapper.g4f')
    def test_send_message_empty_response(self, mock_g4f):
        """Test message sending with empty response"""
        mock_g4f.ChatCompletion.create.return_value = ""
        
        with patch.object(self.wrapper, '_get_provider_by_name') as mock_get_provider:
            mock_get_provider.return_value = Mock()
            
            response = self.wrapper.send_message("Hello", "bing")
            
            self.assertIsInstance(response, ChatResponse)
            self.assertFalse(response.success)
            self.assertIn("Empty response", response.error)
    
    def test_get_provider_by_name_valid(self):
        """Test getting provider by valid name"""
        with patch('g4f_wrapper.Provider') as mock_provider_class:
            mock_provider_class.Bing = Mock()
            
            provider = self.wrapper._get_provider_by_name("bing")
            
            self.assertEqual(provider, mock_provider_class.Bing)
    
    def test_get_provider_by_name_invalid(self):
        """Test getting provider by invalid name"""
        provider = self.wrapper._get_provider_by_name("invalid_provider")
        
        self.assertIsNone(provider)
    
    def test_get_provider_by_name_none(self):
        """Test getting provider with None name"""
        provider = self.wrapper._get_provider_by_name(None)
        
        self.assertIsNone(provider)
    
    @patch('g4f_wrapper.g4f')
    def test_test_provider_success(self, mock_g4f):
        """Test testing specific provider successfully"""
        with patch.object(self.wrapper, '_get_provider_by_name') as mock_get_provider:
            mock_get_provider.return_value = Mock()
            
            with patch.object(self.wrapper, '_test_provider_health') as mock_test_health:
                mock_test_health.return_value = ProviderStatus.AVAILABLE
                
                result = self.wrapper.test_provider("bing")
                
                self.assertIsInstance(result, dict)
                self.assertEqual(result['provider'], "bing")
                self.assertEqual(result['status'], ProviderStatus.AVAILABLE.value)
                self.assertIn('last_checked', result)
    
    def test_test_provider_not_found(self):
        """Test testing provider that doesn't exist"""
        with patch.object(self.wrapper, '_get_provider_by_name') as mock_get_provider:
            mock_get_provider.return_value = None
            
            result = self.wrapper.test_provider("invalid_provider")
            
            self.assertIsInstance(result, dict)
            self.assertEqual(result['provider'], "invalid_provider")
            self.assertEqual(result['status'], ProviderStatus.UNAVAILABLE.value)
            self.assertIn('error', result)
    
    def test_provider_cache(self):
        """Test provider caching functionality"""
        # Test that cache is used when available and not expired
        provider_info = ProviderInfo(
            id="test_provider",
            name="Test Provider",
            status=ProviderStatus.AVAILABLE,
            last_checked=datetime.now()
        )
        
        self.wrapper.provider_cache["test_provider"] = provider_info
        
        with patch.object(self.wrapper, '_test_provider_health') as mock_test:
            # This should not be called due to cache
            providers = self.wrapper.get_available_providers()
            mock_test.assert_not_called()


class TestProviderInfo(unittest.TestCase):
    """Test cases for ProviderInfo dataclass"""
    
    def test_provider_info_creation(self):
        """Test ProviderInfo creation"""
        info = ProviderInfo(
            id="test",
            name="Test Provider",
            status=ProviderStatus.AVAILABLE,
            last_checked=datetime.now()
        )
        
        self.assertEqual(info.id, "test")
        self.assertEqual(info.name, "Test Provider")
        self.assertEqual(info.status, ProviderStatus.AVAILABLE)
        self.assertIsInstance(info.last_checked, datetime)


class TestChatResponse(unittest.TestCase):
    """Test cases for ChatResponse dataclass"""
    
    def test_chat_response_success(self):
        """Test successful ChatResponse creation"""
        response = ChatResponse(
            success=True,
            message="Hello!",
            provider="bing",
            timestamp=datetime.now()
        )
        
        self.assertTrue(response.success)
        self.assertEqual(response.message, "Hello!")
        self.assertEqual(response.provider, "bing")
        self.assertIsNone(response.error)
    
    def test_chat_response_failure(self):
        """Test failed ChatResponse creation"""
        response = ChatResponse(
            success=False,
            error="API Error",
            provider="bing",
            timestamp=datetime.now()
        )
        
        self.assertFalse(response.success)
        self.assertEqual(response.error, "API Error")
        self.assertEqual(response.provider, "bing")
        self.assertIsNone(response.message)


if __name__ == '__main__':
    # Run the tests
    unittest.main(verbosity=2)