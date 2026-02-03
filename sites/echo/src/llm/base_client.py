"""
Base LLM client interface.
All LLM providers inherit from this.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Optional, Dict, Any, List
from datetime import datetime
import json

from loguru import logger


@dataclass
class LLMResponse:
    """Standardized response from LLM providers."""
    provider: str
    model: str
    content: str
    structured_data: Optional[Dict[str, Any]] = None
    tokens_used: int = 0
    response_time_ms: int = 0
    raw_response: Optional[Any] = None
    error: Optional[str] = None
    timestamp: datetime = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()
    
    @property
    def success(self) -> bool:
        return self.error is None and self.content is not None


class BaseLLMClient(ABC):
    """Abstract base class for LLM clients."""
    
    provider_name: str = "base"
    default_model: str = ""
    
    def __init__(self, api_key: str, model: str = None):
        self.api_key = api_key
        self.model = model or self.default_model
    
    @abstractmethod
    async def generate(
        self,
        prompt: str,
        system_prompt: str = None,
        temperature: float = 0.7,
        max_tokens: int = 2048,
        **kwargs
    ) -> LLMResponse:
        """Generate a response from the LLM."""
        pass
    
    @abstractmethod
    async def generate_structured(
        self,
        prompt: str,
        output_schema: Dict[str, Any],
        system_prompt: str = None,
        temperature: float = 0.3,
        **kwargs
    ) -> LLMResponse:
        """Generate a structured JSON response."""
        pass
    
    def parse_json_response(self, content: str) -> Optional[Dict[str, Any]]:
        """Attempt to parse JSON from response content."""
        if not content:
            return None
        
        # Try direct parsing
        try:
            return json.loads(content)
        except json.JSONDecodeError:
            pass
        
        # Try to extract JSON from markdown code blocks
        import re
        json_patterns = [
            r'```json\s*([\s\S]*?)\s*```',
            r'```\s*([\s\S]*?)\s*```',
            r'\{[\s\S]*\}',
        ]
        
        for pattern in json_patterns:
            matches = re.findall(pattern, content)
            for match in matches:
                try:
                    return json.loads(match)
                except json.JSONDecodeError:
                    continue
        
        logger.warning(f"Could not parse JSON from response: {content[:200]}...")
        return None
    
    def _create_analysis_prompt(
        self,
        news_content: str,
        symbols: List[str] = None
    ) -> str:
        """Create a prompt for news analysis."""
        symbols_str = ", ".join(symbols) if symbols else "any mentioned companies"
        
        return f"""Analyze the following financial news content and provide insights for stock investment decisions.

NEWS CONTENT:
{news_content}

FOCUS SYMBOLS: {symbols_str}

Provide your analysis in the following JSON format:
{{
    "sentiment": "positive" | "negative" | "neutral",
    "sentiment_score": -1.0 to 1.0,
    "key_insights": ["insight1", "insight2", ...],
    "affected_symbols": ["SYM1", "SYM2", ...],
    "impact_assessment": {{
        "short_term": "description of expected short-term impact",
        "long_term": "description of expected long-term impact"
    }},
    "investment_signals": {{
        "bullish_factors": ["factor1", "factor2"],
        "bearish_factors": ["factor1", "factor2"]
    }},
    "confidence": 0.0 to 1.0,
    "recommended_action": "buy" | "sell" | "hold" | "watch",
    "reasoning": "brief explanation of your analysis"
}}

Be objective and analytical. Focus on factual information and market implications."""
    
    def _create_prediction_prompt(
        self,
        symbol: str,
        company_name: str,
        technical_data: Dict[str, Any],
        news_summary: str,
        sentiment_data: Dict[str, Any]
    ) -> str:
        """Create a prompt for stock prediction."""
        return f"""You are an expert financial analyst. Based on the following data, provide a prediction for {symbol} ({company_name}).

TECHNICAL ANALYSIS:
{json.dumps(technical_data, indent=2)}

RECENT NEWS SUMMARY:
{news_summary}

SENTIMENT DATA:
{json.dumps(sentiment_data, indent=2)}

Provide your prediction in the following JSON format:
{{
    "symbol": "{symbol}",
    "prediction": "buy" | "sell" | "hold",
    "confidence": 0.0 to 1.0,
    "target_price": estimated target price,
    "stop_loss": recommended stop loss price,
    "expected_return_percent": expected return percentage,
    "time_horizon_days": recommended holding period in days,
    "key_factors": ["factor1", "factor2", ...],
    "risks": ["risk1", "risk2", ...],
    "technical_score": 0.0 to 1.0,
    "sentiment_score": 0.0 to 1.0,
    "fundamental_score": 0.0 to 1.0,
    "reasoning": "detailed explanation of your prediction",
    "entry_conditions": "conditions that should be met before entering",
    "exit_conditions": "conditions for taking profit or cutting losses"
}}

Be thorough, analytical, and realistic. Consider both upside potential and downside risks."""
