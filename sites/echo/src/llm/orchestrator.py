"""
LLM Orchestrator - manages multiple LLM providers and builds consensus.
This is the core component for eliminating bias by using multiple models.
"""

import asyncio
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from collections import defaultdict
import statistics

from loguru import logger

from src.config import settings
from .base_client import BaseLLMClient, LLMResponse
from .gemini_client import GeminiClient
from .groq_client import GroqClient
from .together_client import TogetherClient


@dataclass
class ConsensusResult:
    """Result of multi-LLM consensus building."""
    
    # Individual responses
    responses: List[LLMResponse] = field(default_factory=list)
    
    # Consensus data
    consensus_sentiment: str = "neutral"
    consensus_score: float = 0.0
    consensus_prediction: str = "hold"
    consensus_confidence: float = 0.0
    
    # Aggregated analysis
    aggregated_insights: List[str] = field(default_factory=list)
    common_factors: List[str] = field(default_factory=list)
    identified_risks: List[str] = field(default_factory=list)
    
    # Disagreement tracking
    agreement_level: float = 0.0  # 0-1, how much models agree
    dissenting_opinions: List[Dict[str, Any]] = field(default_factory=list)
    
    # Stats
    providers_used: List[str] = field(default_factory=list)
    total_response_time_ms: int = 0
    successful_responses: int = 0
    failed_responses: int = 0
    
    @property
    def is_valid(self) -> bool:
        """Check if we have enough valid responses for consensus."""
        return self.successful_responses >= 2


