"""
Echo Stock Prediction System - Main Entry Point.
Orchestrates all components for 24/7 autonomous operation.
"""

import asyncio
import sys
from datetime import datetime

import click
from loguru import logger

from src.config import settings
from src.database import init_database, get_session
from src.scheduler import scheduler, run_scheduler
from src.web.app import app
from src.backtesting import Backtester
from src.prediction import PredictionEngine
from src.tracking import InvestmentTracker
from src.improvement import SelfImprovementEngine


def setup_logging():
    """Configure logging with loguru."""
    logger.remove()
    
    # Console logging
    logger.add(
        sys.stderr,
        format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
        level="INFO"
    )
    
    # File logging
    logger.add(
        "logs/echo_{time:YYYY-MM-DD}.log",
        rotation="1 day",
        retention="30 days",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
        level="DEBUG"
    )
    
    logger.info("Logging configured")


@click.group()
@click.version_option(version="1.0.0")
def cli():
    """Echo - AI-Powered Stock Prediction System"""
    setup_logging()


@cli.command()
@click.option("--host", default="0.0.0.0", help="Host to bind to")
@click.option("--port", default=8000, help="Port to bind to")
@click.option("--reload", is_flag=True, help="Enable auto-reload")
def web(host: str, port: int, reload: bool):
    """Start the web dashboard server."""
    import uvicorn
    
    logger.info(f"Starting web server on {host}:{port}")
    uvicorn.run(
        "src.web.app:app",
        host=host,
        port=port,
        reload=reload
    )


@cli.command()
def run():
    """Run the full Echo system (web + scheduler)."""
    import uvicorn
    import threading
    
    logger.info("=" * 60)
    logger.info("Starting Echo Stock Prediction System")
    logger.info("=" * 60)
    
    async def startup():
        """Initialize all components."""
        logger.info("Initializing database...")
        await init_database()
        
        logger.info("Starting background scheduler...")
        scheduler.start()
        
        logger.info("System startup complete!")
        logger.info("-" * 60)
        logger.info("Echo is now running in autonomous mode")
        logger.info("Dashboard: http://localhost:8000")
        logger.info("API Docs: http://localhost:8000/docs")
        logger.info("-" * 60)
    
    # Run startup
    asyncio.run(startup())
    
    # Start web server (blocking)
    uvicorn.run(
        "src.web.app:app",
        host="0.0.0.0",
        port=8000
    )


@cli.command()
@click.argument("symbol")
@click.option("--detailed", is_flag=True, help="Show detailed analysis")
def predict(symbol: str, detailed: bool):
    """Generate a prediction for a specific stock symbol."""
    
    async def run_prediction():
        engine = PredictionEngine()
        
        logger.info(f"Generating prediction for {symbol}...")
        prediction = await engine.predict(symbol.upper())
        
        print("\n" + "=" * 60)
        print(f"PREDICTION FOR {symbol.upper()}")
        print("=" * 60)
        print(f"Action: {prediction.action.upper()}")
        print(f"Confidence: {prediction.confidence:.1%}")
        print(f"Predicted Return: {prediction.predicted_return:+.2%}")
        print(f"Time Horizon: {prediction.time_horizon}")
        print(f"Meets 7% Threshold: {'✅ YES' if prediction.meets_threshold else '❌ NO'}")
        
        if prediction.reasoning:
            print(f"\nReasoning:")
            for reason in prediction.reasoning:
                print(f"  • {reason}")
        
        if detailed:
            print("\n" + "-" * 60)
            print("DETAILED ANALYSIS")
            print("-" * 60)
            
            if prediction.technical_signals:
                print("\nTechnical Signals:")
                for signal, value in prediction.technical_signals.items():
                    print(f"  {signal}: {value}")
            
            if prediction.sentiment_score:
                print(f"\nSentiment Score: {prediction.sentiment_score:.2f}")
            
            if prediction.llm_consensus:
                print(f"\nLLM Consensus: {prediction.llm_consensus}")
        
        print("=" * 60 + "\n")
    
    asyncio.run(run_prediction())


@cli.command()
@click.argument("symbols", nargs=-1)
@click.option("--top", default=10, help="Show top N predictions")
def scan(symbols: tuple, top: int):
    """Scan multiple symbols or the default watchlist."""
    
    async def run_scan():
        engine = PredictionEngine()
        
        if symbols:
            symbol_list = [s.upper() for s in symbols]
        else:
            # Default watchlist
            symbol_list = [
                "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA",
                "META", "TSLA", "JPM", "V", "UNH",
                "JNJ", "WMT", "MA", "PG", "HD"
            ]
        
        logger.info(f"Scanning {len(symbol_list)} symbols...")
        predictions = await engine.batch_predictions(symbol_list)
        
        # Sort by expected return
        predictions.sort(key=lambda p: p.predicted_return, reverse=True)
        
        print("\n" + "=" * 80)
        print("TOP PREDICTIONS")
        print("=" * 80)
        print(f"{'Symbol':<8} {'Action':<8} {'Return':<10} {'Confidence':<12} {'Threshold':<10}")
        print("-" * 80)
        
        for pred in predictions[:top]:
            threshold = "✅" if pred.meets_threshold else "❌"
            print(f"{pred.symbol:<8} {pred.action.upper():<8} {pred.predicted_return:>+8.2%}   {pred.confidence:>10.1%}   {threshold:<10}")
        
        print("=" * 80 + "\n")
    
    asyncio.run(run_scan())


