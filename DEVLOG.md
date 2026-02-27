# DEVLOG

## 2026-02-27 - Display Fidelity Review: Complete Session Summary

### Goal
Review all 254 community indicators against their PineScript source code for missing display elements (plots, markers, fills, hlines, barColors, bgColors, plotCandles) and fix all gaps.

### Work Done

**Phase 1: Display Elements (markers, fills, hlines, barColors, bgColors, plotCandles)**
- Python assessment script found 94 indicators with display gaps across 188 matched TS→Pine pairs
- 6 parallel agents fixed 46 indicators, correctly skipped 12
- 8 more agents fixed fills/markers for previously-skipped indicators needing calculation changes
- Total: ~86 display element fixes

**Phase 2: Plot Count Matching**
- Built 3 versions of plot-count comparison scripts (V1→V3) improving Pine matching accuracy
- V3 found 97 indicators where Pine has more plot() calls than TS
- 6 parallel agents (A-F) addressed the top priority gaps:
  - Batch A: 8 indicators fixed (fibonacci-levels 13 plots, buy-sell-pressure 7 plots, buying-selling-volume 6 plots, volume-flow-v3 6 plots, easy-trend-colors 3 plots, simple-moving-averages, madrid-ma-ribbon, philakone-ema-swing)
  - Batch B: 9 indicators updated (zero-lag-ema, mavilimw, leledc-levels, ma-colored, cm-rsi-2-upper, williams-vix-fix, fibonacci-zone, ichimoku-ema-bands, chandelier-stop)
  - Batch C: 5 updated (price-action-system, murreys-math-osc, rs-support-resistance, cm-laguerre-ppo, range-identifier)
  - Batch D: 3 updated (pivot-point-supertrend, t3-psar, cm-vix-fix-v3)
  - Batch E: 5 updated (most-rsi, premier-rsi, ichimoku-oscillator, price-momentum-oscillator, ehlers-stochastic-cg)
  - Batch F: 2 updated (double-macd, volume-flow-indicator)
  - Total: ~32 plot fixes, ~28 skipped with valid reasons (dummy plots, wrong Pine match, different indicator variant)

### Final State
- **0 TypeScript compilation errors**
- **652/652 tests pass**
- **77 remaining plot gaps** (down from 97), categorized as:
  - 5 with diff >= 10 (complex multi-component indicators like auto-support with 56 Pine plots)
  - 12 with diff 3-9 (already have markers/fills/hlines covering many Pine plots)
  - 10 with diff 2
  - 34 with diff 1 (mostly "Dummy" plots, invisible anchor lines, or level lines already in hlines)
- Many remaining diff:1 items have Pine titles like "Dummy", "DummyL", or empty "" — these are invisible placeholder plots

### Key Decisions
- Skipped indicators where TS and Pine are fundamentally different designs (overlay vs oscillator)
- Skipped Pine "dummy" plots (plot(na), plot with transp=100, plot with display=0)
- Skipped combo Pine indicators where TS implements a focused subset
- Used descriptive plot IDs (midline, up1, down1) instead of generic plot0/plot1 where clearer

---

## 2026-02-27 - Missing Plot Outputs: Batch 4 (8 Indicators, diff 1-2)

### Goal
Add missing plot() outputs to 8 community indicators with small plot diffs (1-2) by reading their PineScript source code.

