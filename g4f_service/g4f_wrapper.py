#!/usr/bin/env python3
"""
G4F Service Wrapper
Provides HTTP API interface for g4f library functionality
"""

import json
import logging
import time
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict
from enum import Enum

try:
    import g4f
    from g4f import Provider
except ImportError:
    print("Warning: g4f library not installed. Install with: pip install g4f")
    g4f = None
    Provider = None


class ProviderStatus(Enum):
    AVAILABLE = "available"
    UNAVAILABLE = "unavailable"
    RATE_LIMITED = "rate_limited"
    UNKNOWN = "unknown"


@dataclass
class ProviderInfo:
    id: str
    name: str
    status: ProviderStatus
    last_checked: datetime
    model: Optional[str] = None
    error_message: Optional[str] = None


@dataclass
class ChatMessage:
    role: str
    content: str


@dataclass
class ChatResponse:
    success: bool
    message: Optional[str] = None
    error: Optional[str] = None
    provider: Optional[str] = None
    timestamp: Optional[datetime] = None


class G4FWrapper:
    """Wrapper class for g4f library functionality"""
    
    def __init__(self):
        self.logger = logging.getLogger(__name__)
        self.provider_cache: Dict[str, ProviderInfo] = {}
        self.cache_ttl = 300  # 5 minutes
        
        # Initialize logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        
        if g4f is None:
            self.logger.error("g4f library not available")
            raise ImportError("g4f library is required but not installed")
    
    def get_available_providers(self) -> List[Dict[str, Any]]:
        """Get list of available g4f providers with their status"""
        try:
            providers = []
            
            # Get all providers from g4f
            if hasattr(g4f, 'Provider') and Provider is not None:
                provider_list = [
                    Provider.Bing,
                    Provider.ChatgptAi,
                    Provider.FreeGpt,
                    Provider.Liaobots,
                    Provider.You,
                    Provider.Yqcloud,
                ]
                
                for provider in provider_list:
                    provider_name = provider.__name__ if hasattr(provider, '__name__') else str(provider)
                    provider_id = provider_name.lower().replace('provider.', '')
                    
                    # Check cache first
                    if provider_id in self.provider_cache:
                        cached_info = self.provider_cache[provider_id]
                        if (datetime.now() - cached_info.last_checked).seconds < self.cache_ttl:
                            providers.append(asdict(cached_info))
                            continue
                    
                    # Test provider availability
                    status = self._test_provider_health(provider)
                    
                    provider_info = ProviderInfo(
                        id=provider_id,
                        name=provider_name,
                        status=status,
                        last_checked=datetime.now(),
                        model=getattr(provider, 'model', None)
                    )
                    
                    self.provider_cache[provider_id] = provider_info
                    providers.append(asdict(provider_info))
            
            self.logger.info(f"Found {len(providers)} providers")
            return providers
            
        except Exception as e:
            self.logger.error(f"Error getting providers: {str(e)}")
            return []
    
    def _test_provider_health(self, provider) -> ProviderStatus:
        """Test if a provider is currently available"""
        try:
            # Simple test message to check provider health
            test_response = g4f.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[{"role": "user", "content": "test"}],
                provider=provider,
                timeout=10
            )
            
            if test_response and len(test_response.strip()) > 0:
                return ProviderStatus.AVAILABLE
            else:
                return ProviderStatus.UNAVAILABLE
                
        except Exception as e:
            error_msg = str(e).lower()
            if "rate limit" in error_msg or "too many requests" in error_msg:
                return ProviderStatus.RATE_LIMITED
            else:
                self.logger.warning(f"Provider {provider} test failed: {str(e)}")
                return ProviderStatus.UNAVAILABLE
    
    def send_message(self, message: str, provider_name: str = None, model: str = "gpt-3.5-turbo") -> ChatResponse:
        """Send message to specified provider and get response"""
        try:
            self.logger.info(f"Sending message to provider: {provider_name}")
            
            # Get provider object
            provider = self._get_provider_by_name(provider_name) if provider_name else None
            
            # Prepare messages
            messages = [{"role": "user", "content": message}]
            
            # Make request to g4f
            response = g4f.ChatCompletion.create(
                model=model,
                messages=messages,
                provider=provider,
                timeout=30
            )
            
            if response:
                return ChatResponse(
                    success=True,
                    message=response,
                    provider=provider_name,
                    timestamp=datetime.now()
                )
            else:
                return ChatResponse(
                    success=False,
                    error="Empty response from provider",
                    provider=provider_name,
                    timestamp=datetime.now()
                )
                
        except Exception as e:
            error_msg = str(e)
            self.logger.error(f"Error sending message: {error_msg}")
            
            return ChatResponse(
                success=False,
                error=error_msg,
                provider=provider_name,
                timestamp=datetime.now()
            )
    
    def _get_provider_by_name(self, provider_name: str):
        """Get provider object by name"""
        if not provider_name or Provider is None:
            return None
            
        provider_map = {
            'bing': Provider.Bing,
            'chatgptai': Provider.ChatgptAi,
            'freegpt': Provider.FreeGpt,
            'liaobots': Provider.Liaobots,
            'you': Provider.You,
            'yqcloud': Provider.Yqcloud,
        }
        
        return provider_map.get(provider_name.lower())
    
    def test_provider(self, provider_name: str) -> Dict[str, Any]:
        """Test specific provider availability"""
        try:
            provider = self._get_provider_by_name(provider_name)
            if not provider:
                return {
                    "provider": provider_name,
                    "status": ProviderStatus.UNAVAILABLE.value,
                    "error": "Provider not found"
                }
            
            status = self._test_provider_health(provider)
            
            return {
                "provider": provider_name,
                "status": status.value,
                "last_checked": datetime.now().isoformat()
            }
            
        except Exception as e:
            self.logger.error(f"Error testing provider {provider_name}: {str(e)}")
            return {
                "provider": provider_name,
                "status": ProviderStatus.UNAVAILABLE.value,
                "error": str(e)
            }


# Custom JSON encoder for datetime objects
class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, datetime):
            return obj.isoformat()
        elif isinstance(obj, ProviderStatus):
            return obj.value
        return super().default(obj)


def main():
    """Main function for testing the wrapper"""
    wrapper = G4FWrapper()
    
    print("Testing G4F Wrapper...")
    
    # Test getting providers
    print("\n1. Getting available providers:")
    providers = wrapper.get_available_providers()
    print(json.dumps(providers, indent=2, cls=DateTimeEncoder))
    
    # Test sending a message
    print("\n2. Testing message sending:")
    response = wrapper.send_message("Hello, how are you?", "bing")
    print(json.dumps(asdict(response), indent=2, cls=DateTimeEncoder))


if __name__ == "__main__":
    main()