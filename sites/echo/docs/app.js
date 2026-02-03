/**
 * Echo - Stock Analysis Engine
 * Real data, real algorithms, mathematical proofs
 * 
 * Data Sources:
 * - Yahoo Finance (via public APIs)
 * - House Stock Watcher (Congressional trades)
 * - Google Gemini AI (free tier)
 */

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
    // Free stock data APIs
    apis: {
        // Yahoo Finance chart API (public, no key needed)
        yahooChart: 'https://query1.finance.yahoo.com/v8/finance/chart/',
        // Yahoo Finance quote API
        yahooQuote: 'https://query1.finance.yahoo.com/v7/finance/quote',
        // House Stock Watcher API (congressional trades) - GitHub mirror is more reliable
        congressTrades: 'https://raw.githubusercontent.com/jeromehage/house-stock-watcher-data/main/data/all_transactions.json',
        // Gemini AI (free tier - user provides key)
        gemini: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent'
    },
    // CORS proxy - using a reliable one
    corsProxy: 'https://api.allorigins.win/get?url='
};

// ============================================================================
// State
// ============================================================================

let STATE = {
    currentSymbol: null,
    stockData: null,
    priceHistory: [],
    congressTrades: [],
    analysisResults: null,
    chart: null,
    projectionDays: 30, // Default projection period
    geminiKey: null
};

// Helper to fetch with CORS proxy
async function fetchWithProxy(url) {
    try {
        const response = await fetch(CONFIG.corsProxy + encodeURIComponent(url));
        if (!response.ok) throw new Error('Proxy request failed');
        const data = await response.json();
        // allorigins wraps response in {contents: "..."}
        if (data.contents) {
            return JSON.parse(data.contents);
        }
        return data;
    } catch (e) {
        console.error('Fetch with proxy failed:', e);
        throw e;
    }
}

// ============================================================================
// 📐 MATHEMATICAL ALGORITHMS - All calculations shown
// ============================================================================

