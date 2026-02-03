"""
News scrapers for various financial news sources.
"""

from datetime import datetime
from typing import List, Dict, Any, Optional
import re

import feedparser
from loguru import logger

from .base_scraper import BaseScraper


class RSSNewsScraper(BaseScraper):
    """Scraper for RSS-based news sources."""
    
    RSS_FEEDS = {
        "reuters_business": "https://www.reutersagency.com/feed/?best-topics=business-finance&post_type=best",
        "yahoo_finance": "https://finance.yahoo.com/rss/topstories",
        "marketwatch": "https://feeds.marketwatch.com/marketwatch/topstories/",
        "cnbc": "https://www.cnbc.com/id/100003114/device/rss/rss.html",
        "bloomberg": "https://feeds.bloomberg.com/markets/news.rss",
        "wsj_markets": "https://feeds.a.dj.com/rss/RSSMarketsMain.xml",
        "ft": "https://www.ft.com/rss/home/international",
        "investing": "https://www.investing.com/rss/news.rss",
        "seekingalpha": "https://seekingalpha.com/market_currents.xml",
    }
    
    name = "rss_news"
    
    async def scrape(self) -> List[Dict[str, Any]]:
        """Scrape all configured RSS feeds."""
        all_articles = []
        
        for source, url in self.RSS_FEEDS.items():
            try:
                articles = await self._scrape_feed(source, url)
                all_articles.extend(articles)
                logger.info(f"Scraped {len(articles)} articles from {source}")
            except Exception as e:
                logger.error(f"Error scraping {source}: {e}")
        
        return all_articles
    
    async def _scrape_feed(self, source: str, url: str) -> List[Dict[str, Any]]:
        """Scrape a single RSS feed."""
        try:
            feed = feedparser.parse(url)
            articles = []
            
            for entry in feed.entries[:50]:  # Limit to most recent 50
                article = {
                    "source": source,
                    "title": self.clean_text(entry.get("title", "")),
                    "url": entry.get("link", ""),
                    "summary": self.clean_text(entry.get("summary", entry.get("description", ""))),
                    "published_at": self._parse_feed_date(entry),
                    "scraped_at": datetime.utcnow(),
                }
                
                # Skip if no title
                if article["title"]:
                    articles.append(article)
            
            return articles
        except Exception as e:
            logger.error(f"Error parsing RSS feed {source}: {e}")
            return []
    
    def _parse_feed_date(self, entry: Dict) -> Optional[datetime]:
        """Parse date from RSS entry."""
        date_fields = ["published_parsed", "updated_parsed", "created_parsed"]
        
        for field in date_fields:
            if hasattr(entry, field) and getattr(entry, field):
                try:
                    import time
                    return datetime(*getattr(entry, field)[:6])
                except (TypeError, ValueError):
                    continue
        
        # Try string parsing
        date_str = entry.get("published", entry.get("updated", ""))
        if date_str:
            return self.extract_date(date_str)
        
        return None
    
    async def parse_article(self, url: str) -> Optional[Dict[str, Any]]:
        """RSS articles already have enough info, but can fetch full content if needed."""
        return None  # Use newspaper3k for full article extraction


class GoogleNewsSearcher(BaseScraper):
    """Search Google News for stock-related articles."""
    
    name = "google_news"
    base_url = "https://news.google.com"
    
    async def search(self, query: str, region: str = "US") -> List[Dict[str, Any]]:
        """Search Google News for a query."""
        # Use RSS feed for search
        search_url = f"https://news.google.com/rss/search?q={query}&hl=en-{region}&gl={region}&ceid={region}:en"
        
        try:
            feed = feedparser.parse(search_url)
            articles = []
            
            for entry in feed.entries[:30]:
                article = {
                    "source": "google_news",
                    "title": self.clean_text(entry.get("title", "")),
                    "url": entry.get("link", ""),
                    "published_at": self._parse_date(entry),
                    "scraped_at": datetime.utcnow(),
                    "search_query": query,
                }
                
                if article["title"]:
                    articles.append(article)
            
            return articles
        except Exception as e:
            logger.error(f"Error searching Google News for '{query}': {e}")
            return []
    
    def _parse_date(self, entry: Dict) -> Optional[datetime]:
        """Parse date from entry."""
        if hasattr(entry, "published_parsed") and entry.published_parsed:
            try:
                return datetime(*entry.published_parsed[:6])
            except (TypeError, ValueError):
                pass
        return None
    
    async def scrape(self) -> List[Dict[str, Any]]:
        """Scrape trending finance news."""
        queries = [
            "stock market",
            "earnings report",
            "IPO",
            "merger acquisition",
            "Federal Reserve",
            "cryptocurrency bitcoin",
            "tech stocks",
            "S&P 500",
        ]
        
        all_articles = []
        for query in queries:
            articles = await self.search(query)
            all_articles.extend(articles)
        
        return all_articles
    
    async def parse_article(self, url: str) -> Optional[Dict[str, Any]]:
        return None


class FullArticleScraper(BaseScraper):
    """Extract full article content using newspaper3k."""
    
    name = "full_article"
    
    async def scrape(self) -> List[Dict[str, Any]]:
        """Not used for this scraper."""
        return []
    
    async def parse_article(self, url: str) -> Optional[Dict[str, Any]]:
        """Extract full article content."""
        try:
            from newspaper import Article
            
            article = Article(url)
            article.download()
            article.parse()
            article.nlp()
            
            return {
                "url": url,
                "title": article.title,
                "content": article.text,
                "summary": article.summary,
                "keywords": article.keywords,
                "authors": article.authors,
                "published_at": article.publish_date,
                "top_image": article.top_image,
            }
        except Exception as e:
            logger.error(f"Error extracting article from {url}: {e}")
            return None


