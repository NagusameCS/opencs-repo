"""
Technical Analysis Engine.
Comprehensive technical analysis for stock prediction.
"""

from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
from enum import Enum
import pandas as pd
import numpy as np
from loguru import logger

from src.scrapers.stock_data import TechnicalIndicators


class Signal(Enum):
    """Trading signal types."""
    STRONG_BUY = "strong_buy"
    BUY = "buy"
    HOLD = "hold"
    SELL = "sell"
    STRONG_SELL = "strong_sell"


@dataclass
class TechnicalSignal:
    """Individual technical indicator signal."""
    indicator: str
    value: float
    signal: Signal
    strength: float  # 0-1
    description: str


@dataclass
class TechnicalAnalysisResult:
    """Comprehensive technical analysis result."""
    
    symbol: str
    timestamp: str
    
    # Current price info
    current_price: float = 0.0
    price_change_1d: float = 0.0
    price_change_5d: float = 0.0
    price_change_1m: float = 0.0
    
    # Individual signals
    signals: List[TechnicalSignal] = field(default_factory=list)
    
    # Aggregate scores (0-100)
    trend_score: float = 50.0
    momentum_score: float = 50.0
    volatility_score: float = 50.0
    volume_score: float = 50.0
    
    # Overall assessment
    overall_score: float = 50.0
    overall_signal: Signal = Signal.HOLD
    confidence: float = 0.5
    
    # Support/Resistance
    support_levels: List[float] = field(default_factory=list)
    resistance_levels: List[float] = field(default_factory=list)
    
    # Key levels
    pivot_point: float = 0.0
    
    # Pattern detection
    patterns_detected: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "symbol": self.symbol,
            "current_price": self.current_price,
            "price_change_1d": self.price_change_1d,
            "trend_score": self.trend_score,
            "momentum_score": self.momentum_score,
            "volatility_score": self.volatility_score,
            "volume_score": self.volume_score,
            "overall_score": self.overall_score,
            "overall_signal": self.overall_signal.value,
            "confidence": self.confidence,
            "support_levels": self.support_levels,
            "resistance_levels": self.resistance_levels,
            "patterns_detected": self.patterns_detected,
            "signals": [
                {"indicator": s.indicator, "signal": s.signal.value, "strength": s.strength}
                for s in self.signals
            ]
        }