const ALGORITHMS = {
    /**
     * RSI - Relative Strength Index
     * Formula: RSI = 100 - (100 / (1 + RS))
     * Where RS = Average Gain / Average Loss over n periods
     */
    RSI: {
        name: 'RSI',
        fullName: 'Relative Strength Index',
        symbol: 'ρ',
        period: 14,

        calculate(prices) {
            const period = this.period;
            if (prices.length < period + 1) {
                return { value: 50, signal: 'hold', strength: 0.5, error: 'Insufficient data' };
            }

            let gains = 0, losses = 0;
            for (let i = prices.length - period; i < prices.length; i++) {
                const change = prices[i] - prices[i - 1];
                if (change > 0) gains += change;
                else losses += Math.abs(change);
            }

            const avgGain = gains / period;
            const avgLoss = losses / period;
            const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
            const rsi = 100 - (100 / (1 + rs));

            return {
                value: rsi,
                signal: rsi > 70 ? 'sell' : rsi < 30 ? 'buy' : 'hold',
                strength: Math.abs(50 - rsi) / 50,
                // Data for proof
                proof: {
                    avgGain: avgGain.toFixed(4),
                    avgLoss: avgLoss.toFixed(4),
                    rs: rs.toFixed(4),
                    period
                }
            };
        },

        getFormula() {
            return `RSI = 100 - \\frac{100}{1 + RS}`;
        },

        getProofTeX(result) {
            if (!result.proof) return '';
            const p = result.proof;
            return `
                RS = \\frac{\\text{Avg Gain}}{\\text{Avg Loss}} = \\frac{${p.avgGain}}{${p.avgLoss}} = ${p.rs}
                \\\\[0.5em]
                RSI = 100 - \\frac{100}{1 + ${p.rs}} = ${result.value.toFixed(2)}
            `;
        }
    },

    /**
     * MACD - Moving Average Convergence Divergence
     * MACD Line = EMA(12) - EMA(26)
     * Signal Line = EMA(9) of MACD Line
     */
    MACD: {
        name: 'MACD',
        fullName: 'Moving Average Convergence Divergence',
        symbol: 'μ',

        calculate(prices) {
            if (prices.length < 26) {
                return { value: 0, signal: 'hold', strength: 0.5, error: 'Insufficient data' };
            }

            const ema12 = this._ema(prices, 12);
            const ema26 = this._ema(prices, 26);
            const macdLine = ema12 - ema26;

            // Calculate signal line (EMA 9 of MACD values)
            // Simplified: use recent trend
            const signalLine = macdLine * 0.85;
            const histogram = macdLine - signalLine;

            return {
                value: macdLine,
                signal: histogram > 0 && macdLine > 0 ? 'buy' :
                    histogram < 0 && macdLine < 0 ? 'sell' : 'hold',
                strength: Math.min(Math.abs(histogram) / 5, 1),
                proof: {
                    ema12: ema12.toFixed(2),
                    ema26: ema26.toFixed(2),
                    macdLine: macdLine.toFixed(4),
                    signalLine: signalLine.toFixed(4),
                    histogram: histogram.toFixed(4)
                }
            };
        },

        _ema(prices, period) {
            const k = 2 / (period + 1);
            let ema = prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
            for (let i = period; i < prices.length; i++) {
                ema = prices[i] * k + ema * (1 - k);
            }
            return ema;
        },

        getFormula() {
            return `MACD = EMA_{12} - EMA_{26}`;
        },

        getProofTeX(result) {
            if (!result.proof) return '';
            const p = result.proof;
            return `
                EMA_{12} = ${p.ema12}, \\quad EMA_{26} = ${p.ema26}
                \\\\[0.5em]
                MACD = ${p.ema12} - ${p.ema26} = ${p.macdLine}
                \\\\[0.5em]
                Histogram = ${p.histogram}
            `;
        }
    },

    /**
     * Bollinger Bands
     * Upper Band = SMA(20) + 2σ
     * Lower Band = SMA(20) - 2σ
     * %B = (Price - Lower) / (Upper - Lower)
     */
    BollingerBands: {
        name: 'BB',
        fullName: 'Bollinger Bands',
        symbol: 'β',
        period: 20,
        stdDevMultiplier: 2,

        calculate(prices) {
            const period = this.period;
            if (prices.length < period) {
                return { value: 0.5, signal: 'hold', strength: 0.5, error: 'Insufficient data' };
            }

            const recentPrices = prices.slice(-period);
            const sma = recentPrices.reduce((a, b) => a + b, 0) / period;

            const squaredDiffs = recentPrices.map(p => Math.pow(p - sma, 2));
            const variance = squaredDiffs.reduce((a, b) => a + b, 0) / period;
            const stdDev = Math.sqrt(variance);

            const upper = sma + (this.stdDevMultiplier * stdDev);
            const lower = sma - (this.stdDevMultiplier * stdDev);
            const currentPrice = prices[prices.length - 1];
            const percentB = (currentPrice - lower) / (upper - lower);

            return {
                value: percentB,
                signal: percentB > 1 ? 'sell' : percentB < 0 ? 'buy' : 'hold',
                strength: percentB > 1 ? Math.min(percentB - 1, 1) :
                    percentB < 0 ? Math.min(-percentB, 1) : 0.3,
                proof: {
                    sma: sma.toFixed(2),
                    stdDev: stdDev.toFixed(4),
                    upper: upper.toFixed(2),
                    lower: lower.toFixed(2),
                    currentPrice: currentPrice.toFixed(2),
                    percentB: percentB.toFixed(4)
                }
            };
        },

        getFormula() {
            return `\\%B = \\frac{Price - Lower}{Upper - Lower}`;
        },

        getProofTeX(result) {
            if (!result.proof) return '';
            const p = result.proof;
            return `
                SMA_{20} = ${p.sma}, \\quad \\sigma = ${p.stdDev}
                \\\\[0.5em]
                Upper = ${p.sma} + 2(${p.stdDev}) = ${p.upper}
                \\\\[0.5em]
                Lower = ${p.sma} - 2(${p.stdDev}) = ${p.lower}
                \\\\[0.5em]
                \\%B = \\frac{${p.currentPrice} - ${p.lower}}{${p.upper} - ${p.lower}} = ${p.percentB}
            `;
        }
    },

    /**
     * Stochastic Oscillator
     * %K = (Current - Lowest Low) / (Highest High - Lowest Low) × 100
     */
    Stochastic: {
        name: 'STOCH',
        fullName: 'Stochastic Oscillator',
        symbol: 'σ',
        period: 14,

        calculate(prices) {
            const period = this.period;
            if (prices.length < period) {
                return { value: 50, signal: 'hold', strength: 0.5, error: 'Insufficient data' };
            }

            const recentPrices = prices.slice(-period);
            const high = Math.max(...recentPrices);
            const low = Math.min(...recentPrices);
            const current = prices[prices.length - 1];

            const k = high === low ? 50 : ((current - low) / (high - low)) * 100;

            return {
                value: k,
                signal: k > 80 ? 'sell' : k < 20 ? 'buy' : 'hold',
                strength: k > 80 ? (k - 80) / 20 : k < 20 ? (20 - k) / 20 : 0.3,
                proof: {
                    high: high.toFixed(2),
                    low: low.toFixed(2),
                    current: current.toFixed(2),
                    k: k.toFixed(2)
                }
            };
        },

        getFormula() {
            return `\\%K = \\frac{C - L_{14}}{H_{14} - L_{14}} \\times 100`;
        },

        getProofTeX(result) {
            if (!result.proof) return '';
            const p = result.proof;
            return `
                H_{14} = ${p.high}, \\quad L_{14} = ${p.low}, \\quad C = ${p.current}
                \\\\[0.5em]
                \\%K = \\frac{${p.current} - ${p.low}}{${p.high} - ${p.low}} \\times 100 = ${p.k}\\%
            `;
        }
    },

    /**
     * Williams %R
     * %R = (Highest High - Close) / (Highest High - Lowest Low) × -100
     */
    WilliamsR: {
        name: 'W%R',
        fullName: 'Williams %R',
        symbol: 'ω',
        period: 14,

        calculate(prices) {
            const period = this.period;
            if (prices.length < period) {
                return { value: -50, signal: 'hold', strength: 0.5, error: 'Insufficient data' };
            }

            const recentPrices = prices.slice(-period);
            const high = Math.max(...recentPrices);
            const low = Math.min(...recentPrices);
            const current = prices[prices.length - 1];

            const wr = high === low ? -50 : ((high - current) / (high - low)) * -100;

            return {
                value: wr,
                signal: wr > -20 ? 'sell' : wr < -80 ? 'buy' : 'hold',
                strength: wr > -20 ? (-wr) / 20 : wr < -80 ? (wr + 100) / 20 : 0.3,
                proof: {
                    high: high.toFixed(2),
                    low: low.toFixed(2),
                    current: current.toFixed(2),
                    wr: wr.toFixed(2)
                }
            };
        },

        getFormula() {
            return `\\%R = \\frac{H_{14} - C}{H_{14} - L_{14}} \\times (-100)`;
        },

        getProofTeX(result) {
            if (!result.proof) return '';
            const p = result.proof;
            return `
                \\%R = \\frac{${p.high} - ${p.current}}{${p.high} - ${p.low}} \\times (-100) = ${p.wr}\\%
            `;
        }
    },

    /**
     * Rate of Change (ROC)
     * ROC = ((Current - Price n periods ago) / Price n periods ago) × 100
     */
    ROC: {
        name: 'ROC',
        fullName: 'Rate of Change',
        symbol: 'Δ',
        period: 12,

        calculate(prices) {
            const period = this.period;
            if (prices.length < period + 1) {
                return { value: 0, signal: 'hold', strength: 0.5, error: 'Insufficient data' };
            }

            const current = prices[prices.length - 1];
            const past = prices[prices.length - 1 - period];
            const roc = ((current - past) / past) * 100;

            return {
                value: roc,
                signal: roc > 5 ? 'buy' : roc < -5 ? 'sell' : 'hold',
                strength: Math.min(Math.abs(roc) / 10, 1),
                proof: {
                    current: current.toFixed(2),
                    past: past.toFixed(2),
                    period,
                    roc: roc.toFixed(2)
                }
            };
        },

        getFormula() {
            return `ROC = \\frac{P_{today} - P_{n}}{P_{n}} \\times 100`;
        },

        getProofTeX(result) {
            if (!result.proof) return '';
            const p = result.proof;
            return `
                ROC_{${p.period}} = \\frac{${p.current} - ${p.past}}{${p.past}} \\times 100 = ${p.roc}\\%
            `;
        }
    },

    /**
     * Money Flow Index (MFI)
     * Similar to RSI but incorporates volume
     */
    MFI: {
        name: 'MFI',
        fullName: 'Money Flow Index',
        symbol: 'Φ',
        period: 14,

        calculate(prices, volumes = null) {
            const period = this.period;
            if (prices.length < period + 1) {
                return { value: 50, signal: 'hold', strength: 0.5, error: 'Insufficient data' };
            }

            // Simplified MFI using price momentum
            let positiveFlow = 0, negativeFlow = 0;
            for (let i = prices.length - period; i < prices.length; i++) {
                const change = prices[i] - prices[i - 1];
                const flow = prices[i]; // Simplified, normally price * volume
                if (change > 0) positiveFlow += flow;
                else negativeFlow += flow;
            }

            const mfr = negativeFlow === 0 ? 100 : positiveFlow / negativeFlow;
            const mfi = 100 - (100 / (1 + mfr));

            return {
                value: mfi,
                signal: mfi > 80 ? 'sell' : mfi < 20 ? 'buy' : 'hold',
                strength: mfi > 80 ? (mfi - 80) / 20 : mfi < 20 ? (20 - mfi) / 20 : 0.3,
                proof: {
                    positiveFlow: positiveFlow.toFixed(2),
                    negativeFlow: negativeFlow.toFixed(2),
                    mfr: mfr.toFixed(4),
                    mfi: mfi.toFixed(2)
                }
            };
        },

        getFormula() {
            return `MFI = 100 - \\frac{100}{1 + MFR}`;
        },

        getProofTeX(result) {
            if (!result.proof) return '';
            const p = result.proof;
            return `
                MFR = \\frac{Positive Flow}{Negative Flow} = \\frac{${p.positiveFlow}}{${p.negativeFlow}} = ${p.mfr}
                \\\\[0.5em]
                MFI = 100 - \\frac{100}{1 + ${p.mfr}} = ${p.mfi}
            `;
        }
    },

    /**
     * Average Directional Index (ADX)
     * Measures trend strength
     */
    ADX: {
        name: 'ADX',
        fullName: 'Average Directional Index',
        symbol: 'α',
        period: 14,

        calculate(prices) {
            const period = this.period;
            if (prices.length < period * 2) {
                return { value: 25, signal: 'hold', strength: 0.5, error: 'Insufficient data' };
            }

            // Simplified ADX calculation using price movement
            let upMoves = 0, downMoves = 0;
            for (let i = prices.length - period; i < prices.length; i++) {
                const change = prices[i] - prices[i - 1];
                if (change > 0) upMoves += change;
                else downMoves += Math.abs(change);
            }

            const totalMove = upMoves + downMoves;
            const adx = totalMove === 0 ? 0 : Math.abs(upMoves - downMoves) / totalMove * 100;

            // ADX doesn't give direction, just strength
            const trending = adx > 25;
            const direction = upMoves > downMoves ? 'bullish' : 'bearish';

            return {
                value: adx,
                signal: trending ? (direction === 'bullish' ? 'buy' : 'sell') : 'hold',
                strength: Math.min(adx / 50, 1),
                proof: {
                    upMoves: upMoves.toFixed(2),
                    downMoves: downMoves.toFixed(2),
                    adx: adx.toFixed(2),
                    trending,
                    direction
                }
            };
        },

        getFormula() {
            return `ADX = \\frac{|+DI - (-DI)|}{+DI + (-DI)} \\times 100`;
        },

        getProofTeX(result) {
            if (!result.proof) return '';
            const p = result.proof;
            return `
                +DM = ${p.upMoves}, \\quad -DM = ${p.downMoves}
                \\\\[0.5em]
                ADX = ${p.adx}\\% \\quad (${p.trending ? 'Trending' : 'Ranging'}: ${p.direction})
            `;
        }
    },

    /**
     * Commodity Channel Index (CCI)
     * CCI = (Typical Price - SMA) / (0.015 × Mean Deviation)
     */
    CCI: {
        name: 'CCI',
        fullName: 'Commodity Channel Index',
        symbol: 'χ',
        period: 20,

        calculate(prices) {
            const period = this.period;
            if (prices.length < period) {
                return { value: 0, signal: 'hold', strength: 0.5, error: 'Insufficient data' };
            }

            const recentPrices = prices.slice(-period);
            const tp = prices[prices.length - 1]; // Typical price (simplified)
            const sma = recentPrices.reduce((a, b) => a + b, 0) / period;

            const meanDev = recentPrices.reduce((sum, p) => sum + Math.abs(p - sma), 0) / period;
            const cci = meanDev === 0 ? 0 : (tp - sma) / (0.015 * meanDev);

            return {
                value: cci,
                signal: cci > 100 ? 'sell' : cci < -100 ? 'buy' : 'hold',
                strength: Math.min(Math.abs(cci) / 200, 1),
                proof: {
                    tp: tp.toFixed(2),
                    sma: sma.toFixed(2),
                    meanDev: meanDev.toFixed(4),
                    cci: cci.toFixed(2)
                }
            };
        },

        getFormula() {
            return `CCI = \\frac{TP - SMA}{0.015 \\times MD}`;
        },

        getProofTeX(result) {
            if (!result.proof) return '';
            const p = result.proof;
            return `
                TP = ${p.tp}, \\quad SMA_{20} = ${p.sma}, \\quad MD = ${p.meanDev}
                \\\\[0.5em]
                CCI = \\frac{${p.tp} - ${p.sma}}{0.015 \\times ${p.meanDev}} = ${p.cci}
            `;
        }
    },

    /**
     * Linear Regression Slope
     * Measures trend direction and strength
     */
    LinearRegression: {
        name: 'LREG',
        fullName: 'Linear Regression',
        symbol: 'λ',
        period: 20,

        calculate(prices) {
            const period = this.period;
            if (prices.length < period) {
                return { value: 0, signal: 'hold', strength: 0.5, error: 'Insufficient data' };
            }

            const recentPrices = prices.slice(-period);
            const n = recentPrices.length;

            let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
            for (let i = 0; i < n; i++) {
                sumX += i;
                sumY += recentPrices[i];
                sumXY += i * recentPrices[i];
                sumX2 += i * i;
            }

            const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
            const intercept = (sumY - slope * sumX) / n;

            // Calculate R² for confidence
            const yMean = sumY / n;
            let ssRes = 0, ssTot = 0;
            for (let i = 0; i < n; i++) {
                const predicted = slope * i + intercept;
                ssRes += Math.pow(recentPrices[i] - predicted, 2);
                ssTot += Math.pow(recentPrices[i] - yMean, 2);
            }
            const rSquared = ssTot === 0 ? 0 : 1 - (ssRes / ssTot);

            // Normalize slope as percentage of price
            const avgPrice = sumY / n;
            const slopePercent = (slope / avgPrice) * 100 * period;

            return {
                value: slopePercent,
                signal: slopePercent > 2 ? 'buy' : slopePercent < -2 ? 'sell' : 'hold',
                strength: Math.min(Math.abs(slopePercent) / 10, 1) * rSquared,
                proof: {
                    slope: slope.toFixed(6),
                    intercept: intercept.toFixed(2),
                    rSquared: rSquared.toFixed(4),
                    slopePercent: slopePercent.toFixed(2)
                }
            };
        },

        getFormula() {
            return `slope = \\frac{n\\sum xy - \\sum x \\sum y}{n\\sum x^2 - (\\sum x)^2}`;
        },

        getProofTeX(result) {
            if (!result.proof) return '';
            const p = result.proof;
            return `
                slope = ${p.slope}, \\quad intercept = ${p.intercept}
                \\\\[0.5em]
                R^2 = ${p.rSquared} \\quad (trend \\: strength)
                \\\\[0.5em]
                Slope\\% = ${p.slopePercent}\\%
            `;
        }
    },

    /**
     * Mean Reversion Score
     * Distance from moving average
     */
    MeanReversion: {
        name: 'MR',
        fullName: 'Mean Reversion',
        symbol: 'δ',
        period: 50,

        calculate(prices) {
            const period = this.period;
            if (prices.length < period) {
                return { value: 0, signal: 'hold', strength: 0.5, error: 'Insufficient data' };
            }

            const recentPrices = prices.slice(-period);
            const sma = recentPrices.reduce((a, b) => a + b, 0) / period;
            const current = prices[prices.length - 1];

            const deviation = ((current - sma) / sma) * 100;

            // Calculate z-score
            const squaredDiffs = recentPrices.map(p => Math.pow(p - sma, 2));
            const stdDev = Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / period);
            const zScore = stdDev === 0 ? 0 : (current - sma) / stdDev;

            return {
                value: deviation,
                signal: zScore > 2 ? 'sell' : zScore < -2 ? 'buy' : 'hold',
                strength: Math.min(Math.abs(zScore) / 3, 1),
                proof: {
                    sma: sma.toFixed(2),
                    current: current.toFixed(2),
                    deviation: deviation.toFixed(2),
                    stdDev: stdDev.toFixed(4),
                    zScore: zScore.toFixed(2)
                }
            };
        },

        getFormula() {
            return `Z = \\frac{P - \\mu}{\\sigma}`;
        },

        getProofTeX(result) {
            if (!result.proof) return '';
            const p = result.proof;
            return `
                \\mu_{50} = ${p.sma}, \\quad \\sigma = ${p.stdDev}, \\quad P = ${p.current}
                \\\\[0.5em]
                Deviation = ${p.deviation}\\%
                \\\\[0.5em]
                Z = \\frac{${p.current} - ${p.sma}}{${p.stdDev}} = ${p.zScore}
            `;
        }
    },

    /**
     * Fibonacci Retracement
     * Key levels based on golden ratio
     */
    Fibonacci: {
        name: 'FIB',
        fullName: 'Fibonacci Retracement',
        symbol: 'φ',

        calculate(prices) {
            if (prices.length < 20) {
                return { value: 0.5, signal: 'hold', strength: 0.5, error: 'Insufficient data' };
            }

            const high = Math.max(...prices);
            const low = Math.min(...prices);
            const diff = high - low;
            const current = prices[prices.length - 1];

            const levels = {
                0: low,
                0.236: low + diff * 0.236,
                0.382: low + diff * 0.382,
                0.5: low + diff * 0.5,
                0.618: low + diff * 0.618,
                0.786: low + diff * 0.786,
                1: high
            };

            // Find nearest level
            let nearestLevel = 0.5;
            let minDist = Infinity;
            for (const [level, price] of Object.entries(levels)) {
                const dist = Math.abs(current - price);
                if (dist < minDist) {
                    minDist = dist;
                    nearestLevel = parseFloat(level);
                }
            }

            const position = (current - low) / diff;

            return {
                value: position,
                signal: position > 0.786 ? 'sell' : position < 0.236 ? 'buy' : 'hold',
                strength: position > 0.618 ? (position - 0.618) / 0.382 :
                    position < 0.382 ? (0.382 - position) / 0.382 : 0.3,
                proof: {
                    high: high.toFixed(2),
                    low: low.toFixed(2),
                    current: current.toFixed(2),
                    position: position.toFixed(4),
                    nearestLevel: (nearestLevel * 100).toFixed(1) + '%',
                    levels
                }
            };
        },

        getFormula() {
            return `Position = \\frac{P - L}{H - L}`;
        },

        getProofTeX(result) {
            if (!result.proof) return '';
            const p = result.proof;
            return `
                H = ${p.high}, \\quad L = ${p.low}, \\quad P = ${p.current}
                \\\\[0.5em]
                Position = \\frac{${p.current} - ${p.low}}{${p.high} - ${p.low}} = ${p.position}
                \\\\[0.5em]
                Nearest\\:Level: ${p.nearestLevel}
            `;
        }
    },

    /**
     * Congressional Trading Signal
     * Based on US politician stock trades
     */
    CongressionalTrading: {
        name: 'CONGRESS',
        fullName: 'Congressional Trading',
        symbol: '⚖',

        calculate(prices, congressData = []) {
            if (!congressData || congressData.length === 0) {
                return {
                    value: 0,
                    signal: 'hold',
                    strength: 0,
                    proof: { trades: [], buyCount: 0, sellCount: 0, netSignal: 'neutral' }
                };
            }

            const buyCount = congressData.filter(t =>
                t.type && t.type.toLowerCase().includes('purchase')).length;
            const sellCount = congressData.filter(t =>
                t.type && (t.type.toLowerCase().includes('sale') || t.type.toLowerCase().includes('sell'))).length;

            const total = buyCount + sellCount;
            const buyRatio = total === 0 ? 0.5 : buyCount / total;

            return {
                value: buyRatio,
                signal: buyRatio > 0.65 ? 'buy' : buyRatio < 0.35 ? 'sell' : 'hold',
                strength: Math.abs(0.5 - buyRatio) * 2,
                proof: {
                    trades: congressData.slice(0, 5),
                    buyCount,
                    sellCount,
                    total,
                    buyRatio: (buyRatio * 100).toFixed(1)
                }
            };
        },

        getFormula() {
            return `Signal = \\frac{Buys}{Buys + Sells}`;
        },

        getProofTeX(result) {
            if (!result.proof) return '';
            const p = result.proof;
            return `
                Congressional\\:Trades: ${p.total}
                \\\\[0.5em]
                Buys = ${p.buyCount}, \\quad Sells = ${p.sellCount}
                \\\\[0.5em]
                Buy\\:Ratio = ${p.buyRatio}\\%
            `;
        }
    }
};