class SymbolExtractor:
    """Extract stock symbols and company names from text."""
    
    # Common stock symbol pattern (1-5 uppercase letters)
    SYMBOL_PATTERN = re.compile(r'\b([A-Z]{1,5})\b')
    
    # Common finance keywords to filter out false positives
    EXCLUDE_WORDS = {
        "A", "I", "THE", "AND", "OR", "FOR", "TO", "IN", "ON", "AT",
        "IS", "IT", "AS", "BE", "BY", "AN", "OF", "CEO", "CFO", "COO",
        "US", "UK", "EU", "GDP", "IPO", "ETF", "SEC", "FED", "NYSE",
        "NASDAQ", "DOW", "ALL", "NEW", "TOP", "VS", "PM", "AM", "EST",
        "USD", "EUR", "GBP", "JPY", "CNY", "BTC", "ETH", "AI", "IT",
        "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
        "UP", "DOWN", "OUT", "OFF", "OVER", "INTO", "THAT", "THIS",
        "JUST", "NOW", "HOW", "WHY", "WHAT", "WHEN", "WHERE", "WHO",
    }
    
    # Known valid symbols (top 100 by market cap + additions)
    KNOWN_SYMBOLS = {
        "AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "NVDA", "META", "TSLA",
        "BRK", "UNH", "JNJ", "XOM", "JPM", "V", "PG", "MA", "HD", "CVX",
        "MRK", "LLY", "ABBV", "PEP", "KO", "COST", "AVGO", "WMT", "MCD",
        "CSCO", "TMO", "ACN", "ABT", "DHR", "ADBE", "CRM", "NKE", "NFLX",
        "VZ", "INTC", "PM", "CMCSA", "TXN", "UPS", "NEE", "AMD", "QCOM",
        "IBM", "CAT", "INTU", "RTX", "BA", "GE", "LOW", "AMGN", "HON",
        "SBUX", "MS", "BLK", "GS", "SPGI", "SCHW", "DE", "PYPL", "SQ",
        "UBER", "SHOP", "SNAP", "TWTR", "ZM", "DOCU", "CRWD", "DDOG",
        "NET", "SNOW", "PLTR", "COIN", "RBLX", "HOOD", "RIVN", "LCID",
        "GME", "AMC", "BB", "NOK", "WISH", "CLOV", "SOFI", "NIO", "XPEV",
        "LI", "BABA", "JD", "PDD", "BIDU", "BILI", "TME", "NTES", "WB",
        "SPY", "QQQ", "DIA", "IWM", "VTI", "VOO", "ARKK", "ARKG",
    }
    
    def extract_symbols(self, text: str) -> List[str]:
        """Extract stock symbols from text."""
        if not text:
            return []
        
        matches = self.SYMBOL_PATTERN.findall(text)
        symbols = []
        
        for match in matches:
            # Only include if it's a known symbol or looks valid
            if match in self.KNOWN_SYMBOLS:
                symbols.append(match)
            elif match not in self.EXCLUDE_WORDS and len(match) >= 2:
                # Could be a valid symbol, include with lower confidence
                symbols.append(match)
        
        return list(set(symbols))
    
    def extract_company_mentions(self, text: str) -> Dict[str, str]:
        """Extract company name to symbol mappings from text."""
        COMPANY_PATTERNS = {
            "Apple": "AAPL", "Microsoft": "MSFT", "Google": "GOOGL",
            "Alphabet": "GOOGL", "Amazon": "AMZN", "NVIDIA": "NVDA",
            "Meta": "META", "Facebook": "META", "Tesla": "TSLA",
            "Netflix": "NFLX", "PayPal": "PYPL", "Shopify": "SHOP",
            "Intel": "INTC", "AMD": "AMD", "Coinbase": "COIN",
            "Uber": "UBER", "Lyft": "LYFT", "Airbnb": "ABNB",
            "Walmart": "WMT", "Target": "TGT", "Costco": "COST",
            "Disney": "DIS", "Warner Bros": "WBD", "Paramount": "PARA",
            "JPMorgan": "JPM", "Goldman Sachs": "GS", "Morgan Stanley": "MS",
            "Berkshire": "BRK", "BlackRock": "BLK", "Visa": "V",
            "Mastercard": "MA", "American Express": "AXP",
            "Pfizer": "PFE", "Moderna": "MRNA", "Johnson & Johnson": "JNJ",
            "Boeing": "BA", "Lockheed": "LMT", "Raytheon": "RTX",
            "ExxonMobil": "XOM", "Chevron": "CVX", "Shell": "SHEL",
            "Coca-Cola": "KO", "PepsiCo": "PEP", "McDonald's": "MCD",
            "Starbucks": "SBUX", "Nike": "NKE", "Adidas": "ADDYY",
            "IBM": "IBM", "Oracle": "ORCL", "Salesforce": "CRM",
            "Adobe": "ADBE", "Zoom": "ZM", "Slack": "WORK",
            "Twitter": "TWTR", "X Corp": "TWTR", "Snap": "SNAP",
            "Pinterest": "PINS", "Reddit": "RDDT", "LinkedIn": "MSFT",
            "GameStop": "GME", "AMC": "AMC", "Rivian": "RIVN",
            "Lucid": "LCID", "NIO": "NIO", "BYD": "BYDDY",
            "Alibaba": "BABA", "Tencent": "TCEHY", "JD.com": "JD",
        }
        
        found = {}
        text_lower = text.lower()
        
        for company, symbol in COMPANY_PATTERNS.items():
            if company.lower() in text_lower:
                found[company] = symbol
        
        return found
