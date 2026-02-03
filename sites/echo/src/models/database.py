"""
Database models for the Echo system.
Defines all tables for storing market data, predictions, and performance metrics.
"""

from datetime import datetime
from typing import Optional, List
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, 
    Text, JSON, ForeignKey, Enum, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship, declarative_base
from sqlalchemy.sql import func
import enum

Base = declarative_base()


class PredictionStatus(enum.Enum):
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    EXPIRED = "expired"


class InvestmentOutcome(enum.Enum):
    PENDING = "pending"
    PROFIT = "profit"
    LOSS = "loss"
    BREAK_EVEN = "break_even"


class NewsArticle(Base):
    """Stores scraped news articles."""
    __tablename__ = "news_articles"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    source = Column(String(100), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    content = Column(Text)
    summary = Column(Text)
    url = Column(String(1000), unique=True)
    published_at = Column(DateTime, index=True)
    scraped_at = Column(DateTime, default=func.now())
    
    # Extracted entities
    mentioned_symbols = Column(JSON)  # List of stock symbols mentioned
    mentioned_companies = Column(JSON)  # Company names
    
    # Sentiment scores from different analyzers
    vader_sentiment = Column(Float)
    textblob_sentiment = Column(Float)
    llm_sentiment = Column(Float)
    composite_sentiment = Column(Float)
    
    # LLM analysis
    llm_analysis = Column(JSON)  # Detailed analysis from LLMs
    
    # Relationships
    predictions = relationship("Prediction", back_populates="news_articles", secondary="prediction_news")
    
    __table_args__ = (
        Index("idx_news_source_date", "source", "published_at"),
    )


class StockData(Base):
    """Historical and real-time stock data."""
    __tablename__ = "stock_data"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(20), nullable=False, index=True)
    timestamp = Column(DateTime, nullable=False, index=True)
    
    # OHLCV data
    open = Column(Float)
    high = Column(Float)
    low = Column(Float)
    close = Column(Float)
    volume = Column(Float)
    adjusted_close = Column(Float)
    
    # Technical indicators (calculated)
    sma_20 = Column(Float)
    sma_50 = Column(Float)
    sma_200 = Column(Float)
    ema_12 = Column(Float)
    ema_26 = Column(Float)
    rsi_14 = Column(Float)
    macd = Column(Float)
    macd_signal = Column(Float)
    bollinger_upper = Column(Float)
    bollinger_lower = Column(Float)
    atr_14 = Column(Float)
    
    # Additional metrics
    market_cap = Column(Float)
    pe_ratio = Column(Float)
    dividend_yield = Column(Float)
    
    __table_args__ = (
        UniqueConstraint("symbol", "timestamp", name="uq_stock_symbol_time"),
        Index("idx_stock_symbol_time", "symbol", "timestamp"),
    )


class CompanyProfile(Base):
    """Company fundamental information."""
    __tablename__ = "company_profiles"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    symbol = Column(String(20), unique=True, nullable=False, index=True)
    name = Column(String(500))
    sector = Column(String(100))
    industry = Column(String(200))
    country = Column(String(100))
    exchange = Column(String(50))
    
    # Fundamentals
    market_cap = Column(Float)
    employees = Column(Integer)
    description = Column(Text)
    website = Column(String(500))
    
    # Financials
    revenue = Column(Float)
    gross_profit = Column(Float)
    net_income = Column(Float)
    total_assets = Column(Float)
    total_debt = Column(Float)
    
    updated_at = Column(DateTime, default=func.now(), onupdate=func.now())


class Prediction(Base):
    """Stock predictions made by the system."""
    __tablename__ = "predictions"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime, default=func.now(), index=True)
    
    # Target
    symbol = Column(String(20), nullable=False, index=True)
    company_name = Column(String(500))
    
    # Prediction details
    prediction_type = Column(String(50))  # buy, sell, hold
    entry_price = Column(Float)
    target_price = Column(Float)
    stop_loss = Column(Float)
    expected_return_percent = Column(Float)
    time_horizon_days = Column(Integer)
    expiry_date = Column(DateTime, index=True)
    
    # Confidence metrics
    overall_confidence = Column(Float)
    technical_confidence = Column(Float)
    sentiment_confidence = Column(Float)
    llm_consensus_score = Column(Float)
    
    # Analysis breakdown
    technical_analysis = Column(JSON)
    sentiment_analysis = Column(JSON)
    fundamental_analysis = Column(JSON)
    llm_analyses = Column(JSON)  # Individual LLM responses
    llm_consensus = Column(Text)  # Aggregated LLM consensus
    
    # Reasoning
    reasoning = Column(Text)
    key_factors = Column(JSON)
    risks = Column(JSON)
    
    # Status tracking
    status = Column(String(20), default="pending", index=True)
    
    # Outcome (filled after expiry)
    actual_price_at_expiry = Column(Float)
    actual_return_percent = Column(Float)
    outcome = Column(String(20))  # profit, loss, break_even
    outcome_analysis = Column(Text)  # Why it succeeded/failed
    
    # Relationships
    news_articles = relationship("NewsArticle", back_populates="predictions", secondary="prediction_news")
    investments = relationship("Investment", back_populates="prediction")
    
    __table_args__ = (
        Index("idx_pred_symbol_status", "symbol", "status"),
    )


