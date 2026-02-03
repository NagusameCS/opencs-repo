#!/bin/bash
# Echo Stock Prediction System - Startup Script

set -e

echo "=========================================="
echo "  Echo - AI-Powered Stock Prediction"
echo "=========================================="

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt --quiet

# Check for .env file
if [ ! -f ".env" ]; then
    echo ""
    echo "WARNING: No .env file found!"
    echo "Please copy .env.example to .env and add your API keys."
    echo ""
    echo "  cp .env.example .env"
    echo "  # Edit .env with your API keys"
    echo ""
fi

# Create logs directory
mkdir -p logs

# Download NLTK data
echo "Downloading NLTK data..."
python3 -c "import nltk; nltk.download('punkt', quiet=True); nltk.download('stopwords', quiet=True); nltk.download('vader_lexicon', quiet=True)" 2>/dev/null || true

echo ""
echo "Setup complete!"
echo ""
echo "Available commands:"
echo "  python run.py run        - Start full system (web + scheduler)"
echo "  python run.py web        - Start web dashboard only"
echo "  python run.py predict AAPL  - Get prediction for a stock"
echo "  python run.py scan      - Scan default watchlist"
echo "  python run.py backtest AAPL - Run backtest"
echo "  python run.py portfolio  - View portfolio"
echo "  python run.py status    - Check system status"
echo ""
echo "Starting Echo..."
echo ""

# Run the system
python run.py run
