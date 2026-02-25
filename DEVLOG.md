# DEVLOG

## 2026-02-25 - Wave 2 Display Features

### Goal
Add missing display features (markers, fills, hlines) to Wave 2 indicators.

### Approach Taken
Used existing framework primitives: `MarkerData` (defined in src/index.ts), `FillData` and `HLineData` (from oakscriptjs IndicatorResult). Markers return type uses `IndicatorResult & { markers: MarkerData[] }` pattern from candlestick-pattern.ts. lightweight-charts v5 `SeriesMarker<Time>` API already consumed in example/src/indicator-ui.ts.

### What Worked
- **Markers (5 indicators)**: AlphaTrend (AT cross AT[2]), HalfTrend (trend flip), FollowLine (iTrend flip), UTBot (close cross trailing stop), OTT (MAvg cross OTT[2])
- **Fills (7 indicators)**: AlphaTrend (AT/AT[2]), HalfTrend (HT/ATR bands), Hull Suite (MHULL/SHULL), CDC Action Zone (Fast/Slow), Ripster EMA Clouds (5 pairs), Zero Lag MACD (MACD/Signal), OTT (Support/OTT)
- **Hlines (2 indicators)**: QQE MOD (zero line dotted), Premier RSI (0 dotted, ±0.2 dashed, ±0.9 solid)
- 14 new tests added, all 94 tests pass

### Current State
- 44 display features implemented across 17 indicators
- Not implemented: dynamic per-bar coloring (needs framework `colors[]` support), barcolor (out of scope)
- PlotConfig.style not available in oakscriptjs runtime/types.d.ts (blocks histogram/circles/columns styles)

### Key Decisions
- Markers use lightweight-charts v5 compatible fields (position, shape, color, text)
- Fill colors match indicator plot colors where applicable; CDC/ZeroLagMACD use default (no color option)
- FollowLine iTrend derived from close vs trendLine comparison (not bbSignal directly)

---

## 2026-02-25 - Wave 2 Community Indicators

### Goal
Implement the 20 Wave 2 "Medium Effort" community indicators from the inventory.

### Approach Taken
Same as Wave 1: ported PineScript logic directly using oakscriptjs ta.* functions for Series-based indicators, manual bar-by-bar loops for stateful trailing-stop indicators.

### What Worked
- 18 new indicators implemented (2 already existed: TTM Squeeze as squeeze-momentum, STC as schaff-trend-cycle)
- Stateful indicators (AlphaTrend, HalfTrend, FollowLine, UTBot, OTT, TrendMagic, SSLChannel) all use bar-by-bar loops with trailing stop ratchet patterns
- Series-chaining (Tillson T3 6-stage EMA cascade, MavilimW 6-stage WMA chain) works cleanly
- QQE MOD dual-QQE with BB overlay is the most complex — manual band tracking per bar
- All 45 unit tests pass, plus existing 35 Wave 1 tests

### What Failed
- N/A

### Current State
- Done (Wave 2): AlphaTrend, HalfTrend, QQE MOD, Follow Line, UT Bot, Hull Suite, OTT, Trend Magic, SSL Channel, MavilimW, CDC Action Zone, Tillson T3, Waddah Attar Explosion, Ripster EMA Clouds, Premier RSI, Laguerre RSI, RSI Candles, Zero Lag MACD
- Skipped (already exist): TTM Squeeze (squeeze-momentum.ts), STC (schaff-trend-cycle.ts)
- Total indicators: ~100+ (core + Wave 1 + Wave 2 + candlestick patterns)
- Version bumped to 0.4.0

### Key Decisions
- OTT uses VAR (Variable Index Dynamic Average) as default MA type — most popular setting
- HalfTrend uses ATR(100) which needs 250-bar fixture for tests
- Ripster EMA Clouds outputs 10 EMA lines (5 pairs), not cloud fills (display concern)
- CDC Action Zone outputs Fast/Slow EMA lines, zone coloring is display concern
- Waddah Attar dead zone = RMA(TR, 100) * 3.7 per original PineScript

---

## 2026-02-25 - Wave 1 Community Indicators

### Goal
Implement the 20 Wave 1 "Quick Wins" community indicators from the inventory.

### Approach Taken
Ported PineScript logic directly using oakscriptjs ta.* functions where available, manual loops for stateful indicators.

### What Worked
- 14 new indicators implemented (4 already existed as core indicators: SAR, ADX/DI, MFI, AO)
- oakscriptjs ta.* API covers BB, KC, linreg, stoch, ema, sma, rma, atr, highest, lowest
- Series arithmetic (add/sub/mul/div) makes translations clean
- Stateful indicators (Chandelier Exit, Coral Trend, STC, KDJ) use manual bar-by-bar loops

### What Failed
- N/A (clean implementation)

### Current State
- Done: ZLSMA, Forecast Oscillator, CCT BBO, MACD 4C, Colored Volume Bars, KDJ, WaveTrend, Squeeze Momentum, Coral Trend, Chandelier Exit, Impulse MACD, Schaff Trend Cycle, Donchian Trend Ribbon, OBV MACD
- Skipped (already exist): Parabolic SAR, ADX/DI, MFI, Awesome Oscillator
- Remaining from Wave 1 list: Heiken Ashi Candles (#278) - TBD if distinct from smoothed HA
- No regression tests yet for new indicators (need PineSuite reference CSV data)

### Key Decisions
- Used ta.rma() as SMMA equivalent (same algorithm: Wilder smoothing)
- Donchian Trend Ribbon outputs composite score (-10 to +10) rather than 10 visual ribbon layers
- MACD 4C outputs the MACD value (coloring is a display concern, not calculation)
- Colored Volume outputs volume values (coloring based on price/vol comparison is display)