### Indicators Modified (4 of 8)
1. **most-rsi** - Added plot2 (raw RSI line, #7E57C2) + hline 50 midline. Pine plots RSI, RSI-MA, and MOST as 3 separate lines; TS only had RSI-MA and MOST.
2. **premier-rsi** - Added plot0 (Premier RSI line, black) + plot1 (colored histogram). Previously only had histogram as plot0. Pine plots `pro` twice: once as line, once as histogram. Also fixed barcolor logic to match Pine's direction-based coloring.
3. **ichimoku-oscillator** - Expanded from 1 plot (simple tenkan-kijun) to 5 plots matching Pine's 4-layer stacked area oscillator (Cloud, ConvBase, Lagging, Oscline) + EMA signal line. Added displacement and emaLen inputs.
4. **price-momentum-oscillator** - Added plot2 (Histogram = PMO - Signal, columns style) with directional coloring.

### Also Fixed
- **ehlers-stochastic-cg** - Added 2 missing OB/OS hlines (0.8 and -0.8) matching Pine's Level+ and Level- plots.

### Intentionally Skipped (4 of 8)
- **market-cipher-a** - Pine is an overlay EMA ribbon; TS is a non-overlay oscillator (WaveTrend+MFI+MACD). Different components.
- **wavetrend** - All 10 Pine plots already covered by 3 data plots + 5 hlines + markers + barColors.
- **rmi-trend-sniper** - Pine is overlay (RWMA bands). TS is non-overlay oscillator. Already has barColors and plotCandles.
- **ehlers-stochastic-cg** (plots) - Pine's extra plots are Dummy (invisible), ZeroLine (hline), Level+/Level- (now added as hlines).

### Current State
- 0 TypeScript compilation errors on modified files

---

## 2026-02-27 - Missing Plot Outputs: Batch 3 (8 Indicators)

### Goal
Add missing plot() outputs to 8 community indicators by comparing Pine source to TS implementation.

### Indicators Modified (4 of 8)
1. **price-action-system** - Added 3 price channel lines: Low Price Line (ema(low,5)), High Price Line (ema(high,5)), Median Price Line (ema(hl2,4)) matching Pine's overlay channel
2. **murreys-math-osc** - Added 4 missing hlines at 12.5 (1/8), 37.5 (3/8), 62.5 (5/8), 87.5 (7/8) to complete all 9 Murrey Math quadrant levels
3. **rs-support-resistance** - Added 4 plots: Long-term Resist/Support (valuewhen highest/lowest over window2=21), Resist/Support Trade Limits (trade zone % from range); plus 2 fills between short/long-term levels
4. **cm-laguerre-ppo** - Added colored histogram columns for Percentile Rank Top (red/orange/gray) and Bottom (lime/green/silver); updated hlines to Pine's +/-90 extreme and +/-70 warning thresholds with zero line
5. **range-identifier** - Added EMA plot (ema(close, 34)) that was already computed but not output

### Intentionally Skipped (3 of 8)
- **vdub-sniper** - Pine is overlay (EMA, Hull MA, resistance channels), TS is oscillator (wave1/wave2/combined). Completely different design; Pine overlay plots cannot be added to oscillator
- **bollinger-awesome-alert** - Pine's 2 "missing" plots are bb_sqz_upper and bb_sqz_lower with transp=100 (invisible squeeze fills). Per rules: skip dummy/invisible plots
- **ema-wave** - Pine's 2 "missing" plots are WaveC Spike and WaveB Spike (conditional fuchsia overlays). TS already handles spikes via barColors. Zero line is already an hline

### Current State
- 0 TypeScript compilation errors
- No existing calculations modified

---

## 2026-02-27 - Missing Plot Outputs: Batch 2 (10 Indicators)

### Goal
Add missing plot() outputs to 10 community indicators by comparing Pine source to TS implementation.

### Indicators Modified (2 of 10)
1. **double-macd** - Added 2 divergence plots (plot4=Bearish Div, plot5=Bullish Div) using fractal top/bottom detection on MACD2 with regular divergence coloring
2. **volume-flow-indicator** - Added histogram plot (plot2=VFI minus Signal), matching Pine's `d = vfi - vfima`

### Intentionally Skipped (8 of 10)
- **macd-divergence** - Extra divergence plots are fully transparent except at divergence points, already handled by markers
- **laguerre-rsi** - Extra plots are constant lines (20, 80) already covered by hlines
- **redk-rss-wma** - 2nd plot has display=0 (hidden)
- **rsi-bands** - TS is a different variant (BB on RSI oscillator) vs Pine's overlay price bands
- **stoch-vx3** - Extra plots are from embedded "Vdubus BinaryPro 2" code, not Stoch VX3
- **top-bottom-candle** - TS intentionally redesigned as overlay markers; Pine is oscillator
- **vdubus-binarypro** - Pine is overlay channel; TS is non-overlay oscillator; different indicators
- **smi-ucs** - Correct Pine (UCSgears variant) has only 2 data plots + 3 constant lines (hlines). All covered.

### Current State
- 0 TypeScript compilation errors on modified files
- All 212 tests pass

---

## 2026-02-27 - Missing Plot Outputs: Batch Fix (10 Indicators)

### Goal
Add missing plot outputs to community indicator TS files by comparing against their PineScript source code.

### Indicators Fixed (8 of 10 assigned)
1. **zero-lag-ema** - Added Fast SMMA(11) and Slow EMA(89) directional filter lines from Pine source
2. **mavilimw** - Added MavWOld (fixed Fibonacci periods 3/5/8/13/21/34) as second plot
3. **leledc-levels** - Added Resistance Level and Support Level plots that hold at exhaustion point highs/lows; also corrected calculation to match Pine's bindex/sindex algorithm with highest/lowest conditions
4. **ma-colored** - Replaced single generic MA with both EMA and SMA plots (direction-colored), matching Pine's dual-MA design
5. **cm-rsi-2-upper** - Added SMA(5) plot with color based on ma5 vs ma200 position (lime/red)
6. **williams-vix-fix** - Added Range High Percentile line (highest(wvf, lb) * ph)
7. **fibonacci-zone** - Added High Border, Low Border, 76.4%, and 23.6% Fibonacci levels (Pine has 6 plots, not 3) plus 3 zone fills
8. **ichimoku-ema-bands** - Added Senkou Span A (avg of Tenkan/Kijun displaced forward) and Senkou Span B (donchian displaced forward) with cloud fill
9. **chandelier-stop** - Added Stop Line plot (same data as circles, rendered as line per Pine's dual plot)

### Intentionally Skipped (1 of 10)
- **pivot-hh-hl-lh-ll** - Task description mentioned "S1/S2/S3/R1/R2/R3" standard pivot points, but the Pine source is actually "Pivot Points High Low (HH/HL/LH/LL) [Anan]" which IS the same indicator as the TS. No missing plots to add.

### Current State
- 0 new TypeScript compilation errors (pre-existing rs-support-resistance.ts errors unchanged)
- All changes add plot data AND corresponding plotConfig entries

---

## 2026-02-27 - Previously Skipped Fills: Batch Fix

### Goal
Add missing fills to indicators previously skipped because they needed new calculation plots.

### Indicators Fixed (8 of 11 assigned)
1. **ma-deviation-rate** - Added 3 new plots (center, hiBound, loBound) + 4 fills (center-hi, center-lo, rate-hi dynamic red, rate-lo dynamic green)
2. **ma-shift** - Added oscillator column plot + threshold/zero boundary plots + 2 gradient fills
3. **redk-vader** - Added demand/supply energy plots + 1 dynamic fill (green when demand > supply, red otherwise)
4. **rsi-cyclic-smoothed** - Added cyclic percentile dynamic bands (LowBand/HighBand) + 2 fills (hline 30-70, band-to-band)
5. **volume-accumulation-pct** - Added oscillator line + dummy boundary plots + 2 fills (positive=lime, negative=red)
6. **volume-supertrend-ai** - Added upTrend/downTrend/middle plots + 2 fills (up fill, down fill with dynamic colors)
7. **vpci** - Added BB bands (upper/lower) on VPCI + 1 fill between bands
8. **trend-trigger-factor** - Added capped TTF plots (buy clip, sell clip) + 2 fills (green above buy, red below sell)
9. **cm-rsi-2-lower** - Added plot-based band references + 1 fill between 90/10 levels

### Intentionally Skipped (2 of 11)
- **variable-ma** - Pine source has NO fill() call; the "missing fills(1)" was a false positive
- **vdubus-binarypro** - Pine source is an overlay channel indicator; TS is a different oscillator design; fills don't apply

### Current State
- 0 TypeScript compilation errors
- All indicator tests pass (ScalpingLine failures are pre-existing from another agent)

---

## 2026-02-27 - Full Display Items Migration (All Community Indicators)

### Goal
Review all 254 community indicators against their PineScript sources and add missing display items (markers, fills, hlines, barColors, bgColors, plotCandles).

### Approach Taken
- Automated cross-reference: Python script matched 188/254 TS files to Pine sources, found 94 with display gaps
- 8 parallel agents fixed indicators grouped by priority and gap type
- Each agent read Pine source for exact conditions/colors and added display items to TS

### What Worked
- 86/94 indicators fixed with zero TypeScript errors
- All 652 tests pass across 6 test files
- Display items added: markers (44), fills (48), barColors (30), bgColors (18), plotCandles (7), hlines (4)

### What Was Skipped (8 indicators, valid reasons)
- 7 missing fills that would need new calculation plots (ma-deviation-rate, redk-vader, rsi-cyclic-smoothed, scalping-line, st0p, stochastic-momentum-index, ma-shift)
- 1 barcolor commented out in Pine source (market-cipher-b)
- 1 histogram already serves fill purpose (volume-accumulation-pct)

### Current State
- 254 community indicators implemented
- 9 remaining with intentional display gaps (would require calc logic changes)
- 652 tests passing
- 66 indicators unmatched to Pine files (fuzzy match failed) - need manual review

---

## 2026-02-27 - Medium Priority Batch B: Missing Display Items

### Goal
Add missing PineScript display items (markers, fills, barColors, bgColors, plotCandles) to 14 Medium-priority community indicators (batch B).

### Approach Taken
- Read each Pine source file for exact display conditions and colors
- Added display items without modifying calculation logic
- Preserved all existing display items (hlines, markers already present)

### What Worked
- All 14 indicators updated with 0 TypeScript compilation errors
- All 652 tests pass across 6 test files (zero regressions)

### Indicators Updated
1. **nrtr** - markers (buy/sell on trend flip), fills (dynamic green/red between trail lines)
2. **parabolic-rsi** - markers (diamond at SAR reversal), fills (RSI overbought/oversold gradient)
3. **pivot-trailing-maxmin** - markers (pivot high/low labels), fills (dynamic bull/bear between max/min)
4. **price-action-system** - barColors (CCI > 75 aqua, < -75 black), bgColors (MACD signal direction)
5. **price-momentum-oscillator** - fills (PMO/Signal region), barColors (histogram direction lime/green/red/orange)
6. **profit-maximizer** - markers (MA cross PMax buy/sell), fills (dynamic green/red MA vs PMax)
7. **range-filter-dw** - fills (upper/lower band to filter), barColors (trend+close direction)
8. **stochastic-ott** - markers (Stoch cross OTT[2] buy/sell), fills (Stoch/OTT purple region)
9. **super-supertrend** - markers (3 ST trend flip arrows), plotCandles (colored OHLC candles)
10. **trader-xo** - barColors (EMA cross bull/bear bars), bgColors (Stoch RSI crossover alerts)
11. **turtle-trade-channels** - markers (long/short entry/exit labels), fills (dynamic entry/exit channel)
12. **vdub-sniper** - markers (wave1 zero-cross + EMA direction buy/sell), fills (wave1/wave2)
13. **zero-lag-ema** - markers (ZLEMA cross EMA buy/sell), bgColors (close vs ZLEMA trend)
14. **zlma-trend-levels** - markers (ZLMA cross EMA diamonds), fills (ZLMA/EMA region)

### Key Decisions
- NRTR Pine uses percentage-based trail (not ATR) but our TS uses ATR; markers/fills logic adapted to match TS direction array
- Parabolic RSI markers use Pine's color scheme (#EEA47F up, #00539C down) matching original indicator
- Price Action System bgColors use MACD(12,17) signal(8) from Pine source (not indicator's own SMA)
- Range Filter DW barColors use Pine's exact color scheme (#05ff9b/#00b36b up, #ff0583/#b8005d down)
- Super SuperTrend plotCandles added because Pine has plotcandle(open,high,low,close) overlay
- Stochastic OTT markers check OTT[2] lag per Pine source (nz(OTT[2]) crossover pattern)

---

## 2026-02-27 - Medium Priority Batch A: Missing Display Items

### Goal
Add missing PineScript display items (fills, markers, barColors, bgColors, plotCandles, hlines) to 14 Medium-priority community indicators.

### Approach Taken
- Read each Pine source file to identify exact display conditions and colors
- Added display items to TS files without modifying calculation logic or function signatures
- Preserved all existing display items (markers, hlines already present)

### What Worked
- All 14 indicators updated with 0 TypeScript compilation errors in target files
- All 471 existing tests pass (426 batch + 45 medium2)
- Each indicator gets 2 new display items matching Pine source

### Indicators Updated
1. **banker-fund-flow** - fills (hline regions yellow/fuchsia), plotCandles (color-coded fund flow candles)
2. **bjorgum-triple-ema** - fills (EMA pairs), barColors (close vs fast/med: blue/pink/gray)
3. **bollinger-awesome-alert** - markers (AO zero cross buy/sell), fills (upper/lower BB)
4. **cci-stochastic** - markers (enter/exit zone arrows), fills (K/D)
5. **cct-bbo** - fills (hline 100/0 blue fill), hlines (100 solid, 50 dashed, 0 solid)
6. **double-macd** - markers (largo/corto trend entry), bgColors (choppy zone)
7. **ehlers-stochastic-cg** - fills (osc/trigger region), barColors (v2 direction: lime/green/orange/red)
8. **envelope-rsi** - markers (RSI envelope cross buy/sell), fills (upper/lower envelope)
9. **ichimoku-oscillator** - markers (zero cross bull/bear), bgColors (positive green/negative blue)
10. **macd-bb** - fills (BB upper/lower), barColors (macd>upper=yellow, macd<lower=aqua)
11. **madrid-trend-squeeze** - hlines (zero line), plotCandles (3 candle types: CMA/RMA/SMA)
12. **market-shift-levels** - barColors (shift direction), plotCandles (colored OHLC candles)
13. **mfi-rsi-bb** - fills (BB upper/lower), bgColors (breach highlight red/green)
14. **most-rsi** - markers (BUY/SELL crossover), fills (RSI MA / MOST)

### Key Decisions
- Bjorgum fills use dynamic-compatible approach (single color per fill, not per-bar dynamic)
- Double MACD bgColors use simplified choppy zone detection (histogram near zero)
- Ichimoku bgColors simplified from full 4-trend-level to positive/negative oscillator
- Market Shift Levels plotCandles duplicate OHLC data with shift-direction coloring

---

## 2026-02-26 - Medium Wave 2 Community Indicators (PineScript Ports)

### Goal
Implement 15 more Medium-difficulty community indicators by reading their PineScript source from docs/official/indicators_community/.

### Approach Taken
- Read PineScript source files directly (not web search) for algorithm reference
- 6 from previously-assessed "proprietary" indicators + 9 additional feasible ones found by scanning 867 .pine files
- 3 parallel agent batches of 3 each (after initial batch of 6)
- All ported to TypeScript following standard indicator file structure

### What Worked
- All 15 implemented with 1 minor TypeScript fix (implicit any in radius-trend.ts)
- PineScript-to-TypeScript port is straightforward for all algorithms
- Adaptive algorithms (Adaptive HMA, MA Converging, Adaptive MACD) use bar-by-bar loops with state tracking
- Divergence detection uses ta.pivothigh/pivotlow + valuewhen pattern
- 45 new tests, 661 total passing across 6 test files

### Current State
- 258 community indicator files total
- 661 tests passing across 6 test files
- 28 Medium indicators remaining implementable
- 51 Hard indicators remaining implementable

### Key Decisions
- Used local PineScript source files (docs/official/indicators_community/*.pine) as primary reference
- HEMA Trend Levels skipped (requires box drawing not supported)
- Adaptive MACD uses R² correlation for speed adaptation (not standard MACD)
- Beta-weighted MA uses Beta distribution kernel for weight function
- Consolidation Zones output top/bottom lines (not box drawing)

---

## 2026-02-26 - AI/ML Community Indicators

### Goal
Implement 8 AI/ML indicators using kNN, k-Means Clustering, and Gaussian Process Regression.

### Approach Taken
- Researched all 13 AI/ML indicators from inventory; 8 feasible (5 already marked implementable + 3 unblocked by table support)
- 2 parallel agent batches of 4 each
- Algorithms: kNN classification/regression (5), k-means clustering (2), Gaussian kernel regression (1)
- 3 indicators output data tables (ML Adaptive SuperTrend, ML RSI, SuperTrend AI Clustering)

### What Worked
- All 8 implemented with zero TypeScript errors
- Table output works with existing chart.ts setTable() rendering
- kNN with inverse-distance weighting for smooth predictions
- k-means with 10-iteration convergence for volatility clustering

### Current State
- 243 community indicator files total
- 616 tests passing across 5 test files
- 3 indicators with table output (first usage of table feature)

### Key Decisions
- kNN uses Euclidean distance on normalized features
- k-means initialized with min/median/max of training data
- ML Moving Average uses Gaussian kernel weights (not true GP regression — simplified for bar-by-bar)
- Volume SuperTrend AI adapts factor based on volume regime from kNN neighbors

---

## 2026-02-26 - Medium Community Indicators

### Goal
Implement feasible Medium-difficulty community indicators that use existing oakscriptjs ta.* functions.

### Approach Taken
- Filtered 74 unimplemented Medium indicators → 24 feasible (use existing ta.* functions), ~28 duplicates, ~22 skipped (MTF/AI/tick-data/interactive)
- 3 parallel agent batches: trailing-stop/trend (8), oscillator/momentum (8), channels/MAs/trend (8)
- Programmatic index.ts registration and test generation

### What Worked
- All 24 indicators implemented and registered
- 96 new tests, 589 total passing
- Fixed NaN propagation in NRTR and Range Filter DW (ATR/EMA warmup edge case)

### What Failed
- Script initially exported `metadata` instead of named exports (regex matched first `export const` in file)

### Current State
- 235 community indicator files total (211 + 24 medium)
- All Easy indicators resolved (208 implemented, 10 duplicate, 1 N/A)
- 24 Medium indicators implemented
- 589 tests passing across 4 test files

### Key Decisions
- Skipped: MTF indicators, AI/ML indicators, tick-data indicators, interactive S/R
- Implemented: trailing-stop variants (NRTR, PMax, OTT Bands, OTTO), oscillator combos (CCI Stoch, Double MACD, Ichimoku Osc), channel/MA types (Gaussian Channel, Madrid Ribbon, ZLMA Levels)

---

## 2026-02-26 - Massive Community Indicator Batch Implementation

### Goal
Implement all ~105 remaining Easy-difficulty community indicators from INDICATOR_INVENTORY_COMMUNITY.md.

### Approach Taken
- Identified 114 unimplemented Easy indicators (after deduplication against existing standard/community files)
- Launched 7 parallel agents to write indicator source files in batches of ~17-25 each
- Generated index.ts additions (imports, exports, type exports, registry entries) programmatically via bash scripts
- Generated test file with 314 tests programmatically

### What Worked
- 7-way parallel agent implementation: ~139 new indicator files written simultaneously
- Programmatic index.ts generation: extracted export names, input types, metadata from each file via bash
- Only 3 TypeScript compilation errors across all files (2x `bb.upper` destructuring, 1x invalid `dashed` style)
- 29 initial test failures resolved: 5 candle-type indicators (use plotCandles), 19 marker/pattern indicators (zero signals in synthetic data), 5 warmup issues
- Final: 493 tests pass (121 batch 1 + 58 wave 2 + 314 batch 2)

### What Failed
- Some agents created extra indicators beyond the requested batch (agent F/G created ~25 bonus files)
- sed-based test fixes required manual follow-up for candle indicators

### Current State
- 211 community indicator files total (was 72)
- All registered in index.ts with imports, exports, type exports, and registry entries
- All pass TypeScript compilation
- 493 tests passing across 3 test files
- Categories: Moving Averages, Momentum, Oscillators, Volume, Trend, Channels & Bands, Candlestick Patterns

### Key Decisions
- Candle indicators (CM Heikin Ashi, Modified HA, Slow HA, LinReg Candles, RSI Candles) use plotCandles with candle0/rsi keys
- Pattern/signal indicators (engulfing, fractals, pivot markers) use markers + NaN-filled plot0
- Category assignment heuristic: filename-based pattern matching (ema-* → Moving Averages, rsi-* → Oscillators, etc.)

---

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
