"""
FastAPI Web Application.
Dashboard and API for the Echo prediction system.
"""

from datetime import datetime, timedelta
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Depends, BackgroundTasks, Query
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse
from fastapi.requests import Request
from pydantic import BaseModel
from loguru import logger

from src.config import settings
from src.database import init_db, get_db_session
from src.prediction import PredictionEngine
from src.backtesting import Backtester
from src.tracking import InvestmentTracker
from src.scrapers import StockDataFetcher
from src.llm import LLMOrchestrator


# ============================================================================
# Pydantic Models for API
# ============================================================================

class PredictionRequest(BaseModel):
    symbol: str
    time_horizon_days: int = 30


class BatchPredictionRequest(BaseModel):
    symbols: List[str]
    time_horizon_days: int = 30


class InvestmentRequest(BaseModel):
    prediction_id: int
    symbol: str
    amount: float
    entry_price: Optional[float] = None


class BacktestRequest(BaseModel):
    symbols: List[str]
    days: int = 365
    initial_capital: float = 100000
    strategy: str = "technical"


class PredictionResponse(BaseModel):
    id: str
    symbol: str
    company_name: str
    action: str
    confidence: float
    current_price: float
    target_price: float
    expected_return_percent: float
    time_horizon_days: int
    reasoning: str
    key_factors: List[str]
    risks: List[str]


class HealthResponse(BaseModel):
    status: str
    timestamp: str
    version: str
    llm_providers: List[str]


