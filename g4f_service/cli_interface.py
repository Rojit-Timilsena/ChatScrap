#!/usr/bin/env python3
"""
G4F CLI Interface
Provides command-line interface for g4f functionality
"""

import json
import sys
import argparse
from dataclasses import asdict

from g4f_wrapper import G4FWrapper, DateTimeEncoder


class G4FCLIInterface:
    """CLI interface for G4F service"""
    
    def __init__(self):
        self.g4f_wrapper = G4FWrapper()
    
    def get_providers(self):
        """Get available providers and output as JSON"""
        try:
            providers = self.g4f_wrapper.get_available_providers()
            result = {
                'success': True,
                'providers': providers,
                'count': len(providers)
            }
            print(json.dumps(result, cls=DateTimeEncoder))
        except Exception as e:
            result = {
                'success': False,
                'error': str(e)
            }
            print(json.dumps(result))
            sys.exit(1)
    
    def test_provider(self, provider_name):
        """Test specific provider"""
        try:
            result = self.g4f_wrapper.test_provider(provider_name)
            output = {
                'success': True,
                'result': result
            }
            print(json.dumps(output, cls=DateTimeEncoder))
        except Exception as e:
            output = {
                'success': False,
                'error': str(e)
            }
            print(json.dumps(output))
            sys.exit(1)
    
    def send_message(self, message, provider=None, model='gpt-3.5-turbo'):
        """Send message to AI provider"""
        try:
            response = self.g4f_wrapper.send_message(message, provider, model)
            result = {
                'success': response.success,
                'response': asdict(response)
            }
            print(json.dumps(result, cls=DateTimeEncoder))
        except Exception as e:
            result = {
                'success': False,
                'error': str(e)
            }
            print(json.dumps(result))
            sys.exit(1)


def main():
    """Main CLI function"""
    parser = argparse.ArgumentParser(description='G4F CLI Interface')
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Providers command
    providers_parser = subparsers.add_parser('providers', help='Get available providers')
    
    # Test provider command
    test_parser = subparsers.add_parser('test', help='Test specific provider')
    test_parser.add_argument('provider', help='Provider name to test')
    
    # Chat command
    chat_parser = subparsers.add_parser('chat', help='Send message to AI')
    chat_parser.add_argument('message', help='Message to send')
    chat_parser.add_argument('--provider', help='Provider to use')
    chat_parser.add_argument('--model', default='gpt-3.5-turbo', help='Model to use')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        sys.exit(1)
    
    cli = G4FCLIInterface()
    
    if args.command == 'providers':
        cli.get_providers()
    elif args.command == 'test':
        cli.test_provider(args.provider)
    elif args.command == 'chat':
        cli.send_message(args.message, args.provider, args.model)
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == '__main__':
    main()