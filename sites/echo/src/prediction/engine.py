"""
Prediction Engine - Core prediction system.
Combines technical analysis, sentiment, and LLM consensus to make predictions.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
import json
import statistics

from loguru import logger

from src.config import settings
from src.scrapers import StockDataFetcher, RSSNewsScraper, SymbolExtractor
from src.analysis import SentimentAnalyzer, TechnicalAnalyzer, Signal
from src.llm import LLMOrchestrator


@dataclass
class Prediction:
    """Stock prediction with full analysis."""
    
    # Identification
    id: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)
    
    # Target
    symbol: str = ""
    company_name: str = ""
    
    # Prediction
    action: str = "hold"  # buy, sell, hold
    confidence: float = 0.0
    
    # Price targets
    current_price: float = 0.0
    target_price: float = 0.0
    stop_loss: float = 0.0
    expected_return_percent: float = 0.0
    
    # Time horizon
    time_horizon_days: int = 30
    expiry_date: datetime = None
    
    # Component scores (0-1)
    technical_score: float = 0.5
    sentiment_score: float = 0.5
    llm_consensus_score: float = 0.5
    
    # Detailed analysis
    technical_analysis: Dict[str, Any] = field(default_factory=dict)
    sentiment_analysis: Dict[str, Any] = field(default_factory=dict)
    llm_analysis: Dict[str, Any] = field(default_factory=dict)
    
    # Reasoning
    key_factors: List[str] = field(default_factory=list)
    risks: List[str] = field(default_factory=list)
    reasoning: str = ""
    
    # Status tracking
    status: str = "pending"  # pending, active, completed, expired
    
    # Outcome (filled later)
    actual_outcome: Optional[Dict[str, Any]] = None
    
    def __post_init__(self):
        if self.expiry_date is None:
            self.expiry_date = self.created_at + timedelta(days=self.time_horizon_days)
        if not self.id:
            self.id = f"{self.symbol}_{self.created_at.strftime('%Y%m%d%H%M%S')}"
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "created_at": self.created_at.isoformat(),
            "symbol": self.symbol,
            "company_name": self.company_name,
            "action": self.action,
            "confidence": self.confidence,
            "current_price": self.current_price,
            "target_price": self.target_price,
            "stop_loss": self.stop_loss,
            "expected_return_percent": self.expected_return_percent,
            "time_horizon_days": self.time_horizon_days,
            "expiry_date": self.expiry_date.isoformat() if self.expiry_date else None,
            "technical_score": self.technical_score,
            "sentiment_score": self.sentiment_score,
            "llm_consensus_score": self.llm_consensus_score,
            "key_factors": self.key_factors,
            "risks": self.risks,
            "reasoning": self.reasoning,
            "status": self.status,
        }
    
    @property
    def meets_threshold(self) -> bool:
        """Check if prediction meets minimum confidence threshold."""
        return self.confidence >= settings.min_confidence_threshold
    
    @property
    def meets_return_target(self) -> bool:
        """Check if expected return meets target."""
        return self.expected_return_percent >= settings.target_return_percent


class PredictionEngine:
    """
    Main prediction engine that orchestrates all analysis.
    
    Process:
    1. Gather stock data and calculate technical indicators
    2. Scrape and analyze relevant news
    3. Get LLM consensus from multiple providers
    4. Combine all signals with weighted scoring
    5. Generate prediction with confidence metrics
    """
    
    # Weights for combining different analysis types
    ANALYSIS_WEIGHTS = {
        "technical": 0.35,
        "sentiment": 0.25,
        "llm_consensus": 0.40
    }
    
    def __init__(self):
        self.stock_fetcher = StockDataFetcher()
        self.news_scraper = RSSNewsScraper()
        self.symbol_extractor = SymbolExtractor()
        self.sentiment_analyzer = SentimentAnalyzer()
        self.technical_analyzer = TechnicalAnalyzer()
        self.llm_orchestrator = LLMOrchestrator()
    
    async def generate_prediction(
        self,
        symbol: str,
        time_horizon_days: int = 30
    ) -> Prediction:
        """
        Generate a comprehensive prediction for a stock.
        
        Args:
            symbol: Stock symbol (e.g., AAPL)
            time_horizon_days: Investment time horizon
        
        Returns:
            Prediction with full analysis
        """
        logger.info(f"Generating prediction for {symbol}")
        
        prediction = Prediction(
            symbol=symbol.upper(),
            time_horizon_days=time_horizon_days
        )
        
        try:
            # Step 1: Get stock data and company info
            stock_data = await self.stock_fetcher.get_stock_data(symbol, period="3mo")
            company_info = await self.stock_fetcher.get_company_info(symbol)
            quote = await self.stock_fetcher.get_realtime_quote(symbol)
            
            if stock_data is None or stock_data.empty:
                logger.warning(f"No stock data available for {symbol}")
                prediction.reasoning = "Insufficient stock data available"
                return prediction
            
            if company_info:
                prediction.company_name = company_info.get("name", symbol)
            
            if quote:
                prediction.current_price = quote.get("price", 0)
            else:
                close_col = "Close" if "Close" in stock_data.columns else "close"
                prediction.current_price = float(stock_data[close_col].iloc[-1])
            
            # Step 2: Technical Analysis
            technical_result = self.technical_analyzer.analyze(stock_data, symbol)
            prediction.technical_analysis = technical_result.to_dict()
            prediction.technical_score = technical_result.overall_score / 100  # Normalize to 0-1
            
            # Step 3: Gather and analyze news
            news_summary, sentiment_result = await self._analyze_news(symbol, prediction.company_name)
            prediction.sentiment_analysis = sentiment_result
            prediction.sentiment_score = (sentiment_result.get("composite_score", 0) + 1) / 2  # Normalize -1,1 to 0,1
            
            # Step 4: Get LLM consensus
            llm_consensus = await self.llm_orchestrator.get_prediction_consensus(
                symbol=symbol,
                company_name=prediction.company_name,
                technical_data=prediction.technical_analysis,
                news_summary=news_summary,
                sentiment_data=sentiment_result
            )
            
            if llm_consensus.is_valid:
                prediction.llm_analysis = {
                    "consensus_prediction": llm_consensus.consensus_prediction,
                    "consensus_confidence": llm_consensus.consensus_confidence,
                    "agreement_level": llm_consensus.agreement_level,
                    "providers_used": llm_consensus.providers_used,
                    "common_factors": llm_consensus.common_factors,
                    "identified_risks": llm_consensus.identified_risks,
                    "dissenting_opinions": llm_consensus.dissenting_opinions
                }
                prediction.llm_consensus_score = llm_consensus.consensus_confidence
                prediction.key_factors = llm_consensus.common_factors[:5]
                prediction.risks = llm_consensus.identified_risks[:5]
            
            # Step 5: Combine all signals
            self._calculate_final_prediction(prediction, technical_result, llm_consensus)
            
            # Step 6: Calculate price targets
            self._calculate_price_targets(prediction, technical_result)
            
            # Step 7: Generate reasoning
            prediction.reasoning = self._generate_reasoning(prediction)
            
            logger.info(f"Prediction generated for {symbol}: {prediction.action} with {prediction.confidence:.2%} confidence")
            
        except Exception as e:
            logger.error(f"Error generating prediction for {symbol}: {e}")
            prediction.reasoning = f"Error during analysis: {str(e)}"
        
        return prediction
    
    async def _analyze_news(
        self,
        symbol: str,
        company_name: str
    ) -> tuple[str, Dict[str, Any]]:
        """Analyze news for a symbol."""
        try:
            # For now, we'll use the Google News search for specific symbol
            from src.scrapers.news_scrapers import GoogleNewsSearcher
            
            async with GoogleNewsSearcher() as searcher:
                # Search for company news
                search_terms = [symbol, company_name] if company_name else [symbol]
                all_articles = []
                
                for term in search_terms:
                    articles = await searcher.search(term)
                    all_articles.extend(articles)
            
            # Combine article titles and summaries
            news_text = " ".join([
                f"{a.get('title', '')}. {a.get('summary', '')}"
                for a in all_articles[:20]  # Limit to 20 most recent
            ])
            
            if not news_text.strip():
                news_text = f"No recent news found for {symbol}"
            
            # Get LLM analysis of news
            news_analysis = await self.llm_orchestrator.analyze_news_consensus(
                news_content=news_text[:5000],  # Limit length
                symbols=[symbol]
            )
            
            # Combine with rule-based sentiment
            rule_sentiment = self.sentiment_analyzer.analyze(
                news_text,
                llm_sentiment_score=news_analysis.consensus_score if news_analysis.is_valid else None
            )
            
            sentiment_result = rule_sentiment.to_dict()
            sentiment_result["llm_analysis"] = {
                "consensus_sentiment": news_analysis.consensus_sentiment,
                "consensus_score": news_analysis.consensus_score,
                "insights": news_analysis.aggregated_insights
            }
            
            # Create summary for LLM prediction
            news_summary = f"""
