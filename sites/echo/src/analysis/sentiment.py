"""
Sentiment Analysis Engine.
Combines multiple sentiment analysis methods for accuracy.
"""

from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
import statistics

from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from textblob import TextBlob
from loguru import logger


@dataclass
class SentimentResult:
    """Comprehensive sentiment analysis result."""
    
    # Individual scores (-1 to 1)
    vader_score: float = 0.0
    textblob_score: float = 0.0
    llm_score: float = 0.0
    
    # Composite score
    composite_score: float = 0.0
    
    # Classification
    sentiment: str = "neutral"  # positive, negative, neutral
    confidence: float = 0.0
    
    # Details
    vader_details: Dict[str, float] = field(default_factory=dict)
    key_phrases: List[str] = field(default_factory=list)
    subjectivity: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "vader_score": self.vader_score,
            "textblob_score": self.textblob_score,
            "llm_score": self.llm_score,
            "composite_score": self.composite_score,
            "sentiment": self.sentiment,
            "confidence": self.confidence,
            "subjectivity": self.subjectivity,
        }


class SentimentAnalyzer:
    """
    Multi-method sentiment analyzer for financial text.
    
    Combines:
    - VADER (specialized for social media/news)
    - TextBlob (general purpose)
    - LLM analysis (context-aware)
    
    Weights are tuned for financial text.
    """
    
    # Weights for combining scores (tuned for financial text)
    WEIGHTS = {
        "vader": 0.35,
        "textblob": 0.25,
        "llm": 0.40  # LLM gets highest weight for context understanding
    }
    
    # Financial-specific word modifications for VADER
    FINANCIAL_LEXICON = {
        # Positive
        "bullish": 2.5,
        "upgrade": 2.0,
        "outperform": 1.8,
        "beat": 1.5,
        "exceeds": 1.5,
        "growth": 1.2,
        "profitable": 1.5,
        "dividend": 1.0,
        "buyback": 1.2,
        "acquisition": 0.8,
        "innovation": 1.0,
        "breakthrough": 1.5,
        "rally": 1.5,
        "surge": 1.3,
        "soar": 1.5,
        
        # Negative
        "bearish": -2.5,
        "downgrade": -2.0,
        "underperform": -1.8,
        "miss": -1.5,
        "disappoints": -1.5,
        "decline": -1.2,
        "loss": -1.5,
        "layoffs": -1.8,
        "lawsuit": -1.5,
        "investigation": -1.3,
        "recession": -2.0,
        "bankruptcy": -2.5,
        "default": -2.0,
        "crash": -2.0,
        "plunge": -1.8,
        "tumble": -1.5,
        "selloff": -1.5,
        "volatility": -0.5,
        "uncertainty": -0.8,
        "warning": -1.2,
    }
    
    def __init__(self):
        self.vader = SentimentIntensityAnalyzer()
        self._update_vader_lexicon()
    
    def _update_vader_lexicon(self):
        """Add financial terms to VADER lexicon."""
        self.vader.lexicon.update(self.FINANCIAL_LEXICON)
    
    def analyze_vader(self, text: str) -> Dict[str, float]:
        """Analyze sentiment using VADER."""
        scores = self.vader.polarity_scores(text)
        return {
            "compound": scores["compound"],
            "positive": scores["pos"],
            "negative": scores["neg"],
            "neutral": scores["neu"]
        }
    
    def analyze_textblob(self, text: str) -> Dict[str, float]:
        """Analyze sentiment using TextBlob."""
        blob = TextBlob(text)
        return {
            "polarity": blob.sentiment.polarity,  # -1 to 1
            "subjectivity": blob.sentiment.subjectivity  # 0 to 1
        }
    
    def analyze(
        self,
        text: str,
        llm_sentiment_score: float = None
    ) -> SentimentResult:
        """
        Perform comprehensive sentiment analysis.
        
        Args:
            text: Text to analyze
            llm_sentiment_score: Optional LLM-provided sentiment score (-1 to 1)
        
        Returns:
            SentimentResult with all scores
        """
        result = SentimentResult()
        
        # VADER analysis
        vader_scores = self.analyze_vader(text)
        result.vader_score = vader_scores["compound"]
        result.vader_details = vader_scores
        
        # TextBlob analysis
        textblob_scores = self.analyze_textblob(text)
        result.textblob_score = textblob_scores["polarity"]
        result.subjectivity = textblob_scores["subjectivity"]
        
        # LLM score (if provided)
        result.llm_score = llm_sentiment_score if llm_sentiment_score is not None else 0.0
        
        # Calculate composite score
        scores = []
        weights = []
        
        scores.append(result.vader_score)
        weights.append(self.WEIGHTS["vader"])
        
        scores.append(result.textblob_score)
        weights.append(self.WEIGHTS["textblob"])
        
        if llm_sentiment_score is not None:
            scores.append(result.llm_score)
            weights.append(self.WEIGHTS["llm"])
        
        # Weighted average
        total_weight = sum(weights)
        result.composite_score = sum(s * w for s, w in zip(scores, weights)) / total_weight
        
        # Classify sentiment
        if result.composite_score >= 0.15:
            result.sentiment = "positive"
        elif result.composite_score <= -0.15:
            result.sentiment = "negative"
        else:
            result.sentiment = "neutral"
        
        # Calculate confidence based on agreement between methods
        score_variance = statistics.variance(scores) if len(scores) > 1 else 0
        # Lower variance = higher confidence
        result.confidence = max(0, 1 - (score_variance * 2))
        
        return result
    
    def analyze_batch(
        self,
        texts: List[str],
        llm_scores: List[float] = None
    ) -> List[SentimentResult]:
        """Analyze multiple texts."""
        results = []
        llm_scores = llm_scores or [None] * len(texts)
        
        for text, llm_score in zip(texts, llm_scores):
            results.append(self.analyze(text, llm_score))
        
        return results
    
    def aggregate_sentiments(self, results: List[SentimentResult]) -> SentimentResult:
        """Aggregate multiple sentiment results into one."""
        if not results:
            return SentimentResult()
        
        aggregated = SentimentResult()
        
        aggregated.vader_score = statistics.mean([r.vader_score for r in results])
        aggregated.textblob_score = statistics.mean([r.textblob_score for r in results])
        aggregated.llm_score = statistics.mean([r.llm_score for r in results])
        aggregated.composite_score = statistics.mean([r.composite_score for r in results])
        aggregated.confidence = statistics.mean([r.confidence for r in results])
        aggregated.subjectivity = statistics.mean([r.subjectivity for r in results])
        
        # Classify
        if aggregated.composite_score >= 0.15:
            aggregated.sentiment = "positive"
        elif aggregated.composite_score <= -0.15:
            aggregated.sentiment = "negative"
        else:
            aggregated.sentiment = "neutral"
        
        return aggregated