class LLMOrchestrator:
    """
    Orchestrates multiple LLM providers to build consensus predictions.
    
    Key features:
    - Uses multiple LLMs to eliminate individual model biases
    - Builds consensus through weighted voting
    - Tracks disagreements for analysis
    - Automatically handles provider failures
    """
    
    def __init__(self):
        self.clients: Dict[str, BaseLLMClient] = {}
        self._initialize_clients()
    
    def _initialize_clients(self):
        """Initialize available LLM clients based on configured API keys."""
        
        if settings.gemini_api_key:
            try:
                self.clients["gemini"] = GeminiClient(settings.gemini_api_key)
                logger.info("Initialized Gemini client")
            except Exception as e:
                logger.error(f"Failed to initialize Gemini: {e}")
        
        if settings.groq_api_key:
            try:
                self.clients["groq"] = GroqClient(settings.groq_api_key)
                logger.info("Initialized Groq client")
            except Exception as e:
                logger.error(f"Failed to initialize Groq: {e}")
        
        if settings.together_api_key:
            try:
                self.clients["together"] = TogetherClient(settings.together_api_key)
                logger.info("Initialized Together AI client")
            except Exception as e:
                logger.error(f"Failed to initialize Together AI: {e}")
        
        if not self.clients:
            logger.warning("No LLM clients initialized! Check your API keys.")
    
    @property
    def available_providers(self) -> List[str]:
        """List of available LLM providers."""
        return list(self.clients.keys())
    
    async def analyze_news_consensus(
        self,
        news_content: str,
        symbols: List[str] = None
    ) -> ConsensusResult:
        """
        Get consensus news analysis from multiple LLMs.
        
        Args:
            news_content: The news text to analyze
            symbols: Optional list of stock symbols to focus on
        
        Returns:
            ConsensusResult with aggregated analysis
        """
        if not self.clients:
            return ConsensusResult()
        
        # Query all LLMs in parallel
        tasks = []
        for name, client in self.clients.items():
            task = self._safe_analyze_news(client, news_content, symbols)
            tasks.append((name, task))
        
        # Gather results
        results = await asyncio.gather(*[t[1] for t in tasks], return_exceptions=True)
        
        # Build consensus
        responses = []
        for (name, _), result in zip(tasks, results):
            if isinstance(result, LLMResponse) and result.success:
                responses.append(result)
        
        return self._build_analysis_consensus(responses)
    
    async def get_prediction_consensus(
        self,
        symbol: str,
        company_name: str,
        technical_data: Dict[str, Any],
        news_summary: str,
        sentiment_data: Dict[str, Any]
    ) -> ConsensusResult:
        """
        Get consensus prediction from multiple LLMs.
        
        Args:
            symbol: Stock symbol
            company_name: Company name
            technical_data: Technical analysis data
            news_summary: Summary of recent news
            sentiment_data: Sentiment analysis results
        
        Returns:
            ConsensusResult with prediction
        """
        if not self.clients:
            return ConsensusResult()
        
        # Query all LLMs in parallel
        tasks = []
        for name, client in self.clients.items():
            task = self._safe_make_prediction(
                client, symbol, company_name, technical_data, news_summary, sentiment_data
            )
            tasks.append((name, task))
        
        results = await asyncio.gather(*[t[1] for t in tasks], return_exceptions=True)
        
        responses = []
        for (name, _), result in zip(tasks, results):
            if isinstance(result, LLMResponse) and result.success:
                responses.append(result)
        
        return self._build_prediction_consensus(responses)
    
    async def _safe_analyze_news(
        self,
        client: BaseLLMClient,
        news_content: str,
        symbols: List[str]
    ) -> LLMResponse:
        """Safely call analyze_news with error handling."""
        try:
            return await client.analyze_news(news_content, symbols)
        except Exception as e:
            logger.error(f"Error in {client.provider_name} news analysis: {e}")
            return LLMResponse(
                provider=client.provider_name,
                model=client.model,
                content="",
                error=str(e)
            )
    
    async def _safe_make_prediction(
        self,
        client: BaseLLMClient,
        symbol: str,
        company_name: str,
        technical_data: Dict[str, Any],
        news_summary: str,
        sentiment_data: Dict[str, Any]
    ) -> LLMResponse:
        """Safely call make_prediction with error handling."""
        try:
            return await client.make_prediction(
                symbol, company_name, technical_data, news_summary, sentiment_data
            )
        except Exception as e:
            logger.error(f"Error in {client.provider_name} prediction: {e}")
            return LLMResponse(
                provider=client.provider_name,
                model=client.model,
                content="",
                error=str(e)
            )
    
    def _build_analysis_consensus(self, responses: List[LLMResponse]) -> ConsensusResult:
        """Build consensus from multiple news analysis responses."""
        result = ConsensusResult()
        result.responses = responses
        result.successful_responses = len(responses)
        result.failed_responses = len(self.clients) - len(responses)
        result.providers_used = [r.provider for r in responses]
        result.total_response_time_ms = sum(r.response_time_ms for r in responses)
        
        if not responses:
            return result
        
        # Extract sentiments and scores
        sentiments = []
        scores = []
        insights = []
        symbols = set()
        
        for response in responses:
            data = response.structured_data or {}
            
            if "sentiment" in data:
                sentiments.append(data["sentiment"])
            
            if "sentiment_score" in data:
                try:
                    scores.append(float(data["sentiment_score"]))
                except (ValueError, TypeError):
                    pass
            
            if "key_insights" in data and isinstance(data["key_insights"], list):
                insights.extend(data["key_insights"])
            
            if "affected_symbols" in data and isinstance(data["affected_symbols"], list):
                symbols.update(data["affected_symbols"])
        
        # Calculate consensus sentiment
        if sentiments:
            sentiment_counts = defaultdict(int)
            for s in sentiments:
                sentiment_counts[s.lower()] += 1
            result.consensus_sentiment = max(sentiment_counts, key=sentiment_counts.get)
        
        # Calculate consensus score
        if scores:
            result.consensus_score = statistics.mean(scores)
        
        # Calculate agreement level
        if len(sentiments) > 1:
            most_common_count = max(defaultdict(int, {s: sentiments.count(s) for s in sentiments}).values())
            result.agreement_level = most_common_count / len(sentiments)
        else:
            result.agreement_level = 1.0
        
        # Aggregate insights (remove duplicates, keep most common)
        result.aggregated_insights = list(set(insights))[:10]
        
        return result
    
    def _build_prediction_consensus(self, responses: List[LLMResponse]) -> ConsensusResult:
        """Build consensus from multiple prediction responses."""
        result = ConsensusResult()
        result.responses = responses
        result.successful_responses = len(responses)
        result.failed_responses = len(self.clients) - len(responses)
        result.providers_used = [r.provider for r in responses]
        result.total_response_time_ms = sum(r.response_time_ms for r in responses)
        
        if not responses:
            return result
        
        # Extract predictions
        predictions = []
        confidences = []
        target_prices = []
        returns = []
        time_horizons = []
        all_factors = []
        all_risks = []
        
        for response in responses:
            data = response.structured_data or {}
            
            if "prediction" in data:
                predictions.append(data["prediction"].lower())
            
            if "confidence" in data:
                try:
                    confidences.append(float(data["confidence"]))
                except (ValueError, TypeError):
                    pass
            
            if "target_price" in data:
                try:
                    target_prices.append(float(data["target_price"]))
                except (ValueError, TypeError):
                    pass
            
            if "expected_return_percent" in data:
                try:
                    returns.append(float(data["expected_return_percent"]))
                except (ValueError, TypeError):
                    pass
            
            if "time_horizon_days" in data:
                try:
                    time_horizons.append(int(data["time_horizon_days"]))
                except (ValueError, TypeError):
                    pass
            
            if "key_factors" in data and isinstance(data["key_factors"], list):
                all_factors.extend(data["key_factors"])
            
            if "risks" in data and isinstance(data["risks"], list):
                all_risks.extend(data["risks"])
        
        # Calculate consensus prediction (majority vote)
        if predictions:
            prediction_counts = defaultdict(int)
            for p in predictions:
                prediction_counts[p] += 1
            result.consensus_prediction = max(prediction_counts, key=prediction_counts.get)
            
            # Agreement level
            most_common_count = prediction_counts[result.consensus_prediction]
            result.agreement_level = most_common_count / len(predictions)
            
            # Track dissenting opinions
            for response in responses:
                data = response.structured_data or {}
                pred = data.get("prediction", "").lower()
                if pred != result.consensus_prediction:
                    result.dissenting_opinions.append({
                        "provider": response.provider,
                        "prediction": pred,
                        "reasoning": data.get("reasoning", "")
                    })
        
        # Calculate consensus confidence (weighted by agreement)
        if confidences:
            result.consensus_confidence = statistics.mean(confidences) * result.agreement_level
        
        # Aggregate factors and risks
        result.common_factors = list(set(all_factors))[:10]
        result.identified_risks = list(set(all_risks))[:10]
        
        return result
    
    async def single_provider_query(
        self,
        provider: str,
        prompt: str,
        system_prompt: str = None
    ) -> LLMResponse:
        """Query a single provider directly."""
        if provider not in self.clients:
            return LLMResponse(
                provider=provider,
                model="",
                content="",
                error=f"Provider {provider} not available"
            )
        
        return await self.clients[provider].generate(
            prompt=prompt,
            system_prompt=system_prompt
        )