class PredictionNews(Base):
    """Association table for predictions and news articles."""
    __tablename__ = "prediction_news"
    
    prediction_id = Column(Integer, ForeignKey("predictions.id"), primary_key=True)
    news_id = Column(Integer, ForeignKey("news_articles.id"), primary_key=True)
    relevance_score = Column(Float)


class Investment(Base):
    """Tracks simulated or real investments based on predictions."""
    __tablename__ = "investments"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    prediction_id = Column(Integer, ForeignKey("predictions.id"), nullable=False)
    created_at = Column(DateTime, default=func.now())
    
    # Investment details
    symbol = Column(String(20), nullable=False, index=True)
    amount_invested = Column(Float, nullable=False)
    shares = Column(Float)
    entry_price = Column(Float, nullable=False)
    
    # Exit details
    exit_price = Column(Float)
    exit_date = Column(DateTime)
    
    # Results
    return_amount = Column(Float)
    return_percent = Column(Float)
    outcome = Column(String(20), default="pending")
    
    # Flags
    flagged_for_review = Column(Boolean, default=False)
    review_notes = Column(Text)
    lessons_learned = Column(Text)
    
    # Relationship
    prediction = relationship("Prediction", back_populates="investments")


class LLMResponse(Base):
    """Stores individual LLM responses for analysis and improvement."""
    __tablename__ = "llm_responses"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime, default=func.now())
    
    provider = Column(String(50), nullable=False, index=True)  # gemini, groq, etc.
    model = Column(String(100))
    
    # Request
    prompt_type = Column(String(100))  # news_analysis, prediction, etc.
    prompt = Column(Text)
    context = Column(JSON)
    
    # Response
    response = Column(Text)
    structured_output = Column(JSON)
    
    # Metrics
    response_time_ms = Column(Integer)
    tokens_used = Column(Integer)
    
    # Quality tracking
    was_accurate = Column(Boolean)
    accuracy_score = Column(Float)
    notes = Column(Text)


class SystemMetrics(Base):
    """Tracks system performance over time for self-improvement."""
    __tablename__ = "system_metrics"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    recorded_at = Column(DateTime, default=func.now(), index=True)
    metric_type = Column(String(100), nullable=False, index=True)
    
    # Metrics
    value = Column(Float)
    metadata = Column(JSON)
    
    # Aggregated stats
    period = Column(String(20))  # daily, weekly, monthly
    predictions_made = Column(Integer)
    successful_predictions = Column(Integer)
    failed_predictions = Column(Integer)
    accuracy_rate = Column(Float)
    average_return = Column(Float)
    total_profit_loss = Column(Float)


class ModelConfiguration(Base):
    """Stores tunable model parameters for self-improvement."""
    __tablename__ = "model_configurations"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    created_at = Column(DateTime, default=func.now())
    active = Column(Boolean, default=True)
    
    # Configuration
    name = Column(String(100), nullable=False)
    version = Column(String(50))
    parameters = Column(JSON)
    
    # Performance
    backtesting_score = Column(Float)
    live_accuracy = Column(Float)
    notes = Column(Text)


class BacktestResult(Base):
    """Results from backtesting the prediction model."""
    __tablename__ = "backtest_results"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    run_at = Column(DateTime, default=func.now())
    
    # Test parameters
    start_date = Column(DateTime)
    end_date = Column(DateTime)
    symbols_tested = Column(JSON)
    configuration_id = Column(Integer, ForeignKey("model_configurations.id"))
    
    # Results
    total_predictions = Column(Integer)
    correct_predictions = Column(Integer)
    accuracy = Column(Float)
    average_return = Column(Float)
    max_drawdown = Column(Float)
    sharpe_ratio = Column(Float)
    win_rate = Column(Float)
    
    # Details
    detailed_results = Column(JSON)
    recommendations = Column(Text)
