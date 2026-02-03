# 🔮 Echo - AI-Powered Stock Prediction System

An autonomous stock prediction system that combines news sentiment analysis, technical indicators, and multiple LLM consensus to identify investment opportunities with a minimum 7% return target.

## ✨ Features

- **📰 Multi-Source News Scraping**: Aggregates news from RSS feeds, Google News, and financial sites
- **📊 Technical Analysis**: RSI, MACD, Bollinger Bands, moving averages, and more
- **🤖 Multi-LLM Consensus**: Uses multiple free LLM providers (Gemini, Groq, Together AI) to eliminate bias
- **🎯 Prediction Engine**: Combines technical, sentiment, and AI analysis for predictions
- **📈 7% Minimum Target**: Only recommends investments meeting the minimum return threshold
- **🔄 Self-Improvement**: Continuously learns from prediction outcomes
- **📉 Risk Management**: Automatic stop-loss monitoring and loss flagging
- **🌐 Web Dashboard**: Real-time monitoring and portfolio management
- **⏰ 24/7 Operation**: Background scheduler for continuous market monitoring

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Web Dashboard                            │
│                    (FastAPI + HTML/JS)                          │
├─────────────────────────────────────────────────────────────────┤
│                       Prediction Engine                          │
│     ┌──────────────┬──────────────┬──────────────┐             │
│     │  Technical   │  Sentiment   │    LLM       │             │
│     │  Analysis    │  Analysis    │  Consensus   │             │
│     └──────────────┴──────────────┴──────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│                        Data Layer                                │
│     ┌──────────────┬──────────────┬──────────────┐             │
│     │   News       │   Stock      │  Investment  │             │
│     │   Scrapers   │   Data       │   Tracker    │             │
│     └──────────────┴──────────────┴──────────────┘             │
├─────────────────────────────────────────────────────────────────┤
│  Background Scheduler │ Self-Improvement │ Backtesting Engine  │
└─────────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Python 3.9+
- API keys for at least one LLM provider (Gemini recommended - it's free!)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/echo.git
   cd echo
   ```

2. **Set up environment**
   ```bash
   # Linux/Mac
   chmod +x start.sh
   ./start.sh

   # Windows
   start.bat
   ```

3. **Configure API keys**
   ```bash
   cp .env.example .env
   # Edit .env with your API keys
   ```

4. **Run Echo**
   ```bash
   python run.py run
   ```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up -d

# View logs
docker-compose logs -f

# Stop
docker-compose down
```

## 📖 Usage

### CLI Commands

```bash
# Start full system (web dashboard + background scheduler)
python run.py run

# Start web dashboard only
python run.py web --port 8000

# Generate prediction for a stock
python run.py predict AAPL --detailed

# Scan watchlist for opportunities
python run.py scan --top 10

# Run backtesting
python run.py backtest AAPL --start-date 2024-01-01

# View portfolio
python run.py portfolio

# Check system status
python run.py status

# Run manual self-improvement cycle
python run.py improve
```

### Web Dashboard

Access the dashboard at `http://localhost:8000`:

- **Dashboard**: Overview of predictions and portfolio
- **Predictions**: View and generate new predictions
- **Portfolio**: Manage investments and track performance
- **Backtesting**: Test strategies on historical data
- **Settings**: Configure system parameters

### API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Web dashboard |
| `/api/health` | GET | System health check |
| `/api/predictions` | GET | Get all predictions |
| `/api/predictions/{symbol}` | POST | Generate new prediction |
| `/api/portfolio` | GET | Get portfolio summary |
| `/api/investments` | POST | Create new investment |
| `/api/backtest/{symbol}` | POST | Run backtest |

## ⚙️ Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GEMINI_API_KEY` | Google Gemini API key | Yes (or other LLM) |
| `GROQ_API_KEY` | Groq API key | No |
| `TOGETHER_API_KEY` | Together AI API key | No |
| `DATABASE_URL` | Database connection string | No (defaults to SQLite) |
| `MIN_RETURN_THRESHOLD` | Minimum return target | No (default: 0.07) |
| `SCRAPE_INTERVAL_MINUTES` | News scraping interval | No (default: 30) |

### Getting Free API Keys

1. **Gemini (Google)**
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - Free tier: 60 requests/minute

2. **Groq**
   - Sign up at [Groq Console](https://console.groq.com)
   - Generate API key
   - Free tier available

3. **Together AI**
   - Sign up at [Together AI](https://api.together.xyz)
   - Get API key from dashboard
   - Free credits for new users

## 🧠 How It Works

### 1. Data Collection
- Scrapes news from multiple sources every 30 minutes
- Fetches real-time stock data via Yahoo Finance
- Stores historical data for analysis

### 2. Analysis Pipeline
```
News Data → Sentiment Analysis → Sentiment Score (-1 to +1)
                    ↓
Stock Data → Technical Analysis → Technical Signals
                    ↓
Combined Data → LLM Analysis → Multiple Provider Consensus
                    ↓
All Signals → Prediction Engine → Action + Confidence + Return
```

### 3. Prediction Criteria
- **BUY**: High confidence (>60%), positive return (>7%), bullish signals
- **HOLD**: Medium confidence, uncertain market conditions
- **SELL**: Bearish signals, negative outlook

### 4. Self-Improvement
- Tracks prediction accuracy daily
- Identifies underperforming strategies
- Adjusts weightings automatically
- Generates actionable insights

## 📊 Example Output

```
===============================================
PREDICTION FOR NVDA
===============================================
Action: BUY
Confidence: 78.3%
Predicted Return: +12.5%
Time Horizon: 2-4 weeks
Meets 7% Threshold: ✅ YES

Reasoning:
  • Strong technical momentum (RSI: 58, MACD bullish crossover)
  • Positive news sentiment (+0.72) from AI chip demand
  • LLM consensus: 3/3 providers recommend BUY
  • Historical pattern suggests continuation
===============================================
```

## ⚠️ Disclaimer

**This software is for educational and research purposes only.**

- Not financial advice
- Past performance doesn't guarantee future results
- Always do your own research before investing
- Never invest more than you can afford to lose
- The developers are not responsible for any financial losses

## 🛠️ Development

### Project Structure

```
echo/
├── src/
│   ├── analysis/          # Sentiment & technical analysis
│   ├── backtesting/       # Historical testing framework
│   ├── improvement/       # Self-improvement engine
│   ├── llm/               # LLM provider integrations
│   ├── models/            # Database models
│   ├── prediction/        # Prediction engine
│   ├── scrapers/          # News & stock data scrapers
│   ├── tracking/          # Investment tracking
│   ├── web/               # FastAPI web application
│   ├── config.py          # Configuration
│   ├── database.py        # Database setup
│   ├── main.py            # CLI entry point
│   └── scheduler.py       # Background task scheduler
├── tests/                 # Test suite
├── logs/                  # Application logs
├── data/                  # Local data storage
├── requirements.txt       # Python dependencies
├── Dockerfile            # Docker configuration
├── docker-compose.yml    # Docker Compose setup
└── run.py                # Main entry script
```

### Running Tests

```bash
pytest tests/ -v --cov=src
```

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open a Pull Request

## 📝 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [yfinance](https://github.com/ranaroussi/yfinance) for stock data
- [Google Gemini](https://deepmind.google/technologies/gemini/) for AI capabilities
- [FastAPI](https://fastapi.tiangolo.com/) for the web framework
- All the open-source libraries that made this possible

---

Built with ❤️ for the trading community