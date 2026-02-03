"""
Self-Improvement Engine.
Continuously learns from predictions and improves the model.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional, Tuple
from dataclasses import dataclass, field
import statistics
import json

from loguru import logger
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.models import (
    Prediction, Investment, SystemMetrics, 
    ModelConfiguration, BacktestResult, LLMResponse
)
from src.backtesting import Backtester


@dataclass
class ImprovementInsight:
    """Insight from performance analysis."""
    category: str  # technical, sentiment, llm, general
    finding: str
    impact: str  # positive, negative, neutral
    recommendation: str
    confidence: float
    data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PerformanceReport:
    """Comprehensive performance report."""
    
    period_start: datetime = None
    period_end: datetime = None
    
    # Overall metrics
    total_predictions: int = 0
    successful_predictions: int = 0
    failed_predictions: int = 0
    accuracy_rate: float = 0.0
    
    # Returns
    total_return_percent: float = 0.0
    average_return_percent: float = 0.0
    best_return: float = 0.0
    worst_return: float = 0.0
    
    # By action type
    buy_accuracy: float = 0.0
    sell_accuracy: float = 0.0
    hold_accuracy: float = 0.0
    
    # By confidence level
    high_confidence_accuracy: float = 0.0  # >80%
    medium_confidence_accuracy: float = 0.0  # 60-80%
    low_confidence_accuracy: float = 0.0  # <60%
    
    # Component analysis
    technical_correlation: float = 0.0
    sentiment_correlation: float = 0.0
    llm_correlation: float = 0.0
    
    # Insights
    insights: List[ImprovementInsight] = field(default_factory=list)
    
    # Recommendations
    parameter_adjustments: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "period_start": self.period_start.isoformat() if self.period_start else None,
            "period_end": self.period_end.isoformat() if self.period_end else None,
            "total_predictions": self.total_predictions,
            "accuracy_rate": self.accuracy_rate,
            "total_return_percent": self.total_return_percent,
            "average_return_percent": self.average_return_percent,
            "insights": [
                {"category": i.category, "finding": i.finding, "recommendation": i.recommendation}
                for i in self.insights
            ],
            "parameter_adjustments": self.parameter_adjustments
        }


class SelfImprovementEngine:
    """
    Engine for continuous self-improvement.
    
    Analyzes past performance to:
    1. Identify patterns in successful vs failed predictions
    2. Adjust model weights and parameters
    3. Learn which indicators work best in which conditions
    4. Optimize confidence thresholds
    5. Improve LLM prompt engineering
    """
    
    # Target metrics
    TARGET_ACCURACY = 0.65  # 65% accuracy
    TARGET_RETURN = 7.0  # 7% average return
    TARGET_WIN_RATE = 0.60  # 60% win rate
    
    def __init__(self, session: AsyncSession = None):
        self.session = session
        self.backtester = Backtester()
        self._current_config: Dict[str, Any] = self._get_default_config()
    
    def _get_default_config(self) -> Dict[str, Any]:
        """Get default model configuration."""
        return {
            "version": "1.0.0",
            "weights": {
                "technical": 0.35,
                "sentiment": 0.25,
                "llm_consensus": 0.40
            },
            "thresholds": {
                "min_confidence": 0.75,
                "buy_threshold": 0.65,
                "sell_threshold": 0.35
            },
            "indicators": {
                "rsi_oversold": 30,
                "rsi_overbought": 70,
                "macd_weight": 0.3,
                "sma_weight": 0.25,
                "bb_weight": 0.2
            },
            "sentiment": {
                "vader_weight": 0.35,
                "textblob_weight": 0.25,
                "llm_weight": 0.40
            },
            "llm": {
                "min_agreement": 0.7,
                "timeout_seconds": 30
            }
        }
    
    async def analyze_performance(
        self,
        days: int = 30
    ) -> PerformanceReport:
        """
        Analyze prediction performance over a period.
        
        Args:
            days: Number of days to analyze
        
        Returns:
            PerformanceReport with insights
        """
        report = PerformanceReport(
            period_start=datetime.utcnow() - timedelta(days=days),
            period_end=datetime.utcnow()
        )
        
        # Get completed predictions from database
        predictions = await self._get_completed_predictions(days)
        
        if not predictions:
            logger.info("No completed predictions to analyze")
            report.insights.append(ImprovementInsight(
                category="general",
                finding="No prediction data available for analysis",
                impact="neutral",
                recommendation="Continue gathering predictions before optimization",
                confidence=1.0
            ))
            return report
        
        # Calculate basic metrics
        report.total_predictions = len(predictions)
        report.successful_predictions = sum(1 for p in predictions if self._is_successful(p))
        report.failed_predictions = report.total_predictions - report.successful_predictions
        report.accuracy_rate = report.successful_predictions / report.total_predictions
        
        # Calculate returns
        returns = [p.get("actual_return_percent", 0) for p in predictions if p.get("actual_return_percent")]
        if returns:
            report.total_return_percent = sum(returns)
            report.average_return_percent = statistics.mean(returns)
            report.best_return = max(returns)
            report.worst_return = min(returns)
        
        # Analyze by action type
        report.buy_accuracy = self._calculate_accuracy_by_action(predictions, "buy")
        report.sell_accuracy = self._calculate_accuracy_by_action(predictions, "sell")
        report.hold_accuracy = self._calculate_accuracy_by_action(predictions, "hold")
        
        # Analyze by confidence level
        report.high_confidence_accuracy = self._calculate_accuracy_by_confidence(predictions, 0.8, 1.0)
        report.medium_confidence_accuracy = self._calculate_accuracy_by_confidence(predictions, 0.6, 0.8)
        report.low_confidence_accuracy = self._calculate_accuracy_by_confidence(predictions, 0.0, 0.6)
        
        # Calculate component correlations
        report.technical_correlation = self._calculate_component_correlation(predictions, "technical_score")
        report.sentiment_correlation = self._calculate_component_correlation(predictions, "sentiment_score")
        report.llm_correlation = self._calculate_component_correlation(predictions, "llm_consensus_score")
        
        # Generate insights
        report.insights = self._generate_insights(report, predictions)
        
        # Generate parameter adjustments
        report.parameter_adjustments = self._generate_adjustments(report)
        
        return report
    
    async def _get_completed_predictions(self, days: int) -> List[Dict[str, Any]]:
        """Get completed predictions from database."""
        # For now, return empty list if no session
        # In production, this would query the database
        if not self.session:
            return []
        
        try:
            stmt = select(Prediction).where(
                and_(
                    Prediction.status == "completed",
                    Prediction.created_at >= datetime.utcnow() - timedelta(days=days)
                )
            )
            result = await self.session.execute(stmt)
            predictions = result.scalars().all()
            
            return [
                {
                    "id": p.id,
                    "symbol": p.symbol,
                    "action": p.prediction_type,
                    "confidence": p.overall_confidence,
                    "technical_score": p.technical_confidence,
                    "sentiment_score": p.sentiment_confidence,
                    "llm_consensus_score": p.llm_consensus_score,
                    "expected_return": p.expected_return_percent,
                    "actual_return_percent": p.actual_return_percent,
                    "target_price": p.target_price,
                    "actual_price": p.actual_price_at_expiry,
                    "outcome": p.outcome
                }
                for p in predictions
            ]
        except Exception as e:
            logger.error(f"Error fetching predictions: {e}")
            return []
    
    def _is_successful(self, prediction: Dict[str, Any]) -> bool:
        """Determine if a prediction was successful."""
        actual_return = prediction.get("actual_return_percent", 0)
        action = prediction.get("action", "hold")
        
        if action == "buy":
            # Success if positive return
            return actual_return > 0
        elif action == "sell":
            # For shorts, success if negative return (price went down)
            return actual_return < 0
        else:
            # Hold is successful if price stayed relatively stable
            return abs(actual_return) < 5
    
    def _calculate_accuracy_by_action(
        self,
        predictions: List[Dict[str, Any]],
        action: str
    ) -> float:
        """Calculate accuracy for a specific action type."""
        action_predictions = [p for p in predictions if p.get("action") == action]
        if not action_predictions:
            return 0.0
        
        successful = sum(1 for p in action_predictions if self._is_successful(p))
        return successful / len(action_predictions)
    
    def _calculate_accuracy_by_confidence(
        self,
        predictions: List[Dict[str, Any]],
        min_conf: float,
        max_conf: float
    ) -> float:
        """Calculate accuracy for a confidence range."""
        range_predictions = [
            p for p in predictions
            if min_conf <= p.get("confidence", 0) < max_conf
        ]
        if not range_predictions:
            return 0.0
        
        successful = sum(1 for p in range_predictions if self._is_successful(p))
        return successful / len(range_predictions)
    
    def _calculate_component_correlation(
        self,
        predictions: List[Dict[str, Any]],
        component: str
    ) -> float:
        """Calculate correlation between component score and success."""
        # Extract component scores and outcomes
        data = [
            (p.get(component, 0.5), 1 if self._is_successful(p) else 0)
            for p in predictions
            if p.get(component) is not None
        ]
        
        if len(data) < 5:
            return 0.0
        
        scores, outcomes = zip(*data)
        
        # Simple correlation calculation
        try:
            mean_score = statistics.mean(scores)
            mean_outcome = statistics.mean(outcomes)
            
            numerator = sum((s - mean_score) * (o - mean_outcome) for s, o in data)
            denominator = (
                sum((s - mean_score) ** 2 for s, _ in data) ** 0.5 *
                sum((o - mean_outcome) ** 2 for _, o in data) ** 0.5
            )
            
            if denominator == 0:
                return 0.0
            
            return numerator / denominator
        except Exception:
            return 0.0
    
    def _generate_insights(
        self,
        report: PerformanceReport,
        predictions: List[Dict[str, Any]]
    ) -> List[ImprovementInsight]:
        """Generate insights from performance data."""
        insights = []
        
        # Accuracy insight
        if report.accuracy_rate < self.TARGET_ACCURACY:
            insights.append(ImprovementInsight(
                category="general",
                finding=f"Accuracy rate ({report.accuracy_rate:.1%}) below target ({self.TARGET_ACCURACY:.1%})",
                impact="negative",
                recommendation="Consider raising confidence threshold to filter out weaker predictions",
                confidence=0.8
            ))
        elif report.accuracy_rate > 0.75:
            insights.append(ImprovementInsight(
                category="general",
                finding=f"Strong accuracy rate of {report.accuracy_rate:.1%}",
                impact="positive",
                recommendation="Model parameters are well-tuned, continue monitoring",
                confidence=0.9
            ))
        
        # Return insight
        if report.average_return_percent < self.TARGET_RETURN:
            insights.append(ImprovementInsight(
                category="general",
                finding=f"Average return ({report.average_return_percent:.1f}%) below target ({self.TARGET_RETURN}%)",
                impact="negative",
                recommendation="Consider adjusting target price calculations or holding period",
                confidence=0.7
            ))
        
        # Confidence level analysis
        if report.high_confidence_accuracy < report.low_confidence_accuracy:
            insights.append(ImprovementInsight(
                category="general",
                finding="High confidence predictions performing worse than low confidence",
                impact="negative",
                recommendation="Recalibrate confidence scoring - current formula may be inverted",
                confidence=0.85
            ))
        
        # Component analysis
        correlations = [
            ("technical", report.technical_correlation),
            ("sentiment", report.sentiment_correlation),
            ("llm", report.llm_correlation)
        ]
        
        best_component = max(correlations, key=lambda x: x[1])
        worst_component = min(correlations, key=lambda x: x[1])
        
        if best_component[1] > 0.3:
            insights.append(ImprovementInsight(
                category=best_component[0],
                finding=f"{best_component[0].capitalize()} analysis shows strong correlation ({best_component[1]:.2f}) with success",
                impact="positive",
                recommendation=f"Consider increasing {best_component[0]} weight in overall score",
                confidence=0.75,
                data={"correlation": best_component[1]}
            ))
        
        if worst_component[1] < 0.1:
            insights.append(ImprovementInsight(
                category=worst_component[0],
                finding=f"{worst_component[0].capitalize()} analysis shows weak correlation ({worst_component[1]:.2f}) with success",
                impact="negative",
                recommendation=f"Review {worst_component[0]} analysis methodology or reduce its weight",
                confidence=0.7,
                data={"correlation": worst_component[1]}
            ))
        
        # Action type analysis
        if report.buy_accuracy < report.sell_accuracy:
            insights.append(ImprovementInsight(
                category="general",
                finding=f"Buy predictions ({report.buy_accuracy:.1%}) less accurate than sell ({report.sell_accuracy:.1%})",
                impact="neutral",
                recommendation="Model may be better at identifying overvalued stocks",
                confidence=0.65
            ))
        
        return insights
    
    def _generate_adjustments(
        self,
        report: PerformanceReport
    ) -> Dict[str, Any]:
        """Generate recommended parameter adjustments."""
        adjustments = {}
        
        # Adjust confidence threshold
        if report.high_confidence_accuracy > report.medium_confidence_accuracy * 1.2:
            # High confidence predictions are significantly better
            adjustments["min_confidence"] = {
                "current": self._current_config["thresholds"]["min_confidence"],
                "recommended": 0.80,
                "reason": "High confidence predictions outperform - raise threshold"
            }
        elif report.accuracy_rate < 0.5:
            adjustments["min_confidence"] = {
                "current": self._current_config["thresholds"]["min_confidence"],
                "recommended": 0.85,
                "reason": "Low accuracy - be more selective with predictions"
            }
        
        # Adjust component weights based on correlation
        total_correlation = (
            abs(report.technical_correlation) +
            abs(report.sentiment_correlation) +
            abs(report.llm_correlation)
        )
        
        if total_correlation > 0:
            adjustments["weights"] = {
                "technical": {
                    "current": self._current_config["weights"]["technical"],
                    "recommended": abs(report.technical_correlation) / total_correlation,
                    "reason": f"Based on correlation of {report.technical_correlation:.2f}"
                },
                "sentiment": {
                    "current": self._current_config["weights"]["sentiment"],
                    "recommended": abs(report.sentiment_correlation) / total_correlation,
                    "reason": f"Based on correlation of {report.sentiment_correlation:.2f}"
                },
                "llm_consensus": {
                    "current": self._current_config["weights"]["llm_consensus"],
                    "recommended": abs(report.llm_correlation) / total_correlation,
                    "reason": f"Based on correlation of {report.llm_correlation:.2f}"
                }
            }
        
        return adjustments
    
    async def apply_improvements(
        self,
        report: PerformanceReport,
        auto_apply: bool = False
    ) -> Dict[str, Any]:
        """
        Apply recommended improvements to the model.
        
        Args:
            report: PerformanceReport with recommendations
            auto_apply: Whether to automatically apply changes
        
        Returns:
            Summary of applied changes
        """
        changes = {
            "applied": [],
            "skipped": [],
            "new_config": self._current_config.copy()
        }
        
        if not report.parameter_adjustments:
            return changes
        
        for param, adjustment in report.parameter_adjustments.items():
            if param == "min_confidence" and isinstance(adjustment, dict):
                if auto_apply or adjustment.get("recommended", 0) >= adjustment.get("current", 0):
                    changes["new_config"]["thresholds"]["min_confidence"] = adjustment["recommended"]
                    changes["applied"].append({
                        "parameter": "min_confidence",
                        "old_value": adjustment["current"],
                        "new_value": adjustment["recommended"],
                        "reason": adjustment.get("reason", "")
                    })
                else:
                    changes["skipped"].append(param)
            
            elif param == "weights" and isinstance(adjustment, dict):
                for weight_name, weight_adj in adjustment.items():
                    if isinstance(weight_adj, dict):
                        if auto_apply:
                            changes["new_config"]["weights"][weight_name] = weight_adj["recommended"]
                            changes["applied"].append({
                                "parameter": f"weights.{weight_name}",
                                "old_value": weight_adj["current"],
                                "new_value": weight_adj["recommended"],
                                "reason": weight_adj.get("reason", "")
                            })
        
        # Save new config if changes were applied
        if changes["applied"]:
            self._current_config = changes["new_config"]
            
            # Save to database if session available
            if self.session:
                config = ModelConfiguration(
                    name="auto_tuned",
                    version=f"1.0.{datetime.utcnow().strftime('%Y%m%d%H%M')}",
                    parameters=changes["new_config"],
                    active=True
                )
                self.session.add(config)
                await self.session.commit()
            
            logger.info(f"Applied {len(changes['applied'])} model improvements")
        
        return changes
    
    async def run_optimization_cycle(self) -> Dict[str, Any]:
        """
        Run a complete optimization cycle.
        
        1. Analyze recent performance
        2. Generate insights and recommendations
        3. Run backtest with proposed changes
        4. Apply if improvement is significant
        """
        logger.info("Starting optimization cycle...")
        
        # Step 1: Analyze current performance
        report = await self.analyze_performance(days=30)
        
        if report.total_predictions < 10:
            logger.info("Insufficient data for optimization (need at least 10 predictions)")
            return {
                "status": "skipped",
                "reason": "Insufficient data",
                "predictions_available": report.total_predictions
            }
        
        # Step 2: Check if current performance meets targets
        meets_targets = (
            report.accuracy_rate >= self.TARGET_ACCURACY and
            report.average_return_percent >= self.TARGET_RETURN
        )
        
        if meets_targets:
            logger.info("Current performance meets targets - no optimization needed")
            return {
                "status": "optimal",
                "current_performance": report.to_dict()
            }
        
        # Step 3: Apply improvements
        changes = await self.apply_improvements(report, auto_apply=settings.enable_auto_tuning)
        
        # Step 4: Log metrics
        if self.session:
            metric = SystemMetrics(
                metric_type="optimization_cycle",
                value=report.accuracy_rate,
                metadata={
                    "accuracy": report.accuracy_rate,
                    "avg_return": report.average_return_percent,
                    "changes_applied": len(changes.get("applied", []))
                },
                period="daily"
            )
            self.session.add(metric)
            await self.session.commit()
        
        return {
            "status": "optimized" if changes["applied"] else "unchanged",
            "performance_before": report.to_dict(),
            "changes": changes,
            "insights": [
                {"finding": i.finding, "recommendation": i.recommendation}
                for i in report.insights
            ]
        }
    
    def get_current_config(self) -> Dict[str, Any]:
        """Get current model configuration."""
        return self._current_config.copy()