class TechnicalAnalyzer:
    """
    Comprehensive technical analysis engine.
    
    Analyzes:
    - Trend indicators (Moving Averages, MACD)
    - Momentum indicators (RSI, Stochastic)
    - Volatility indicators (Bollinger Bands, ATR)
    - Volume indicators (OBV, Volume trends)
    - Support/Resistance levels
    - Chart patterns
    """
    
    def __init__(self):
        self.indicators = TechnicalIndicators()
    
    def analyze(self, df: pd.DataFrame, symbol: str) -> TechnicalAnalysisResult:
        """
        Perform comprehensive technical analysis on stock data.
        
        Args:
            df: DataFrame with OHLCV data
            symbol: Stock symbol
        
        Returns:
            TechnicalAnalysisResult
        """
        if df.empty or len(df) < 20:
            logger.warning(f"Insufficient data for technical analysis of {symbol}")
            return TechnicalAnalysisResult(symbol=symbol, timestamp="")
        
        # Calculate indicators
        df = self.indicators.calculate_all_indicators(df)
        
        result = TechnicalAnalysisResult(
            symbol=symbol,
            timestamp=str(df.index[-1]) if hasattr(df.index[-1], 'isoformat') else str(df.index[-1])
        )
        
        # Get current values
        close_col = "Close" if "Close" in df.columns else "close"
        result.current_price = float(df[close_col].iloc[-1])
        
        # Price changes
        if len(df) >= 2:
            result.price_change_1d = ((df[close_col].iloc[-1] / df[close_col].iloc[-2]) - 1) * 100
        if len(df) >= 5:
            result.price_change_5d = ((df[close_col].iloc[-1] / df[close_col].iloc[-5]) - 1) * 100
        if len(df) >= 20:
            result.price_change_1m = ((df[close_col].iloc[-1] / df[close_col].iloc[-20]) - 1) * 100
        
        # Analyze each category
        trend_signals = self._analyze_trend(df, result.current_price)
        momentum_signals = self._analyze_momentum(df)
        volatility_signals = self._analyze_volatility(df, result.current_price)
        volume_signals = self._analyze_volume(df)
        
        # Collect all signals
        result.signals = trend_signals + momentum_signals + volatility_signals + volume_signals
        
        # Calculate category scores
        result.trend_score = self._calculate_category_score(trend_signals)
        result.momentum_score = self._calculate_category_score(momentum_signals)
        result.volatility_score = self._calculate_category_score(volatility_signals)
        result.volume_score = self._calculate_category_score(volume_signals)
        
        # Calculate overall score (weighted average)
        result.overall_score = (
            result.trend_score * 0.35 +
            result.momentum_score * 0.30 +
            result.volatility_score * 0.20 +
            result.volume_score * 0.15
        )
        
        # Determine overall signal
        result.overall_signal = self._score_to_signal(result.overall_score)
        
        # Calculate confidence based on signal agreement
        result.confidence = self._calculate_confidence(result.signals)
        
        # Find support/resistance
        result.support_levels, result.resistance_levels = self._find_support_resistance(df)
        
        # Calculate pivot point
        high_col = "High" if "High" in df.columns else "high"
        low_col = "Low" if "Low" in df.columns else "low"
        result.pivot_point = (df[high_col].iloc[-1] + df[low_col].iloc[-1] + df[close_col].iloc[-1]) / 3
        
        # Detect patterns
        result.patterns_detected = self._detect_patterns(df)
        
        return result
    
    def _analyze_trend(self, df: pd.DataFrame, current_price: float) -> List[TechnicalSignal]:
        """Analyze trend indicators."""
        signals = []
        
        # SMA 20
        if "sma_20" in df.columns and not pd.isna(df["sma_20"].iloc[-1]):
            sma_20 = df["sma_20"].iloc[-1]
            if current_price > sma_20 * 1.02:
                signals.append(TechnicalSignal(
                    indicator="SMA 20",
                    value=sma_20,
                    signal=Signal.BUY,
                    strength=0.7,
                    description=f"Price above SMA 20 ({sma_20:.2f})"
                ))
            elif current_price < sma_20 * 0.98:
                signals.append(TechnicalSignal(
                    indicator="SMA 20",
                    value=sma_20,
                    signal=Signal.SELL,
                    strength=0.7,
                    description=f"Price below SMA 20 ({sma_20:.2f})"
                ))
            else:
                signals.append(TechnicalSignal(
                    indicator="SMA 20",
                    value=sma_20,
                    signal=Signal.HOLD,
                    strength=0.5,
                    description=f"Price near SMA 20 ({sma_20:.2f})"
                ))
        
        # SMA 50
        if "sma_50" in df.columns and not pd.isna(df["sma_50"].iloc[-1]):
            sma_50 = df["sma_50"].iloc[-1]
            if current_price > sma_50:
                signals.append(TechnicalSignal(
                    indicator="SMA 50",
                    value=sma_50,
                    signal=Signal.BUY,
                    strength=0.75,
                    description=f"Price above SMA 50 ({sma_50:.2f})"
                ))
            else:
                signals.append(TechnicalSignal(
                    indicator="SMA 50",
                    value=sma_50,
                    signal=Signal.SELL,
                    strength=0.75,
                    description=f"Price below SMA 50 ({sma_50:.2f})"
                ))
        
        # SMA 200 (Golden/Death cross detection)
        if "sma_200" in df.columns and not pd.isna(df["sma_200"].iloc[-1]):
            sma_200 = df["sma_200"].iloc[-1]
            if current_price > sma_200:
                signals.append(TechnicalSignal(
                    indicator="SMA 200",
                    value=sma_200,
                    signal=Signal.STRONG_BUY,
                    strength=0.85,
                    description=f"Price above SMA 200 - Long term bullish"
                ))
            else:
                signals.append(TechnicalSignal(
                    indicator="SMA 200",
                    value=sma_200,
                    signal=Signal.STRONG_SELL,
                    strength=0.85,
                    description=f"Price below SMA 200 - Long term bearish"
                ))
        
        # MACD
        if "macd" in df.columns and "macd_signal" in df.columns:
            if not pd.isna(df["macd"].iloc[-1]) and not pd.isna(df["macd_signal"].iloc[-1]):
                macd = df["macd"].iloc[-1]
                macd_signal = df["macd_signal"].iloc[-1]
                
                # Check for crossover
                if len(df) >= 2:
                    prev_macd = df["macd"].iloc[-2]
                    prev_signal = df["macd_signal"].iloc[-2]
                    
                    if prev_macd <= prev_signal and macd > macd_signal:
                        signals.append(TechnicalSignal(
                            indicator="MACD",
                            value=macd,
                            signal=Signal.STRONG_BUY,
                            strength=0.9,
                            description="MACD bullish crossover"
                        ))
                    elif prev_macd >= prev_signal and macd < macd_signal:
                        signals.append(TechnicalSignal(
                            indicator="MACD",
                            value=macd,
                            signal=Signal.STRONG_SELL,
                            strength=0.9,
                            description="MACD bearish crossover"
                        ))
                    elif macd > macd_signal:
                        signals.append(TechnicalSignal(
                            indicator="MACD",
                            value=macd,
                            signal=Signal.BUY,
                            strength=0.7,
                            description="MACD above signal line"
                        ))
                    else:
                        signals.append(TechnicalSignal(
                            indicator="MACD",
                            value=macd,
                            signal=Signal.SELL,
                            strength=0.7,
                            description="MACD below signal line"
                        ))
        
        return signals
    
    def _analyze_momentum(self, df: pd.DataFrame) -> List[TechnicalSignal]:
        """Analyze momentum indicators."""
        signals = []
        
        # RSI
        if "rsi_14" in df.columns and not pd.isna(df["rsi_14"].iloc[-1]):
            rsi = df["rsi_14"].iloc[-1]
            
            if rsi < 30:
                signals.append(TechnicalSignal(
                    indicator="RSI",
                    value=rsi,
                    signal=Signal.STRONG_BUY,
                    strength=0.85,
                    description=f"RSI oversold ({rsi:.1f})"
                ))
            elif rsi < 40:
                signals.append(TechnicalSignal(
                    indicator="RSI",
                    value=rsi,
                    signal=Signal.BUY,
                    strength=0.65,
                    description=f"RSI approaching oversold ({rsi:.1f})"
                ))
            elif rsi > 70:
                signals.append(TechnicalSignal(
                    indicator="RSI",
                    value=rsi,
                    signal=Signal.STRONG_SELL,
                    strength=0.85,
                    description=f"RSI overbought ({rsi:.1f})"
                ))
            elif rsi > 60:
                signals.append(TechnicalSignal(
                    indicator="RSI",
                    value=rsi,
                    signal=Signal.SELL,
                    strength=0.65,
                    description=f"RSI approaching overbought ({rsi:.1f})"
                ))
            else:
                signals.append(TechnicalSignal(
                    indicator="RSI",
                    value=rsi,
                    signal=Signal.HOLD,
                    strength=0.5,
                    description=f"RSI neutral ({rsi:.1f})"
                ))
        
        # Stochastic
        if "stoch_k" in df.columns and "stoch_d" in df.columns:
            if not pd.isna(df["stoch_k"].iloc[-1]):
                stoch_k = df["stoch_k"].iloc[-1]
                stoch_d = df["stoch_d"].iloc[-1]
                
                if stoch_k < 20:
                    signals.append(TechnicalSignal(
                        indicator="Stochastic",
                        value=stoch_k,
                        signal=Signal.STRONG_BUY,
                        strength=0.8,
                        description=f"Stochastic oversold (%K: {stoch_k:.1f})"
                    ))
                elif stoch_k > 80:
                    signals.append(TechnicalSignal(
                        indicator="Stochastic",
                        value=stoch_k,
                        signal=Signal.STRONG_SELL,
                        strength=0.8,
                        description=f"Stochastic overbought (%K: {stoch_k:.1f})"
                    ))
                elif stoch_k > stoch_d:
                    signals.append(TechnicalSignal(
                        indicator="Stochastic",
                        value=stoch_k,
                        signal=Signal.BUY,
                        strength=0.6,
                        description=f"Stochastic bullish (%K above %D)"
                    ))
                else:
                    signals.append(TechnicalSignal(
                        indicator="Stochastic",
                        value=stoch_k,
                        signal=Signal.SELL,
                        strength=0.6,
                        description=f"Stochastic bearish (%K below %D)"
                    ))
        
        return signals
    
    def _analyze_volatility(self, df: pd.DataFrame, current_price: float) -> List[TechnicalSignal]:
        """Analyze volatility indicators."""
        signals = []
        
        # Bollinger Bands
        if "bb_upper" in df.columns and "bb_lower" in df.columns:
            bb_upper = df["bb_upper"].iloc[-1]
            bb_lower = df["bb_lower"].iloc[-1]
            bb_middle = df["bb_middle"].iloc[-1]
            
            if not pd.isna(bb_upper):
                bb_width = (bb_upper - bb_lower) / bb_middle
                
                if current_price <= bb_lower:
                    signals.append(TechnicalSignal(
                        indicator="Bollinger Bands",
                        value=current_price,
                        signal=Signal.STRONG_BUY,
                        strength=0.85,
                        description="Price at lower Bollinger Band - Oversold"
                    ))
                elif current_price >= bb_upper:
                    signals.append(TechnicalSignal(
                        indicator="Bollinger Bands",
                        value=current_price,
                        signal=Signal.STRONG_SELL,
                        strength=0.85,
                        description="Price at upper Bollinger Band - Overbought"
                    ))
                elif current_price < bb_middle:
                    signals.append(TechnicalSignal(
                        indicator="Bollinger Bands",
                        value=current_price,
                        signal=Signal.BUY,
                        strength=0.55,
                        description="Price below middle band"
                    ))
                else:
                    signals.append(TechnicalSignal(
                        indicator="Bollinger Bands",
                        value=current_price,
                        signal=Signal.SELL,
                        strength=0.55,
                        description="Price above middle band"
                    ))
        
        # ATR (volatility measure, not directional)
        if "atr_14" in df.columns and not pd.isna(df["atr_14"].iloc[-1]):
            atr = df["atr_14"].iloc[-1]
            atr_percent = (atr / current_price) * 100
            
            # High volatility = higher risk
            if atr_percent > 5:
                signals.append(TechnicalSignal(
                    indicator="ATR",
                    value=atr,
                    signal=Signal.HOLD,
                    strength=0.4,
                    description=f"High volatility (ATR: {atr_percent:.1f}%)"
                ))
            else:
                signals.append(TechnicalSignal(
                    indicator="ATR",
                    value=atr,
                    signal=Signal.HOLD,
                    strength=0.6,
                    description=f"Normal volatility (ATR: {atr_percent:.1f}%)"
                ))
        
        return signals
    
    def _analyze_volume(self, df: pd.DataFrame) -> List[TechnicalSignal]:
        """Analyze volume indicators."""
        signals = []
        
        vol_col = "Volume" if "Volume" in df.columns else "volume"
        
        if vol_col in df.columns and len(df) >= 20:
            current_vol = df[vol_col].iloc[-1]
            avg_vol = df[vol_col].iloc[-20:].mean()
            
            if current_vol > avg_vol * 1.5:
                # High volume - confirm trend
                close_col = "Close" if "Close" in df.columns else "close"
                if df[close_col].iloc[-1] > df[close_col].iloc[-2]:
                    signals.append(TechnicalSignal(
                        indicator="Volume",
                        value=current_vol,
                        signal=Signal.STRONG_BUY,
                        strength=0.75,
                        description="High volume on up day - Strong buying pressure"
                    ))
                else:
                    signals.append(TechnicalSignal(
                        indicator="Volume",
                        value=current_vol,
                        signal=Signal.STRONG_SELL,
                        strength=0.75,
                        description="High volume on down day - Strong selling pressure"
                    ))
            elif current_vol < avg_vol * 0.5:
                signals.append(TechnicalSignal(
                    indicator="Volume",
                    value=current_vol,
                    signal=Signal.HOLD,
                    strength=0.4,
                    description="Low volume - Weak conviction"
                ))
        
        # OBV trend
        if "obv" in df.columns and len(df) >= 5:
            obv_trend = df["obv"].iloc[-1] - df["obv"].iloc[-5]
            if obv_trend > 0:
                signals.append(TechnicalSignal(
                    indicator="OBV",
                    value=df["obv"].iloc[-1],
                    signal=Signal.BUY,
                    strength=0.6,
                    description="OBV trending up - Accumulation"
                ))
            else:
                signals.append(TechnicalSignal(
                    indicator="OBV",
                    value=df["obv"].iloc[-1],
                    signal=Signal.SELL,
                    strength=0.6,
                    description="OBV trending down - Distribution"
                ))
        
        return signals
    
    def _calculate_category_score(self, signals: List[TechnicalSignal]) -> float:
        """Calculate score for a category of signals (0-100)."""
        if not signals:
            return 50.0
        
        signal_values = {
            Signal.STRONG_BUY: 100,
            Signal.BUY: 75,
            Signal.HOLD: 50,
            Signal.SELL: 25,
            Signal.STRONG_SELL: 0
        }
        
        weighted_sum = sum(signal_values[s.signal] * s.strength for s in signals)
        total_weight = sum(s.strength for s in signals)
        
        return weighted_sum / total_weight if total_weight > 0 else 50.0
    
    def _score_to_signal(self, score: float) -> Signal:
        """Convert numeric score to signal."""
        if score >= 80:
            return Signal.STRONG_BUY
        elif score >= 60:
            return Signal.BUY
        elif score >= 40:
            return Signal.HOLD
        elif score >= 20:
            return Signal.SELL
        else:
            return Signal.STRONG_SELL
    
    def _calculate_confidence(self, signals: List[TechnicalSignal]) -> float:
        """Calculate confidence based on signal agreement."""
        if not signals:
            return 0.5
        
        buy_signals = sum(1 for s in signals if s.signal in [Signal.BUY, Signal.STRONG_BUY])
        sell_signals = sum(1 for s in signals if s.signal in [Signal.SELL, Signal.STRONG_SELL])
        total = len(signals)
        
        # Higher agreement = higher confidence
        max_agreement = max(buy_signals, sell_signals)
        agreement_ratio = max_agreement / total
        
        return min(0.95, 0.4 + agreement_ratio * 0.5)
    
    def _find_support_resistance(
        self, 
        df: pd.DataFrame, 
        num_levels: int = 3
    ) -> Tuple[List[float], List[float]]:
        """Find support and resistance levels."""
        high_col = "High" if "High" in df.columns else "high"
        low_col = "Low" if "Low" in df.columns else "low"
        close_col = "Close" if "Close" in df.columns else "close"
        
        current_price = df[close_col].iloc[-1]
        
        # Find local minima (support) and maxima (resistance)
        window = 5
        
        # Recent highs and lows
        recent_highs = df[high_col].iloc[-50:].nlargest(num_levels * 2).values
        recent_lows = df[low_col].iloc[-50:].nsmallest(num_levels * 2).values
        
        # Filter for levels above/below current price
        resistance = sorted([h for h in recent_highs if h > current_price])[:num_levels]
        support = sorted([l for l in recent_lows if l < current_price], reverse=True)[:num_levels]
        
        return [float(s) for s in support], [float(r) for r in resistance]
    
    def _detect_patterns(self, df: pd.DataFrame) -> List[str]:
        """Detect common chart patterns."""
        patterns = []
        close_col = "Close" if "Close" in df.columns else "close"
        
        if len(df) < 10:
            return patterns
        
        prices = df[close_col].iloc[-20:].values
        
        # Simple pattern detection
        
        # Uptrend
        if all(prices[i] <= prices[i+1] for i in range(len(prices)-5, len(prices)-1)):
            patterns.append("Short-term uptrend")
        
        # Downtrend
        if all(prices[i] >= prices[i+1] for i in range(len(prices)-5, len(prices)-1)):
            patterns.append("Short-term downtrend")
        
        # Higher highs
        recent_highs = [max(prices[i:i+3]) for i in range(0, len(prices)-3, 3)]
        if len(recent_highs) >= 3 and all(recent_highs[i] < recent_highs[i+1] for i in range(len(recent_highs)-1)):
            patterns.append("Higher highs pattern")
        
        # Lower lows
        recent_lows = [min(prices[i:i+3]) for i in range(0, len(prices)-3, 3)]
        if len(recent_lows) >= 3 and all(recent_lows[i] > recent_lows[i+1] for i in range(len(recent_lows)-1)):
            patterns.append("Lower lows pattern")
        
        # Consolidation
        if len(prices) >= 10:
            price_range = (max(prices[-10:]) - min(prices[-10:])) / prices[-1]
            if price_range < 0.03:
                patterns.append("Consolidation/Range-bound")
        
        return patterns
