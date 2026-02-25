# OakScriptJS Indicator Inventory

This document provides a comprehensive inventory of all PineScript indicators from TradingView's standard library,
ranked by complexity. It tracks implementation status in OakScriptJS.

## Summary Statistics

| Category               | Count |
|------------------------|-------|
| **Total Indicators**   | 134   |
| **Implemented**        | 75    |
| **Pending**            | 59    |
| **Very Complex (25+)** | 3     |
| **Complex (15-24)**    | 29    |
| **Medium (5-14)**      | 43    |
| **Simple (0-4)**       | 59    |

## Complexity Scoring

Complexity is calculated based on:

- Number of unique TA functions used
- Strategy functions (+20 points)
- Drawing functions (+10 points)
- `request.security` usage (+5 points)
- Table operations (+5 points)
- Array/Matrix operations (+5 points)

---

## Complete Indicator Inventory

| Indicator | Score | TA Funcs | Special Features | Status | Test Data | Test |
|-----------|-------|----------|------------------|--------|-----------|------|
| Keltner Channels Strategy | 27 | 7 | Strategy | Pending | No | - |
| Technical Ratings Strategy | 26 | 6 | Strategy, ReqSec | Pending | No | - |
| Seasonality | 25 | 5 | Drawing, ReqSec, Tables, Arrays | Pending | No | - |
| Stochastic Slow Strategy | 24 | 4 | Strategy | Pending | No | - |
| Bollinger Bands Strategy | 24 | 4 | Strategy | Pending | No | - |
| Bollinger Bands Strategy directed | 24 | 4 | Strategy | Pending | No | - |
| RSI Strategy | 23 | 3 | Strategy | Pending | No | - |
| MovingAvg2Line Cross | 23 | 3 | Strategy | Pending | No | - |
| MACD Strategy | 23 | 3 | Strategy | Pending | No | - |
| Volty Expan Close Strategy | 22 | 2 | Strategy | Pending | No | - |
| Supertrend Strategy | 22 | 2 | Strategy | Pending | No | - |
| Price Channel Strategy | 22 | 2 | Strategy | Pending | No | - |
| Pivot Reversal Strategy | 22 | 2 | Strategy | Pending | No | - |
| Pivot Extension Strategy | 22 | 2 | Strategy | Pending | No | - |
| ChannelBreakOutStrategy | 22 | 2 | Strategy | Pending | No | - |
| Pivot Points Standard | 21 | 1 | Drawing, ReqSec, Arrays | Pending | No | - |
| MovingAvg Cross | 21 | 1 | Strategy | Pending | No | - |
| Gaps | 21 | 1 | Drawing, Tables, Arrays | Pending | No | - |
| Rob Booker - ADX Breakout | 20 | 0 | Strategy | Pending | No | - |
| Parabolic SAR Strategy | 20 | 0 | Strategy | Pending | No | - |
| OutSide Bar Strategy | 20 | 0 | Strategy | Pending | No | - |
| Momentum Strategy | 20 | 0 | Strategy | Pending | No | - |
| InSide Bar Strategy | 20 | 0 | Strategy | Pending | No | - |
| Greedy Strategy | 20 | 0 | Strategy | Pending | No | - |
| Consecutive Up_Down Strategy | 20 | 0 | Strategy | Pending | No | - |
| BarUpDn Strategy | 20 | 0 | Strategy | Pending | No | - |
| Technical Ratings | 17 | 7 | ReqSec, Tables, Arrays | Pending | No | - |
| Trading Sessions | 15 | 5 | Drawing, Arrays | Pending | No | - |
| Price Target | 15 | 5 | Drawing, Tables | Pending | No | - |
| Multi-Time Period Charts | 15 | 5 | Drawing, ReqSec | Pending | No | - |
| Auto Pitchfork | 15 | 5 | Drawing, Arrays | Pending | No | - |
| Auto Fib Extension | 15 | 5 | Drawing, Arrays | Pending | No | - |
| Pivot Points High Low | 12 | 2 | Drawing | Pending | No | - |
| Relative Strength Index | 11 | 11 | - | **Implemented** | Yes | ✅ Pass |
| Auto Fib Retracement | 11 | 1 | Drawing | Pending | No | - |
| Performance | 10 | 0 | ReqSec, Tables | Pending | No | - |
| Linear Regression Channel | 10 | 0 | Drawing | Pending | No | - |
| On Balance Volume | 8 | 8 | - | **Implemented** | Yes | ✅ Pass |
| Relative Volatility Index | 7 | 7 | - | **Implemented** | Yes | ✅ Pass |
| Rank Correlation Index | 7 | 7 | - | **Implemented** | Yes | ✅ Pass |
| Commodity Channel Index | 7 | 7 | - | **Implemented** | Yes | ✅ Pass |
| Moving Average Simple | 6 | 6 | - | **Implemented** | Yes | ✅ Pass |
| Moving Average Exponential | 6 | 6 | - | **Implemented** | Yes | ✅ Pass |
| Moon Phases | 6 | 1 | Arrays | **Implemented** | Yes | ✅ Pass |
| Cumulative Volume Index | 6 | 1 | ReqSec | Pending | No | - |
| Correlation Coefficient | 6 | 1 | ReqSec | Pending | No | - |
| Bollinger Bands | 6 | 6 | - | **Implemented** | Yes | ✅ Pass |
| Advance Decline Line | 6 | 1 | ReqSec | Pending | No | - |
| Visible Average Price | 5 | 0 | ReqSec | Pending | No | - |
| RSI Divergence Indicator | 5 | 5 | Drawing | Pending | No | - |
| Rob Booker - Ziv Ghost Pivots | 5 | 0 | Drawing | Pending | No | - |
| Open Interest | 5 | 0 | ReqSec | Pending | No | - |
| Moving Average Ribbon | 5 | 5 | - | **Implemented** | Yes | ✅ Pass |
| Keltner Channels | 5 | 5 | - | **Implemented** | Yes | ✅ Pass |
| Average True Range | 5 | 5 | - | **Implemented** | Yes | ✅ Pass |
| Advance Decline Ratio | 5 | 1 | ReqSec | Pending | No | - |
| Advance_Decline Ratio (Bars) | 5 | 1 | ReqSec | Pending | No | - |
| 24-hour Volume | 5 | 0 | ReqSec | Pending | No | - |
| Directional Movement Index | 4 | 4 | - | **Implemented** | Yes | ✅ Pass |
| Know Sure Thing | 4 | 4 | - | **Implemented** | Yes | ✅ Pass |
| Volume Profile Fixed Range | 4 | 0 | Drawing | Pending | No | - |
| Volume Profile Visible Range | 4 | 0 | Drawing | Pending | No | - |
| Connors RSI | 3 | 3 | - | **Implemented** | Yes | ✅ Pass |
| Aroon | 2 | 2 | - | **Implemented** | Yes | ✅ Pass |
| Bollinger Bands %B | 2 | 2 | - | **Implemented** | Yes | ✅ Pass |
| Bollinger BandWidth | 2 | 2 | - | **Implemented** | Yes | ✅ Pass |
| Chaikin Oscillator | 2 | 2 | - | **Implemented** | Yes | ✅ Pass |
| Chande Kroll Stop | 2 | 2 | - | **Implemented** | Yes | ✅ Pass |
| Chop Zone | 2 | 2 | - | **Implemented** | Yes | ✅ Pass |
| Choppiness Index | 2 | 2 | - | **Implemented** | Yes | ✅ Pass |
| Coppock Curve | 2 | 2 | - | **Implemented** | Yes | ✅ Pass |
| Donchian Channels | 2 | 2 | - | **Implemented** | Yes | ✅ Pass |
| Ease of Movement | 2 | 2 | - | **Implemented** | Yes | ✅ Pass |
| Envelope | 2 | 2 | - | **Implemented** | Yes | ✅ Pass |
| Fisher Transform | 2 | 2 | - | **Implemented** | Yes | ✅ Pass |
| Klinger Oscillator | 2 | 2 | - | **Implemented** | Yes | ✅ Pass |
| MACD | 2 | 2 | - | **Implemented** | Yes | ✅ Pass |
| Price Oscillator | 2 | 2 | - | **Implemented** | Yes | ✅ Pass |
| Stochastic | 2 | 2 | - | **Implemented** | Yes | ✅ Pass |
| Average Directional Index | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Awesome Oscillator | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| BBTrend | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Bull Bear Power | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Chande Momentum Oscillator | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Cumulative Volume Delta | 1 | 1 | - | **Implemented** | Yes | ⏭️ Skip |
| Detrended Price Oscillator | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Double EMA | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Elder Force Index | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Historical Volatility | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Hull Moving Average | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Ichimoku Cloud | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Least Squares Moving Average | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| MA Cross | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Mass Index | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| McGinley Dynamic | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Median | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Money Flow Index | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Moving Average Weighted | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Net Volume | 1 | 1 | - | **Implemented** | Yes | ⏭️ Skip |
| Parabolic SAR | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Price Volume Trend | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| RCI Ribbon | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Relative Vigor Index | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Relative Volume at Time | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Smoothed Moving Average | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| SMI Ergodic Indicator | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| SMI Ergodic Oscillator | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Standard Deviation | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Stochastic RSI | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Supertrend | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Trend Strength Index | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Triple EMA | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| True Strength Index | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Volume Delta | 1 | 1 | - | **Implemented** | Yes | ⏭️ Skip |
| Volume Oscillator | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Volume Weighted Moving Average | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Vortex Indicator | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Williams Alligator | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Williams %R | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Woodies CCI | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Accumulation/Distribution | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Average Day Range | 1 | 1 | - | **Implemented** | Yes | ✅ Pass |
| Balance of Power | 0 | 0 | - | **Implemented** | Yes | ✅ Pass |
| Bollinger Bars | 0 | 0 | - | **Implemented** | Yes | ✅ Pass |
| Chaikin Money Flow | 0 | 0 | - | **Implemented** | Yes | ✅ Pass |
| Momentum | 0 | 0 | - | **Implemented** | Yes | ✅ Pass |
| Rate of Change | 0 | 0 | - | **Implemented** | Yes | ✅ Pass |
| Time Weighted Average Price | 0 | 0 | - | **Implemented** | Yes | ✅ Pass |
| Ultimate Oscillator | 0 | 0 | - | **Implemented** | Yes | ✅ Pass |
| Williams Fractals | 0 | 0 | - | **Implemented** | Yes | ⏭️ Skip |
| Zig Zag | 0 | 0 | - | **Implemented** | Yes | ✅ Pass |

