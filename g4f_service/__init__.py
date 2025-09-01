"""
G4F Service Package
Provides HTTP and CLI interfaces for g4f library
"""

from .g4f_wrapper import G4FWrapper, ProviderStatus, ProviderInfo, ChatResponse
from .http_server import G4FHTTPServer
from .cli_interface import G4FCLIInterface

__version__ = "1.0.0"
__author__ = "G4F Chat Simulation"

__all__ = [
    "G4FWrapper",
    "G4FHTTPServer", 
    "G4FCLIInterface",
    "ProviderStatus",
    "ProviderInfo",
    "ChatResponse"
]