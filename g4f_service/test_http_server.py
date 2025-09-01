#!/usr/bin/env python3
"""
Unit tests for G4F HTTP Server
"""

import unittest
from unittest.mock import Mock, patch, MagicMock
import json
from datetime import datetime

from http_server import G4FHTTPServer
from g4f_wrapper import ChatResponse, ProviderStatus


class TestG4FHTTPServer(unittest.TestCase):
    """Test cases for G4FHTTPServer class"""
    
    def setUp(self):
        """Set up test fixtures"""
        with patch('http_server.G4FWrapper') as mock_wrapper_class:
            self.mock_wrapper = Mock()
            mock_wrapper_class.return_value = self.mock_wrapper
            
            self.server = G4FHTTPServer()
            self.client = self.server.app.test_client()
            self.server.app.config['TESTING'] = True
    
    def test_health_check(self):
        """Test health check endpoint"""
        response = self.client.get('/health')
        
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertEqual(data['status'], 'healthy')
        self.assertEqual(data['service'], 'g4f-wrapper')
        self.assertIn('timestamp', data)
    
    def test_get_providers_success(self):
        """Test successful providers endpoint"""
        mock_providers = [
            {
                'id': 'bing',
                'name': 'Bing',
                'status': 'available',
                'last_checked': datetime.now().isoformat()
            }
        ]
        
        self.mock_wrapper.get_available_providers.return_value = mock_providers
        
        response = self.client.get('/providers')
        
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['providers'], mock_providers)
        self.assertEqual(data['count'], 1)
    
    def test_get_providers_error(self):
        """Test providers endpoint with error"""
        self.mock_wrapper.get_available_providers.side_effect = Exception("Test error")
        
        response = self.client.get('/providers')
        
        self.assertEqual(response.status_code, 500)
        
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertIn('error', data)
    
    def test_test_provider_success(self):
        """Test successful provider test endpoint"""
        mock_result = {
            'provider': 'bing',
            'status': 'available',
            'last_checked': datetime.now().isoformat()
        }
        
        self.mock_wrapper.test_provider.return_value = mock_result
        
        response = self.client.post('/providers/bing/test')
        
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertEqual(data['result'], mock_result)
    
    def test_test_provider_error(self):
        """Test provider test endpoint with error"""
        self.mock_wrapper.test_provider.side_effect = Exception("Test error")
        
        response = self.client.post('/providers/bing/test')
        
        self.assertEqual(response.status_code, 500)
        
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertIn('error', data)
    
    def test_send_message_success(self):
        """Test successful chat endpoint"""
        mock_response = ChatResponse(
            success=True,
            message="Hello! How can I help you?",
            provider="bing",
            timestamp=datetime.now()
        )
        
        self.mock_wrapper.send_message.return_value = mock_response
        
        payload = {
            'message': 'Hello',
            'provider': 'bing',
            'model': 'gpt-3.5-turbo'
        }
        
        response = self.client.post('/chat', 
                                  data=json.dumps(payload),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertTrue(data['success'])
        self.assertIn('response', data)
        self.assertTrue(data['response']['success'])
    
    def test_send_message_missing_message(self):
        """Test chat endpoint with missing message"""
        payload = {
            'provider': 'bing'
        }
        
        response = self.client.post('/chat',
                                  data=json.dumps(payload),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 400)
        
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertIn('Message is required', data['error'])
    
    def test_send_message_no_json(self):
        """Test chat endpoint with no JSON data"""
        response = self.client.post('/chat')
        
        self.assertEqual(response.status_code, 400)
        
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertIn('Message is required', data['error'])
    
    def test_send_message_error(self):
        """Test chat endpoint with wrapper error"""
        self.mock_wrapper.send_message.side_effect = Exception("Test error")
        
        payload = {
            'message': 'Hello',
            'provider': 'bing'
        }
        
        response = self.client.post('/chat',
                                  data=json.dumps(payload),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 500)
        
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertIn('error', data)
    
    def test_send_message_failed_response(self):
        """Test chat endpoint with failed response from wrapper"""
        mock_response = ChatResponse(
            success=False,
            error="Provider unavailable",
            provider="bing",
            timestamp=datetime.now()
        )
        
        self.mock_wrapper.send_message.return_value = mock_response
        
        payload = {
            'message': 'Hello',
            'provider': 'bing'
        }
        
        response = self.client.post('/chat',
                                  data=json.dumps(payload),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertIn('response', data)
        self.assertFalse(data['response']['success'])
    
    def test_not_found_endpoint(self):
        """Test 404 error handling"""
        response = self.client.get('/nonexistent')
        
        self.assertEqual(response.status_code, 404)
        
        data = json.loads(response.data)
        self.assertFalse(data['success'])
        self.assertIn('not found', data['error'].lower())
    
    def test_send_message_default_model(self):
        """Test chat endpoint with default model"""
        mock_response = ChatResponse(
            success=True,
            message="Hello!",
            provider="bing",
            timestamp=datetime.now()
        )
        
        self.mock_wrapper.send_message.return_value = mock_response
        
        payload = {
            'message': 'Hello',
            'provider': 'bing'
            # No model specified, should use default
        }
        
        response = self.client.post('/chat',
                                  data=json.dumps(payload),
                                  content_type='application/json')
        
        self.assertEqual(response.status_code, 200)
        
        # Verify that send_message was called with default model
        self.mock_wrapper.send_message.assert_called_once_with(
            'Hello', 'bing', 'gpt-3.5-turbo'
        )


class TestG4FHTTPServerIntegration(unittest.TestCase):
    """Integration tests for G4FHTTPServer"""
    
    def setUp(self):
        """Set up test fixtures for integration tests"""
        # These tests would require actual g4f integration
        # For now, we'll mock the entire wrapper
        pass
    
    @unittest.skip("Requires actual g4f integration")
    def test_full_integration(self):
        """Test full integration with real g4f wrapper"""
        # This would test the actual integration with g4f
        # Skip for now as it requires g4f to be properly installed
        pass


if __name__ == '__main__':
    # Run the tests
    unittest.main(verbosity=2)