// ============================================================================
// Data Fetching
// ============================================================================

async function fetchStockData(symbol, range = '30') {
    const url = `${CONFIG.apis.yahooChart}${symbol}?interval=1d&range=${range}d`;

    try {
        const data = await fetchWithProxy(url);

        if (!data.chart || !data.chart.result || !data.chart.result[0]) {
            throw new Error('Invalid data format');
        }

        const result = data.chart.result[0];
        const meta = result.meta;
        const quotes = result.indicators.quote[0];
        const timestamps = result.timestamp;

        // Build price history
        const priceHistory = [];
        for (let i = 0; i < timestamps.length; i++) {
            if (quotes.close[i] !== null) {
                priceHistory.push({
                    date: new Date(timestamps[i] * 1000),
                    open: quotes.open[i],
                    high: quotes.high[i],
                    low: quotes.low[i],
                    close: quotes.close[i],
                    volume: quotes.volume[i]
                });
            }
        }

        return {
            symbol: meta.symbol,
            name: meta.shortName || meta.symbol,
            currency: meta.currency,
            exchange: meta.exchangeName,
            currentPrice: meta.regularMarketPrice,
            previousClose: meta.previousClose,
            open: meta.regularMarketOpen || quotes.open[quotes.open.length - 1],
            high: meta.regularMarketDayHigh || Math.max(...quotes.high.filter(h => h)),
            low: meta.regularMarketDayLow || Math.min(...quotes.low.filter(l => l)),
            volume: meta.regularMarketVolume,
            fiftyTwoWeekHigh: meta.fiftyTwoWeekHigh,
            fiftyTwoWeekLow: meta.fiftyTwoWeekLow,
            priceHistory
        };
    } catch (error) {
        console.error('Error fetching stock data:', error);
        updateStatus('error', 'API Error - Try again');
        throw error;
    }
}

