#!/usr/bin/env python3
"""
Integration example showing how the G4F service would work
This demonstrates the expected behavior when g4f is properly installed
"""

import json
from datetime import datetime
from dataclasses import asdict

# Mock g4f for demonstration
class MockG4F:
    class Provider:
        class Bing:
            __name__ = "Provider.Bing"
        
        class ChatgptAi:
            __name__ = "Provider.ChatgptAi"
        
        class FreeGpt:
            __name__ = "Provider.FreeGpt"
        
        class Liaobots:
            __name__ = "Provider.Liaobots"
        
        class You:
            __name__ = "Provider.You"
        
        class Yqcloud:
            __name__ = "Provider.Yqcloud"
    
    class ChatCompletion:
        @staticmethod
        def create(model, messages, provider=None, timeout=30):
            # Simulate different responses based on provider
            if hasattr(provider, '__name__') and 'Bing' in provider.__name__:
                return "Hello! I'm Bing AI. How can I help you today?"
            elif hasattr(provider, '__name__') and 'ChatgptAi' in provider.__name__:
                return "Hi there! I'm ChatGPT AI. What would you like to know?"
            else:
                return "Hello! I'm an AI assistant. How can I assist you?"

# Patch the g4f import for demonstration
import sys
sys.modules['g4f'] = MockG4F()

# Now import our wrapper
from g4f_wrapper import G4FWrapper, DateTimeEncoder

def demonstrate_g4f_service():
    """Demonstrate G4F service functionality"""
    print("G4F Service Integration Example")
    print("=" * 40)
    
    # Initialize wrapper
    wrapper = G4FWrapper()
    
    # 1. Get available providers
    print("\n1. Getting available providers:")
    providers = wrapper.get_available_providers()
    print(json.dumps(providers, indent=2, cls=DateTimeEncoder))
    
    # 2. Test a specific provider
    print("\n2. Testing Bing provider:")
    test_result = wrapper.test_provider("bing")
    print(json.dumps(test_result, indent=2, cls=DateTimeEncoder))
    
    # 3. Send a message
    print("\n3. Sending message to Bing:")
    response = wrapper.send_message("Hello, how are you?", "bing")
    print(json.dumps(asdict(response), indent=2, cls=DateTimeEncoder))
    
    # 4. Send message to different provider
    print("\n4. Sending message to ChatGPT AI:")
    response2 = wrapper.send_message("What's the weather like?", "chatgptai")
    print(json.dumps(asdict(response2), indent=2, cls=DateTimeEncoder))
    
    print("\n" + "=" * 40)
    print("Integration example completed successfully!")

if __name__ == "__main__":
    demonstrate_g4f_service()