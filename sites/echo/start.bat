@echo off
REM Echo Stock Prediction System - Startup Script (Windows)

echo ==========================================
echo   Echo - AI-Powered Stock Prediction
echo ==========================================

REM Check if virtual environment exists
if not exist "venv" (
    echo Creating virtual environment...
    python -m venv venv
)

REM Activate virtual environment
echo Activating virtual environment...
call venv\Scripts\activate.bat

REM Install dependencies
echo Installing dependencies...
pip install -r requirements.txt --quiet

REM Check for .env file
if not exist ".env" (
    echo.
    echo WARNING: No .env file found!
    echo Please copy .env.example to .env and add your API keys.
    echo.
    echo   copy .env.example .env
    echo   REM Edit .env with your API keys
    echo.
)

REM Create logs directory
if not exist "logs" mkdir logs

REM Download NLTK data
echo Downloading NLTK data...
python -c "import nltk; nltk.download('punkt', quiet=True); nltk.download('stopwords', quiet=True); nltk.download('vader_lexicon', quiet=True)" 2>nul

echo.
echo Setup complete!
echo.
echo Available commands:
echo   python run.py run        - Start full system (web + scheduler)
echo   python run.py web        - Start web dashboard only
echo   python run.py predict AAPL  - Get prediction for a stock
echo   python run.py scan      - Scan default watchlist
echo   python run.py backtest AAPL - Run backtest
echo   python run.py portfolio  - View portfolio
echo   python run.py status    - Check system status
echo.
echo Starting Echo...
echo.

REM Run the system
python run.py run