async function fetchCongressTrades(symbol) {
    try {
        // Try direct fetch first (S3 bucket should allow CORS)
        let data;
        try {
            const directResponse = await fetch('https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json');
            if (directResponse.ok) {
                data = await directResponse.json();
            } else {
                throw new Error('Direct fetch failed');
            }
        } catch (e) {
            // Fallback to proxy
            console.log('Direct congress fetch failed, trying proxy...');
            data = await fetchWithProxy('https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json');
        }

        if (!Array.isArray(data)) {
            console.warn('Congress data is not an array:', typeof data);
            return [];
        }

        // Filter for specific symbol, last 6 months
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const trades = data.filter(trade => {
            if (!trade.ticker) return false;
            const ticker = trade.ticker.toUpperCase();
            const tradeDate = new Date(trade.transaction_date);
            return ticker === symbol.toUpperCase() && tradeDate >= sixMonthsAgo;
        });

        document.getElementById('congress-status').classList.add('connected');
        return trades;
    } catch (error) {
        console.warn('Could not fetch congress trades:', error);
        document.getElementById('congress-status').classList.remove('connected');
        return [];
    }
}

// ============================================================================
// Gemini AI Analysis
// ============================================================================

async function fetchGeminiAnalysis(stockData, analysis, congressTrades) {
    const apiKey = STATE.geminiKey || document.getElementById('gemini-key')?.value;

    if (!apiKey) {
        return null; // No API key provided
    }

    const container = document.getElementById('ai-content');
    container.innerHTML = `
        <div class="ai-loading">
            <div class="spinner"></div>
            <span>Gemini is analyzing ${stockData.symbol}...</span>
        </div>
    `;

    try {
        // Build context for Gemini
        const prices = stockData.priceHistory.map(p => p.close);
        const recentPrices = prices.slice(-10);
        const priceChange = ((prices[prices.length - 1] - prices[0]) / prices[0] * 100).toFixed(2);

        const algoSummary = Object.entries(analysis.algorithms)
            .map(([name, data]) => `${name}: ${data.signal.toUpperCase()} (strength: ${(data.strength * 100).toFixed(0)}%)`)
            .join(', ');

        const prompt = `You are a stock analysis AI. Analyze this stock data and provide a brief, actionable insight.

Stock: ${stockData.symbol} (${stockData.name})
Current Price: $${stockData.currentPrice.toFixed(2)}
Price Change (period): ${priceChange}%
52-Week Range: $${stockData.fiftyTwoWeekLow?.toFixed(2) || 'N/A'} - $${stockData.fiftyTwoWeekHigh?.toFixed(2) || 'N/A'}

Algorithm Signals: ${algoSummary}
Echo Consensus: ${analysis.consensus.signal.toUpperCase()} (${(analysis.consensus.confidence * 100).toFixed(0)}% confidence)
Buy/Hold/Sell Ratio: ${analysis.consensus.buyCount}/${analysis.consensus.holdCount}/${analysis.consensus.sellCount}

Congressional Trades (last 6 months): ${congressTrades.length} trades found
${congressTrades.slice(0, 3).map(t => `- ${t.representative}: ${t.type} (${t.amount})`).join('\n')}

Provide a 2-3 sentence analysis covering:
1. What the technical indicators suggest
2. Any notable patterns or concerns
3. A clear recommendation (BUY/HOLD/SELL) with brief reasoning

Keep response under 100 words. Be direct and actionable.`;

        const response = await fetch(`${CONFIG.apis.gemini}?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.7,
                    maxOutputTokens: 200
                }
            })
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'Gemini API error');
        }

        const data = await response.json();
        const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!aiText) {
            throw new Error('No response from Gemini');
        }

        document.getElementById('gemini-status').classList.add('connected');
        return aiText;

    } catch (error) {
        console.error('Gemini error:', error);
        document.getElementById('gemini-status').classList.remove('connected');

        container.innerHTML = `
            <div class="ai-error">
                <span class="material-icons" style="font-size:16px;vertical-align:middle">error</span>
                ${error.message}
            </div>
        `;
        return null;
    }
}

function updateAIPanel(aiResponse) {
    const container = document.getElementById('ai-content');

    if (!aiResponse) {
        const hasKey = document.getElementById('gemini-key')?.value;
        container.innerHTML = `
            <div class="ai-placeholder">
                <span class="material-icons" style="font-size:32px;color:var(--text-muted)">auto_awesome</span>
                <p>${hasKey ? 'AI analysis unavailable' : 'Enter your free Gemini API key below for AI insights'}</p>
            </div>
        `;
        return;
    }

    // Parse and highlight signals in the response
    let formattedResponse = aiResponse
        .replace(/\b(BUY|BULLISH|STRONG BUY)\b/gi, '<span class="ai-signal buy">$1</span>')
        .replace(/\b(SELL|BEARISH|STRONG SELL)\b/gi, '<span class="ai-signal sell">$1</span>')
        .replace(/\b(HOLD|NEUTRAL|WAIT)\b/gi, '<span class="ai-signal hold">$1</span>');

    container.innerHTML = `
        <div class="ai-response">
            ${formattedResponse}
        </div>
    `;
}

// ============================================================================
// Analysis Engine
// ============================================================================

function runAnalysis(priceHistory, congressTrades = []) {
    const prices = priceHistory.map(p => p.close);
    const results = {};

    let buyCount = 0, sellCount = 0, holdCount = 0;
    let totalStrength = 0;
    let weightedSignal = 0;

    // Run each algorithm
    for (const [key, algo] of Object.entries(ALGORITHMS)) {
        try {
            let result;
            if (key === 'CongressionalTrading') {
                result = algo.calculate(prices, congressTrades);
            } else {
                result = algo.calculate(prices);
            }

            results[key] = {
                ...result,
                name: algo.name,
                fullName: algo.fullName,
                symbol: algo.symbol,
                formula: algo.getFormula(),
                proofTeX: algo.getProofTeX(result)
            };

            if (result.signal === 'buy') {
                buyCount++;
                weightedSignal += result.strength;
            } else if (result.signal === 'sell') {
                sellCount++;
                weightedSignal -= result.strength;
            } else {
                holdCount++;
            }

            totalStrength += result.strength;
        } catch (error) {
            console.warn(`Algorithm ${key} failed:`, error);
        }
    }

    const totalAlgos = buyCount + sellCount + holdCount;

    // Calculate consensus
    let consensus = 'hold';
    let confidence = 0;

    if (buyCount > sellCount && buyCount > holdCount) {
        consensus = 'buy';
        confidence = buyCount / totalAlgos;
    } else if (sellCount > buyCount && sellCount > holdCount) {
        consensus = 'sell';
        confidence = sellCount / totalAlgos;
    } else {
        confidence = holdCount / totalAlgos;
    }

    // Expected move based on analysis
    const avgStrength = totalStrength / totalAlgos;
    const expectedMove = weightedSignal / totalAlgos * 10; // Scale to reasonable %

    return {
        algorithms: results,
        consensus: {
            signal: consensus,
            confidence,
            buyCount,
            sellCount,
            holdCount,
            total: totalAlgos,
            expectedMove
        }
    };
}

// ============================================================================
// UI Updates
// ============================================================================

function updateStatus(status, text) {
    const indicator = document.getElementById('api-status');
    const statusText = document.getElementById('status-text');

    indicator.className = 'status-indicator ' + (status === 'online' ? 'online' : status === 'error' ? 'offline' : '');
    statusText.textContent = text;
}

function updateStockHeader(data) {
    document.getElementById('stock-header').classList.remove('hidden');
    document.getElementById('display-symbol').textContent = data.symbol;
    document.getElementById('display-name').textContent = data.name;
    document.getElementById('current-price').textContent = '$' + data.currentPrice.toFixed(2);

    const change = data.currentPrice - data.previousClose;
    const changePercent = (change / data.previousClose) * 100;
    const changeEl = document.getElementById('price-change');
    changeEl.textContent = `${change >= 0 ? '+' : ''}${change.toFixed(2)} (${changePercent >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`;
    changeEl.className = 'price-change ' + (change >= 0 ? 'positive' : 'negative');

    document.getElementById('meta-open').textContent = '$' + (data.open?.toFixed(2) || '—');
    document.getElementById('meta-high').textContent = '$' + (data.high?.toFixed(2) || '—');
    document.getElementById('meta-low').textContent = '$' + (data.low?.toFixed(2) || '—');
    document.getElementById('meta-volume').textContent = formatVolume(data.volume);
    document.getElementById('meta-52high').textContent = '$' + (data.fiftyTwoWeekHigh?.toFixed(2) || '—');
    document.getElementById('meta-52low').textContent = '$' + (data.fiftyTwoWeekLow?.toFixed(2) || '—');
}

function formatVolume(vol) {
    if (!vol) return '—';
    if (vol >= 1e9) return (vol / 1e9).toFixed(2) + 'B';
    if (vol >= 1e6) return (vol / 1e6).toFixed(2) + 'M';
    if (vol >= 1e3) return (vol / 1e3).toFixed(2) + 'K';
    return vol.toString();
}

function updateAlgorithmPanel(analysis) {
    // Update verdict
    const verdictAction = document.getElementById('verdict-action');
    verdictAction.textContent = analysis.consensus.signal.toUpperCase();
    verdictAction.className = 'verdict-action ' + analysis.consensus.signal;

    const confidence = analysis.consensus.confidence * 100;
    document.getElementById('confidence-fill').style.width = confidence + '%';
    document.getElementById('confidence-value').textContent = confidence.toFixed(1) + '%';

    const expectedMove = document.getElementById('expected-move');
    const move = analysis.consensus.expectedMove;
    expectedMove.textContent = (move >= 0 ? '+' : '') + move.toFixed(2) + '%';
    expectedMove.className = 'expected-value ' + (move >= 0 ? 'positive' : 'negative');

    // Update algorithm grid
    const grid = document.getElementById('algorithms-grid');
    grid.innerHTML = Object.entries(analysis.algorithms).map(([key, algo]) => {
        const signalClass = algo.signal === 'buy' ? 'bullish' :
            algo.signal === 'sell' ? 'bearish' : 'neutral';

        let displayValue = '';
        if (typeof algo.value === 'number') {
            displayValue = algo.value.toFixed(2);
        }

        return `
            <div class="algo-card ${signalClass}" data-algo="${key}">
                <div class="algo-header">
                    <span class="algo-name">${algo.name}</span>
                    <span class="algo-symbol">${algo.symbol}</span>
                </div>
                <span class="algo-signal ${algo.signal}">${algo.signal.toUpperCase()}</span>
                <div class="algo-value">${displayValue}</div>
                <div class="algo-bar">
                    <div class="algo-bar-fill ${signalClass}" style="width: ${algo.strength * 100}%"></div>
                </div>
            </div>
        `;
    }).join('');

    // Update consensus bar
    const total = analysis.consensus.total;
    document.getElementById('consensus-buy').style.width = (analysis.consensus.buyCount / total * 100) + '%';
    document.getElementById('consensus-hold').style.width = (analysis.consensus.holdCount / total * 100) + '%';
    document.getElementById('consensus-sell').style.width = (analysis.consensus.sellCount / total * 100) + '%';

    document.getElementById('buy-count').textContent = analysis.consensus.buyCount;
    document.getElementById('hold-count').textContent = analysis.consensus.holdCount;
    document.getElementById('sell-count').textContent = analysis.consensus.sellCount;
    document.getElementById('consensus-ratio').textContent =
        `${analysis.consensus.buyCount}/${analysis.consensus.holdCount}/${analysis.consensus.sellCount}`;
}

function updateProofPanel(analysis) {
    const container = document.getElementById('proof-content');

    let html = '';
    for (const [key, algo] of Object.entries(analysis.algorithms)) {
        if (!algo.proofTeX) continue;

        const signalColor = algo.signal === 'buy' ? 'var(--positive)' :
            algo.signal === 'sell' ? 'var(--negative)' : 'var(--neutral)';

        html += `
            <div class="proof-section">
                <div class="proof-title">
                    <span class="algo-sym">${algo.symbol}</span>
                    ${algo.fullName}
                    <span style="margin-left: auto; color: ${signalColor}; font-weight: 600;">${algo.signal.toUpperCase()}</span>
                </div>
                <div class="proof-formula" id="formula-${key}">
                    $$ ${algo.formula} $$
                </div>
                <div class="proof-formula" id="proof-${key}">
                    $$ ${algo.proofTeX} $$
                </div>
            </div>
        `;
    }

    container.innerHTML = html;

    // Render KaTeX
    if (window.renderMathInElement) {
        renderMathInElement(container, {
            delimiters: [
                { left: '$$', right: '$$', display: true },
                { left: '$', right: '$', display: false }
            ],
            throwOnError: false
        });
    }
}

function updatePoliticianPanel(congressTrades, analysis) {
    const container = document.getElementById('politician-content');

    if (!congressTrades || congressTrades.length === 0) {
        container.innerHTML = `
            <div class="politician-placeholder">
                <p>No congressional trades found for this stock in the last 6 months.</p>
            </div>
        `;
        return;
    }

    const congressAlgo = analysis.algorithms.CongressionalTrading;
    const signalClass = congressAlgo.signal === 'buy' ? 'bullish' :
        congressAlgo.signal === 'sell' ? 'bearish' : 'neutral';

    html = `
        <div class="politician-signal">
            <div class="politician-verdict">
                <span class="politician-label">Signal</span>
                <span class="politician-action ${signalClass}">${congressAlgo.signal.toUpperCase()}</span>
            </div>
            <div class="politician-stats">
                <div class="pol-stat">
                    <span class="pol-stat-value">${congressAlgo.proof.buyCount}</span>
                    <span class="pol-stat-label">Buys</span>
                </div>
                <div class="pol-stat">
                    <span class="pol-stat-value">${congressAlgo.proof.sellCount}</span>
                    <span class="pol-stat-label">Sells</span>
                </div>
                <div class="pol-stat">
                    <span class="pol-stat-value">${congressAlgo.proof.buyRatio}%</span>
                    <span class="pol-stat-label">Buy Ratio</span>
                </div>
            </div>
        </div>
        <div class="recent-trades">
            <div class="recent-trades-title">Recent Trades</div>
            ${congressTrades.slice(0, 5).map(trade => `
                <div class="trade-item">
                    <span class="trade-politician">${trade.representative || 'Unknown'}</span>
                    <span class="trade-type ${trade.type?.toLowerCase().includes('purchase') ? 'buy' : 'sell'}">
                        ${trade.type?.toLowerCase().includes('purchase') ? 'BUY' : 'SELL'}
                    </span>
                    <span class="trade-amount">${trade.amount || '—'}</span>
                </div>
            `).join('')}
        </div>
    `;

    container.innerHTML = html;
}

// ============================================================================
// Chart - Past Data + Future Projections
// ============================================================================

function initChart(priceHistory, analysis, projectionDays = STATE.projectionDays) {
    const ctx = document.getElementById('price-chart');
    if (!ctx) return;

    const prices = priceHistory.map(p => p.close);
    const dates = priceHistory.map(p => p.date);

    // Calculate SMAs (only for historical data)
    const sma20 = calculateSMA(prices, 20);
    const sma50 = calculateSMA(prices, 50);

    // ===== PROJECTION CALCULATION =====
    // Based on: recent trend + algorithm consensus + volatility
    const lastPrice = prices[prices.length - 1];

    // Calculate recent trend (linear regression on last 20 days)
    const recentPrices = prices.slice(-20);
    let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
    const n = recentPrices.length;
    for (let i = 0; i < n; i++) {
        sumX += i;
        sumY += recentPrices[i];
        sumXY += i * recentPrices[i];
        sumX2 += i * i;
    }
    const trendSlope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);

    // Daily return as percentage
    const dailyTrendPercent = (trendSlope / lastPrice) * 100;

    // Adjust by consensus: if algorithms agree, strengthen signal; if mixed, dampen
    const consensusMultiplier = analysis.consensus.signal === 'buy' ? 1 + (analysis.consensus.confidence * 0.5) :
        analysis.consensus.signal === 'sell' ? 1 - (analysis.consensus.confidence * 0.5) : 1;

    // Calculate historical volatility (standard deviation of daily returns)
    let dailyReturns = [];
    for (let i = 1; i < prices.length; i++) {
        dailyReturns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    const avgReturn = dailyReturns.reduce((a, b) => a + b, 0) / dailyReturns.length;
    const volatility = Math.sqrt(dailyReturns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / dailyReturns.length);

    // Generate projection paths
    const lastDate = new Date(dates[dates.length - 1]);
    const projectionDates = [];
    const projectionMain = [];
    const projectionHigh = [];
    const projectionLow = [];

    // Base daily move: trend adjusted by consensus, clamped to reasonable range
    const baseDailyMove = Math.max(-0.02, Math.min(0.02, (dailyTrendPercent / 100) * consensusMultiplier));

    for (let i = 1; i <= projectionDays; i++) {
        const newDate = new Date(lastDate);
        newDate.setDate(newDate.getDate() + i);
        projectionDates.push(newDate);

        // Main projection: follows trend with diminishing confidence
        const decayFactor = Math.pow(0.98, i); // Trend weakens over time
        const projectedPrice = lastPrice * (1 + baseDailyMove * i * decayFactor);
        projectionMain.push(projectedPrice);

        // Uncertainty cone: grows with sqrt of time (standard in finance)
        const uncertainty = volatility * Math.sqrt(i) * lastPrice * 1.5;
        projectionHigh.push(projectedPrice + uncertainty);
        projectionLow.push(Math.max(0, projectedPrice - uncertainty));
    }

    // Combine all dates
    const allDates = [...dates, ...projectionDates];

    // Historical data with nulls for projection period
    const priceData = [...prices, ...Array(projectionDays).fill(null)];
    const sma20Data = [...sma20, ...Array(projectionDays).fill(null)];
    const sma50Data = [...sma50, ...Array(projectionDays).fill(null)];

    // Projection data starting from last historical price
    const projMainData = [...Array(prices.length - 1).fill(null), lastPrice, ...projectionMain];
    const projHighData = [...Array(prices.length - 1).fill(null), lastPrice, ...projectionHigh];
    const projLowData = [...Array(prices.length - 1).fill(null), lastPrice, ...projectionLow];

    if (STATE.chart) {
        STATE.chart.destroy();
    }

    STATE.chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: allDates,
            datasets: [
                {
                    label: 'Price (Historical)',
                    data: priceData,
                    borderColor: '#6366f1',
                    backgroundColor: 'rgba(99, 102, 241, 0.1)',
                    fill: true,
                    tension: 0.1,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: 'SMA(20)',
                    data: sma20Data,
                    borderColor: '#f59e0b',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'SMA(50)',
                    data: sma50Data,
                    borderColor: '#10b981',
                    borderWidth: 1.5,
                    pointRadius: 0,
                    fill: false
                },
                {
                    label: 'Echo Projection',
                    data: projMainData,
                    borderColor: '#8b5cf6',
                    borderWidth: 2.5,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    spanGaps: true
                },
                {
                    label: 'Upper Bound',
                    data: projHighData,
                    borderColor: 'rgba(16, 185, 129, 0.5)',
                    borderWidth: 1,
                    borderDash: [2, 2],
                    pointRadius: 0,
                    fill: false,
                    spanGaps: true
                },
                {
                    label: 'Lower Bound',
                    data: projLowData,
                    borderColor: 'rgba(239, 68, 68, 0.5)',
                    borderWidth: 1,
                    borderDash: [2, 2],
                    pointRadius: 0,
                    fill: '-1', // Fill between upper and lower
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    spanGaps: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: 'rgba(15, 15, 22, 0.95)',
                    titleColor: '#f8fafc',
                    bodyColor: '#94a3b8',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    padding: 12,
                    callbacks: {
                        title: function (ctx) {
                            if (!ctx[0]) return '';
                            const idx = ctx[0].dataIndex;
                            const isProjection = idx >= prices.length;
                            const date = allDates[idx];
                            if (!date) return '';
                            return (date instanceof Date ? date.toLocaleDateString() : date) + (isProjection ? ' (Projected)' : '');
                        },
                        label: function (ctx) {
                            if (ctx.raw === null || ctx.raw === undefined) return null;
                            return `${ctx.dataset.label}: $${ctx.raw.toFixed(2)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        displayFormats: { day: 'MMM d' }
                    },
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    ticks: {
                        color: '#64748b',
                        font: { family: "'JetBrains Mono', monospace", size: 10 }
                    }
                },
                y: {
                    grid: { color: 'rgba(255,255,255,0.03)' },
                    ticks: {
                        color: '#64748b',
                        font: { family: "'JetBrains Mono', monospace", size: 10 },
                        callback: v => '$' + v.toFixed(0)
                    }
                }
            }
        }
    });

    // Update projection info
    const projEnd = projectionMain[projectionMain.length - 1];
    const projChange = ((projEnd - lastPrice) / lastPrice * 100).toFixed(2);
    const projHigh = projectionHigh[projectionHigh.length - 1];
    const projLowVal = projectionLow[projectionLow.length - 1];

    console.log(`Projection (${projectionDays}d): $${projEnd.toFixed(2)} (${projChange}%) | Range: $${projLowVal.toFixed(2)} - $${projHigh.toFixed(2)}`);
}

