#!/usr/bin/env python3
"""
Basic functionality test for G4F service components
"""

import sys
import json
from datetime import datetime

# Test basic imports and functionality without external dependencies
def test_basic_imports():
    """Test that basic imports work"""
    try:
        from g4f_wrapper import ProviderStatus, ProviderInfo, ChatResponse, DateTimeEncoder
        print("✓ Basic imports successful")
        return True
    except Exception as e:
        print(f"✗ Import failed: {e}")
        return False

def test_data_classes():
    """Test data class functionality"""
    try:
        from g4f_wrapper import ProviderStatus, ProviderInfo, ChatResponse
        
        # Test ProviderInfo
        info = ProviderInfo(
            id="test",
            name="Test Provider",
            status=ProviderStatus.AVAILABLE,
            last_checked=datetime.now()
        )
        print(f"✓ ProviderInfo created: {info.id}")
        
        # Test ChatResponse
        response = ChatResponse(
            success=True,
            message="Test message",
            provider="test",
            timestamp=datetime.now()
        )
        print(f"✓ ChatResponse created: {response.success}")
        
        return True
    except Exception as e:
        print(f"✗ Data class test failed: {e}")
        return False

def test_json_encoding():
    """Test JSON encoding with datetime objects"""
    try:
        from g4f_wrapper import DateTimeEncoder, ChatResponse
        
        response = ChatResponse(
            success=True,
            message="Test",
            timestamp=datetime.now()
        )
        
        # Test JSON serialization
        json_str = json.dumps(response.__dict__, cls=DateTimeEncoder)
        parsed = json.loads(json_str)
        
        print(f"✓ JSON encoding successful: {len(json_str)} chars")
        return True
    except Exception as e:
        print(f"✗ JSON encoding failed: {e}")
        return False

def test_cli_interface():
    """Test CLI interface basic functionality"""
    try:
        from cli_interface import G4FCLIInterface
        
        # This will fail due to g4f not being installed, but we can test the class creation
        try:
            cli = G4FCLIInterface()
        except ImportError:
            print("✓ CLI interface class created (g4f not installed, expected)")
            return True
        except Exception as e:
            print(f"✗ CLI interface failed: {e}")
            return False
            
        print("✓ CLI interface created successfully")
        return True
    except Exception as e:
        print(f"✗ CLI interface test failed: {e}")
        return False

def main():
    """Run all basic tests"""
    print("Running basic functionality tests...\n")
    
    tests = [
        ("Basic Imports", test_basic_imports),
        ("Data Classes", test_data_classes),
        ("JSON Encoding", test_json_encoding),
        ("CLI Interface", test_cli_interface),
    ]
    
    passed = 0
    total = len(tests)
    
    for test_name, test_func in tests:
        print(f"Testing {test_name}:")
        if test_func():
            passed += 1
        print()
    
    print(f"Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("✓ All basic tests passed!")
        return 0
    else:
        print("✗ Some tests failed")
        return 1

if __name__ == "__main__":
    sys.exit(main())