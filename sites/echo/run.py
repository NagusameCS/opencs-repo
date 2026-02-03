#!/usr/bin/env python3
"""
Echo - AI-Powered Stock Prediction System
Main entry point script.
"""

import sys
import os

# Ensure the project root is in the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.main import cli

if __name__ == "__main__":
    cli()