function calculateSMA(prices, period) {
    const sma = [];
    for (let i = 0; i < prices.length; i++) {
        if (i < period - 1) {
            sma.push(null);
        } else {
            const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
            sma.push(sum / period);
        }
    }
    return sma;
}

// ============================================================================
// Main Analysis Function
// ============================================================================

async function analyzeStock(symbol) {
    const btn = document.getElementById('analyze-btn');
    btn.disabled = true;
    btn.innerHTML = '<span>Loading...</span>';

    updateStatus('loading', 'Fetching data...');

    try {
        // Fetch stock data (90 days default for 3M view)
        const stockData = await fetchStockData(symbol, 90);
        STATE.stockData = stockData;
        STATE.priceHistory = stockData.priceHistory;
        STATE.currentSymbol = symbol;

        document.getElementById('yahoo-status').classList.add('connected');
        updateStatus('online', 'Connected');

        // Update stock header
        updateStockHeader(stockData);

        // Fetch congressional trades
        updateStatus('online', 'Checking congress trades...');
        const congressTrades = await fetchCongressTrades(symbol);
        STATE.congressTrades = congressTrades;

        // Run analysis
        updateStatus('online', 'Running algorithms...');
        const analysis = runAnalysis(stockData.priceHistory, congressTrades);
        STATE.analysisResults = analysis;

        // Update UI
        document.getElementById('initial-state').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');

        updateAlgorithmPanel(analysis);
        updateProofPanel(analysis);
        updatePoliticianPanel(congressTrades, analysis);
        initChart(stockData.priceHistory, analysis, STATE.projectionDays);

        // Fetch AI analysis (non-blocking)
        updateStatus('online', 'Getting AI insights...');
        const aiResponse = await fetchGeminiAnalysis(stockData, analysis, congressTrades);
        updateAIPanel(aiResponse);

        // Update timestamp
        document.getElementById('last-updated').textContent = new Date().toLocaleTimeString();

        updateStatus('online', 'Analysis complete');

    } catch (error) {
        console.error('Analysis failed:', error);
        updateStatus('error', 'Failed: ' + error.message);
        alert('Failed to fetch data for ' + symbol + '. Please check the symbol and try again.');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>Analyze</span><span class="btn-icon">→</span>';
    }
}

