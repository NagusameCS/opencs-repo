"""
Backtesting Framework.
Tests predictions against historical data to validate and improve the model.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
import statistics

import pandas as pd
import numpy as np
from loguru import logger

from src.scrapers import StockDataFetcher, TechnicalIndicators
from src.analysis import TechnicalAnalyzer, SentimentAnalyzer


@dataclass
class BacktestTrade:
    """Single trade in backtesting."""
    
    symbol: str
    entry_date: datetime
    entry_price: float
    exit_date: datetime = None
    exit_price: float = None
    
    action: str = "buy"  # buy or sell (short)
    target_price: float = 0.0
    stop_loss: float = 0.0
    
    # Outcome
    return_percent: float = 0.0
    profit_loss: float = 0.0
    hit_target: bool = False
    hit_stop_loss: bool = False
    
    # Prediction data at entry
    confidence: float = 0.0
    technical_score: float = 0.0
    
    @property
    def is_profitable(self) -> bool:
        return self.return_percent > 0
    
    @property
    def holding_days(self) -> int:
        if self.exit_date and self.entry_date:
            return (self.exit_date - self.entry_date).days
        return 0


@dataclass
class BacktestResult:
    """Results from a backtest run."""
    
    # Parameters
    start_date: datetime = None
    end_date: datetime = None
    symbols_tested: List[str] = field(default_factory=list)
    initial_capital: float = 100000.0
    
    # Trades
    trades: List[BacktestTrade] = field(default_factory=list)
    
    # Performance Metrics
    total_return_percent: float = 0.0
    annualized_return_percent: float = 0.0
    win_rate: float = 0.0
    average_return: float = 0.0
    average_win: float = 0.0
    average_loss: float = 0.0
    
    # Risk Metrics
    max_drawdown_percent: float = 0.0
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    profit_factor: float = 0.0
    
    # Trade Statistics
    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    
    # Best/Worst
    best_trade: Optional[BacktestTrade] = None
    worst_trade: Optional[BacktestTrade] = None
    
    # By Symbol
    performance_by_symbol: Dict[str, Dict[str, float]] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "symbols_tested": self.symbols_tested,
            "initial_capital": self.initial_capital,
            "total_return_percent": self.total_return_percent,
            "annualized_return_percent": self.annualized_return_percent,
            "win_rate": self.win_rate,
            "average_return": self.average_return,
            "max_drawdown_percent": self.max_drawdown_percent,
            "sharpe_ratio": self.sharpe_ratio,
            "total_trades": self.total_trades,
            "winning_trades": self.winning_trades,
            "losing_trades": self.losing_trades,
            "profit_factor": self.profit_factor,
        }
    
    def summary(self) -> str:
        """Human-readable summary."""
        lines = [
            "=" * 50,
            "BACKTEST RESULTS",
            "=" * 50,
            f"Period: {self.start_date.date()} to {self.end_date.date()}",
            f"Symbols: {len(self.symbols_tested)}",
            f"Initial Capital: ${self.initial_capital:,.2f}",
            "",
            "PERFORMANCE",
            "-" * 30,
            f"Total Return: {self.total_return_percent:+.2f}%",
            f"Annualized Return: {self.annualized_return_percent:+.2f}%",
            f"Win Rate: {self.win_rate:.1f}%",
            f"Average Return per Trade: {self.average_return:+.2f}%",
            "",
            "RISK METRICS",
            "-" * 30,
            f"Max Drawdown: {self.max_drawdown_percent:.2f}%",
            f"Sharpe Ratio: {self.sharpe_ratio:.2f}",
            f"Profit Factor: {self.profit_factor:.2f}",
            "",
            "TRADES",
            "-" * 30,
            f"Total Trades: {self.total_trades}",
            f"Winning: {self.winning_trades} | Losing: {self.losing_trades}",
            f"Avg Win: {self.average_win:+.2f}% | Avg Loss: {self.average_loss:.2f}%",
            "=" * 50,
        ]
        return "\n".join(lines)


class Backtester:
    """
    Backtesting engine for validating prediction strategies.
    
    Features:
    - Historical simulation of trades
    - Performance metrics calculation
    - Strategy optimization
    - Walk-forward analysis
    """
    
    def __init__(self):
        self.stock_fetcher = StockDataFetcher()
        self.technical_analyzer = TechnicalAnalyzer()
        self.indicators = TechnicalIndicators()
    
    async def run_backtest(
        self,
        symbols: List[str],
        start_date: datetime,
        end_date: datetime = None,
        initial_capital: float = 100000.0,
        position_size_percent: float = 10.0,
        strategy: str = "technical"
    ) -> BacktestResult:
        """
        Run a backtest on historical data.
        
        Args:
            symbols: List of symbols to test
            start_date: Backtest start date
            end_date: Backtest end date (default: today)
            initial_capital: Starting capital
            position_size_percent: Percentage of capital per trade
            strategy: Strategy to test (technical, momentum, etc.)
        
        Returns:
            BacktestResult with performance metrics
        """
        end_date = end_date or datetime.now()
        
        result = BacktestResult(
            start_date=start_date,
            end_date=end_date,
            symbols_tested=symbols,
            initial_capital=initial_capital
        )
        
        all_trades = []
        
        for symbol in symbols:
            try:
                trades = await self._backtest_symbol(
                    symbol, start_date, end_date, 
                    initial_capital * position_size_percent / 100,
                    strategy
                )
                all_trades.extend(trades)
            except Exception as e:
                logger.error(f"Error backtesting {symbol}: {e}")
        
        if not all_trades:
            logger.warning("No trades generated in backtest")
            return result
        
        result.trades = all_trades
        self._calculate_metrics(result)
        
        return result
    
    async def _backtest_symbol(
        self,
        symbol: str,
        start_date: datetime,
        end_date: datetime,
        position_size: float,
        strategy: str
    ) -> List[BacktestTrade]:
        """Backtest a single symbol."""
        
        # Get historical data
        df = await self.stock_fetcher.get_historical_data(symbol, start_date, end_date)
        
        if df is None or len(df) < 50:
            logger.warning(f"Insufficient data for {symbol}")
            return []
        
        # Calculate indicators
        df = self.indicators.calculate_all_indicators(df)
        
        trades = []
        in_position = False
        current_trade = None
        
        close_col = "Close" if "Close" in df.columns else "close"
        
        for i in range(50, len(df)):  # Start after enough data for indicators
            date = df.index[i]
            price = df[close_col].iloc[i]
            
            if not in_position:
                # Check for entry signal
                signal, confidence = self._get_signal(df.iloc[:i+1], strategy)
                
                if signal == "buy" and confidence > 0.6:
                    # Enter long position
                    current_trade = BacktestTrade(
                        symbol=symbol,
                        entry_date=date.to_pydatetime() if hasattr(date, 'to_pydatetime') else date,
                        entry_price=price,
                        action="buy",
                        confidence=confidence,
                        technical_score=confidence
                    )
                    
                    # Set targets
                    atr = df["atr_14"].iloc[i] if "atr_14" in df.columns else price * 0.02
                    current_trade.target_price = price + (atr * 2)  # 2 ATR profit target
                    current_trade.stop_loss = price - (atr * 1.5)   # 1.5 ATR stop loss
                    
                    in_position = True
                    
            else:
                # Check exit conditions
                should_exit = False
                exit_reason = ""
                
                # Hit target
                if price >= current_trade.target_price:
                    should_exit = True
                    exit_reason = "target"
                    current_trade.hit_target = True
                
                # Hit stop loss
                elif price <= current_trade.stop_loss:
                    should_exit = True
                    exit_reason = "stop_loss"
                    current_trade.hit_stop_loss = True
                
                # Exit signal
                signal, _ = self._get_signal(df.iloc[:i+1], strategy)
                if signal == "sell":
                    should_exit = True
                    exit_reason = "signal"
                
                # Max holding period (30 days)
                holding_days = (date - current_trade.entry_date).days if hasattr(date, 'day') else i
                if holding_days > 30:
                    should_exit = True
                    exit_reason = "timeout"
                
                if should_exit:
                    current_trade.exit_date = date.to_pydatetime() if hasattr(date, 'to_pydatetime') else date
                    current_trade.exit_price = price
                    current_trade.return_percent = (
                        (price - current_trade.entry_price) / current_trade.entry_price * 100
                    )
                    current_trade.profit_loss = position_size * current_trade.return_percent / 100
                    
                    trades.append(current_trade)
                    current_trade = None
                    in_position = False
        
        return trades
    
    def _get_signal(
        self,
        df: pd.DataFrame,
        strategy: str
    ) -> Tuple[str, float]:
        """
        Get trading signal based on strategy.
        
        Returns: (signal, confidence)
        """
        close_col = "Close" if "Close" in df.columns else "close"
        current_price = df[close_col].iloc[-1]
        
        if strategy == "technical":
            return self._technical_strategy_signal(df, current_price)
        elif strategy == "momentum":
            return self._momentum_strategy_signal(df)
        elif strategy == "mean_reversion":
            return self._mean_reversion_signal(df, current_price)
        else:
            return "hold", 0.5
    
    def _technical_strategy_signal(
        self,
        df: pd.DataFrame,
        current_price: float
    ) -> Tuple[str, float]:
        """Combined technical indicators strategy."""
        signals = []
        
        # RSI
        if "rsi_14" in df.columns:
            rsi = df["rsi_14"].iloc[-1]
            if not pd.isna(rsi):
                if rsi < 30:
                    signals.append(("buy", 0.8))
                elif rsi > 70:
                    signals.append(("sell", 0.8))
                else:
                    signals.append(("hold", 0.5))
        
        # MACD
        if "macd" in df.columns and "macd_signal" in df.columns:
            macd = df["macd"].iloc[-1]
            macd_signal = df["macd_signal"].iloc[-1]
            if not pd.isna(macd) and not pd.isna(macd_signal):
                if macd > macd_signal:
                    signals.append(("buy", 0.7))
                else:
                    signals.append(("sell", 0.7))
        
        # Moving Average
        if "sma_20" in df.columns and "sma_50" in df.columns:
            sma_20 = df["sma_20"].iloc[-1]
            sma_50 = df["sma_50"].iloc[-1]
            if not pd.isna(sma_20) and not pd.isna(sma_50):
                if current_price > sma_20 > sma_50:
                    signals.append(("buy", 0.75))
                elif current_price < sma_20 < sma_50:
                    signals.append(("sell", 0.75))
        
        # Aggregate signals
        if not signals:
            return "hold", 0.5
        
        buy_count = sum(1 for s, _ in signals if s == "buy")
        sell_count = sum(1 for s, _ in signals if s == "sell")
        
        if buy_count > sell_count:
            avg_conf = statistics.mean([c for s, c in signals if s == "buy"])
            return "buy", avg_conf
        elif sell_count > buy_count:
            avg_conf = statistics.mean([c for s, c in signals if s == "sell"])
            return "sell", avg_conf
        else:
            return "hold", 0.5
    
    def _momentum_strategy_signal(self, df: pd.DataFrame) -> Tuple[str, float]:
        """Momentum-based strategy."""
        close_col = "Close" if "Close" in df.columns else "close"
        
        if len(df) < 20:
            return "hold", 0.5
        
        # Calculate momentum (rate of change)
        roc_10 = (df[close_col].iloc[-1] / df[close_col].iloc[-10] - 1) * 100
        roc_20 = (df[close_col].iloc[-1] / df[close_col].iloc[-20] - 1) * 100
        
        # Strong upward momentum
        if roc_10 > 5 and roc_20 > 10:
            return "buy", 0.8
        # Strong downward momentum
        elif roc_10 < -5 and roc_20 < -10:
            return "sell", 0.8
        # Moderate momentum
        elif roc_10 > 2:
            return "buy", 0.6
        elif roc_10 < -2:
            return "sell", 0.6
        else:
            return "hold", 0.5
    
    def _mean_reversion_signal(
        self,
        df: pd.DataFrame,
        current_price: float
    ) -> Tuple[str, float]:
        """Mean reversion strategy using Bollinger Bands."""
        if "bb_lower" not in df.columns or "bb_upper" not in df.columns:
            return "hold", 0.5
        
        bb_lower = df["bb_lower"].iloc[-1]
        bb_upper = df["bb_upper"].iloc[-1]
        bb_middle = df["bb_middle"].iloc[-1]
        
        if pd.isna(bb_lower):
            return "hold", 0.5
        
        # Price at lower band - buy signal (expect reversion to mean)
        if current_price <= bb_lower:
            return "buy", 0.85
        # Price at upper band - sell signal
        elif current_price >= bb_upper:
            return "sell", 0.85
        # Price below middle - mild buy
        elif current_price < bb_middle:
            return "buy", 0.55
        else:
            return "hold", 0.5
    
    def _calculate_metrics(self, result: BacktestResult):
        """Calculate all performance metrics."""
        trades = result.trades
        
        if not trades:
            return
        
        result.total_trades = len(trades)
        result.winning_trades = sum(1 for t in trades if t.is_profitable)
        result.losing_trades = result.total_trades - result.winning_trades
        
        # Win rate
        result.win_rate = (result.winning_trades / result.total_trades) * 100
        
        # Returns
        returns = [t.return_percent for t in trades]
        result.average_return = statistics.mean(returns)
        
        winning_returns = [t.return_percent for t in trades if t.is_profitable]
        losing_returns = [t.return_percent for t in trades if not t.is_profitable]
        
        result.average_win = statistics.mean(winning_returns) if winning_returns else 0
        result.average_loss = statistics.mean(losing_returns) if losing_returns else 0
        
        # Total return
        result.total_return_percent = sum(returns)
        
        # Annualized return
        if result.start_date and result.end_date:
            years = (result.end_date - result.start_date).days / 365
            if years > 0:
                result.annualized_return_percent = (
                    (1 + result.total_return_percent / 100) ** (1 / years) - 1
                ) * 100
        
        # Profit factor
        gross_profit = sum(t.profit_loss for t in trades if t.is_profitable)
        gross_loss = abs(sum(t.profit_loss for t in trades if not t.is_profitable))
        result.profit_factor = gross_profit / gross_loss if gross_loss > 0 else float('inf')
        
        # Sharpe Ratio (simplified)
        if len(returns) > 1:
            return_std = statistics.stdev(returns)
            if return_std > 0:
                result.sharpe_ratio = result.average_return / return_std * np.sqrt(252)
        
        # Max drawdown
        cumulative = []
        total = 0
        for r in returns:
            total += r
            cumulative.append(total)
        
        peak = cumulative[0]
        max_dd = 0
        for value in cumulative:
            if value > peak:
                peak = value
            dd = peak - value
            if dd > max_dd:
                max_dd = dd
        result.max_drawdown_percent = max_dd
        
        # Best/worst trades
        result.best_trade = max(trades, key=lambda t: t.return_percent)
        result.worst_trade = min(trades, key=lambda t: t.return_percent)
        
        # Performance by symbol
        symbol_returns = {}
        for trade in trades:
            if trade.symbol not in symbol_returns:
                symbol_returns[trade.symbol] = []
            symbol_returns[trade.symbol].append(trade.return_percent)
        
        for symbol, rets in symbol_returns.items():
            result.performance_by_symbol[symbol] = {
                "trades": len(rets),
                "avg_return": statistics.mean(rets),
                "win_rate": sum(1 for r in rets if r > 0) / len(rets) * 100,
                "total_return": sum(rets)
            }


async def run_quick_backtest(
    symbols: List[str] = None,
    days: int = 365
) -> BacktestResult:
    """
    Quick backtest utility function.
    
    Args:
        symbols: List of symbols (default: top tech stocks)
        days: Number of days to backtest
    
    Returns:
        BacktestResult
    """
    if symbols is None:
        symbols = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA"]
    
    backtester = Backtester()
    
    result = await backtester.run_backtest(
        symbols=symbols,
        start_date=datetime.now() - timedelta(days=days),
        end_date=datetime.now(),
        initial_capital=100000,
        strategy="technical"
    )
    
    print(result.summary())
    return result