# ============================================================================
# Application Setup
# ============================================================================

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown."""
    # Startup
    logger.info("Starting Echo AI Stock Prediction System...")
    await init_db()
    logger.info("Database initialized")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Echo...")


app = FastAPI(
    title="Echo AI Stock Prediction System",
    description="""
    An AI-powered stock prediction system that combines:
    - Multi-source news scraping and sentiment analysis
    - Technical analysis with multiple indicators
    - Multi-LLM consensus building (Gemini, Groq, Together AI)
    - Backtesting and continuous self-improvement
    
    Target: +7% minimum return on investments.
    """,
    version="1.0.0",
    lifespan=lifespan
)

# Templates for web dashboard
templates = Jinja2Templates(directory="src/web/templates")


# ============================================================================
# Dependency Injection
# ============================================================================

def get_prediction_engine():
    return PredictionEngine()


def get_backtester():
    return Backtester()


def get_investment_tracker():
    return InvestmentTracker()


def get_stock_fetcher():
    return StockDataFetcher()


def get_llm_orchestrator():
    return LLMOrchestrator()


# ============================================================================
# Health & Status Endpoints
# ============================================================================

@app.get("/health", response_model=HealthResponse, tags=["System"])
async def health_check():
    """Check system health and status."""
    orchestrator = get_llm_orchestrator()
    
    return HealthResponse(
        status="healthy",
        timestamp=datetime.utcnow().isoformat(),
        version="1.0.0",
        llm_providers=orchestrator.available_providers
    )


@app.get("/status", tags=["System"])
async def system_status():
    """Get detailed system status."""
    orchestrator = get_llm_orchestrator()
    
    return {
        "status": "operational",
        "timestamp": datetime.utcnow().isoformat(),
        "components": {
            "database": "connected",
            "llm_providers": orchestrator.available_providers,
            "news_scraping": "active",
            "prediction_engine": "ready"
        },
        "settings": {
            "min_confidence_threshold": settings.min_confidence_threshold,
            "target_return_percent": settings.target_return_percent,
            "scrape_interval_minutes": settings.scrape_interval_minutes
        }
    }


# ============================================================================
# Prediction Endpoints
# ============================================================================

@app.post("/api/predict", response_model=PredictionResponse, tags=["Predictions"])
async def generate_prediction(
    request: PredictionRequest,
    engine: PredictionEngine = Depends(get_prediction_engine)
):
    """
    Generate a prediction for a single stock.
    
    - **symbol**: Stock symbol (e.g., AAPL, MSFT)
    - **time_horizon_days**: Investment time horizon (default: 30 days)
    """
    try:
        prediction = await engine.generate_prediction(
            symbol=request.symbol.upper(),
            time_horizon_days=request.time_horizon_days
        )
        
        return PredictionResponse(
            id=prediction.id,
            symbol=prediction.symbol,
            company_name=prediction.company_name,
            action=prediction.action,
            confidence=prediction.confidence,
            current_price=prediction.current_price,
            target_price=prediction.target_price,
            expected_return_percent=prediction.expected_return_percent,
            time_horizon_days=prediction.time_horizon_days,
            reasoning=prediction.reasoning,
            key_factors=prediction.key_factors,
            risks=prediction.risks
        )
    except Exception as e:
        logger.error(f"Error generating prediction: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/predict/batch", tags=["Predictions"])
async def batch_predictions(
    request: BatchPredictionRequest,
    engine: PredictionEngine = Depends(get_prediction_engine)
):
    """Generate predictions for multiple stocks."""
    try:
        predictions = await engine.batch_predictions(
            symbols=[s.upper() for s in request.symbols],
            time_horizon_days=request.time_horizon_days
        )
        
        return {
            "predictions": [p.to_dict() for p in predictions],
            "count": len(predictions),
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error generating batch predictions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/opportunities", tags=["Predictions"])
async def get_opportunities(
    min_confidence: float = Query(0.75, ge=0, le=1),
    min_return: float = Query(7.0, ge=0),
    limit: int = Query(10, ge=1, le=50),
    engine: PredictionEngine = Depends(get_prediction_engine)
):
    """
    Find top investment opportunities.
    
    Returns stocks that meet minimum confidence and return thresholds.
    """
    try:
        opportunities = await engine.get_top_opportunities(
            min_confidence=min_confidence,
            min_return=min_return,
            limit=limit
        )
        
        return {
            "opportunities": [o.to_dict() for o in opportunities],
            "count": len(opportunities),
            "filters": {
                "min_confidence": min_confidence,
                "min_return": min_return
            },
            "generated_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error finding opportunities: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Stock Data Endpoints
# ============================================================================

@app.get("/api/stock/{symbol}", tags=["Market Data"])
async def get_stock_info(
    symbol: str,
    fetcher: StockDataFetcher = Depends(get_stock_fetcher)
):
    """Get stock information and current quote."""
    try:
        quote = await fetcher.get_realtime_quote(symbol.upper())
        company = await fetcher.get_company_info(symbol.upper())
        
        return {
            "symbol": symbol.upper(),
            "quote": quote,
            "company": company,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error fetching stock info: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/market", tags=["Market Data"])
async def get_market_overview(
    fetcher: StockDataFetcher = Depends(get_stock_fetcher)
):
    """Get market overview with indices and sector performance."""
    try:
        indices = await fetcher.get_market_indices()
        sectors = await fetcher.get_sector_performance()
        
        return {
            "indices": indices,
            "sectors": sectors,
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error fetching market data: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Backtesting Endpoints
# ============================================================================

@app.post("/api/backtest", tags=["Backtesting"])
async def run_backtest(
    request: BacktestRequest,
    backtester: Backtester = Depends(get_backtester)
):
    """
    Run a backtest on historical data.
    
    Tests the prediction strategy against past data to validate performance.
    """
    try:
        result = await backtester.run_backtest(
            symbols=[s.upper() for s in request.symbols],
            start_date=datetime.now() - timedelta(days=request.days),
            end_date=datetime.now(),
            initial_capital=request.initial_capital,
            strategy=request.strategy
        )
        
        return {
            "result": result.to_dict(),
            "summary": result.summary(),
            "performance_by_symbol": result.performance_by_symbol
        }
    except Exception as e:
        logger.error(f"Error running backtest: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Investment Tracking Endpoints
# ============================================================================

@app.post("/api/investments", tags=["Investments"])
async def create_investment(
    request: InvestmentRequest,
    tracker: InvestmentTracker = Depends(get_investment_tracker)
):
    """Create a new investment based on a prediction."""
    try:
        position = await tracker.create_investment(
            prediction_id=request.prediction_id,
            symbol=request.symbol.upper(),
            amount=request.amount,
            entry_price=request.entry_price
        )
        
        return {
            "investment": position.to_dict(),
            "created_at": datetime.utcnow().isoformat()
        }
    except Exception as e:
        logger.error(f"Error creating investment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/portfolio", tags=["Investments"])
async def get_portfolio(
    tracker: InvestmentTracker = Depends(get_investment_tracker)
):
    """Get current portfolio summary."""
    try:
        summary = await tracker.get_portfolio_summary()
        
        return {
            "total_invested": summary.total_invested,
            "current_value": summary.current_value,
            "total_pnl": summary.total_pnl,
            "total_pnl_percent": summary.total_pnl_percent,
            "active_positions": summary.active_positions,
            "win_rate": summary.win_rate,
            "positions": [p.to_dict() for p in summary.positions],
            "by_symbol": summary.by_symbol,
            "flagged_count": summary.flagged_investments
        }
    except Exception as e:
        logger.error(f"Error getting portfolio: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/investments/flagged", tags=["Investments"])
async def get_flagged_investments(
    tracker: InvestmentTracker = Depends(get_investment_tracker)
):
    """Get investments flagged for review."""
    try:
        flagged = await tracker.get_flagged_investments()
        
        return {
            "flagged": [p.to_dict() for p in flagged],
            "count": len(flagged)
        }
    except Exception as e:
        logger.error(f"Error getting flagged investments: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# LLM Analysis Endpoints
# ============================================================================

@app.post("/api/analyze/news", tags=["Analysis"])
async def analyze_news(
    content: str,
    symbols: List[str] = None,
    orchestrator: LLMOrchestrator = Depends(get_llm_orchestrator)
):
    """Analyze news content using multi-LLM consensus."""
    try:
        result = await orchestrator.analyze_news_consensus(
            news_content=content,
            symbols=symbols
        )
        
        return {
            "consensus_sentiment": result.consensus_sentiment,
            "consensus_score": result.consensus_score,
            "agreement_level": result.agreement_level,
            "insights": result.aggregated_insights,
            "providers_used": result.providers_used
        }
    except Exception as e:
        logger.error(f"Error analyzing news: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# Web Dashboard
# ============================================================================

@app.get("/", response_class=HTMLResponse, tags=["Dashboard"])
async def dashboard(request: Request):
    """Main dashboard page."""
    return templates.TemplateResponse(
        "dashboard.html",
        {"request": request, "title": "Echo AI - Stock Prediction Dashboard"}
    )


@app.get("/predictions", response_class=HTMLResponse, tags=["Dashboard"])
async def predictions_page(request: Request):
    """Predictions page."""
    return templates.TemplateResponse(
        "predictions.html",
        {"request": request, "title": "Predictions - Echo AI"}
    )


@app.get("/portfolio", response_class=HTMLResponse, tags=["Dashboard"])
async def portfolio_page(request: Request):
    """Portfolio page."""
    return templates.TemplateResponse(
        "portfolio.html",
        {"request": request, "title": "Portfolio - Echo AI"}
    )


@app.get("/backtest", response_class=HTMLResponse, tags=["Dashboard"])
async def backtest_page(request: Request):
    """Backtesting page."""
    return templates.TemplateResponse(
        "backtest.html",
        {"request": request, "title": "Backtesting - Echo AI"}
    )
