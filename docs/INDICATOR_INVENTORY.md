# OakScriptJS Indicator Inventory

This document provides a comprehensive inventory of the standard PineScript indicators,
ranked by complexity. It tracks implementation status in OakScriptJS.

## Summary Statistics

| Category               | Count |
|------------------------|-------|
| **Total Indicators**   | 147   |
| **Implemented**        | 100   |
| **Pending**            | 47    |
| **Very Complex (25+)** | 3     |
| **Complex (15-24)**    | 29    |
| **Medium (5-14)**      | 43    |
| **Simple (0-4)**       | 59    |

> 131 scored rows below (84 implemented / 47 pending) + 16 built-in studies listed separately
> (all 16 implemented). The complexity buckets cover the scored table only (the 16 built-in
> rows await Pine-source scoring). Note `src/` registers 1337 indicators in total — the bulk are
> community/candlestick ports tracked in `INDICATOR_INVENTORY_COMMUNITY.md` /
> `INDICATOR_INVENTORY_CANDLESTICK.md`, not in this standard-library table.

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

| Indicator | Score | TA Funcs | Special Features | Status |
|-----------|-------|----------|------------------|--------|
| Keltner Channels Strategy | 27 | 7 | Strategy | Pending |
| Technical Ratings Strategy | 26 | 6 | Strategy, ReqSec | Pending |
| Seasonality | 25 | 5 | Drawing, ReqSec, Tables, Arrays | Pending |
| Stochastic Slow Strategy | 24 | 4 | Strategy | Pending |
| Bollinger Bands Strategy | 24 | 4 | Strategy | Pending |
| Bollinger Bands Strategy directed | 24 | 4 | Strategy | Pending |
| RSI Strategy | 23 | 3 | Strategy | Pending |
| MovingAvg2Line Cross | 23 | 3 | Strategy | Pending |
| MACD Strategy | 23 | 3 | Strategy | Pending |
| Volty Expan Close Strategy | 22 | 2 | Strategy | Pending |
| Supertrend Strategy | 22 | 2 | Strategy | Pending |
| Price Channel Strategy | 22 | 2 | Strategy | Pending |
| Pivot Reversal Strategy | 22 | 2 | Strategy | Pending |
| Pivot Extension Strategy | 22 | 2 | Strategy | Pending |
| ChannelBreakOutStrategy | 22 | 2 | Strategy | Pending |
| Pivot Points Standard | 21 | 1 | Drawing, ReqSec, Arrays | Pending |
| MovingAvg Cross | 21 | 1 | Strategy | Pending |
| Gaps | 21 | 1 | Drawing, Tables, Arrays | Pending |
| Rob Booker - ADX Breakout | 20 | 0 | Strategy | Pending |
| Parabolic SAR Strategy | 20 | 0 | Strategy | Pending |
| OutSide Bar Strategy | 20 | 0 | Strategy | Pending |
| Momentum Strategy | 20 | 0 | Strategy | Pending |
| InSide Bar Strategy | 20 | 0 | Strategy | Pending |
| Greedy Strategy | 20 | 0 | Strategy | Pending |
| Consecutive Up_Down Strategy | 20 | 0 | Strategy | Pending |
| BarUpDn Strategy | 20 | 0 | Strategy | Pending |
| Technical Ratings | 17 | 7 | ReqSec, Tables, Arrays | Pending |
| Trading Sessions | 15 | 5 | Drawing, Arrays | Pending |
| Price Target | 15 | 5 | Drawing, Tables | Pending |
| Multi-Time Period Charts | 15 | 5 | Drawing, ReqSec | Pending |
| Auto Pitchfork | 15 | 5 | Drawing, Arrays | Pending |
| Auto Fib Extension | 15 | 5 | Drawing, Arrays | Pending |
| Pivot Points High Low | 12 | 2 | Drawing | Pending |
| Relative Strength Index | 11 | 11 | - | **Implemented** |
| Auto Fib Retracement | 11 | 1 | Drawing | Pending |
| Performance | 10 | 0 | ReqSec, Tables | Pending |
| Linear Regression Channel | 10 | 0 | Drawing | **Implemented** (community/) |
| On Balance Volume | 8 | 8 | - | **Implemented** |
| Relative Volatility Index | 7 | 7 | - | **Implemented** |
| Rank Correlation Index | 7 | 7 | - | **Implemented** |
| Commodity Channel Index | 7 | 7 | - | **Implemented** |
| Moving Average Simple | 6 | 6 | - | **Implemented** |
| Moving Average Exponential | 6 | 6 | - | **Implemented** |
| Moon Phases | 6 | 1 | Arrays | **Implemented** |
| Cumulative Volume Index | 6 | 1 | ReqSec | Pending |
| Correlation Coefficient | 6 | 1 | ReqSec | Pending |
| Bollinger Bands | 6 | 6 | - | **Implemented** |
| Advance Decline Line | 6 | 1 | ReqSec | Pending |
| Visible Average Price | 5 | 0 | ReqSec | Pending |
| RSI Divergence Indicator | 5 | 5 | Drawing | Pending |
| Rob Booker - Ziv Ghost Pivots | 5 | 0 | Drawing | Pending |
| Open Interest | 5 | 0 | ReqSec | Pending |
| Moving Average Ribbon | 5 | 5 | - | **Implemented** |
| Keltner Channels | 5 | 5 | - | **Implemented** |
| Average True Range | 5 | 5 | - | **Implemented** |
| Advance Decline Ratio | 5 | 1 | ReqSec | Pending |
| Advance_Decline Ratio (Bars) | 5 | 1 | ReqSec | Pending |
| 24-hour Volume | 5 | 0 | ReqSec | Pending |
| Directional Movement Index | 4 | 4 | - | **Implemented** |
| Know Sure Thing | 4 | 4 | - | **Implemented** |
| Volume Profile Fixed Range | 4 | 0 | Drawing | Pending |
| Volume Profile Visible Range | 4 | 0 | Drawing | Pending |
| Connors RSI | 3 | 3 | - | **Implemented** |
| Aroon | 2 | 2 | - | **Implemented** |
| Bollinger Bands %B | 2 | 2 | - | **Implemented** |
| Bollinger BandWidth | 2 | 2 | - | **Implemented** |
| Chaikin Oscillator | 2 | 2 | - | **Implemented** |
| Chande Kroll Stop | 2 | 2 | - | **Implemented** |
| Chop Zone | 2 | 2 | - | **Implemented** |
| Choppiness Index | 2 | 2 | - | **Implemented** |
| Coppock Curve | 2 | 2 | - | **Implemented** |
| Donchian Channels | 2 | 2 | - | **Implemented** |
| Ease of Movement | 2 | 2 | - | **Implemented** |
| Envelope | 2 | 2 | - | **Implemented** |
| Fisher Transform | 2 | 2 | - | **Implemented** |
| Klinger Oscillator | 2 | 2 | - | **Implemented** |
| MACD | 2 | 2 | - | **Implemented** |
| Price Oscillator | 2 | 2 | - | **Implemented** |
| Stochastic | 2 | 2 | - | **Implemented** |
| Average Directional Index | 1 | 1 | - | **Implemented** |
| Awesome Oscillator | 1 | 1 | - | **Implemented** |
| BBTrend | 1 | 1 | - | **Implemented** |
| Bull Bear Power | 1 | 1 | - | **Implemented** |
| Chande Momentum Oscillator | 1 | 1 | - | **Implemented** |
| Cumulative Volume Delta | 1 | 1 | - | **Implemented** |
| Detrended Price Oscillator | 1 | 1 | - | **Implemented** |
| Double EMA | 1 | 1 | - | **Implemented** |
| Elder Force Index | 1 | 1 | - | **Implemented** |
| Historical Volatility | 1 | 1 | - | **Implemented** |
| Hull Moving Average | 1 | 1 | - | **Implemented** |
| Ichimoku Cloud | 1 | 1 | - | **Implemented** |
| Least Squares Moving Average | 1 | 1 | - | **Implemented** |
| MA Cross | 1 | 1 | - | **Implemented** |
| Mass Index | 1 | 1 | - | **Implemented** |
| McGinley Dynamic | 1 | 1 | - | **Implemented** |
| Median | 1 | 1 | - | **Implemented** |
| Money Flow Index | 1 | 1 | - | **Implemented** |
| Moving Average Weighted | 1 | 1 | - | **Implemented** |
| Net Volume | 1 | 1 | - | **Implemented** |
| Parabolic SAR | 1 | 1 | - | **Implemented** |
| Price Volume Trend | 1 | 1 | - | **Implemented** |
| RCI Ribbon | 1 | 1 | - | **Implemented** |
| Relative Vigor Index | 1 | 1 | - | **Implemented** |
| Relative Volume at Time | 1 | 1 | - | **Implemented** |
| Smoothed Moving Average | 1 | 1 | - | **Implemented** |
| SMI Ergodic Indicator | 1 | 1 | - | **Implemented** |
| SMI Ergodic Oscillator | 1 | 1 | - | **Implemented** |
| Standard Deviation | 1 | 1 | - | **Implemented** |
| Stochastic RSI | 1 | 1 | - | **Implemented** |
| Supertrend | 1 | 1 | - | **Implemented** |
| Trend Strength Index | 1 | 1 | - | **Implemented** |
| Triple EMA | 1 | 1 | - | **Implemented** |
| True Strength Index | 1 | 1 | - | **Implemented** |
| Volume Delta | 1 | 1 | - | **Implemented** |
| Volume Oscillator | 1 | 1 | - | **Implemented** |
| Volume Weighted Moving Average | 1 | 1 | - | **Implemented** |
| Vortex Indicator | 1 | 1 | - | **Implemented** |
| Williams Alligator | 1 | 1 | - | **Implemented** |
| Williams %R | 1 | 1 | - | **Implemented** |
| Woodies CCI | 1 | 1 | - | **Implemented** |
| Accumulation/Distribution | 1 | 1 | - | **Implemented** |
| Average Day Range | 1 | 1 | - | **Implemented** |
| Balance of Power | 0 | 0 | - | **Implemented** |
| Bollinger Bars | 0 | 0 | - | **Implemented** |
| Chaikin Money Flow | 0 | 0 | - | **Implemented** |
| Momentum | 0 | 0 | - | **Implemented** |
| Rate of Change | 0 | 0 | - | **Implemented** |
| Time Weighted Average Price | 0 | 0 | - | **Implemented** |
| Ultimate Oscillator | 0 | 0 | - | **Implemented** |
| Williams Fractals | 0 | 0 | - | **Implemented** |
| Zig Zag | 0 | 0 | - | **Implemented** |