Recent news sentiment for {symbol}: {news_analysis.consensus_sentiment}
Key insights: {', '.join(news_analysis.aggregated_insights[:5])}
Composite sentiment score: {rule_sentiment.composite_score:.2f}
"""
            
            return news_summary, sentiment_result
            
        except Exception as e:
            logger.error(f"Error analyzing news for {symbol}: {e}")
            return f"Unable to analyze news for {symbol}", {"composite_score": 0, "sentiment": "neutral"}
    
    def _calculate_final_prediction(
        self,
        prediction: Prediction,
        technical_result,
        llm_consensus
    ):
        """Combine all analysis to determine final prediction."""
        # Weighted combination of scores
        weighted_score = (
            prediction.technical_score * self.ANALYSIS_WEIGHTS["technical"] +
            prediction.sentiment_score * self.ANALYSIS_WEIGHTS["sentiment"] +
            prediction.llm_consensus_score * self.ANALYSIS_WEIGHTS["llm_consensus"]
        )
        
        # Determine action
        if weighted_score >= 0.65:
            prediction.action = "buy"
        elif weighted_score <= 0.35:
            prediction.action = "sell"
        else:
            prediction.action = "hold"
        
        # Override with strong technical signals
        if technical_result.overall_signal == Signal.STRONG_BUY:
            if prediction.action != "sell":
                prediction.action = "buy"
        elif technical_result.overall_signal == Signal.STRONG_SELL:
            if prediction.action != "buy":
                prediction.action = "sell"
        
        # Consider LLM consensus
        if llm_consensus.is_valid and llm_consensus.agreement_level > 0.7:
            if llm_consensus.consensus_prediction in ["buy", "sell"]:
                # Strong LLM agreement can influence action
                if llm_consensus.consensus_prediction != prediction.action:
                    # Average the signals
                    if prediction.action == "hold":
                        prediction.action = llm_consensus.consensus_prediction
        
        # Calculate confidence
        # Base confidence on weighted score distance from neutral (0.5)
        base_confidence = abs(weighted_score - 0.5) * 2
        
        # Adjust for agreement between different analysis types
        score_variance = statistics.variance([
            prediction.technical_score,
            prediction.sentiment_score,
            prediction.llm_consensus_score
        ])
        agreement_factor = 1 - min(1, score_variance * 4)
        
        # Adjust for LLM agreement
        llm_agreement_factor = llm_consensus.agreement_level if llm_consensus.is_valid else 0.5
        
        prediction.confidence = base_confidence * 0.4 + agreement_factor * 0.3 + llm_agreement_factor * 0.3
        prediction.confidence = max(0.1, min(0.95, prediction.confidence))  # Clamp to reasonable range
    
    def _calculate_price_targets(self, prediction: Prediction, technical_result):
        """Calculate target price and stop loss."""
        current = prediction.current_price
        
        if prediction.action == "buy":
            # Use resistance levels or percentage-based targets
            if technical_result.resistance_levels:
                # Target first resistance level
                prediction.target_price = technical_result.resistance_levels[0]
            else:
                # Default 10% gain target
                prediction.target_price = current * 1.10
            
            # Stop loss at support or percentage
            if technical_result.support_levels:
                prediction.stop_loss = technical_result.support_levels[0]
            else:
                prediction.stop_loss = current * 0.95
                
        elif prediction.action == "sell":
            # For shorts, invert the logic
            if technical_result.support_levels:
                prediction.target_price = technical_result.support_levels[0]
            else:
                prediction.target_price = current * 0.90
            
            if technical_result.resistance_levels:
                prediction.stop_loss = technical_result.resistance_levels[0]
            else:
                prediction.stop_loss = current * 1.05
        else:
            # Hold - no specific targets
            prediction.target_price = current
            prediction.stop_loss = current * 0.95
        
        # Calculate expected return
        prediction.expected_return_percent = (
            (prediction.target_price - current) / current * 100
        )
    
    def _generate_reasoning(self, prediction: Prediction) -> str:
        """Generate human-readable reasoning for the prediction."""
        parts = []
        
        parts.append(f"**{prediction.action.upper()} recommendation for {prediction.symbol}**")
        parts.append(f"Confidence: {prediction.confidence:.1%}")
        parts.append("")
        
        # Technical summary
        tech_signal = "Bullish" if prediction.technical_score > 0.6 else "Bearish" if prediction.technical_score < 0.4 else "Neutral"
        parts.append(f"**Technical Analysis:** {tech_signal} ({prediction.technical_score:.1%})")
        
        # Sentiment summary
        sent_label = "Positive" if prediction.sentiment_score > 0.6 else "Negative" if prediction.sentiment_score < 0.4 else "Neutral"
        parts.append(f"**Market Sentiment:** {sent_label} ({prediction.sentiment_score:.1%})")
        
        # LLM consensus
        if prediction.llm_analysis:
            parts.append(f"**AI Consensus:** {prediction.llm_analysis.get('consensus_prediction', 'N/A').upper()}")
            parts.append(f"Agreement level: {prediction.llm_analysis.get('agreement_level', 0):.1%}")
        
        parts.append("")
        
        # Key factors
        if prediction.key_factors:
            parts.append("**Key Factors:**")
            for factor in prediction.key_factors[:5]:
                parts.append(f"  • {factor}")
        
        # Risks
        if prediction.risks:
            parts.append("")
            parts.append("**Risks:**")
            for risk in prediction.risks[:5]:
                parts.append(f"  • {risk}")
        
        # Price targets
        parts.append("")
        parts.append(f"**Price Targets:**")
        parts.append(f"  Current: ${prediction.current_price:.2f}")
        parts.append(f"  Target: ${prediction.target_price:.2f} ({prediction.expected_return_percent:+.1f}%)")
        parts.append(f"  Stop Loss: ${prediction.stop_loss:.2f}")
        parts.append(f"  Time Horizon: {prediction.time_horizon_days} days")
        
        return "\n".join(parts)
    
    async def batch_predictions(
        self,
        symbols: List[str],
        time_horizon_days: int = 30
    ) -> List[Prediction]:
        """Generate predictions for multiple symbols."""
        predictions = []
        
        for symbol in symbols:
            try:
                pred = await self.generate_prediction(symbol, time_horizon_days)
                predictions.append(pred)
            except Exception as e:
                logger.error(f"Failed to generate prediction for {symbol}: {e}")
        
        # Sort by confidence
        predictions.sort(key=lambda p: p.confidence, reverse=True)
        
        return predictions
    
    async def get_top_opportunities(
        self,
        symbols: List[str] = None,
        min_confidence: float = None,
        min_return: float = None,
        limit: int = 10
    ) -> List[Prediction]:
        """
        Find top investment opportunities.
        
        Args:
            symbols: List of symbols to analyze (default: S&P 500 top stocks)
            min_confidence: Minimum confidence threshold
            min_return: Minimum expected return percentage
            limit: Maximum number of opportunities to return
        
        Returns:
            List of top predictions sorted by opportunity score
        """
        if symbols is None:
            # Default watchlist - diversified sectors
            symbols = [
                "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA",
                "JPM", "V", "MA", "UNH", "JNJ", "PG", "HD", "DIS",
                "NFLX", "CRM", "ADBE", "AMD", "INTC", "PYPL", "SQ",
                "XOM", "CVX", "BA", "CAT", "MMM", "GE", "F", "GM"
            ]
        
        min_confidence = min_confidence or settings.min_confidence_threshold
        min_return = min_return or settings.target_return_percent
        
        # Generate predictions
        all_predictions = await self.batch_predictions(symbols)
        
        # Filter
        opportunities = [
            p for p in all_predictions
            if p.confidence >= min_confidence
            and p.expected_return_percent >= min_return
            and p.action == "buy"  # Focus on buy opportunities
        ]
        
        # Score opportunities (confidence * expected return)
        for opp in opportunities:
            opp._opportunity_score = opp.confidence * (opp.expected_return_percent / 100)
        
        # Sort by opportunity score
        opportunities.sort(key=lambda p: p._opportunity_score, reverse=True)
        
        return opportunities[:limit]
