"""
Investment Tracker.
Manages and tracks investments, monitors performance, and flags issues.
"""

from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from dataclasses import dataclass, field
from enum import Enum
import statistics

from loguru import logger
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.config import settings
from src.models import Investment, Prediction
from src.scrapers import StockDataFetcher


class InvestmentStatus(Enum):
    """Investment status types."""
    PENDING = "pending"
    ACTIVE = "active"
    CLOSED_PROFIT = "closed_profit"
    CLOSED_LOSS = "closed_loss"
    CLOSED_BREAK_EVEN = "closed_break_even"
    FLAGGED = "flagged"


@dataclass
class InvestmentPosition:
    """Current investment position."""
    
    id: int = 0
    prediction_id: int = 0
    symbol: str = ""
    
    # Entry
    entry_date: datetime = None
    entry_price: float = 0.0
    shares: float = 0.0
    amount_invested: float = 0.0
    
    # Current
    current_price: float = 0.0
    current_value: float = 0.0
    unrealized_pnl: float = 0.0
    unrealized_pnl_percent: float = 0.0
    
    # Targets
    target_price: float = 0.0
    stop_loss: float = 0.0
    expiry_date: datetime = None
    
    # Status
    status: InvestmentStatus = InvestmentStatus.ACTIVE
    days_held: int = 0
    
    # Flags
    flagged: bool = False
    flag_reason: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "symbol": self.symbol,
            "entry_date": self.entry_date.isoformat() if self.entry_date else None,
            "entry_price": self.entry_price,
            "shares": self.shares,
            "amount_invested": self.amount_invested,
            "current_price": self.current_price,
            "current_value": self.current_value,
            "unrealized_pnl": self.unrealized_pnl,
            "unrealized_pnl_percent": self.unrealized_pnl_percent,
            "target_price": self.target_price,
            "stop_loss": self.stop_loss,
            "days_held": self.days_held,
            "status": self.status.value,
            "flagged": self.flagged,
            "flag_reason": self.flag_reason,
        }


@dataclass
class PortfolioSummary:
    """Portfolio summary statistics."""
    
    total_invested: float = 0.0
    current_value: float = 0.0
    total_pnl: float = 0.0
    total_pnl_percent: float = 0.0
    
    # Positions
    active_positions: int = 0
    closed_positions: int = 0
    winning_positions: int = 0
    losing_positions: int = 0
    
    # Performance
    win_rate: float = 0.0
    average_return: float = 0.0
    best_return: float = 0.0
    worst_return: float = 0.0
    
    # Risk
    flagged_investments: int = 0
    below_stop_loss: int = 0
    near_expiry: int = 0
    
    # Breakdown
    positions: List[InvestmentPosition] = field(default_factory=list)
    by_symbol: Dict[str, Dict[str, float]] = field(default_factory=dict)