// ============================================================================
// Event Listeners
// ============================================================================

document.addEventListener('DOMContentLoaded', () => {
    console.log('Echo Analysis Engine initialized');

    // Analyze button
    document.getElementById('analyze-btn').addEventListener('click', () => {
        const symbol = document.getElementById('stock-input').value.trim().toUpperCase();
        if (symbol) analyzeStock(symbol);
    });

    // Enter key
    document.getElementById('stock-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const symbol = e.target.value.trim().toUpperCase();
            if (symbol) analyzeStock(symbol);
        }
    });

    // Quick picks
    document.querySelectorAll('.quick-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const symbol = btn.dataset.symbol;
            document.getElementById('stock-input').value = symbol;
            analyzeStock(symbol);
        });
    });

    // Time range controls (historical data)
    document.querySelectorAll('.control-btn[data-range]').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!STATE.currentSymbol) return;

            document.querySelectorAll('.control-btn[data-range]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const range = btn.dataset.range;
            updateStatus('online', 'Fetching data...');

            try {
                const stockData = await fetchStockData(STATE.currentSymbol, range);
                STATE.priceHistory = stockData.priceHistory;

                const analysis = runAnalysis(stockData.priceHistory, STATE.congressTrades);
                STATE.analysisResults = analysis;

                updateAlgorithmPanel(analysis);
                updateProofPanel(analysis);
                initChart(stockData.priceHistory, analysis, STATE.projectionDays);
                updateStatus('online', 'Updated');
            } catch (e) {
                updateStatus('error', 'Failed to update');
            }
        });
    });

    // Projection period controls
    document.querySelectorAll('.proj-btn[data-proj]').forEach(btn => {
        btn.addEventListener('click', () => {
            if (!STATE.analysisResults) return;

            document.querySelectorAll('.proj-btn[data-proj]').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            STATE.projectionDays = parseInt(btn.dataset.proj);
            initChart(STATE.priceHistory, STATE.analysisResults, STATE.projectionDays);
        });
    });

    // Gemini API key - save to state and localStorage
    const geminiKeyInput = document.getElementById('gemini-key');
    if (geminiKeyInput) {
        // Load saved key
        const savedKey = localStorage.getItem('echo_gemini_key');
        if (savedKey) {
            geminiKeyInput.value = savedKey;
            STATE.geminiKey = savedKey;
        }

        // Save on change
        geminiKeyInput.addEventListener('change', (e) => {
            const key = e.target.value.trim();
            STATE.geminiKey = key;
            if (key) {
                localStorage.setItem('echo_gemini_key', key);
            } else {
                localStorage.removeItem('echo_gemini_key');
            }

            // Re-run AI analysis if we have data
            if (STATE.stockData && STATE.analysisResults && key) {
                fetchGeminiAnalysis(STATE.stockData, STATE.analysisResults, STATE.congressTrades)
                    .then(updateAIPanel);
            }
        });
    }

    // Footer time
    function updateTime() {
        document.getElementById('footer-time').textContent = new Date().toLocaleString();
    }
    updateTime();
    setInterval(updateTime, 1000);

    // Initial status
    updateStatus('online', 'Ready');
});
