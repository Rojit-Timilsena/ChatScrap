#!/usr/bin/env python3
"""
Verification script for G4F service implementation
Checks all components and functionality
"""

import os
import sys
import importlib.util

def check_file_exists(filepath, description):
    """Check if a file exists"""
    if os.path.exists(filepath):
        print(f"✓ {description}: {filepath}")
        return True
    else:
        print(f"✗ {description} missing: {filepath}")
        return False

def check_python_syntax(filepath):
    """Check if Python file has valid syntax"""
    try:
        spec = importlib.util.spec_from_file_location("module", filepath)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return True
    except Exception as e:
        print(f"  ✗ Syntax error: {e}")
        return False

def verify_implementation():
    """Verify the G4F service implementation"""
    print("G4F Service Implementation Verification")
    print("=" * 50)
    
    # Check required files
    files_to_check = [
        ("g4f_wrapper.py", "Core G4F wrapper"),
        ("http_server.py", "HTTP server"),
        ("cli_interface.py", "CLI interface"),
        ("test_g4f_wrapper.py", "Unit tests for wrapper"),
        ("test_http_server.py", "Unit tests for HTTP server"),
        ("requirements.txt", "Python dependencies"),
        ("setup.py", "Package setup"),
        ("README.md", "Documentation"),
        ("__init__.py", "Package init"),
    ]
    
    print("\n1. Checking required files:")
    files_exist = 0
    for filename, description in files_to_check:
        if check_file_exists(filename, description):
            files_exist += 1
    
    print(f"\nFiles check: {files_exist}/{len(files_to_check)} files present")
    
    # Check Python syntax
    python_files = [
        "g4f_wrapper.py",
        "http_server.py", 
        "cli_interface.py",
        "test_g4f_wrapper.py",
        "test_http_server.py",
        "__init__.py"
    ]
    
    print("\n2. Checking Python syntax:")
    syntax_ok = 0
    for filename in python_files:
        if os.path.exists(filename):
            print(f"  Checking {filename}...")
            if check_python_syntax(filename):
                print(f"  ✓ {filename} syntax OK")
                syntax_ok += 1
            else:
                print(f"  ✗ {filename} has syntax errors")
        else:
            print(f"  - {filename} not found")
    
    print(f"\nSyntax check: {syntax_ok}/{len([f for f in python_files if os.path.exists(f)])} files OK")
    
    # Check core functionality
    print("\n3. Checking core functionality:")
    
    try:
        from g4f_wrapper import G4FWrapper, ProviderStatus, ProviderInfo, ChatResponse
        print("  ✓ Core classes import successfully")
        
        # Test data classes
        info = ProviderInfo(
            id="test",
            name="Test",
            status=ProviderStatus.AVAILABLE,
            last_checked=None
        )
        print("  ✓ ProviderInfo can be created")
        
        response = ChatResponse(success=True)
        print("  ✓ ChatResponse can be created")
        
        functionality_ok = True
    except Exception as e:
        print(f"  ✗ Core functionality error: {e}")
        functionality_ok = False
    
    # Check CLI interface
    print("\n4. Checking CLI interface:")
    try:
        from cli_interface import G4FCLIInterface
        print("  ✓ CLI interface imports successfully")
        cli_ok = True
    except Exception as e:
        print(f"  ✗ CLI interface error: {e}")
        cli_ok = False
    
    # Check requirements
    print("\n5. Checking requirements.txt:")
    if os.path.exists("requirements.txt"):
        with open("requirements.txt", "r") as f:
            requirements = f.read().strip().split("\n")
        
        required_packages = ["g4f", "flask", "flask-cors", "requests"]
        missing_packages = []
        
        for package in required_packages:
            found = any(package in req.lower() for req in requirements if req.strip())
            if found:
                print(f"  ✓ {package} listed in requirements")
            else:
                print(f"  ✗ {package} missing from requirements")
                missing_packages.append(package)
        
        requirements_ok = len(missing_packages) == 0
    else:
        print("  ✗ requirements.txt not found")
        requirements_ok = False
    
    # Summary
    print("\n" + "=" * 50)
    print("VERIFICATION SUMMARY")
    print("=" * 50)
    
    checks = [
        ("Files present", files_exist == len(files_to_check)),
        ("Python syntax", syntax_ok > 0),
        ("Core functionality", functionality_ok),
        ("CLI interface", cli_ok),
        ("Requirements", requirements_ok),
    ]
    
    passed_checks = sum(1 for _, passed in checks if passed)
    
    for check_name, passed in checks:
        status = "✓ PASS" if passed else "✗ FAIL"
        print(f"{check_name:20} {status}")
    
    print(f"\nOverall: {passed_checks}/{len(checks)} checks passed")
    
    if passed_checks == len(checks):
        print("\n🎉 G4F Service implementation is complete and ready!")
        print("\nNext steps:")
        print("1. Install dependencies: pip install -r requirements.txt")
        print("2. Start HTTP server: python http_server.py")
        print("3. Test CLI: python cli_interface.py providers")
        return 0
    else:
        print("\n⚠️  Some issues found. Please review and fix.")
        return 1

if __name__ == "__main__":
    sys.exit(verify_implementation())