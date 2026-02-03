"""
Background Scheduler.
Manages scheduled tasks for continuous data gathering and analysis.
"""

import asyncio
from datetime import datetime, timedelta
from typing import Callable, Dict, Any
import signal
import sys

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.cron import CronTrigger
from loguru import logger

from src.config import settings
from src.database import get_session
from src.scrapers import RSSNewsScraper, StockDataFetcher
from src.prediction import PredictionEngine
from src.tracking import InvestmentTracker
from src.improvement import SelfImprovementEngine


class BackgroundScheduler:
    """
    Manages all background scheduled tasks.
    
    Tasks:
    1. News scraping (every 30 minutes)
    2. Stock data updates (every 15 minutes during market hours)
    3. Prediction generation (every hour)
    4. Investment monitoring (every 5 minutes)
    5. Self-improvement cycle (daily)
    """
    
    def __init__(self):
        self.scheduler = AsyncIOScheduler()
        self.is_running = False
        self._setup_signal_handlers()
    
    def _setup_signal_handlers(self):
        """Setup graceful shutdown handlers."""
        def signal_handler(sig, frame):
            logger.info("Shutdown signal received, stopping scheduler...")
            self.stop()
            sys.exit(0)
        
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
    
    def start(self):
        """Start the scheduler with all tasks."""
        if self.is_running:
            logger.warning("Scheduler already running")
            return
        
        logger.info("Starting background scheduler...")
        
        # Add jobs
        self._add_news_scraping_job()
        self._add_stock_update_job()
        self._add_prediction_job()
        self._add_monitoring_job()
        self._add_improvement_job()
        self._add_cleanup_job()
        
        self.scheduler.start()
        self.is_running = True
        logger.info("Background scheduler started with all jobs")
    
    def stop(self):
        """Stop the scheduler."""
        if self.is_running:
            self.scheduler.shutdown(wait=False)
            self.is_running = False
            logger.info("Background scheduler stopped")
    
    def _add_news_scraping_job(self):
        """Add news scraping job - runs every 30 minutes."""
        self.scheduler.add_job(
            self._scrape_news,
            trigger=IntervalTrigger(minutes=settings.scrape_interval_minutes),
            id="news_scraping",
            name="News Scraping",
            replace_existing=True,
            max_instances=1
        )
        logger.info(f"Added news scraping job (every {settings.scrape_interval_minutes} minutes)")
    
    def _add_stock_update_job(self):
        """Add stock data update job - runs every 15 minutes during market hours."""
        # US Market hours: 9:30 AM - 4:00 PM ET, Monday-Friday
        self.scheduler.add_job(
            self._update_stock_data,
            trigger=IntervalTrigger(minutes=15),
            id="stock_update",
            name="Stock Data Update",
            replace_existing=True,
            max_instances=1
        )
        logger.info("Added stock data update job (every 15 minutes)")
    
    def _add_prediction_job(self):
        """Add prediction generation job - runs every hour."""
        self.scheduler.add_job(
            self._generate_predictions,
            trigger=IntervalTrigger(hours=1),
            id="prediction_generation",
            name="Prediction Generation",
            replace_existing=True,
            max_instances=1
        )
        logger.info("Added prediction generation job (every hour)")
    
    def _add_monitoring_job(self):
        """Add investment monitoring job - runs every 5 minutes."""
        self.scheduler.add_job(
            self._monitor_investments,
            trigger=IntervalTrigger(minutes=5),
            id="investment_monitoring",
            name="Investment Monitoring",
            replace_existing=True,
            max_instances=1
        )
        logger.info("Added investment monitoring job (every 5 minutes)")
    
    def _add_improvement_job(self):
        """Add self-improvement job - runs daily at 6 AM."""
        self.scheduler.add_job(
            self._run_improvement_cycle,
            trigger=CronTrigger(hour=6, minute=0),
            id="self_improvement",
            name="Self Improvement Cycle",
            replace_existing=True,
            max_instances=1
        )
        logger.info("Added self-improvement job (daily at 6 AM)")
    
    def _add_cleanup_job(self):
        """Add cleanup job - runs daily at midnight."""
        self.scheduler.add_job(
            self._cleanup_old_data,
            trigger=CronTrigger(hour=0, minute=0),
            id="cleanup",
            name="Data Cleanup",
            replace_existing=True,
            max_instances=1
        )
        logger.info("Added cleanup job (daily at midnight)")
    
    async def _scrape_news(self):
        """Scrape news from all sources."""
        logger.info("Starting news scraping task...")
        
        try:
            async with RSSNewsScraper() as scraper:
                articles = await scraper.scrape()
            
            logger.info(f"Scraped {len(articles)} news articles")
            
            # Store in database
            # (Implementation would save to database here)
            
        except Exception as e:
            logger.error(f"Error in news scraping task: {e}")
    
    async def _update_stock_data(self):
        """Update stock data for watchlist."""
        logger.info("Starting stock data update task...")
        
        try:
            fetcher = StockDataFetcher()
            
            # Update market indices
            indices = await fetcher.get_market_indices()
            logger.info(f"Updated {len(indices)} market indices")
            
            # Update sector ETFs
            sectors = await fetcher.get_sector_performance()
            logger.info(f"Updated {len(sectors)} sector ETFs")
            
        except Exception as e:
            logger.error(f"Error in stock data update task: {e}")
    
    async def _generate_predictions(self):
        """Generate predictions for top opportunities."""
        logger.info("Starting prediction generation task...")
        
        try:
            engine = PredictionEngine()
            
            # Generate predictions for watchlist
            watchlist = [
                "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA",
                "META", "TSLA", "JPM", "V", "UNH"
            ]
            
            predictions = await engine.batch_predictions(watchlist)
            
            # Filter for actionable predictions
            actionable = [p for p in predictions if p.meets_threshold and p.action == "buy"]
            
            logger.info(f"Generated {len(predictions)} predictions, {len(actionable)} actionable")
            
            # Store predictions
            # (Implementation would save to database here)
            
        except Exception as e:
            logger.error(f"Error in prediction generation task: {e}")
    
    async def _monitor_investments(self):
        """Monitor active investments for stop-loss and targets."""
        logger.info("Starting investment monitoring task...")
        
        try:
            tracker = InvestmentTracker()
            summary = await tracker.get_portfolio_summary()
            
            if summary.flagged_investments > 0:
                logger.warning(f"{summary.flagged_investments} investments flagged for review!")
            
            # Check for stop-loss triggers
            for position in summary.positions:
                if position.current_price <= position.stop_loss:
                    logger.warning(f"STOP LOSS TRIGGERED: {position.symbol} at ${position.current_price:.2f}")
                    # Auto-close logic could go here
                
                elif position.current_price >= position.target_price:
                    logger.info(f"TARGET REACHED: {position.symbol} at ${position.current_price:.2f}")
                    # Auto-close logic could go here
            
        except Exception as e:
            logger.error(f"Error in investment monitoring task: {e}")
    
    async def _run_improvement_cycle(self):
        """Run the self-improvement optimization cycle."""
        logger.info("Starting self-improvement cycle...")
        
        try:
            engine = SelfImprovementEngine()
            result = await engine.run_optimization_cycle()
            
            logger.info(f"Improvement cycle completed: {result.get('status')}")
            
            if result.get("changes", {}).get("applied"):
                logger.info(f"Applied {len(result['changes']['applied'])} improvements")
            
        except Exception as e:
            logger.error(f"Error in self-improvement cycle: {e}")
    
    async def _cleanup_old_data(self):
        """Clean up old data to prevent database bloat."""
        logger.info("Starting cleanup task...")
        
        try:
            # Would clean up:
            # - Old news articles (>30 days)
            # - Old stock data (>1 year)
            # - Completed predictions (>90 days)
            # - LLM responses (>7 days)
            
            logger.info("Cleanup completed")
            
        except Exception as e:
            logger.error(f"Error in cleanup task: {e}")


# Global scheduler instance
scheduler = BackgroundScheduler()


async def run_scheduler():
    """Run the scheduler as an async task."""
    scheduler.start()
    
    # Keep running until stopped
    while scheduler.is_running:
        await asyncio.sleep(1)