class InvestmentTracker:
    """
    Tracks investments and monitors performance.
    
    Features:
    - Create and manage investment positions
    - Real-time P&L tracking
    - Automatic flagging of underperforming investments
    - Loss analysis and learning
    """
    
    def __init__(self, session: AsyncSession = None):
        self.session = session
        self.stock_fetcher = StockDataFetcher()
        self._cache: Dict[str, Any] = {}
    
    async def create_investment(
        self,
        prediction_id: int,
        symbol: str,
        amount: float,
        entry_price: float = None,
        target_price: float = None,
        stop_loss: float = None,
    ) -> InvestmentPosition:
        """
        Create a new investment based on a prediction.
        
        Args:
            prediction_id: ID of the prediction
            symbol: Stock symbol
            amount: Amount to invest in dollars
            entry_price: Entry price (default: current market price)
            target_price: Target exit price
            stop_loss: Stop loss price
        
        Returns:
            InvestmentPosition
        """
        # Get current price if not provided
        if entry_price is None:
            quote = await self.stock_fetcher.get_realtime_quote(symbol)
            if quote:
                entry_price = quote.get("price", 0)
            else:
                raise ValueError(f"Could not get price for {symbol}")
        
        # Calculate shares
        shares = amount / entry_price if entry_price > 0 else 0
        
        position = InvestmentPosition(
            prediction_id=prediction_id,
            symbol=symbol,
            entry_date=datetime.utcnow(),
            entry_price=entry_price,
            shares=shares,
            amount_invested=amount,
            current_price=entry_price,
            current_value=amount,
            target_price=target_price or entry_price * 1.07,  # Default 7% target
            stop_loss=stop_loss or entry_price * 0.95,  # Default 5% stop
            status=InvestmentStatus.ACTIVE
        )
        
        # Save to database if session available
        if self.session:
            db_investment = Investment(
                prediction_id=prediction_id,
                symbol=symbol,
                amount_invested=amount,
                shares=shares,
                entry_price=entry_price,
                outcome="pending"
            )
            self.session.add(db_investment)
            await self.session.commit()
            position.id = db_investment.id
        
        logger.info(f"Created investment: {symbol} @ ${entry_price:.2f} x {shares:.4f} shares")
        
        return position
    
    async def update_positions(
        self,
        positions: List[InvestmentPosition]
    ) -> List[InvestmentPosition]:
        """
        Update all positions with current prices.
        
        Args:
            positions: List of positions to update
        
        Returns:
            Updated positions
        """
        # Get unique symbols
        symbols = list(set(p.symbol for p in positions))
        
        # Fetch current prices
        prices = {}
        for symbol in symbols:
            quote = await self.stock_fetcher.get_realtime_quote(symbol)
            if quote:
                prices[symbol] = quote.get("price", 0)
        
        # Update each position
        for position in positions:
            if position.symbol in prices:
                position.current_price = prices[position.symbol]
                position.current_value = position.shares * position.current_price
                position.unrealized_pnl = position.current_value - position.amount_invested
                position.unrealized_pnl_percent = (
                    (position.unrealized_pnl / position.amount_invested) * 100
                    if position.amount_invested > 0 else 0
                )
                
                if position.entry_date:
                    position.days_held = (datetime.utcnow() - position.entry_date).days
                
                # Check for flags
                position = self._check_flags(position)
        
        return positions
    
    def _check_flags(self, position: InvestmentPosition) -> InvestmentPosition:
        """Check if position needs to be flagged."""
        position.flagged = False
        position.flag_reason = ""
        
        # Below stop loss
        if position.current_price <= position.stop_loss:
            position.flagged = True
            position.flag_reason = "Price below stop loss"
            position.status = InvestmentStatus.FLAGGED
        
        # Large unrealized loss (>10%)
        elif position.unrealized_pnl_percent < -10:
            position.flagged = True
            position.flag_reason = f"Large unrealized loss: {position.unrealized_pnl_percent:.1f}%"
        
        # Near expiry with loss
        elif position.expiry_date:
            days_to_expiry = (position.expiry_date - datetime.utcnow()).days
            if days_to_expiry <= 3 and position.unrealized_pnl_percent < 0:
                position.flagged = True
                position.flag_reason = f"Approaching expiry with {position.unrealized_pnl_percent:.1f}% loss"
        
        # Underperforming (held too long without profit)
        elif position.days_held > 45 and position.unrealized_pnl_percent < 3:
            position.flagged = True
            position.flag_reason = f"Held {position.days_held} days with minimal gain"
        
        return position
    
    async def close_investment(
        self,
        position: InvestmentPosition,
        exit_price: float = None,
        reason: str = ""
    ) -> Dict[str, Any]:
        """
        Close an investment position.
        
        Args:
            position: Position to close
            exit_price: Exit price (default: current market price)
            reason: Reason for closing
        
        Returns:
            Closure summary
        """
        if exit_price is None:
            quote = await self.stock_fetcher.get_realtime_quote(position.symbol)
            exit_price = quote.get("price", position.current_price) if quote else position.current_price
        
        # Calculate final P&L
        final_value = position.shares * exit_price
        realized_pnl = final_value - position.amount_invested
        realized_pnl_percent = (realized_pnl / position.amount_invested) * 100
        
        # Determine outcome
        if realized_pnl_percent >= settings.target_return_percent:
            outcome = "profit_target_met"
            status = InvestmentStatus.CLOSED_PROFIT
        elif realized_pnl_percent > 0.5:
            outcome = "profit"
            status = InvestmentStatus.CLOSED_PROFIT
        elif realized_pnl_percent < -0.5:
            outcome = "loss"
            status = InvestmentStatus.CLOSED_LOSS
        else:
            outcome = "break_even"
            status = InvestmentStatus.CLOSED_BREAK_EVEN
        
        result = {
            "position_id": position.id,
            "symbol": position.symbol,
            "entry_date": position.entry_date,
            "exit_date": datetime.utcnow(),
            "entry_price": position.entry_price,
            "exit_price": exit_price,
            "shares": position.shares,
            "amount_invested": position.amount_invested,
            "final_value": final_value,
            "realized_pnl": realized_pnl,
            "realized_pnl_percent": realized_pnl_percent,
            "days_held": position.days_held,
            "outcome": outcome,
            "reason": reason,
            "met_target": realized_pnl_percent >= settings.target_return_percent,
        }
        
        # Update database if session available
        if self.session and position.id:
            stmt = select(Investment).where(Investment.id == position.id)
            db_result = await self.session.execute(stmt)
            db_investment = db_result.scalar_one_or_none()
            
            if db_investment:
                db_investment.exit_price = exit_price
                db_investment.exit_date = datetime.utcnow()
                db_investment.return_amount = realized_pnl
                db_investment.return_percent = realized_pnl_percent
                db_investment.outcome = outcome
                await self.session.commit()
        
        logger.info(f"Closed investment {position.symbol}: {realized_pnl_percent:+.2f}% ({outcome})")
        
        # If loss, analyze why
        if status == InvestmentStatus.CLOSED_LOSS:
            result["loss_analysis"] = await self.analyze_loss(position, result)
        
        return result
    
    async def analyze_loss(
        self,
        position: InvestmentPosition,
        closure: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Analyze why an investment resulted in a loss.
        
        This helps the system learn and improve.
        """
        analysis = {
            "loss_amount": closure.get("realized_pnl", 0),
            "loss_percent": closure.get("realized_pnl_percent", 0),
            "days_held": position.days_held,
            "potential_causes": [],
            "lessons": [],
            "recommendations": []
        }
        
        # Get historical data during holding period
        try:
            df = await self.stock_fetcher.get_historical_data(
                position.symbol,
                position.entry_date,
                datetime.utcnow()
            )
            
            if df is not None and not df.empty:
                close_col = "Close" if "Close" in df.columns else "close"
                
                # Analyze price action
                max_price = df[close_col].max()
                min_price = df[close_col].min()
                
                max_gain = ((max_price - position.entry_price) / position.entry_price) * 100
                max_drawdown = ((min_price - position.entry_price) / position.entry_price) * 100
                
                analysis["max_potential_gain"] = max_gain
                analysis["max_drawdown"] = max_drawdown
                
                # Analyze what went wrong
                if max_gain > settings.target_return_percent:
                    analysis["potential_causes"].append(
                        f"Target was reached but position wasn't closed. Max gain was {max_gain:.1f}%"
                    )
                    analysis["lessons"].append("Consider implementing automatic profit-taking")
                
                if max_drawdown < -15:
                    analysis["potential_causes"].append(
                        f"Large drawdown of {max_drawdown:.1f}% occurred"
                    )
                    analysis["lessons"].append("Stop loss may have been set too loose")
                
                # Check if stop loss was honored
                if min_price < position.stop_loss:
                    analysis["potential_causes"].append("Stop loss was breached")
                    analysis["recommendations"].append("Review stop loss execution")
        
        except Exception as e:
            logger.error(f"Error analyzing loss for {position.symbol}: {e}")
        
        # General lessons based on loss magnitude
        if analysis["loss_percent"] < -10:
            analysis["lessons"].append("Consider using tighter position sizing")
            analysis["recommendations"].append("Reduce position size for similar setups")
        
        if position.days_held > 30:
            analysis["lessons"].append("Position was held too long despite not performing")
            analysis["recommendations"].append("Implement time-based exits")
        
        return analysis
    
    async def get_portfolio_summary(
        self,
        positions: List[InvestmentPosition] = None
    ) -> PortfolioSummary:
        """
        Get portfolio summary and statistics.
        
        Args:
            positions: List of positions (will fetch from DB if not provided)
        
        Returns:
            PortfolioSummary
        """
        if positions is None:
            positions = []
            # Fetch from database if session available
            if self.session:
                stmt = select(Investment).where(Investment.outcome == "pending")
                result = await self.session.execute(stmt)
                db_investments = result.scalars().all()
                
                for inv in db_investments:
                    pos = InvestmentPosition(
                        id=inv.id,
                        prediction_id=inv.prediction_id,
                        symbol=inv.symbol,
                        entry_date=inv.created_at,
                        entry_price=inv.entry_price,
                        shares=inv.shares,
                        amount_invested=inv.amount_invested,
                        status=InvestmentStatus.ACTIVE
                    )
                    positions.append(pos)
        
        # Update with current prices
        if positions:
            positions = await self.update_positions(positions)
        
        summary = PortfolioSummary()
        summary.positions = positions
        summary.active_positions = len(positions)
        
        if not positions:
            return summary
        
        # Calculate totals
        summary.total_invested = sum(p.amount_invested for p in positions)
        summary.current_value = sum(p.current_value for p in positions)
        summary.total_pnl = summary.current_value - summary.total_invested
        summary.total_pnl_percent = (
            (summary.total_pnl / summary.total_invested) * 100
            if summary.total_invested > 0 else 0
        )
        
        # Count winning/losing
        summary.winning_positions = sum(1 for p in positions if p.unrealized_pnl > 0)
        summary.losing_positions = sum(1 for p in positions if p.unrealized_pnl < 0)
        
        # Returns
        returns = [p.unrealized_pnl_percent for p in positions]
        summary.average_return = statistics.mean(returns) if returns else 0
        summary.best_return = max(returns) if returns else 0
        summary.worst_return = min(returns) if returns else 0
        
        # Flags
        summary.flagged_investments = sum(1 for p in positions if p.flagged)
        summary.below_stop_loss = sum(
            1 for p in positions if p.current_price <= p.stop_loss
        )
        
        # By symbol
        for position in positions:
            if position.symbol not in summary.by_symbol:
                summary.by_symbol[position.symbol] = {
                    "invested": 0,
                    "current_value": 0,
                    "pnl": 0,
                    "pnl_percent": 0,
                    "positions": 0
                }
            
            summary.by_symbol[position.symbol]["invested"] += position.amount_invested
            summary.by_symbol[position.symbol]["current_value"] += position.current_value
            summary.by_symbol[position.symbol]["pnl"] += position.unrealized_pnl
            summary.by_symbol[position.symbol]["positions"] += 1
        
        # Calculate per-symbol percentages
        for symbol in summary.by_symbol:
            invested = summary.by_symbol[symbol]["invested"]
            pnl = summary.by_symbol[symbol]["pnl"]
            summary.by_symbol[symbol]["pnl_percent"] = (pnl / invested) * 100 if invested > 0 else 0
        
        return summary
    
    async def get_flagged_investments(
        self,
        positions: List[InvestmentPosition] = None
    ) -> List[InvestmentPosition]:
        """Get all flagged investments that need review."""
        if positions is None:
            summary = await self.get_portfolio_summary()
            positions = summary.positions
        
        return [p for p in positions if p.flagged]
    
    async def get_investment_history(
        self,
        limit: int = 100
    ) -> List[Dict[str, Any]]:
        """Get historical investment records."""
        if not self.session:
            return []
        
        stmt = (
            select(Investment)
            .where(Investment.outcome != "pending")
            .order_by(Investment.exit_date.desc())
            .limit(limit)
        )
        
        result = await self.session.execute(stmt)
        investments = result.scalars().all()
        
        history = []
        for inv in investments:
            history.append({
                "id": inv.id,
                "symbol": inv.symbol,
                "entry_price": inv.entry_price,
                "exit_price": inv.exit_price,
                "amount_invested": inv.amount_invested,
                "return_amount": inv.return_amount,
                "return_percent": inv.return_percent,
                "outcome": inv.outcome,
                "created_at": inv.created_at.isoformat() if inv.created_at else None,
                "exit_date": inv.exit_date.isoformat() if inv.exit_date else None,
            })
        
        return history
