"""
Stock market data scrapers and API integrations.
"""

from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
import asyncio

import yfinance as yf
import pandas as pd
from loguru import logger

from src.config import settings


class StockDataFetcher:
    """Fetch stock data from multiple sources."""
    
    def __init__(self):
        self.cache: Dict[str, Any] = {}
        self.cache_ttl = 300  # 5 minutes
    
    async def get_stock_data(
        self, 
        symbol: str, 
        period: str = "1mo",
        interval: str = "1d"
    ) -> Optional[pd.DataFrame]:
        """
        Fetch stock data for a symbol.
        
        Args:
            symbol: Stock symbol (e.g., AAPL)
            period: Data period (1d, 5d, 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, ytd, max)
            interval: Data interval (1m, 2m, 5m, 15m, 30m, 60m, 90m, 1h, 1d, 5d, 1wk, 1mo, 3mo)
        
        Returns:
            DataFrame with OHLCV data
        """
        cache_key = f"{symbol}_{period}_{interval}"
        
        # Check cache
        if cache_key in self.cache:
            cached_time, cached_data = self.cache[cache_key]
            if (datetime.now() - cached_time).seconds < self.cache_ttl:
                return cached_data
        
        try:
            # Use yfinance (runs sync, so we run in executor)
            loop = asyncio.get_event_loop()
            df = await loop.run_in_executor(
                None, 
                lambda: yf.download(symbol, period=period, interval=interval, progress=False)
            )
            
            if df.empty:
                logger.warning(f"No data returned for {symbol}")
                return None
            
            # Cache result
            self.cache[cache_key] = (datetime.now(), df)
            
            return df
        except Exception as e:
            logger.error(f"Error fetching stock data for {symbol}: {e}")
            return None
    
    async def get_realtime_quote(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get real-time quote for a symbol."""
        try:
            loop = asyncio.get_event_loop()
            ticker = await loop.run_in_executor(None, lambda: yf.Ticker(symbol))
            info = await loop.run_in_executor(None, lambda: ticker.info)
            
            return {
                "symbol": symbol,
                "price": info.get("currentPrice") or info.get("regularMarketPrice"),
                "previous_close": info.get("previousClose"),
                "open": info.get("open") or info.get("regularMarketOpen"),
                "day_high": info.get("dayHigh") or info.get("regularMarketDayHigh"),
                "day_low": info.get("dayLow") or info.get("regularMarketDayLow"),
                "volume": info.get("volume") or info.get("regularMarketVolume"),
                "market_cap": info.get("marketCap"),
                "pe_ratio": info.get("trailingPE"),
                "forward_pe": info.get("forwardPE"),
                "dividend_yield": info.get("dividendYield"),
                "52_week_high": info.get("fiftyTwoWeekHigh"),
                "52_week_low": info.get("fiftyTwoWeekLow"),
                "50_day_avg": info.get("fiftyDayAverage"),
                "200_day_avg": info.get("twoHundredDayAverage"),
                "beta": info.get("beta"),
                "timestamp": datetime.now().isoformat(),
            }
        except Exception as e:
            logger.error(f"Error fetching quote for {symbol}: {e}")
            return None
    
    async def get_company_info(self, symbol: str) -> Optional[Dict[str, Any]]:
        """Get company profile information."""
        try:
            loop = asyncio.get_event_loop()
            ticker = await loop.run_in_executor(None, lambda: yf.Ticker(symbol))
            info = await loop.run_in_executor(None, lambda: ticker.info)
            
            return {
                "symbol": symbol,
                "name": info.get("longName") or info.get("shortName"),
                "sector": info.get("sector"),
                "industry": info.get("industry"),
                "country": info.get("country"),
                "exchange": info.get("exchange"),
                "currency": info.get("currency"),
                "website": info.get("website"),
                "description": info.get("longBusinessSummary"),
                "employees": info.get("fullTimeEmployees"),
                "market_cap": info.get("marketCap"),
                "revenue": info.get("totalRevenue"),
                "gross_profit": info.get("grossProfits"),
                "net_income": info.get("netIncomeToCommon"),
                "total_debt": info.get("totalDebt"),
                "total_cash": info.get("totalCash"),
                "free_cash_flow": info.get("freeCashflow"),
                "operating_margin": info.get("operatingMargins"),
                "profit_margin": info.get("profitMargins"),
                "return_on_equity": info.get("returnOnEquity"),
                "return_on_assets": info.get("returnOnAssets"),
            }
        except Exception as e:
            logger.error(f"Error fetching company info for {symbol}: {e}")
            return None
    
    async def get_historical_data(
        self,
        symbol: str,
        start_date: datetime,
        end_date: datetime = None
    ) -> Optional[pd.DataFrame]:
        """Get historical data between dates."""
        if end_date is None:
            end_date = datetime.now()
        
        try:
            loop = asyncio.get_event_loop()
            df = await loop.run_in_executor(
                None,
                lambda: yf.download(
                    symbol,
                    start=start_date.strftime("%Y-%m-%d"),
                    end=end_date.strftime("%Y-%m-%d"),
                    progress=False
                )
            )
            return df if not df.empty else None
        except Exception as e:
            logger.error(f"Error fetching historical data for {symbol}: {e}")
            return None
    
    async def get_multiple_stocks(
        self,
        symbols: List[str],
        period: str = "1mo"
    ) -> Dict[str, pd.DataFrame]:
        """Fetch data for multiple stocks concurrently."""
        tasks = [self.get_stock_data(sym, period) for sym in symbols]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        data = {}
        for symbol, result in zip(symbols, results):
            if isinstance(result, pd.DataFrame) and not result.empty:
                data[symbol] = result
            elif isinstance(result, Exception):
                logger.error(f"Error fetching {symbol}: {result}")
        
        return data
    
    async def get_market_indices(self) -> Dict[str, Dict[str, Any]]:
        """Get major market indices."""
        indices = {
            "^GSPC": "S&P 500",
            "^DJI": "Dow Jones",
            "^IXIC": "NASDAQ",
            "^RUT": "Russell 2000",
            "^VIX": "VIX",
            "^TNX": "10Y Treasury",
        }
        
        results = {}
        for symbol, name in indices.items():
            quote = await self.get_realtime_quote(symbol)
            if quote:
                quote["name"] = name
                results[symbol] = quote
        
        return results
    
    async def get_sector_performance(self) -> Dict[str, Dict[str, Any]]:
        """Get sector ETF performance."""
        sector_etfs = {
            "XLK": "Technology",
            "XLF": "Financial",
            "XLV": "Healthcare",
            "XLE": "Energy",
            "XLI": "Industrial",
            "XLY": "Consumer Discretionary",
            "XLP": "Consumer Staples",
            "XLU": "Utilities",
            "XLB": "Materials",
            "XLRE": "Real Estate",
            "XLC": "Communication Services",
        }
        
        results = {}
        for symbol, name in sector_etfs.items():
            quote = await self.get_realtime_quote(symbol)
            if quote:
                quote["sector_name"] = name
                results[symbol] = quote
        
        return results


class TechnicalIndicators:
    """Calculate technical indicators for stock data."""
    
    @staticmethod
    def calculate_sma(data: pd.Series, period: int) -> pd.Series:
        """Simple Moving Average."""
        return data.rolling(window=period).mean()
    
    @staticmethod
    def calculate_ema(data: pd.Series, period: int) -> pd.Series:
        """Exponential Moving Average."""
        return data.ewm(span=period, adjust=False).mean()
    
    @staticmethod
    def calculate_rsi(data: pd.Series, period: int = 14) -> pd.Series:
        """Relative Strength Index."""
        delta = data.diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
        
        rs = gain / loss
        rsi = 100 - (100 / (1 + rs))
        return rsi
    
    @staticmethod
    def calculate_macd(
        data: pd.Series, 
        fast: int = 12, 
        slow: int = 26, 
        signal: int = 9
    ) -> Dict[str, pd.Series]:
        """MACD indicator."""
        ema_fast = data.ewm(span=fast, adjust=False).mean()
        ema_slow = data.ewm(span=slow, adjust=False).mean()
        
        macd_line = ema_fast - ema_slow
        signal_line = macd_line.ewm(span=signal, adjust=False).mean()
        histogram = macd_line - signal_line
        
        return {
            "macd": macd_line,
            "signal": signal_line,
            "histogram": histogram
        }
    
    @staticmethod
    def calculate_bollinger_bands(
        data: pd.Series, 
        period: int = 20, 
        std_dev: float = 2.0
    ) -> Dict[str, pd.Series]:
        """Bollinger Bands."""
        sma = data.rolling(window=period).mean()
        std = data.rolling(window=period).std()
        
        return {
            "upper": sma + (std * std_dev),
            "middle": sma,
            "lower": sma - (std * std_dev)
        }
    
    @staticmethod
    def calculate_atr(
        high: pd.Series, 
        low: pd.Series, 
        close: pd.Series, 
        period: int = 14
    ) -> pd.Series:
        """Average True Range."""
        tr1 = high - low
        tr2 = abs(high - close.shift())
        tr3 = abs(low - close.shift())
        
        true_range = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
        atr = true_range.rolling(window=period).mean()
        return atr
    
    @staticmethod
    def calculate_stochastic(
        high: pd.Series,
        low: pd.Series,
        close: pd.Series,
        k_period: int = 14,
        d_period: int = 3
    ) -> Dict[str, pd.Series]:
        """Stochastic Oscillator."""
        lowest_low = low.rolling(window=k_period).min()
        highest_high = high.rolling(window=k_period).max()
        
        k = 100 * (close - lowest_low) / (highest_high - lowest_low)
        d = k.rolling(window=d_period).mean()
        
        return {"k": k, "d": d}
    
    @staticmethod
    def calculate_obv(close: pd.Series, volume: pd.Series) -> pd.Series:
        """On-Balance Volume."""
        direction = close.diff().apply(lambda x: 1 if x > 0 else (-1 if x < 0 else 0))
        obv = (volume * direction).cumsum()
        return obv
    
    def calculate_all_indicators(self, df: pd.DataFrame) -> pd.DataFrame:
        """Calculate all indicators for a DataFrame with OHLCV data."""
        result = df.copy()
        
        close = df["Close"] if "Close" in df.columns else df["close"]
        high = df["High"] if "High" in df.columns else df["high"]
        low = df["Low"] if "Low" in df.columns else df["low"]
        volume = df["Volume"] if "Volume" in df.columns else df.get("volume", pd.Series())
        
        # Moving Averages
        result["sma_20"] = self.calculate_sma(close, 20)
        result["sma_50"] = self.calculate_sma(close, 50)
        result["sma_200"] = self.calculate_sma(close, 200)
        result["ema_12"] = self.calculate_ema(close, 12)
        result["ema_26"] = self.calculate_ema(close, 26)
        
        # RSI
        result["rsi_14"] = self.calculate_rsi(close, 14)
        
        # MACD
        macd = self.calculate_macd(close)
        result["macd"] = macd["macd"]
        result["macd_signal"] = macd["signal"]
        result["macd_histogram"] = macd["histogram"]
        
        # Bollinger Bands
        bb = self.calculate_bollinger_bands(close)
        result["bb_upper"] = bb["upper"]
        result["bb_middle"] = bb["middle"]
        result["bb_lower"] = bb["lower"]
        
        # ATR
        result["atr_14"] = self.calculate_atr(high, low, close, 14)
        
        # Stochastic
        stoch = self.calculate_stochastic(high, low, close)
        result["stoch_k"] = stoch["k"]
        result["stoch_d"] = stoch["d"]
        
        # OBV
        if not volume.empty:
            result["obv"] = self.calculate_obv(close, volume)
        
        return result