@cli.command()
@click.argument("symbol")
@click.option("--start-date", help="Start date (YYYY-MM-DD)")
@click.option("--end-date", help="End date (YYYY-MM-DD)")
@click.option("--initial-capital", default=10000.0, help="Initial capital")
def backtest(symbol: str, start_date: str, end_date: str, initial_capital: float):
    """Run a backtest on historical data."""
    
    async def run_backtest():
        from src.backtesting import Backtester, run_quick_backtest
        
        logger.info(f"Running backtest for {symbol}...")
        
        result = await run_quick_backtest(
            symbol=symbol.upper(),
            initial_capital=initial_capital,
            start_date=start_date,
            end_date=end_date
        )
        
        print("\n" + "=" * 60)
        print(f"BACKTEST RESULTS - {symbol.upper()}")
        print("=" * 60)
        print(f"Period: {result.start_date} to {result.end_date}")
        print(f"Total Trades: {result.total_trades}")
        print(f"Win Rate: {result.win_rate:.1%}")
        print(f"Total Return: {result.total_return:+.2%}")
        print(f"Max Drawdown: {result.max_drawdown:.2%}")
        print(f"Sharpe Ratio: {result.sharpe_ratio:.2f}")
        print(f"Final Portfolio Value: ${result.final_value:,.2f}")
        print("=" * 60 + "\n")
    
    asyncio.run(run_backtest())


@cli.command()
def portfolio():
    """View current portfolio and investments."""
    
    async def show_portfolio():
        tracker = InvestmentTracker()
        summary = await tracker.get_portfolio_summary()
        
        print("\n" + "=" * 80)
        print("PORTFOLIO SUMMARY")
        print("=" * 80)
        print(f"Total Value: ${summary.total_value:,.2f}")
        print(f"Total P&L: ${summary.total_pnl:+,.2f} ({summary.total_pnl_percent:+.2%})")
        print(f"Available Cash: ${summary.available_cash:,.2f}")
        print(f"Active Positions: {len(summary.positions)}")
        print(f"Flagged Investments: {summary.flagged_investments}")
        
        if summary.positions:
            print("\n" + "-" * 80)
            print("ACTIVE POSITIONS")
            print("-" * 80)
            print(f"{'Symbol':<8} {'Shares':<10} {'Avg Cost':<12} {'Current':<12} {'P&L':<12} {'Status':<10}")
            print("-" * 80)
            
            for pos in summary.positions:
                status = "🚩 FLAG" if pos.needs_review else "✅ OK"
                print(f"{pos.symbol:<8} {pos.shares:<10.2f} ${pos.avg_cost:<11.2f} ${pos.current_price:<11.2f} {pos.pnl:>+10.2f}  {status}")
        
        print("=" * 80 + "\n")
    
    asyncio.run(show_portfolio())


@cli.command()
def status():
    """Show system status and health."""
    
    async def show_status():
        print("\n" + "=" * 60)
        print("ECHO SYSTEM STATUS")
        print("=" * 60)
        print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"Environment: {settings.environment}")
        print(f"Debug Mode: {settings.debug}")
        
        # Check scheduler
        scheduler_status = "🟢 Running" if scheduler.is_running else "🔴 Stopped"
        print(f"\nScheduler: {scheduler_status}")
        
        # Check database
        try:
            async with get_session() as session:
                await session.execute("SELECT 1")
            db_status = "🟢 Connected"
        except Exception as e:
            db_status = f"🔴 Error: {e}"
        print(f"Database: {db_status}")
        
        # Check LLM providers
        print("\nLLM Providers:")
        print(f"  Gemini: {'🟢 Configured' if settings.gemini_api_key else '🔴 Not configured'}")
        print(f"  Groq: {'🟢 Configured' if settings.groq_api_key else '🔴 Not configured'}")
        print(f"  Together AI: {'🟢 Configured' if settings.together_api_key else '🔴 Not configured'}")
        
        print("=" * 60 + "\n")
    
    asyncio.run(show_status())


@cli.command()
def improve():
    """Run a manual self-improvement cycle."""
    
    async def run_improvement():
        engine = SelfImprovementEngine()
        
        logger.info("Running self-improvement cycle...")
        result = await engine.run_optimization_cycle()
        
        print("\n" + "=" * 60)
        print("SELF-IMPROVEMENT CYCLE RESULTS")
        print("=" * 60)
        print(f"Status: {result.get('status')}")
        
        if result.get("performance_report"):
            report = result["performance_report"]
            print(f"\nPrediction Accuracy: {report.prediction_accuracy:.1%}")
            print(f"Average Return: {report.average_return:+.2%}")
            print(f"Predictions Meeting Threshold: {report.predictions_meeting_threshold}")
        
        if result.get("insights"):
            print(f"\nInsights Generated: {len(result['insights'])}")
            for insight in result["insights"][:3]:
                print(f"  • [{insight.severity.upper()}] {insight.message}")
        
        print("=" * 60 + "\n")
    
    asyncio.run(run_improvement())


if __name__ == "__main__":
    cli()
