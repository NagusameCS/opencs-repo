"""
Configuration management for Echo system.
Uses pydantic-settings for type-safe configuration with validation.
"""

from functools import lru_cache
from typing import List, Optional
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )
    
    # Database
    database_url: str = "sqlite+aiosqlite:///./data/echo.db"
    redis_url: str = "redis://localhost:6379/0"
    
    # LLM API Keys
    gemini_api_key: Optional[str] = None
    groq_api_key: Optional[str] = None
    together_api_key: Optional[str] = None
    openai_api_key: Optional[str] = None
    
    # Stock Market APIs
    alpha_vantage_api_key: Optional[str] = None
    finnhub_api_key: Optional[str] = None
    
    # News APIs
    news_api_key: Optional[str] = None
    newsdata_api_key: Optional[str] = None
    
    # Application
    debug: bool = False
    log_level: str = "INFO"
    secret_key: str = "change-me-in-production"
    
    # Prediction Settings
    min_confidence_threshold: float = 0.75
    target_return_percent: float = 7.0
    max_investment_per_prediction: float = 1000.0
    risk_tolerance: str = "medium"  # low, medium, high
    
    # Self-Improvement
    enable_auto_tuning: bool = True
    backtesting_lookback_days: int = 365
    prediction_review_interval_hours: int = 24
    
    # Scraping
    scrape_interval_minutes: int = 30
    max_concurrent_scrapers: int = 5
    news_sources: str = "reuters,bloomberg,cnbc,yahoo_finance,marketwatch"
    
    # Server
    host: str = "0.0.0.0"
    port: int = 8000
    workers: int = 4
    
    @property
    def news_sources_list(self) -> List[str]:
        """Parse news sources string into list."""
        return [s.strip() for s in self.news_sources.split(",")]
    
    def get_available_llms(self) -> List[str]:
        """Return list of configured LLM providers."""
        available = []
        if self.gemini_api_key:
            available.append("gemini")
        if self.groq_api_key:
            available.append("groq")
        if self.together_api_key:
            available.append("together")
        if self.openai_api_key:
            available.append("openai")
        return available


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


# Convenience access
settings = get_settings()
