"""
Base scraper class with common functionality.
All news and data scrapers inherit from this.
"""

from abc import ABC, abstractmethod
from datetime import datetime
from typing import List, Dict, Any, Optional
import asyncio
import random

import httpx
from bs4 import BeautifulSoup
from loguru import logger
from tenacity import retry, stop_after_attempt, wait_exponential

from src.config import settings


class BaseScraper(ABC):
    """Abstract base class for all scrapers."""
    
    name: str = "base"
    base_url: str = ""
    
    # Rate limiting
    min_delay: float = 1.0
    max_delay: float = 3.0
    
    # User agents for rotation
    USER_AGENTS = [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    ]
    
    def __init__(self):
        self.client: Optional[httpx.AsyncClient] = None
        self._last_request_time: float = 0
        
    async def __aenter__(self):
        self.client = httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            headers=self._get_headers()
        )
        return self
    
    async def __aexit__(self, exc_type, exc_val, exc_tb):
        if self.client:
            await self.client.aclose()
    
    def _get_headers(self) -> Dict[str, str]:
        """Get request headers with random user agent."""
        return {
            "User-Agent": random.choice(self.USER_AGENTS),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Accept-Encoding": "gzip, deflate, br",
            "DNT": "1",
            "Connection": "keep-alive",
            "Upgrade-Insecure-Requests": "1",
        }
    
    async def _rate_limit(self):
        """Enforce rate limiting between requests."""
        delay = random.uniform(self.min_delay, self.max_delay)
        await asyncio.sleep(delay)
    
    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=2, max=10))
    async def fetch_page(self, url: str) -> Optional[str]:
        """Fetch a page with retry logic."""
        await self._rate_limit()
        
        try:
            # Rotate headers on each request
            self.client.headers.update(self._get_headers())
            response = await self.client.get(url)
            response.raise_for_status()
            return response.text
        except httpx.HTTPStatusError as e:
            logger.warning(f"HTTP error fetching {url}: {e.response.status_code}")
            raise
        except httpx.RequestError as e:
            logger.warning(f"Request error fetching {url}: {e}")
            raise
    
    def parse_html(self, html: str) -> BeautifulSoup:
        """Parse HTML content."""
        return BeautifulSoup(html, "lxml")
    
    @abstractmethod
    async def scrape(self) -> List[Dict[str, Any]]:
        """Scrape data from the source. Must be implemented by subclasses."""
        pass
    
    @abstractmethod
    async def parse_article(self, url: str) -> Optional[Dict[str, Any]]:
        """Parse a single article. Must be implemented by subclasses."""
        pass
    
    def extract_date(self, date_str: str, formats: List[str] = None) -> Optional[datetime]:
        """Try to parse a date string with multiple formats."""
        if not date_str:
            return None
            
        default_formats = [
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S%z",
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d",
            "%B %d, %Y",
            "%b %d, %Y",
            "%d %B %Y",
            "%d %b %Y",
        ]
        
        formats = formats or default_formats
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt)
            except ValueError:
                continue
        
        logger.debug(f"Could not parse date: {date_str}")
        return None
    
    def clean_text(self, text: str) -> str:
        """Clean and normalize text content."""
        if not text:
            return ""
        
        # Remove extra whitespace
        text = " ".join(text.split())
        # Remove common artifacts
        text = text.replace("\n", " ").replace("\r", "").replace("\t", " ")
        return text.strip()