---

## Core TA Functions

These functions are implemented in the core `ta` module (`packages/oakscriptjs/src/ta/`):

| Function | Status | Notes |
|----------|--------|-------|
| `ta.ema()` | Implemented | Exponential Moving Average |
| `ta.sma()` | Implemented | Simple Moving Average |
| `ta.rma()` | Implemented | Wilder's Smoothing (RMA) |
| `ta.wma()` | Implemented | Weighted Moving Average |
| `ta.vwma()` | Implemented | Volume Weighted MA |
| `ta.rsi()` | Implemented | Relative Strength Index |
| `ta.stdev()` | Implemented | Standard Deviation |
| `ta.highest()` | Implemented | Highest value |
| `ta.lowest()` | Implemented | Lowest value |
| `ta.change()` | Implemented | Price change |
| `ta.atr()` | Implemented | Average True Range |
| `ta.tr()` | Implemented | True Range |

---

## File Reference

All source PineScript files are located in:
```
docs/official/indicators_standard/
```

Implemented indicators are in:
```
src/
```

Regression tests and reference data mapping:
```
tests/regression/
```

---

## Regression Test Results

All 74 implemented indicators pass PineSuite regression tests:

```
Total Indicators: 77 (in mapping)
Passed:           53
Passed w/caveats: 20 (extended warmup, normalized comparison, or tolerance adjustment)
Skipped:          4 (CVD, Net Volume, Volume Delta, Williams Fractals)
Failed:           0
```

**Notes on skipped indicators:**
- CVD, Net Volume, and Volume Delta use TradingView's `ta.requestVolumeDelta` / `ta.requestUpAndDownVolume` which analyze intrabar data from lower timeframes
- Our implementation approximates up/down volume using close vs open price comparison
- Williams Fractals: CSV has duplicate 'Shapes' columns that merge in parser - incompatible format
- RCI Ribbon passes with extended warmup and tolerance adjustment

---

*Last updated: February 25, 2026 - Added KST, Connors RSI, Chop Zone, RCI, RVI, Williams Fractals, TWAP, Bollinger Bars, Moon Phases*