---

## Built-in studies

These 16 built-in **studies** are not in the table above. Six were already implemented and the
other ten were added later. All 16 are now implemented. Complexity scores are left
blank pending Pine-source analysis and so are excluded from the bucket counts above.

| Indicator | Status | Implementation / Notes |
|-----------|--------|------------------------|
| Arnaud Legoux Moving Average (ALMA) | **Implemented** | `src/standard/alma.ts` |
| TRIX | **Implemented** | `src/standard/trix.ts` |
| Chandelier Exit | **Implemented** | `src/community/chandelier-exit.ts` |
| Kaufman's Adaptive Moving Average (KAMA) | **Implemented** | `src/community/kaufman-adaptive-ma.ts` |
| Price Momentum Oscillator (PMO) | **Implemented** | `src/community/price-momentum-oscillator.ts` |
| Stochastic Momentum Index (SMI) | **Implemented** | `src/community/stochastic-momentum-index.ts` (distinct from SMI Ergodic) |
| Aroon Oscillator | **Implemented** | `src/standard/aroon-oscillator.ts` |
| Negative Volume Index (NVI) | **Implemented** | `src/standard/nvi.ts` (NVI + EMA signal) |
| Positive Volume Index (PVI) | **Implemented** | `src/standard/pvi.ts` (PVI + EMA signal) |
| Pring's Special K | **Implemented** | `src/standard/prings-special-k.ts` |
| Ulcer Index | **Implemented** | `src/standard/ulcer-index.ts` |
| Volatility Stop | **Implemented** | `src/standard/volatility-stop.ts` |
| Volume Weighted Average Price (VWAP) | **Implemented** | `src/standard/vwap.ts` (anchored, optional bands) |
| Auto Key Levels | **Implemented** | `src/standard/auto-key-levels.ts` (approx; pivot-based S/R rays) |
| Auto Trend Detector | **Implemented** | `src/standard/auto-trend-detector.ts` (approx; pivot trendlines) |
| Up/Down Volume | **Implemented** | `src/standard/up-down-volume.ts` (approx; no intrabar data — like CVD) |

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

Implemented indicators are in:
```
src/
```

---

## Notes

- CVD, Net Volume, and Volume Delta use the PineScript `ta.requestVolumeDelta` / `ta.requestUpAndDownVolume`, which analyze intrabar data from lower timeframes
- Our implementation approximates up/down volume using close vs open price comparison

---

*Last updated: February 25, 2026 - Added KST, Connors RSI, Chop Zone, RCI, RVI, Williams Fractals, TWAP, Bollinger Bars, Moon Phases*

*Updated May 31, 2026 - Added 16 built-in studies (6 already implemented but undocumented). Implemented the remaining 10 (`src/standard/`: aroon-oscillator, nvi, pvi, ulcer-index, prings-special-k, volatility-stop, vwap, up-down-volume, auto-key-levels, auto-trend-detector) with unit tests. Auto Key Levels, Auto Trend Detector, and Up/Down Volume are approximations (drawing/intrabar). Linear Regression Channel is now marked as implemented (`community/`) and the summary counts are corrected.*
