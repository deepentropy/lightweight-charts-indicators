# DEVLOG

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
