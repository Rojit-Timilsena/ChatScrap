#!/usr/bin/env python3
"""
G4F HTTP Server
Provides REST API interface for g4f functionality
"""

import json
import logging
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from dataclasses import asdict

from g4f_wrapper import G4FWrapper, DateTimeEncoder


class G4FHTTPServer:
    """HTTP server for G4F service"""
    
    def __init__(self, host='localhost', port=5001):
        self.app = Flask(__name__)
        CORS(self.app)  # Enable CORS for cross-origin requests
        
        self.host = host
        self.port = port
        self.g4f_wrapper = G4FWrapper()
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(__name__)
        
        # Setup routes
        self._setup_routes()
    
    def _setup_routes(self):
        """Setup Flask routes"""
        
        @self.app.route('/health', methods=['GET'])
        def health_check():
            """Health check endpoint"""
            return jsonify({
                'status': 'healthy',
                'timestamp': datetime.now().isoformat(),
                'service': 'g4f-wrapper'
            })
        
        @self.app.route('/providers', methods=['GET'])
        def get_providers():
            """Get available providers"""
            try:
                providers = self.g4f_wrapper.get_available_providers()
                return jsonify({
                    'success': True,
                    'providers': providers,
                    'count': len(providers)
                })
            except Exception as e:
                self.logger.error(f"Error getting providers: {str(e)}")
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500
        
        @self.app.route('/providers/<provider_name>/test', methods=['POST'])
        def test_provider(provider_name):
            """Test specific provider"""
            try:
                result = self.g4f_wrapper.test_provider(provider_name)
                return jsonify({
                    'success': True,
                    'result': result
                })
            except Exception as e:
                self.logger.error(f"Error testing provider {provider_name}: {str(e)}")
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500
        
        @self.app.route('/chat', methods=['POST'])
        def send_message():
            """Send message to AI provider"""
            try:
                data = request.get_json()
                
                if not data or 'message' not in data:
                    return jsonify({
                        'success': False,
                        'error': 'Message is required'
                    }), 400
                
                message = data['message']
                provider = data.get('provider')
                model = data.get('model', 'gpt-3.5-turbo')
                
                self.logger.info(f"Received chat request: provider={provider}, model={model}")
                
                response = self.g4f_wrapper.send_message(message, provider, model)
                
                return jsonify({
                    'success': response.success,
                    'response': asdict(response)
                })
                
            except Exception as e:
                self.logger.error(f"Error in chat endpoint: {str(e)}")
                return jsonify({
                    'success': False,
                    'error': str(e)
                }), 500
        
        @self.app.errorhandler(404)
        def not_found(error):
            return jsonify({
                'success': False,
                'error': 'Endpoint not found'
            }), 404
        
        @self.app.errorhandler(500)
        def internal_error(error):
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500
    
    def run(self, debug=False):
        """Start the HTTP server"""
        self.logger.info(f"Starting G4F HTTP server on {self.host}:{self.port}")
        self.app.run(host=self.host, port=self.port, debug=debug)


def main():
    """Main function to start the server"""
    import argparse
    
    parser = argparse.ArgumentParser(description='G4F HTTP Server')
    parser.add_argument('--host', default='localhost', help='Host to bind to')
    parser.add_argument('--port', type=int, default=5001, help='Port to bind to')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    
    args = parser.parse_args()
    
    server = G4FHTTPServer(host=args.host, port=args.port)
    server.run(debug=args.debug)


if __name__ == '__main__':
    main()