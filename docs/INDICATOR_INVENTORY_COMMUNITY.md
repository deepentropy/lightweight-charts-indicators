# OakScriptJS Community Indicator Inventory

This document provides a comprehensive inventory of all community PineScript indicators
from TradingView. It tracks implementation feasibility and status in OakScriptJS.

## Summary Statistics

| Category | Count |
|---|---|
| **Total Indicators** | 867 |
| **Implementable** | 356 |
| **Blocked** | 511 |
| **Implemented** | 14 |

### Implementable Breakdown

| Difficulty | Count | Description |
|---|---|---|
| Easy | 222 | Direct TA port, all functions available, <80 lines |
| Medium | 80 | Stateful logic or custom MAs, 80-200 lines |
| Hard | 54 | Complex logic, may need partial feature skip, 200+ lines |

### Blocker Breakdown

| Blocker | Affected | Description |
|---|---|---|
| Drawing | 324 | Heavy use of line.new/box.new/label.new (>3 calls) |
| MTF | 192 | Uses request.security() for multi-timeframe data |
| Table | 131 | Uses table.new/table.cell for info display |
| Strategy | 61 | Uses strategy.* for backtesting/trade simulation |
| Session | 38 | Uses session/timezone functions |
| Screener | 37 | Cross-symbol scanning (>5 security calls or >2 input.symbol) |
| ExternalData | 4 | Uses request.financial/earnings/dividends |

> **Note:** Many blocked indicators have multiple blockers. The primary blocker is listed first.
> Indicators marked "Blocked" may still have their core calculation logic portable,
> but the full feature set cannot be replicated without the missing capabilities.

---

## Legend

| Status | Meaning |
|---|---|
| Implementable (Easy) | All required oakscriptjs functions available. Direct port. |
| Implementable (Medium) | Feasible but needs stateful logic or custom functions. |
| Implementable (Hard) | Complex but possible. May need to skip table/drawing extras. |
| Blocked: Strategy | Requires strategy.* backtesting engine |
| Blocked: MTF | Requires request.security() multi-timeframe |
| Blocked: Session | Requires timezone/session detection |
| Blocked: Table | Requires table.new/table.cell display |
| Blocked: Drawing | Requires heavy line/box/label drawing (>3 calls) |
| Blocked: Screener | Requires cross-symbol data (multiple tickers) |
| Blocked: ExternalData | Requires request.financial/earnings/dividends |

---

## Complete Community Indicator Inventory

| # | Indicator | Status | Difficulty | Blockers |
|---|-----------|--------|------------|----------|
| 1 | %R Trend Exhaustion [upslidedown] | Implementable | Hard | |
| 2 | [@btc_charlie] Trader XO Macro Trend Scanner | Implementable | Medium | |
| 3 | [blackcat] L3 Banker Fund Flow Trend Oscillator | Implementable | Medium | |
| 4 | [imba]lance algo | Blocked | N/A | Table;Drawing |
| 5 | [JRL] MM Fibonacci | Blocked | N/A | MTF |
| 6 | [RS]Fractals V9 | Blocked | N/A | MTF |
| 7 | [RS]Support and Resistance V0 | Implementable | Easy | |
| 8 | [RS]ZigZag Multiple Methods - Forecast - patterns - labels | Blocked | N/A | Drawing |
| 9 | [RS]ZigZag Percent Reversal - Forecast - patterns - labels | Blocked | N/A | Drawing |
| 10 | [SK] Fibonacci Auto Trend Scouter | Blocked | N/A | MTF;Drawing |
| 11 | [STRATEGY][RS]ZigZag PA Strategy V4.1 | Blocked | N/A | Strategy;MTF |
| 12 | _CM_High_Low_Open_Close_Weekly-Intraday | Blocked | N/A | MTF |
| 13 | _CM_Ultimate_MA_MTF_V4 | Blocked | N/A | MTF |
| 14 | 10x Bull Vs. Bear VP Intraday Sessions [Kioseff Trading] | Blocked | N/A | Session;Drawing |
| 15 | 1-2-3 Pattern (Expo) | Blocked | N/A | Drawing |
| 16 | 20 years old Turtles strategy still work!! | Blocked | N/A | Strategy |
| 17 | 2B Reversal Pattern (Expo) | Blocked | N/A | Drawing |
| 18 | 3Commas Bot | Blocked | N/A | Strategy;Session |
| 19 | 3rd Wave | Blocked | N/A | Drawing |
| 20 | 72s Strat_ Backtesting Adaptive HMA+ pt.1 | Blocked | N/A | Strategy |
| 21 | 72s_ Adaptive Hull Moving Average+ | Implementable | Medium | |
| 22 | A Useful MA Weighting Function For Controlling Lag & Smoothness | Implementable | Medium | |
| 23 | ABC on Recursive Zigzag [Trendoscope] | Blocked | N/A | Table;Drawing |
| 24 | Accurate Swing Trading System | Implementable | Easy | |
| 25 | Activity and Volume Orderflow Profile [AlgoAlpha] | Blocked | N/A | Drawing |
| 26 | Adaptive MACD [LuxAlgo] | Implementable | Medium | |
| 27 | Adaptive Trend Finder (log) | Blocked | N/A | Table;Drawing |
| 28 | Adaptive Trend Flow [QuantAlgo] | Implementable | Medium | |
| 29 | ADR% - Average Daily Range % by MikeC (AKA TheScrutiniser) | Blocked | N/A | MTF |
| 30 | ADX and DI | Implementable | Easy | |
| 31 | ADX by cobra | Implementable | Easy | |
| 32 | ADX Di+ Di- [Gu5] | Implementable | Hard | |
| 33 | AG FX - Watermark | Blocked | N/A | Table |
| 34 | AI Trend Navigator [K-Neighbor] | Implementable | Medium | |
| 35 | AI-EngulfingCandle | Implementable | Easy | |
| 36 | AK  TREND ID v1.00 | Implementable | Easy | |
| 37 | AK MACD BB INDICATOR V  1.00 | Implementable | Easy | |
| 38 | All Candlestick Patterns Identifier | Implementable | Easy | |
| 39 | AlphaTrend - Screener | Blocked | N/A | Screener;MTF |
| 40 | AlphaTrend Strategy | Blocked | N/A | Strategy |
| 41 | AlphaTrend | Implementable | Easy | |
| 42 | Angle Attack Follow Line Indicator | Blocked | N/A | MTF |
| 43 | ANN Strategy v2 | Blocked | N/A | Strategy;MTF |
| 44 | Anti-Volume Stop Loss | Implementable | Easy | |
| 45 | AR Forecast Scatterplot [SS] | Blocked | N/A | Table;Drawing |
| 46 | AsiaSessionHighLowMidLines | Blocked | N/A | Session;Drawing |
| 47 | ATR Bands | Blocked | N/A | Table |
| 48 | ATR Stop Loss Finder | Blocked | N/A | Table |
| 49 | ATR Trailing Stoploss | Implementable | Easy | |
| 50 | ATR+ (Stop Loss Indicator) | Implementable | Easy | |
| 51 | Auto Chart Patterns [Trendoscope®] | Implementable | Hard | |
| 52 | Auto Fib Channels by DGT | Blocked | N/A | Table;Drawing |
| 53 | Auto Fib Retracement Alerts | Blocked | N/A | Drawing |
| 54 | Auto Fib Speed Resistance Fans by DGT | Blocked | N/A | Table;Drawing |
| 55 | Auto Fib | Implementable | Easy | |
| 56 | Auto Fibo on Indicators | Implementable | Medium | |
| 57 | Auto Fibonacci and Gann Fan_Retracements Combo | Blocked | N/A | Drawing |
| 58 | Auto PitchFan, Fib Extension_Retracement and ZigZag by DGT | Blocked | N/A | Table;Drawing |
| 59 | Auto Pitchfork, Fib Retracement and Zig Zag by DGT | Blocked | N/A | MTF;Table;Drawing |
| 60 | Auto Trendline Indicator (based on fractals) | Implementable | Hard | |
| 61 | Auto TrendLines [HeWhoMustNotBeNamed] | Blocked | N/A | Table;Drawing |
| 62 | Automatic Daily Fibonacci v0.3 by JustUncleL | Blocked | N/A | MTF |
| 63 | Automatic Support & Resistance | Implementable | Easy | |
| 64 | Auto-Support | Implementable | Easy | |
| 65 | Average Sentiment Oscillator | Implementable | Easy | |
| 66 | Average True Range Trailing Stops Colored | Implementable | Easy | |
| 67 | AWESOME OSCILLATOR V2 by KIVANCfr3762 | Implementable | Easy | |
| 68 | Backtest Adapter | Blocked | N/A | Strategy |
| 69 | Backtesting & Trading Engine [PineCoders] | Blocked | N/A | Strategy |
| 70 | Backtesting 3commas DCA Bot v2 | Blocked | N/A | Strategy;MTF;Table |
| 71 | Balanced Price Range (BPR) | Blocked | N/A | Drawing |
| 72 | BEST Supertrend CCI | Implementable | Medium | |
| 73 | BEST Trend Direction Helper (Strategy Edition) | Blocked | N/A | Strategy;Drawing |
| 74 | Big Snapper Alerts R2.0 by JustUncleL | Implementable | Hard | |
| 75 | Bill Williams. Alligator, Fractals & Res_Sup combined (by vlkvr) | Implementable | Easy | |
| 76 | Binary Option Arrows (example) [TheMightyChicken] | Implementable | Easy | |
| 77 | BITCOIN KILL ZONES v2 | Implementable | Easy | |
| 78 | Bitcoin Logarithmic Growth Curves | Implementable | Medium | |
| 79 | Bjorgum AutoTrail | Implementable | Hard | |
| 80 | Bjorgum Double Tap | Blocked | N/A | Strategy;Table;Drawing |
| 81 | Bjorgum Key Levels | Blocked | N/A | Drawing |
| 82 | Bjorgum MTF MA | Blocked | N/A | MTF |
| 83 | Bjorgum SuperScript | Blocked | N/A | Table |
| 84 | Bjorgum Triple EMA Strat | Implementable | Medium | |
| 85 | Bjorgum TSI | Implementable | Hard | |
| 86 | Bollinger + RSI, Double Strategy (by ChartArt) v1.1 | Blocked | N/A | Strategy |
| 87 | Bollinger + RSI, Double Strategy (by ChartArt) | Blocked | N/A | Strategy |
| 88 | Bollinger + RSI, Double Strategy Long-Only (by ChartArt) v1.2 | Blocked | N/A | Strategy |
| 89 | Bollinger Awesome Alert R1 by JustUncleL | Implementable | Medium | |
| 90 | Bollinger Band with RSI | Blocked | N/A | Strategy |
| 91 | Bollinger Bands Breakout Oscillator [LuxAlgo] | Implementable | Easy | |
| 92 | Bollinger Bands Fibonacci ratios | Implementable | Easy | |
| 93 | Bollinger Bands Stochastic RSI Extreme Signal | Implementable | Easy | |
| 94 | Boom Hunter Pro | Implementable | Hard | |
| 95 | Breakaway Fair Value Gaps [LuxAlgo] | Blocked | N/A | Table;Drawing |
| 96 | Breaker Blocks + Order Blocks confirm [TradingFinder] BBOB Alert | Implementable | Hard | |
| 97 | Breaker Blocks with Signals [LuxAlgo] | Blocked | N/A | Drawing |
| 98 | Breakout Finder | Blocked | N/A | Drawing |
| 99 | Breakout Probability (Expo) | Blocked | N/A | Table |
| 100 | Breakouts with Tests & Retests [LuxAlgo] | Blocked | N/A | Drawing |
| 101 | BTCUSDSHORTS BTCUSDLONGS - Bitfinex BTC Shorts & Longs | Blocked | N/A | MTF |
| 102 | Bull Bear Power Trend | Implementable | Easy | |
| 103 | Bull Market Support Band (20w SMA, 21w EMA) | Blocked | N/A | MTF |
| 104 | Bullish Engulfing automatic finding script | Implementable | Easy | |
| 105 | BUY & SELL VOLUME TO PRICE PRESSURE by @XeL_Arjona | Implementable | Easy | |
| 106 | BUY and SELL -  Backtest single EMA cross By che_trader | Blocked | N/A | Strategy |
| 107 | Buy&Sell Strategy depends on AO+Stoch+RSI+ATR by SerdarYILMAZ | Blocked | N/A | Strategy |
| 108 | Buying Selling Volume | Implementable | Easy | |
| 109 | buysellsignal-yashgode9 | Implementable | Medium | |
| 110 | Buyside & Sellside Liquidity [LuxAlgo] | Blocked | N/A | Drawing |
| 111 | Candlestick Patterns Identified (updated 3_11_15) | Implementable | Easy | |
| 112 | Candlestick Reversal System | Implementable | Easy | |
| 113 | Candlestick Structure [LuxAlgo] | Blocked | N/A | Table;Drawing |
| 114 | Candlestick Trend Indicator v0.5 by JustUncleL | Blocked | N/A | Strategy |
| 115 | Candlesticks Patterns Identified | Implementable | Easy | |
| 116 | Captain Backtest Model [TFO] | Blocked | N/A | Strategy;Session;Drawing |
| 117 | CCI Stochastic and a quick lesson on Scalping & Trading Systems | Implementable | Medium | |
| 118 | CCT Bollinger Band Oscillator | Implementable | Easy | |
| 119 | CD_Average Daily Range Zones- highs and lows of the day | Blocked | N/A | MTF |
| 120 | CDC Action Zone V.2 | Implementable | Easy | |
| 121 | CDC ActionZone V3 2020 | Blocked | N/A | MTF |
| 122 | Chandelier Exit | Implementable | Easy | |
| 123 | Chandelier Stop | Implementable | Easy | |
| 124 | Channels With Patterns [ChartPrime] | Blocked | N/A | Drawing |
| 125 | CM EMA Trend Bars | Implementable | Easy | |
| 126 | CM Enhanced Ichimoku Cloud V5 | Implementable | Easy | |
| 127 | CM Gann Swing High Low V2 | Implementable | Easy | |
| 128 | CM Heikin-Ashi Candlesticks_V1 | Implementable | Easy | |
| 129 | CM MACD Custom Indicator - Multiple Time Frame - V2 | Blocked | N/A | MTF |
| 130 | CM Renko Overlay Bars | Blocked | N/A | MTF |
| 131 | CM RSI-2 Strategy - Upper Indicators. | Implementable | Easy | |
| 132 | CM RSI-2 Strategy Lower Indicator | Implementable | Easy | |
| 133 | CM Sling Shot System | Implementable | Easy | |
| 134 | CM Stochastic Multi-TimeFrame | Blocked | N/A | MTF |
| 135 | CM Stochastic POP Method 1 - Jake Bernstein_V1 | Implementable | Easy | |
| 136 | CM Stochastic POP Method 2-Jake Bernstein_V1 | Implementable | Easy | |
| 137 | CM Super Guppy | Implementable | Medium | |
| 138 | CM Time Based Vertical Lines | Implementable | Easy | |
| 139 | CM_ADX_V1 | Implementable | Easy | |
| 140 | CM_Gap_Indicator_Intra-Day_V2.1 | Blocked | N/A | MTF |
| 141 | CM_Guppy_EMA | Implementable | Easy | |
| 142 | CM_Laguerre PPO PercentileRank Mkt Tops & Bottoms | Implementable | Easy | |
| 143 | CM_Modified_Heikin-Ashi_TrendBars | Implementable | Easy | |
| 144 | CM_OldSchool_Projected_high_Low | Blocked | N/A | MTF |
| 145 | CM_Parabolic SAR | Implementable | Easy | |
| 146 | CM_Pivot Points Daily To Intraday | Blocked | N/A | MTF |
| 147 | CM_Pivot Points_Custom | Blocked | N/A | MTF |
| 148 | CM_Pivot Points_M-W-D-4H-1H_Filtered | Blocked | N/A | MTF |
| 149 | CM_Price-Action-Bars-Price Patterns That Work! | Implementable | Easy | |
| 150 | CM_RSI Plus EMA | Implementable | Easy | |
| 151 | CM_Stochastic Highlight Bars | Implementable | Easy | |
| 152 | CM_Ultimate RSI Multi Time Frame | Blocked | N/A | MTF |
| 153 | CM_Ultimate_MA_MTF_V2 | Blocked | N/A | MTF |
| 154 | CM_Williams_Vix_Fix  Finds Market Bottoms | Implementable | Easy | |
| 155 | CM_Williams_Vix_Fix_V3_Ultimate_Filtered_Alerts | Implementable | Easy | |
| 156 | CM_Williams_Vix_Fix_V3_Upper_Text Plots | Implementable | Easy | |
| 157 | Code for All 4 Forex Sessions W_ Background Highlight!!! | Implementable | Easy | |
| 158 | Code Plots - High, Low, Open, Close—Daily, Weekly, & Monthly!!! | Blocked | N/A | Screener;MTF |
| 159 | Colored Volume Bars [LazyBear] | Implementable | Easy | |
| 160 | Comprehensive Trading Toolkit [BigBeluga] | Blocked | N/A | Drawing |
| 161 | Consolidation Range with Signals (Zeiierman) | Blocked | N/A | Drawing |
| 162 | Consolidation Zones - Live | Implementable | Medium | |
| 163 | Coral Trend Indicator [LazyBear] | Implementable | Easy | |
| 164 | Cumulative Delta Volume | Implementable | Easy | |
| 165 | Cumulative Volume Delta Strategy _ Flux Charts | Blocked | N/A | Table;Drawing |
| 166 | Cup Finder | Blocked | N/A | Drawing |
| 167 | Custom Indicator Clearly Shows If Bulls or Bears are in Control! | Implementable | Easy | |
| 168 | Custom Indicator for Donchian Channels!!! System Rules Included! | Implementable | Easy | |
| 169 | Custom Pattern Detection | Blocked | N/A | Table;Drawing |
| 170 | CVD - Cumulative Volume Delta (Chart) | Blocked | N/A | MTF;Session;Table;Drawing |
| 171 | CVD - Cumulative Volume Delta Candles | Blocked | N/A | MTF;Session;Table |
| 172 | Daily Close Comparison Strategy (by ChartArt via sirolf2009) | Blocked | N/A | Strategy;MTF |
| 173 | Daily Weekly Monthly Yearly Opens | Blocked | N/A | MTF;Session;Drawing |
| 174 | DARVAS BOX by KIVANÇ fr3762 | Implementable | Easy | |
| 175 | Day Trading Booster by DGT | Blocked | N/A | MTF;Table;Drawing |
| 176 | DecisionPoint Price Momentum Oscillator [LazyBear] | Implementable | Easy | |
| 177 | DecisionPoint Volume Swenlin Trading Oscillator [LazyBear] | Blocked | N/A | MTF |
| 178 | Delta Flow Profile [LuxAlgo] | Blocked | N/A | Drawing |
| 179 | Delta Volume Candles [LucF] | Blocked | N/A | MTF;Table |
| 180 | Delta-RSI Oscillator Strategy | Implementable | Hard | |
| 181 | Demand & Supply Zones [eyes20xx] | Blocked | N/A | Drawing |
| 182 | Depth of Market (DOM) [LuxAlgo] | Blocked | N/A | MTF;Table |
| 183 | Deviation Trend Profile [BigBeluga] | Blocked | N/A | Drawing |
| 184 | Directional Movement Index + ADX & Keylevel Support | Implementable | Easy | |
| 185 | Divergence for many indicator v3 | Blocked | N/A | Drawing |
| 186 | Divergence for Many Indicators v4 | Implementable | Hard | |
| 187 | Divergence Indicator (any oscillator) | Implementable | Medium | |
| 188 | Divergences for many indicators v2.0 | Blocked | N/A | MTF |
| 189 | DIY Custom Strategy Builder  [ZP] - v1 | Blocked | N/A | Screener;MTF;Session;Table;Drawing;ExternalData |
| 190 | DonAlt - Smart Money Toolkit [BigBeluga] | Blocked | N/A | Drawing |
| 191 | Donchian Trend Ribbon | Implementable | Easy | |
| 192 | Double MACD Buy and Sell | Implementable | Medium | |
| 193 | Double Top_Bottom - Ultimate (OS) | Blocked | N/A | Table;Drawing |
| 194 | Double Zig Zag with HHLL | Blocked | N/A | Drawing |
| 195 | DR_IDR V1 | Blocked | N/A | MTF;Session;Drawing |
| 196 | DTFX Algo Zones [LuxAlgo] | Blocked | N/A | Drawing |
| 197 | Dynamic Linear Regression Channels | Blocked | N/A | Drawing |
| 198 | Dynamic Structure Indicator | Implementable | Hard | |
| 199 | Dynamic Supply and Demand Zones [AlgoAlpha] | Blocked | N/A | Drawing |
| 200 | Dynamic Support_Resistance Zones [ChartPrime] | Blocked | N/A | Drawing |
| 201 | Dynamic Swing Anchored VWAP (Zeiierman) | Blocked | N/A | Drawing |
| 202 | Easy Entry_Exit Trend Colors (With Alerts) | Implementable | Easy | |
| 203 | Ehlers Instantaneous Trend [LazyBear] | Implementable | Easy | |
| 204 | Ehlers MESA Adaptive Moving Average [LazyBear] | Implementable | Easy | |
| 205 | Ehlers Stochastic CG Oscillator [LazyBear] | Implementable | Easy | |
| 206 | Elastic Volume Weighted Moving Average & Envelope [LazyBear] | Implementable | Easy | |
| 207 | Elliot Wave - Impulse | Blocked | N/A | Table;Drawing |
| 208 | Elliot Wave Oscillator | Implementable | Easy | |
| 209 | Elliott Wave [LuxAlgo] | Blocked | N/A | Drawing |
| 210 | Elliott Wave Oscillator Signals by DGT | Blocked | N/A | Table;Drawing |
| 211 | EMA & MA Crossover | Implementable | Easy | |
| 212 | EMA 20_50_100_200 | Implementable | Easy | |
| 213 | EMA Enveloper Indicator & a crazy prediction | Implementable | Easy | |
| 214 | EMA Ribbon [Krypt] | Implementable | Easy | |
| 215 | EMA Slope + EMA Cross Strategy (by ChartArt) | Blocked | N/A | Strategy |
| 216 | EMA Wave Indicator [LazyBear] | Implementable | Easy | |
| 217 | EMA+Super | Implementable | Easy | |
| 218 | Engulfing Candle Indicator | Blocked | N/A | Strategy |
| 219 | Entry points | Implementable | Easy | |
| 220 | ENVELOPE RSI - Buy Sell Signals | Implementable | Easy | |
| 221 | Extrapolated Pivot Connector - Lets Make Support And Resistances | Blocked | N/A | Drawing |
| 222 | Extreme Trend Reversal Points [HeWhoMustNotBeNamed] | Implementable | Hard | |
| 223 | Fair value bands _ quantifytools | Blocked | N/A | Table |
| 224 | Fair Value Gap [LuxAlgo] | Blocked | N/A | MTF;Table;Drawing |
| 225 | Fair Value Gap Absorption Indicator [LuxAlgo] | Blocked | N/A | Drawing |
| 226 | Fair Value Gap | Blocked | N/A | MTF;Drawing |
| 227 | Fair Value Gaps (Volumetric) _ Flux Charts | Blocked | N/A | Drawing |
| 228 | Faith Indicator | Implementable | Easy | |
| 229 | False Breakout (Expo) | Implementable | Medium | |
| 230 | Fibo Levels with Volume Profile and Targets [ChartPrime] | Blocked | N/A | MTF;Drawing |
| 231 | Fibonacci Bollinger Bands | Implementable | Easy | |
| 232 | Fibonacci Confluence Toolkit [LuxAlgo] | Blocked | N/A | Drawing |
| 233 | Fibonacci Extension _ Retracement _ Pivot Points by DGT | Blocked | N/A | Table;Drawing |
| 234 | Fibonacci levels MTF | Blocked | N/A | Drawing |
| 235 | Fibonacci levels | Implementable | Easy | |
| 236 | Fibonacci Ranges (Real-Time) [LuxAlgo] | Blocked | N/A | Drawing |
| 237 | Fibonacci Time-Price Zones | Blocked | N/A | Drawing |
| 238 | Fibonacci Toolkit [LuxAlgo] | Blocked | N/A | Drawing |
| 239 | Fibonacci Trend [ChartPrime] | Blocked | N/A | Drawing |
| 240 | Fibonacci Zone | Implementable | Easy | |
| 241 | Flawless Victory Strategy - 15min BTC Machine Learning Strategy | Blocked | N/A | Strategy |
| 242 | FluidTrades - SMC Lite | Blocked | N/A | Drawing |
| 243 | Follow Line Indicator | Blocked | N/A | MTF |
| 244 | Follow Line | Implementable | Medium | |
| 245 | Forecast Oscillator | Implementable | Easy | |
| 246 | Fractal and Alligator Alerts by JustUncleL | Blocked | N/A | Strategy |
| 247 | Fractal Breakout Strategy (by ChartArt) | Blocked | N/A | Strategy |
| 248 | Fractals | Blocked | N/A | MTF |
| 249 | FREE INDICATOR_ Laguerre RSI | Implementable | Easy | |
| 250 | Full CRYPTO pack macd, rsi, obv, ema strategy | Blocked | N/A | Strategy;MTF |
| 251 | Future Trend Channel [ChartPrime] | Blocked | N/A | Drawing |
| 252 | FVG & IFVG ICT [TradingFinder] Inversion Fair Value Gap Signal | Implementable | Medium | |
| 253 | FVG Instantaneous Mitigation Signals [LuxAlgo] | Blocked | N/A | Drawing |
| 254 | FVG Order Blocks [BigBeluga] | Blocked | N/A | Drawing |
| 255 | FVG Positioning Average [LuxAlgo] | Implementable | Medium | |
| 256 | FVG Sessions [LuxAlgo] | Blocked | N/A | Drawing |
| 257 | FX Market Sessions | Blocked | N/A | Session;Table;Drawing |
| 258 | FX Sniper_ T3-CCI Copy Strategy | Implementable | Easy | |
| 259 | FXN - Asian Session Range | Blocked | N/A | MTF;Drawing |
| 260 | FXN - Week and Day Separator | Implementable | Medium | |
| 261 | Gann High Low | Implementable | Easy | |
| 262 | Gaps + Imbalances + Wicks (MTF) - By Leviathan | Blocked | N/A | Screener;MTF;Drawing |
| 263 | Gaussian Channel [DW] | Implementable | Medium | |
| 264 | Ghost Tangent Crossings [ChartPrime] | Blocked | N/A | Drawing |
| 265 | Global (World) Monetary Supply M2 (measured in USD) | Blocked | N/A | Screener;MTF |
| 266 | Global Liquidity Index | Blocked | N/A | Screener;MTF;Table |
| 267 | GMMA Oscillator v1 by JustUncleL | Implementable | Hard | |
| 268 | GMMA | Implementable | Easy | |
| 269 | Godmode 4.0.2 [Supply_Demand] | Blocked | N/A | MTF |
| 270 | Golden Cross, SMA 200 Moving Average Strategy (by ChartArt) | Blocked | N/A | Strategy |
| 271 | Grid Bot Simulator | Blocked | N/A | Drawing |
| 272 | HalfTrend | Implementable | Medium | |
| 273 | Hammers & Stars Strategy | Blocked | N/A | Strategy;MTF;Table |
| 274 | Harmonic Pattern Detection [LuxAlgo] | Blocked | N/A | Table;Drawing |
| 275 | Harmonic Pattern Detection, Prediction, and Backtesting Tool | Blocked | N/A | Table |
| 276 | Hash Ribbons | Blocked | N/A | Screener;MTF;Table |
| 277 | Heatmap Volume [xdecow] | Implementable | Medium | |
| 278 | Heiken Ashi Candles | Blocked | N/A | MTF |
| 279 | Heiken Ashi zero lag EMA v1.1 by JustUncleL | Blocked | N/A | MTF |
| 280 | Heikin Ashi RSI Oscillator | Implementable | Hard | |
| 281 | HEMA Trend Levels [AlgoAlpha] | Implementable | Medium | |
| 282 | HIGH and LOW Optimized Trend Tracker HOTT LOTT | Implementable | Hard | |
| 283 | High Volume Points [BigBeluga] | Blocked | N/A | Drawing |
| 284 | Higher High Lower Low Strategy (With Source Code) | Blocked | N/A | Drawing |
| 285 | Higher order Orderblocks + Breakerblocks + Range + Alerts | Blocked | N/A | Drawing |
| 286 | Higher Time Frame Chart Overlay | Blocked | N/A | Screener;MTF;Table |
| 287 | Higher Time Frame Support_Resistance [BigBeluga] | Blocked | N/A | MTF;Drawing |
| 288 | Higher Timeframe High & Low [ChartPrime] | Blocked | N/A | MTF;Drawing |
| 289 | Horns Pattern Identifier [LuxAlgo] | Blocked | N/A | Drawing |
| 290 | Hourly Trading System (Zeiierman) | Blocked | N/A | MTF;Table;Drawing |
| 291 | How To Set Backtest Date Range | Blocked | N/A | Strategy |
| 292 | HTF Candles by DGT | Blocked | N/A | Screener;MTF;Table;Drawing |
| 293 | HTF Liquidity Levels | Blocked | N/A | MTF |
| 294 | Hull Butterfly Oscillator [LuxAlgo] | Implementable | Hard | |
| 295 | Hull Suite Strategy | Blocked | N/A | Strategy |
| 296 | Hull Suite | Blocked | N/A | MTF |
| 297 | HyperTrend [LuxAlgo] | Implementable | Hard | |
| 298 | Ichimoku + Daily-Candle_X + HULL-MA_X + MacD | Blocked | N/A | Strategy;MTF |
| 299 | Ichimoku EMA Bands | Implementable | Easy | |
| 300 | ICHIMOKU Kinko Hyo by KIVANC fr3762 | Implementable | Easy | |
| 301 | Ichimoku Kinkō hyō 目均衡表 | Blocked | N/A | Table;Drawing |
| 302 | Ichimoku Oscillator | Implementable | Medium | |
| 303 | Ichimoku Theories [LuxAlgo] | Blocked | N/A | Drawing |
| 304 | Ichimoku | Implementable | Easy | |
| 305 | ICT Algorithmic Macro Tracker° (Open-Source) by toodegrees | Blocked | N/A | Drawing |
| 306 | ICT Concept [TradingFinder] Order Block _ FVG _ Liquidity Sweeps | Blocked | N/A | Drawing |
| 307 | ICT Concepts [LuxAlgo] | Blocked | N/A | Session;Drawing |
| 308 | ICT Everything | Blocked | N/A | MTF;Session;Table;Drawing |
| 309 | ICT Immediate Rebalance Toolkit [LuxAlgo] | Blocked | N/A | Drawing |
| 310 | ICT Implied Fair Value Gap (IFVG) [LuxAlgo] | Blocked | N/A | Drawing |
| 311 | ICT Institutional Order Flow (fadi) | Blocked | N/A | Drawing |
| 312 | ICT Killzones [LuxAlgo] | Blocked | N/A | Drawing |
| 313 | ICT Killzones + Pivots [TFO] | Blocked | N/A | Session;Table;Drawing |
| 314 | ICT Killzones Toolkit [LuxAlgo] | Blocked | N/A | Session;Drawing |
| 315 | ICT Macros [LuxAlgo] | Blocked | N/A | MTF;Table;Drawing |
| 316 | ICT Power Of Three _ Flux Charts | Blocked | N/A | Table;Drawing |
| 317 | ICT Seek & Destroy Profile [TFO] | Blocked | N/A | Session;Table;Drawing |
| 318 | ICT Sessions [Killzones] | Blocked | N/A | MTF;Session |
| 319 | ICT Silver Bullet [LuxAlgo] | Blocked | N/A | Table;Drawing |
| 320 | ICT Turtle Soup _ Flux Charts | Blocked | N/A | Table;Drawing |
| 321 | ICT Unicorn Model [LuxAlgo] | Blocked | N/A | Drawing |
| 322 | IDEAL BB with MA (With Alerts) | Implementable | Medium | |
| 323 | Imbalance Detector [LuxAlgo] | Blocked | N/A | Table;Drawing |
| 324 | Impulse MACD [LazyBear] | Implementable | Easy | |
| 325 | Indicator Panel | Blocked | N/A | Screener;MTF;Table |
| 326 | Indicator_ CCI coded OBV | Implementable | Easy | |
| 327 | Indicator_ Custom COG channel | Implementable | Easy | |
| 328 | Indicator_ Elder Impulse System | Blocked | N/A | MTF |
| 329 | Indicator_ ElliotWave Oscillator [EWO] | Implementable | Easy | |
| 330 | Indicator_ HawkEye Volume Indicator | Implementable | Easy | |
| 331 | Indicator_ MFI or RSI enclosed by Bollinger Bands | Implementable | Easy | |
| 332 | Indicator_ OBV Oscillator | Implementable | Easy | |
| 333 | Indicator_ Premier Stochastic Oscillator | Implementable | Easy | |
| 334 | Indicator_ Trend Trigger Factor | Implementable | Easy | |
| 335 | Indicator_ Volume Price Confirmation Indicator (VPCI) | Implementable | Easy | |
| 336 | Indicator_ WaveTrend Oscillator [WT] | Implementable | Easy | |
| 337 | Indicator_ Weis Wave Volume [LazyBear] | Implementable | Easy | |
| 338 | Indicator_ Zero Lag EMA & a simple trading strategy | Implementable | Easy | |
| 339 | Indicators Overlay | Implementable | Hard | |
| 340 | Indicators_ Better Volume Indicator & InstrumentVolume | Implementable | Medium | |
| 341 | Indicators_ Traders Dynamic Index, HLCTrends and Trix Ribbon | Implementable | Easy | |
| 342 | Indicators_ Volume-Weighted MACD Histogram & Sentiment Zone Osc | Implementable | Easy | |
| 343 | Initial Balance Breakout Signals [LuxAlgo] | Blocked | N/A | Session;Drawing |
| 344 | Institutional OrderBlock Pressure | Blocked | N/A | Drawing |
| 345 | Intraday BUY_SELL | Implementable | Easy | |
| 346 | Intraday TS ,BB + Buy_Sell +Squeeze Mom.+ adx-dmi | Implementable | Easy | |
| 347 | Intraday Volume Swings | Implementable | Medium | |
| 348 | Inverse Fisher Transform COMBO STO+RSI+CCIv2  by KIVANÇ fr3762 | Implementable | Easy | |
| 349 | Inverse FVG with Rejections [TFO] | Blocked | N/A | MTF;Session |
| 350 | Inversion Fair Value Gaps (IFVG) [LuxAlgo] | Blocked | N/A | Drawing |
| 351 | Isolated Peak and Bottom (Tuncer ŞENGÖZ)  by KıvanÇ fr3762 | Implementable | Easy | |
| 352 | ITG Scalper | Blocked | N/A | MTF;Drawing |
| 353 | Kalman Trend Levels [BigBeluga] | Blocked | N/A | Drawing |
| 354 | Kaufman Moving Average Adaptive (KAMA) | Implementable | Easy | |
| 355 | KDJ Indicator - @iamaltcoin | Implementable | Easy | |
| 356 | Key Levels SpacemanBTC IDWM | Blocked | N/A | Screener;MTF;Session;Drawing |
| 357 | Laguerre Multi-Filter [DW] | Blocked | N/A | Screener;MTF |
| 358 | Laguerre RSI | Implementable | Easy | |
| 359 | Leledc levels (IS) | Implementable | Easy | |
| 360 | Linear Regression ++ | Blocked | N/A | MTF |
| 361 | Linear Regression Candles | Implementable | Easy | |
| 362 | Linear Regression Channel _ Curve _ Slope by DGT | Blocked | N/A | Table;Drawing |
| 363 | Linear Regression Channel | Implementable | Easy | |
| 364 | Linear Regression Oscillator [ChartPrime] | Blocked | N/A | Drawing |
| 365 | Liquidation Levels [LuxAlgo] | Blocked | N/A | Drawing |
| 366 | Liquidations Zones [ChartPrime] | Blocked | N/A | Drawing |
| 367 | Liquidity Grabs _ Flux Charts | Implementable | Hard | |
| 368 | Liquidity Heatmap (Nephew_Sam_) | Blocked | N/A | Screener;MTF;Table;Drawing |
| 369 | Liquidity Heatmap LTF [LuxAlgo] | Blocked | N/A | MTF;Drawing |
| 370 | Liquidity Levels [LuxAlgo] | Implementable | Hard | |
| 371 | Liquidity Levels MTF - Sonarlab | Blocked | N/A | MTF;Drawing |
| 372 | Liquidity Location Detector [BigBeluga] | Blocked | N/A | Table;Drawing |
| 373 | Liquidity Pools [LuxAlgo] | Blocked | N/A | Drawing |
| 374 | Liquidity Pools | Blocked | N/A | Drawing |
| 375 | Liquidity Price Depth Chart [LuxAlgo] | Blocked | N/A | Drawing |
| 376 | Liquidity Sentiment Profile (Auto-Anchored) [LuxAlgo] | Blocked | N/A | Drawing |
| 377 | Liquidity Sentiment Profile [LuxAlgo] | Blocked | N/A | Drawing |
| 378 | Liquidity Sweep Filter [AlgoAlpha] | Blocked | N/A | Table;Drawing |
| 379 | Liquidity Sweeps [LuxAlgo] | Blocked | N/A | Drawing |
| 380 | Liquidity Swings [LuxAlgo] | Blocked | N/A | MTF;Drawing |
| 381 | Liquidity Trendline With Signals [BigBeluga] | Blocked | N/A | Drawing |
| 382 | Liquidity Voids (FVG) [LuxAlgo] | Blocked | N/A | Drawing |
| 383 | Liquidity Zones [BigBeluga] | Blocked | N/A | Table;Drawing |
| 384 | Live Economic Calendar by toodegrees | Blocked | N/A | ExternalData |
| 385 | Logistic RSI, STOCH, ROC, AO, ... by DGT | Blocked | N/A | Drawing |
| 386 | Lorentzian Classification Strategy | Blocked | N/A | Strategy;Session;Table |
| 387 | LOWESS (Locally Weighted Scatterplot Smoothing) [ChartPrime] | Blocked | N/A | Drawing |
| 388 | Lucid SAR | Implementable | Medium | |
| 389 | MA Sabres [LuxAlgo] | Blocked | N/A | Drawing |
| 390 | MA Strategy Emperor insiliconot | Implementable | Hard | |
| 391 | MACD & RSI Overlay (Expo) | Blocked | N/A | Table |
| 392 | MACD + SMA 200 Strategy (by ChartArt) | Blocked | N/A | Strategy |
| 393 | MACD + Stochastic, Double Strategy (by ChartArt) | Blocked | N/A | Strategy |
| 394 | MACD 4C | Implementable | Easy | |
| 395 | MACD Based Price Forecasting [LuxAlgo] | Blocked | N/A | Drawing |
| 396 | MACD Crossover | Implementable | Easy | |
| 397 | MacD Custom Indicator-Multiple Time Frame+All Available Options! | Blocked | N/A | MTF |
| 398 | MACD DEMA | Implementable | Easy | |
| 399 | MACD Divergence MultiTimeFrame [FantasticFox] | Implementable | Easy | |
| 400 | MACD Divergences by @DaviddTech | Implementable | Medium | |
| 401 | MACD Leader [LazyBear] | Implementable | Easy | |
| 402 | MACD ReLoaded STRATEGY | Blocked | N/A | Strategy |
| 403 | MACD ReLoaded | Implementable | Hard | |
| 404 | MACD Support and Resistance [ChartPrime] | Implementable | Hard | |
| 405 | MACD_VXI | Implementable | Easy | |
| 406 | MACDAS | Implementable | Easy | |
| 407 | MACD-X, More Than MACD by DGT | Blocked | N/A | Drawing |
| 408 | Machine Learning Adaptive SuperTrend [AlgoAlpha] | Blocked | N/A | Table |
| 409 | Machine Learning Momentum Index (MLMI) [Zeiierman] | Implementable | Medium | |
| 410 | Machine Learning Moving Average [LuxAlgo] | Implementable | Hard | |
| 411 | Machine Learning RSI ║ BullVision | Blocked | N/A | Table |
| 412 | Machine Learning_ Gaussian Process Regression [LuxAlgo] | Blocked | N/A | Drawing |
| 413 | Machine Learning_ kNN-based Strategy | Implementable | Hard | |
| 414 | Machine Learning_ Logistic Regression | Blocked | N/A | MTF |
| 415 | Machine Learning_ Lorentzian Classification | Blocked | N/A | Table |
| 416 | Madrid MA Ribbon Bar v2 | Implementable | Medium | |
| 417 | Madrid Moving Average Ribbon | Implementable | Medium | |
| 418 | Madrid Trend Squeeze | Implementable | Easy | |
| 419 | Market Cipher A free version 1.1 | Implementable | Easy | |
| 420 | Market Cipher B  Free version with Buy and sell | Implementable | Easy | |
| 421 | Market Profile with TPO | Blocked | N/A | Session;Table;Drawing |
| 422 | Market Profile | Blocked | N/A | Drawing |
| 423 | Market Sentiment Technicals [LuxAlgo] | Blocked | N/A | MTF;Drawing |
| 424 | Market Sessions - By Leviathan | Blocked | N/A | Session;Drawing |
| 425 | Market sessions and Volume profile - By Leviathan | Blocked | N/A | MTF;Drawing |
| 426 | Market Shift Levels [ChartPrime] | Implementable | Easy | |
| 427 | Market Structure - By Leviathan | Blocked | N/A | Drawing |
| 428 | Market Structure (Breakers) [LuxAlgo] | Blocked | N/A | Drawing |
| 429 | Market Structure (Intrabar) [LuxAlgo] | Blocked | N/A | MTF;Table;Drawing |
| 430 | Market Structure Break & Order Block by EmreKb | Blocked | N/A | Drawing |
| 431 | Market Structure CHoCH_BOS (Fractal) [LuxAlgo] | Blocked | N/A | Table;Drawing |
| 432 | Market Structure Oscillator [LuxAlgo] | Blocked | N/A | Drawing |
| 433 | Market Structure Trailing Stop [LuxAlgo] | Implementable | Hard | |
| 434 | Market Structure Trend Targets [ChartPrime] | Blocked | N/A | Drawing |
| 435 | Market Structure with Inducements & Sweeps [LuxAlgo] | Blocked | N/A | Drawing |
| 436 | Market Trend Levels Detector [BigBeluga] | Blocked | N/A | Drawing |
| 437 | Master Pattern [LuxAlgo] | Blocked | N/A | Drawing |
| 438 | Matrix Series | Implementable | Easy | |
| 439 | MavilimW | Implementable | Easy | |
| 440 | Mean Reversion Channel - (fareid's MRI Variant) | Blocked | N/A | MTF |
| 441 | MFI [seiglerj] | Implementable | Easy | |
| 442 | Mix1 _ Ema Cross + Trend Channel [Gu5] | Blocked | N/A | MTF |
| 443 | Momentum Acceleration by DGT | Blocked | N/A | Table;Drawing |
| 444 | Momentum adjusted Moving Average by DGT | Blocked | N/A | Drawing |
| 445 | Momentum Ghost Machine [ChartPrime] | Implementable | Hard | |
| 446 | Momentum Shift [Bigbeluga] | Blocked | N/A | Drawing |
| 447 | Momentum-based ZigZag (incl. QQE) NON-REPAINTING | Implementable | Medium | |
| 448 | Money Flow Index + Alerts | Blocked | N/A | MTF |
| 449 | Money Flow Profile [LuxAlgo] | Blocked | N/A | Drawing |
| 450 | Moon Phases Strategy [LuxAlgo] | Blocked | N/A | Strategy |
| 451 | MOST + Moving Average Screener | Blocked | N/A | Screener;MTF |
| 452 | MOST on RSI | Implementable | Medium | |
| 453 | Moving Average ADX | Implementable | Easy | |
| 454 | Moving Average Colored EMA_SMA | Implementable | Easy | |
| 455 | Moving Average Converging [LuxAlgo] | Implementable | Medium | |
| 456 | Moving Average Cross Alert, Multi-Timeframe (MTF) (by ChartArt) | Blocked | N/A | MTF |
| 457 | Moving average deviation rate | Implementable | Easy | |
| 458 | Moving Average Shaded Fill Area Crossover EMA Color - Editable | Implementable | Easy | |
| 459 | Moving Average Shift [ChartPrime] | Implementable | Easy | |
| 460 | Moving Averages as Support Resistance MTF | Blocked | N/A | MTF;Drawing |
| 461 | MTF Break of Structure(BOS) & Market Structure Shift(MSS) | Blocked | N/A | MTF;Drawing |
| 462 | MTF Order Block Finder | Blocked | N/A | Screener;MTF;Drawing |
| 463 | Multi Kernel Regression [ChartPrime] | Blocked | N/A | Drawing |
| 464 | Multi Time Frame Candles with Volume Info _ 3D | Blocked | N/A | MTF;Drawing |
| 465 | Multi ZigZag Harmonic Patterns | Blocked | N/A | Table;Drawing |
| 466 | Multi-Layer Volume Profile [BigBeluga] | Blocked | N/A | Drawing |
| 467 | Multiple divergences NON-REPAINT by PeterO | Implementable | Hard | |
| 468 | Multiple Indicators Screener | Blocked | N/A | Screener;MTF;Table |
| 469 | Multiple Moving Averages using only 1 Indicator! | Implementable | Easy | |
| 470 | Multitimeframe Fair Value Gap – FVG (Zeiierman) | Blocked | N/A | MTF;Drawing |
| 471 | Multi-Timeframe VWAP | Blocked | N/A | Drawing |
| 472 | Multpile strategies [LUPOWN] | Blocked | N/A | MTF |
| 473 | Mxwll Price Action Suite [Mxwll] | Blocked | N/A | MTF;Table;Drawing |
| 474 | N Bar Reversal Detector [LuxAlgo] | Blocked | N/A | Drawing |
| 475 | Nadaraya-Watson Envelope [LuxAlgo] | Blocked | N/A | Table;Drawing |
| 476 | Nadaraya-Watson Smoothers [LuxAlgo] | Blocked | N/A | Table;Drawing |
| 477 | Neglected Volume by DGT | Blocked | N/A | Table |
| 478 | Next Pivot Projection [Trendoscope] | Blocked | N/A | Table;Drawing |
| 479 | Nick Rypock Trailing Reverse (NRTR) | Implementable | Medium | |
| 480 | Normalized Quantitative Qualitative Estimation nQQE | Implementable | Easy | |
| 481 | NR4 & NR7 with Breakouts [LuxAlgo] | Blocked | N/A | MTF;Drawing |
| 482 | OBV MACD Indicator | Implementable | Hard | |
| 483 | One Shot One Kill ICT [TradingFinder] Liquidity MMXM + CISD OTE | Blocked | N/A | MTF;Drawing |
| 484 | Open Close Cross Alerts NoRepaint Version by JustUncleL | Implementable | Hard | |
| 485 | Open Close Cross Strategy NoRepaint Version by JustUncleL | Blocked | N/A | Strategy |
| 486 | Open Close Cross Strategy R5 revised by JustUncleL | Blocked | N/A | Strategy;MTF |
| 487 | Open Interest Stochastic Money Flow Index | Blocked | N/A | MTF |
| 488 | Open Interest Suite [Aggregated] - By Leviathan | Blocked | N/A | Screener;MTF;Table;Drawing |
| 489 | Open Liquidity Heatmap [BigBeluga] | Blocked | N/A | Drawing |
| 490 | Opening Range Breakout with 2 Profit Targets. | Blocked | N/A | MTF |
| 491 | Opening Range with Breakouts & Targets [LuxAlgo] | Blocked | N/A | Session;Drawing |
| 492 | Optimized Trend Tracker Bands | Implementable | Medium | |
| 493 | Optimized Trend Tracker Oscillator OTTO | Implementable | Medium | |
| 494 | Optimized Trend Tracker STRATEGY & SCREENER | Blocked | N/A | Strategy;Screener;MTF |
| 495 | Optimized Trend Tracker | Implementable | Medium | |
| 496 | OptionsMillionaire SPY Moving Averages and Signals | Blocked | N/A | Screener;MTF;Session;Drawing |
| 497 | ORB - Opening Range Breakout | Blocked | N/A | Session |
| 498 | ORB Algo _ Flux Charts | Blocked | N/A | Session;Table |
| 499 | Order Block Detector [LuxAlgo] | Blocked | N/A | Drawing |
| 500 | Order Block Finder (Experimental) | Blocked | N/A | Drawing |
| 501 | Order Block Finder | Blocked | N/A | Screener;MTF;Drawing |
| 502 | Order Blocks & Breaker Blocks [LuxAlgo] | Blocked | N/A | Drawing |
| 503 | Order Blocks _ Flux Charts | Blocked | N/A | MTF;Drawing |
| 504 | Order Blocks W_ Realtime Fibs [QuantVue] | Blocked | N/A | Drawing |
| 505 | Order Blocks with signals | Implementable | Hard | |
| 506 | Orderblocks (Nephew_Sam_) - Open source | Blocked | N/A | Table;Drawing |
| 507 | Parabolic RSI [ChartPrime] | Implementable | Medium | |
| 508 | Parabolic SAR + EMA 200 + MACD Signals | Implementable | Easy | |
| 509 | Parabolic SAR | Implementable | Easy | |
| 510 | Parallel Pivot Lines [LuxAlgo] | Implementable | Easy | |
| 511 | Pekipek's PPO Divergence BETA | Implementable | Easy | |
| 512 | Periodic Linear Regressions [LuxAlgo] | Blocked | N/A | Table |
| 513 | Philakone 55 EMA Swing Trading Strategy | Implementable | Easy | |
| 514 | Pip collector [LazyBear] | Blocked | N/A | MTF |
| 515 | Pivot Based Trailing Maxima & Minima [LuxAlgo] | Implementable | Medium | |
| 516 | Pivot High_Low Analysis & Forecast [LuxAlgo] | Blocked | N/A | Table;Drawing |
| 517 | Pivot Hilo Support n Resistance Levels R3-3 by JustUncleL | Blocked | N/A | Drawing |
| 518 | Pivot Point SuperTrend [Backtest] | Blocked | N/A | Strategy |
| 519 | Pivot Point Supertrend | Implementable | Easy | |
| 520 | Pivot Point | Blocked | N/A | MTF |
| 521 | Pivot Points High Low & Missed Reversal Levels [LuxAlgo] | Blocked | N/A | Drawing |
| 522 | Pivot Points High Low (HH_HL_LH_LL) [Anan] | Implementable | Medium | |
| 523 | Pivot Points High Low Multi Time Frame | Blocked | N/A | MTF;Drawing |
| 524 | Pivot Range Pivot Boss | Blocked | N/A | MTF |
| 525 | Pivot Trendlines with Breaks [HG] | Blocked | N/A | Drawing |
| 526 | PMax Explorer STRATEGY & SCREENER | Blocked | N/A | Strategy;Screener;MTF |
| 527 | PMax on RSI with Tillson T3 | Implementable | Medium | |
| 528 | Polynomial Regression Extrapolation [LuxAlgo] | Blocked | N/A | Drawing |
| 529 | Poor man's volume clusters | Blocked | N/A | MTF;Drawing |
| 530 | Poor man's volume profile | Blocked | N/A | MTF;Drawing |
| 531 | Position Size Calculator | Blocked | N/A | Drawing |
| 532 | Power Of 3 ICT 01 [TradingFinder] AMD ICT & SMC Accumulations | Blocked | N/A | Session;Drawing |
| 533 | PPO Divergence Alerts | Implementable | Easy | |
| 534 | Predictive Channels [LuxAlgo] | Implementable | Medium | |
| 535 | Predictive Ranges [LuxAlgo] | Blocked | N/A | MTF |
| 536 | Premier RSI Oscillator [LazyBear] | Implementable | Easy | |
| 537 | Previous Day High and Low + Separators Daily_Weekly | Blocked | N/A | Drawing |
| 538 | Previous Day Week Highs & Lows | Blocked | N/A | MTF;Drawing |
| 539 | Previous Highs & Lows [LuxAlgo] | Blocked | N/A | MTF;Drawing |
| 540 | Price & Volume Profile (Expo) | Implementable | Hard | |
| 541 | Price Action - Support & Resistance by DGT | Blocked | N/A | Table;Drawing |
| 542 | Price Action Doji Harami v0.2 by JustUncleL | Blocked | N/A | MTF |
| 543 | Price Action Smart Money Concepts [BigBeluga] | Blocked | N/A | Drawing |
| 544 | Price Action Toolkit Lite [UAlgo] | Blocked | N/A | Table;Drawing |
| 545 | Price Action Trading System v0.3 by JustUncleL | Implementable | Easy | |
| 546 | Price and Volume Breakout Buy Strategy [TradeDots] | Blocked | N/A | Strategy;Drawing |
| 547 | Price Divergence Detector V3 revised by JustUncleL | Implementable | Hard | |
| 548 | Profit Maximizer PMax | Implementable | Medium | |
| 549 | Protected Highs & Lows [TFO] | Blocked | N/A | Drawing |
| 550 | Pullback Trading Tool ALT R1.0 by JustUncleL | Implementable | Hard | |
| 551 | Pure Price Action ICT Tools [LuxAlgo] | Blocked | N/A | Drawing |
| 552 | Pure Price Action Liquidity Sweeps [LuxAlgo] | Implementable | Hard | |
| 553 | Pure Price Action Order & Breaker Blocks [LuxAlgo] | Blocked | N/A | Drawing |
| 554 | Pure Price Action Structures [LuxAlgo] | Blocked | N/A | Drawing |
| 555 | QQE Cross Indicator Alert v2.0 by JustUncleL | Implementable | Hard | |
| 556 | QQE MOD + SSL Hybrid + Waddah Attar Explosion | Blocked | N/A | Strategy;Drawing |
| 557 | QQE MOD | Implementable | Medium | |
| 558 | QQE signals | Implementable | Easy | |
| 559 | Quantitative Qualitative Estimation QQE | Implementable | Easy | |
| 560 | Quarterly Earnings | Blocked | N/A | Table;ExternalData |
| 561 | R_R Trading System Framework | Blocked | N/A | Table;Drawing |
| 562 | Radius Trend [ChartPrime] | Implementable | Medium | |
| 563 | Range Analysis - By Leviathan | Blocked | N/A | MTF;Drawing |
| 564 | Range Average Retest Model [LuxAlgo] | Blocked | N/A | Drawing |
| 565 | Range Breakout [BigBeluga] | Blocked | N/A | Drawing |
| 566 | Range Detector [LuxAlgo] | Implementable | Medium | |
| 567 | Range Filter [DW] | Implementable | Medium | |
| 568 | Range Filter Buy and Sell 5min - guikroth version | Blocked | N/A | Strategy |
| 569 | Range Identifier [LazyBear] | Implementable | Easy | |
| 570 | Range Sentiment Profile [LuxAlgo] | Blocked | N/A | MTF;Drawing |
| 571 | Ranges With Targets [ChartPrime] | Blocked | N/A | Table;Drawing |
| 572 | RCI3lines | Implementable | Easy | |
| 573 | Realtime 5D Profile [LucF] | Blocked | N/A | Screener;MTF;Table;Drawing |
| 574 | Realtime Delta Volume Action [LucF] | Blocked | N/A | Drawing |
| 575 | Realtime Footprint | Blocked | N/A | Drawing |
| 576 | Realtime Volume Bars w Market Buy_Sell_Neutral split & Mkt Delta | Implementable | Medium | |
| 577 | RedK EVEREX - Effort Versus Results Explorer | Implementable | Hard | |
| 578 | RedK Momentum Bars (RedK Mo_Bars) | Implementable | Medium | |
| 579 | RedK Slow_Smooth Average (RSS_WMA) | Implementable | Easy | |
| 580 | RedK Trader Pressure Index (TPX v1.0) | Implementable | Medium | |
| 581 | RedK Volume-Accelerated Directional Energy Ratio (RedK VADER) | Implementable | Medium | |
| 582 | Relative Strength Index - Divergences - Libertus | Blocked | N/A | Drawing |
| 583 | Relative Strength of a stock | Blocked | N/A | MTF |
| 584 | Relative Strength of Volume Indicators by DGT | Blocked | N/A | Table |
| 585 | Renko Candles Overlay | Blocked | N/A | Drawing |
| 586 | Renko Chart | Implementable | Hard | |
| 587 | Renko+Moving Average+RMI Alert R3 by JustUncleL | Blocked | N/A | MTF |
| 588 | Retest Support Resistance Signals [ChartPrime] | Blocked | N/A | Drawing |
| 589 | Reversal Candle Pattern SetUp | Implementable | Easy | |
| 590 | Reversal Candlestick Structure [LuxAlgo] | Blocked | N/A | Table;Drawing |
| 591 | Reversal Probability Zone & Levels [LuxAlgo] | Blocked | N/A | Drawing |
| 592 | Reversal Signals [LuxAlgo] | Blocked | N/A | Drawing |
| 593 | Ripster EMA Clouds | Implementable | Medium | |
| 594 | Rising & Falling Window Signals [LuxAlgo] | Blocked | N/A | Drawing |
| 595 | Risk Management Tool [LuxAlgo] | Blocked | N/A | Table;Drawing |
| 596 | RMI Trend Sniper | Implementable | Medium | |
| 597 | Rolling VWAP | Blocked | N/A | Table |
| 598 | RSI (Kernel Optimized) _ Flux Charts | Blocked | N/A | Table;Drawing |
| 599 | RSI + BB (EMA) + Dispersion (2.0) | Implementable | Easy | |
| 600 | RSI Bands, RSI %B and RSI Bandwidth | Implementable | Easy | |
| 601 | RSI Based Automatic Supply and Demand | Implementable | Hard | |
| 602 | RSI Candles | Implementable | Easy | |
| 603 | RSI cyclic smoothed v2 | Implementable | Medium | |
| 604 | RSI Divergence Indicator strategy | Blocked | N/A | Strategy |
| 605 | RSI Divergence | Implementable | Easy | |
| 606 | RSI HistoAlert Strategy | Implementable | Easy | |
| 607 | RSI Momentum Divergence Zones [ChartPrime] | Implementable | Medium | |
| 608 | RSI Multi Length [LuxAlgo] | Blocked | N/A | Table |
| 609 | RSI Strategy | Blocked | N/A | Strategy |
| 610 | RSI Support & Resistance by DGT | Blocked | N/A | Table;Drawing |
| 611 | RSI Swing Indicator v2 | Blocked | N/A | Drawing |
| 612 | RSI Swing Signal | Implementable | Easy | |
| 613 | RSI Tops and Bottoms | Implementable | Hard | |
| 614 | Rsi_Snabbel | Implementable | Easy | |
| 615 | RSI-VWAP INDICATOR | Blocked | N/A | Strategy |
| 616 | RVOL Relative Volume - Intraday | Blocked | N/A | MTF |
| 617 | Saty ATR Levels | Blocked | N/A | MTF;Session;Table |
| 618 | Saty Pivot Ribbon | Blocked | N/A | Screener;MTF;Session |
| 619 | Scalp Pro | Blocked | N/A | Strategy |
| 620 | Scalping Line Indicator | Implementable | Easy | |
| 621 | Scalping PullBack Tool R1 by JustUncleL | Blocked | N/A | MTF |
| 622 | Scalping Support Resistance Strategy | Blocked | N/A | Strategy |
| 623 | Scalping Swing Trading Tool R1-4 by JustUncleL | Blocked | N/A | Screener;MTF |
| 624 | Schaff Trend Cycle | Implementable | Easy | |
| 625 | Screener - Mean Reversion Channel | Blocked | N/A | Screener;MTF |
| 626 | Sell _ Buy Rates | Implementable | Easy | |
| 627 | Session Sweeps [LuxAlgo] | Blocked | N/A | Session;Table;Drawing |
| 628 | Session TPO Market Profile | Blocked | N/A | Session;Drawing |
| 629 | Sessions [LuxAlgo] | Blocked | N/A | Drawing |
| 630 | Sessions on Chart | Blocked | N/A | Session |
| 631 | Signal Moving Average [LuxAlgo] | Implementable | Easy | |
| 632 | Signal Table - AutoFib - SMA - EMA - RSI - ATR - Vol | Blocked | N/A | Table;Drawing |
| 633 | Simple Moving Averages | Implementable | Easy | |
| 634 | Slow Heiken Ashi | Implementable | Easy | |
| 635 | Slow Stochastic | Implementable | Easy | |
| 636 | Smart Money Breakout Channels [AlgoAlpha] | Blocked | N/A | Table;Drawing |
| 637 | Smart Money Breakout Signals [AlgoAlpha] | Blocked | N/A | Table;Drawing |
| 638 | Smart Money Breakouts [ChartPrime] | Blocked | N/A | Table;Drawing |
| 639 | Smart Money Concept [TradingFinder] Major OB + FVG + Liquidity | Blocked | N/A | Drawing |
| 640 | Smart Money Concepts (Advanced) | Blocked | N/A | MTF;Drawing |
| 641 | Smart Money Concepts (SMC) [LuxAlgo] | Blocked | N/A | MTF;Drawing |
| 642 | Smart Money Concepts by WeloTrades | Blocked | N/A | Screener;MTF;Drawing |
| 643 | Smart Money Concepts Probability (Expo) | Blocked | N/A | Table;Drawing |
| 644 | Smart Money Index (SMI) | Blocked | N/A | MTF |
| 645 | Smart Money Range [ChartPrime] | Blocked | N/A | Drawing |
| 646 | Smart Money Volume Activity [AlgoAlpha] | Blocked | N/A | MTF;Table |
| 647 | Smarter SNR (Support and Ressistance, Trendline, MTF OSC) | Blocked | N/A | MTF;Table;Drawing |
| 648 | SMC Structures and FVG | Blocked | N/A | Drawing |
| 649 | Smoothed Heiken Ashi Candles v1 | Implementable | Easy | |
| 650 | SMT Divergences [LuxAlgo] | Blocked | N/A | MTF;Table |
| 651 | Squeeze Momentum Indicator [LazyBear] Version2 by KıvanÇ fr3762 | Implementable | Easy | |
| 652 | Squeeze Momentum Indicator [LazyBear] | Implementable | Easy | |
| 653 | SSL channel | Implementable | Easy | |
| 654 | SSL HYBRID Advanced | Blocked | N/A | MTF;Table;Drawing |
| 655 | SSL Hybrid | Blocked | N/A | Table |
| 656 | ST0P | Implementable | Easy | |
| 657 | Standardized MACD Heikin-Ashi Transformed | Implementable | Hard | |
| 658 | Statistical Trailing Stop [LuxAlgo] | Blocked | N/A | Table |
| 659 | STC Indicator - A Better MACD [SHK] | Implementable | Medium | |
| 660 | STD-Filtered, N-Pole Gaussian Filter [Loxx] | Blocked | N/A | MTF |
| 661 | Stoch_VX3 | Implementable | Easy | |
| 662 | Stochastic + RSI, Double Strategy (by ChartArt) | Blocked | N/A | Strategy |
| 663 | Stochastic Heat Map | Implementable | Hard | |
| 664 | Stochastic Momentum Index (SMI) of Money Flow Index (MFI) | Blocked | N/A | MTF;Drawing |
| 665 | Stochastic Momentum Index (SMI) | Implementable | Easy | |
| 666 | Stochastic Momentum Index _ UCSgears | Implementable | Easy | |
| 667 | Stochastic OTT | Implementable | Easy | |
| 668 | Stop loss and Take Profit in $$ example | Blocked | N/A | Strategy |
| 669 | Strat Assistant | Blocked | N/A | MTF;Drawing |
| 670 | Strength of Divergence Across Multiple Indicators | Implementable | Hard | |
| 671 | Strong Demands & Supplies + Liquidity _ Zonas de Compra e Venda | Blocked | N/A | MTF;Drawing |
| 672 | Super Guppy R1.0 by JustUncleL | Implementable | Hard | |
| 673 | Super OrderBlock _ FVG _ BoS Tools by makuchaku & eFe | Blocked | N/A | Drawing |
| 674 | Super Pivots | Blocked | N/A | MTF;Drawing |
| 675 | Super Scalper - 5 Min 15 Min | Blocked | N/A | Strategy |
| 676 | Super Smoothed MACD for CRYPTO by KIVANÇ fr3762 | Implementable | Easy | |
| 677 | SUPER SUPERTREND THREE LINE PROFIT STRATEGY | Implementable | Easy | |
| 678 | Super Trend Daily 2.0 BF | Blocked | N/A | Strategy |
| 679 | Super trend V | Implementable | Medium | |
| 680 | SuperBollingerTrend (Expo) | Blocked | N/A | Table;Drawing |
| 681 | Supertrend - Ladder ATR | Implementable | Medium | |
| 682 | SuperTrend + Relative Volume (Kernel Optimized) | Blocked | N/A | Table |
| 683 | SuperTrend AI (Clustering) [LuxAlgo] | Blocked | N/A | Table |
| 684 | Supertrend Channels [LuxAlgo] | Implementable | Easy | |
| 685 | SuperTrend EXPLORER _ SCREENER | Blocked | N/A | Screener;MTF |
| 686 | Supertrend MTF Heikin Ashi | Blocked | N/A | Screener;MTF |
| 687 | SuperTrend Oscillator [LuxAlgo] | Blocked | N/A | Drawing |
| 688 | SuperTrend STRATEGY | Blocked | N/A | Strategy |
| 689 | SuperTrend | Implementable | Easy | |
| 690 | SuperTrended Moving Averages | Implementable | Medium | |
| 691 | Supply & Demand (MTF) _ Flux Charts | Blocked | N/A | MTF;Drawing |
| 692 | Supply and Demand Anchored [LuxAlgo] | Blocked | N/A | MTF;Drawing |
| 693 | Supply and Demand Daily [LuxAlgo] | Blocked | N/A | MTF;Drawing |
| 694 | Supply and Demand Visible Range [LuxAlgo] | Blocked | N/A | MTF;Drawing |
| 695 | Supply Demand Profiles [LuxAlgo] | Blocked | N/A | MTF;Drawing |
| 696 | Support & Resistance AI (K means_median) [ThinkLogicAI] | Blocked | N/A | Table;Drawing |
| 697 | Support & Resistance Dynamic [LuxAlgo] | Blocked | N/A | Drawing |
| 698 | Support and Resistance (High Volume Boxes) [ChartPrime] | Blocked | N/A | Drawing |
| 699 | Support and Resistance (MTF) _ Flux Charts | Blocked | N/A | MTF;Drawing |
| 700 | Support and Resistance Levels with Breaks [LuxAlgo] | Implementable | Easy | |
| 701 | Support and Resistance Logistic Regression _ Flux Charts | Blocked | N/A | Drawing |
| 702 | Support and Resistance Power Channel [ChartPrime] | Blocked | N/A | Drawing |
| 703 | Support and Resistance Signals MTF [LuxAlgo] | Blocked | N/A | Drawing |
| 704 | Support and Resistance | Blocked | N/A | Drawing |
| 705 | Support Resistance - Dynamic v2 | Blocked | N/A | Drawing |
| 706 | Support Resistance - Dynamic | Blocked | N/A | Drawing |
| 707 | Support Resistance Channels | Implementable | Hard | |
| 708 | Support Resistance Channels_Zones Multi Time Frame | Blocked | N/A | MTF;Table |
| 709 | Support Resistance Classification (VR) [LuxAlgo] | Blocked | N/A | MTF;Drawing |
| 710 | Support Resistance Interactive | Implementable | Medium | |
| 711 | Support Resistance MTF | Blocked | N/A | MTF;Drawing |
| 712 | Support Resistance with Breaks and Retests | Blocked | N/A | Drawing |
| 713 | Support_Resistance V2 Indicator | Blocked | N/A | MTF;Drawing |
| 714 | Swing Breakout Sequence [LuxAlgo] | Blocked | N/A | Drawing |
| 715 | Swing Data - ADR% _ RVol _ PVol _ Float % _ Avg $ Vol | Blocked | N/A | Screener;MTF;Table;ExternalData |
| 716 | Swing Failure Pattern (SFP) [LuxAlgo] | Blocked | N/A | MTF;Table;Drawing |
| 717 | Swing Highs_Lows & Candle Patterns [LuxAlgo] | Implementable | Medium | |
| 718 | Swing Levels and Liquidity - By Leviathan | Blocked | N/A | Screener;MTF;Drawing |
| 719 | SWING TRADE SIGNALS | Implementable | Easy | |
| 720 | Swing Volume Profiles [LuxAlgo] | Blocked | N/A | Drawing |
| 721 | SwingArm ATR Trend Indicator | Blocked | N/A | MTF |
| 722 | Target Trend [BigBeluga] | Blocked | N/A | Drawing |
| 723 | Targets For Many Indicators [LuxAlgo] | Blocked | N/A | Table;Drawing |
| 724 | Targets For Overlay Indicators [LuxAlgo] | Blocked | N/A | Table;Drawing |
| 725 | TDI - Traders Dynamic Index + RSI Divergences + Buy_Sell Signals | Implementable | Hard | |
| 726 | TDMacd | Implementable | Easy | |
| 727 | Technical Ratings | Blocked | N/A | MTF;Drawing |
| 728 | The Echo Forecast [LuxAlgo] | Blocked | N/A | Drawing |
| 729 | The Next Pivot [Kioseff Trading] | Blocked | N/A | Table;Drawing |
| 730 | The Ultimate Buy and Sell Indicator | Implementable | Hard | |
| 731 | Three Bar Reversal Pattern [LuxAlgo] | Blocked | N/A | Drawing |
| 732 | Three Drive Pattern Detector [LuxAlgo] | Blocked | N/A | Table;Drawing |
| 733 | Three Moving Averages [AdventTrading] | Implementable | Easy | |
| 734 | Tick Chart | Blocked | N/A | Drawing |
| 735 | Tick Data Detailed | Blocked | N/A | Drawing |
| 736 | Tillson T3 Moving Average by KIVANÇ fr3762 | Implementable | Easy | |
| 737 | TKP T3 Trend With Psar Barcolor | Implementable | Medium | |
| 738 | TMA Overlay | Implementable | Medium | |
| 739 | TonyUX EMA Scalper - Buy _ Sell | Implementable | Easy | |
| 740 | Tops_Bottoms | Implementable | Easy | |
| 741 | Traders Dynamic Index Indicator Alert v0.1 by JustUncleL | Blocked | N/A | MTF |
| 742 | Traders Reality Main | Blocked | N/A | Screener;MTF;Session;Table |
| 743 | Trading ABC | Blocked | N/A | Drawing |
| 744 | Trading Psychology - Fear & Greed Index by DGT | Blocked | N/A | Screener;MTF;Table |
| 745 | TradingView Alerts (Expo) | Blocked | N/A | Table |
| 746 | TradingView Alerts to MT4 MT5 + dynamic variables NON-REPAINTING | Blocked | N/A | Strategy;Table |
| 747 | Trailing SL Strategy [QuantNomad] | Blocked | N/A | Strategy |
| 748 | Trailing Stop Loss Indicator by KıvanÇ fr3762 | Blocked | N/A | MTF |
| 749 | Transient Zones v1.1 | Implementable | Easy | |
| 750 | Trend Channels With Liquidity Breaks [ChartPrime] | Blocked | N/A | Drawing |
| 751 | Trend Direction Helper (ZigZag and S_R and HH_LL labels) | Blocked | N/A | Drawing |
| 752 | Trend Following Moving Averages | Implementable | Easy | |
| 753 | Trend Impulse Channels (Zeiierman) | Implementable | Hard | |
| 754 | Trend Indicator A-V2 (Smoothed Heikin Ashi Cloud) | Blocked | N/A | MTF |
| 755 | Trend Levels [ChartPrime] | Blocked | N/A | Table;Drawing |
| 756 | Trend Line | Implementable | Medium | |
| 757 | Trend Lines [LuxAlgo] | Blocked | N/A | Drawing |
| 758 | Trend Lines for RSI, CCI, Momentum, OBV | Blocked | N/A | Drawing |
| 759 | Trend Lines v2 | Implementable | Hard | |
| 760 | Trend Lines | Blocked | N/A | Drawing |
| 761 | Trend Magic | Implementable | Easy | |
| 762 | Trend Meter | Blocked | N/A | MTF |
| 763 | Trend Range Detector (Zeiierman) | Blocked | N/A | Drawing |
| 764 | Trend Regularity Adaptive Moving Average [LuxAlgo] | Implementable | Easy | |
| 765 | Trend Signals with TP & SL [UAlgo] | Blocked | N/A | Drawing |
| 766 | Trend Targets [AlgoAlpha] | Blocked | N/A | Drawing |
| 767 | Trend Trader Strategy | Implementable | Easy | |
| 768 | Trend Type Indicator by BobRivera990 | Blocked | N/A | Drawing |
| 769 | Trending Market Toolkit [LuxAlgo] | Blocked | N/A | MTF;Drawing |
| 770 | Trendline Breakout Navigator [LuxAlgo] | Blocked | N/A | MTF;Drawing |
| 771 | Trendline Breakouts With Targets [ChartPrime] | Blocked | N/A | Drawing |
| 772 | Trendlines - JD | Blocked | N/A | Drawing |
| 773 | Trendlines 2x + | Blocked | N/A | Screener;MTF |
| 774 | Trendlines with Breaks [LuxAlgo] | Implementable | Hard | |
| 775 | Triangular Momentum Oscillator & Real Time Divergences [LuxAlgo] | Implementable | Easy | |
| 776 | Triangular Moving Average (TMA) bands | Implementable | Easy | |
| 777 | Triple MA Forecast | Implementable | Easy | |
| 778 | True Williams Alligator (SMMA) | Implementable | Easy | |
| 779 | TTM Squeeze Pro | Implementable | Easy | |
| 780 | TTM Squeeze | Implementable | Easy | |
| 781 | TTrades Daily Bias [TFO] | Blocked | N/A | Table;Drawing |
| 782 | Turtle Trade Channels Indicator TUTCI | Implementable | Easy | |
| 783 | TV Community Algo | Blocked | N/A | Screener;MTF;Drawing |
| 784 | Tweezers and Kangaroo Tail | Implementable | Medium | |
| 785 | Twin Optimized Trend Tracker Strategy TOTT | Blocked | N/A | Strategy |
| 786 | Twin Range Filter Visualized | Implementable | Easy | |
| 787 | Twin Range Filter | Implementable | Easy | |
| 788 | UCS_Murrey's Math Oscillator_V2 | Implementable | Easy | |
| 789 | UCS_Top & Bottom Candle | Implementable | Easy | |
| 790 | Ultimate Moving Average-Multi-TimeFrame-7 MA Types | Blocked | N/A | MTF |
| 791 | Ultimate RSI [LuxAlgo] | Implementable | Medium | |
| 792 | Ultimate Strategy Template | Blocked | N/A | Strategy;Session |
| 793 | UT Bot Alerts | Blocked | N/A | MTF |
| 794 | UT Bot Strategy with Backtesting Range [QuantNomad] | Blocked | N/A | Strategy;MTF |
| 795 | UT Bot Strategy | Blocked | N/A | Strategy;MTF |
| 796 | UT Bot | Implementable | Easy | |
| 797 | Variable Moving Average [LazyBear] | Implementable | Easy | |
| 798 | Vdub FX SniperVX2 Color v2 | Implementable | Easy | |
| 799 | VDUB_BINARY_PRO_3_V2  FINAL + Strategy | Blocked | N/A | MTF |
| 800 | vdub_Trend_Master_v  _  v1 _ v2 _ v3 | Blocked | N/A | MTF |
| 801 | vdubus BinaryPro  - Indicators 1 & 2 | Implementable | Easy | |
| 802 | Vervoort Heiken-Ashi LongTerm Candlestick Oscillator [LazyBear] | Implementable | Easy | |
| 803 | Vix FIX _ StochRSI Strategy | Blocked | N/A | Strategy |
| 804 | Volumatic Support_Resistance Levels [BigBeluga] | Implementable | Medium | |
| 805 | Volumatic Variable Index Dynamic Average [BigBeluga] | Blocked | N/A | Drawing |
| 806 | Volume _ Open Interest _Footprint_ - By Leviathan | Blocked | N/A | Screener;MTF |
| 807 | Volume Accumulation Percentage Indicator [LazyBear] | Implementable | Easy | |
| 808 | Volume Analysis - Heatmap and Volume Profile | Blocked | N/A | MTF;Table;Drawing |
| 809 | Volume Bar Breakout and Breakdown  Indicator | Implementable | Medium | |
| 810 | Volume Based Coloured Bars | Implementable | Easy | |
| 811 | Volume composition _ quantifytools | Blocked | N/A | MTF;Table |
| 812 | Volume Delta [hapharmonic] | Blocked | N/A | Table |
| 813 | Volume Delta Candles [LuxAlgo] | Blocked | N/A | MTF;Table |
| 814 | Volume Divergence by MM | Implementable | Medium | |
| 815 | Volume Flow Indicator [LazyBear] | Implementable | Easy | |
| 816 | Volume Flow v3 | Implementable | Easy | |
| 817 | Volume Footprint [LuxAlgo] | Implementable | Medium | |
| 818 | Volume Footprint Voids [BigBeluga] | Blocked | N/A | MTF |
| 819 | Volume Order Blocks [BigBeluga] | Blocked | N/A | Drawing |
| 820 | Volume Orderbook (Expo) | Blocked | N/A | Table |
| 821 | Volume Profile [LuxAlgo] | Blocked | N/A | Drawing |
| 822 | Volume Profile [Makit0] | Blocked | N/A | Drawing |
| 823 | Volume Profile _ Fixed Range | Blocked | N/A | Drawing |
| 824 | Volume Profile + Pivot Levels [ChartPrime] | Blocked | N/A | Drawing |
| 825 | Volume Profile and Volume Indicator by DGT | Blocked | N/A | MTF;Table;Drawing |
| 826 | Volume Profile Auto [line] | Blocked | N/A | Drawing |
| 827 | Volume Profile Bar-Magnified Order Blocks [MyTradingCoder] | Blocked | N/A | MTF;Drawing |
| 828 | Volume Profile Free Pro (25 Levels Value Area VWAP) by RRB | Blocked | N/A | MTF;Session |
| 829 | Volume Profile Free Ultra SLI (100 Levels Value Area VWAP) - RRB | Blocked | N/A | MTF;Session |
| 830 | Volume Profile per day with support_resistance lines | Blocked | N/A | Session;Drawing |
| 831 | Volume Profile Plus | Blocked | N/A | Screener;MTF;Drawing |
| 832 | Volume Profile Volume Delta OI Delta [Kioseff Trading] | Blocked | N/A | MTF;Drawing |
| 833 | Volume Profile with Node Detection [LuxAlgo] | Blocked | N/A | MTF;Drawing |
| 834 | Volume Profile, Pivot Anchored by DGT | Blocked | N/A | Table;Drawing |
| 835 | Volume Profile | Blocked | N/A | MTF;Table;Drawing |
| 836 | Volume Suite - By Leviathan (CVD, Volume Delta, Relative Volume) | Blocked | N/A | MTF |
| 837 | Volume SuperTrend AI (Expo) | Implementable | Medium | |
| 838 | VOLUME WEIGHTED MACD V2 VWMACDV2 BY KIVANÇ fr3762 | Implementable | Easy | |
| 839 | Volume-based Support & Resistance Zones | Blocked | N/A | Screener;MTF;Table;Drawing |
| 840 | VolumeHeatmap _ Experimental Version of Marketorders Matrix | Blocked | N/A | MTF;Drawing |
| 841 | Volume-Supported Linear Regression Trend | Implementable | Easy | |
| 842 | VuManChu Cipher A | Blocked | N/A | MTF |
| 843 | VuManChu Cipher B + Divergences | Blocked | N/A | Screener;MTF |
| 844 | VuManChu Swing Free | Implementable | Medium | |
| 845 | VWAP + Fibo Dev Extensions Strategy | Blocked | N/A | Strategy |
| 846 | VWAP MTF (Multi Timeframe) | Blocked | N/A | MTF |
| 847 | VWAP Stdev Bands v2 Mod UPDATE | Blocked | N/A | MTF |
| 848 | VWAP Stdev Bands v2 Mod | Blocked | N/A | MTF |
| 849 | VWAP_MVWAP_EMA CROSSOVER | Implementable | Medium | |
| 850 | Waddah Attar Explosion V2 [SHK] | Implementable | Easy | |
| 851 | Waindrops [Makit0] | Blocked | N/A | Drawing |
| 852 | WaveTrend 3D | Implementable | Hard | |
| 853 | WaveTrend Oscillator + Divergence  + Direction Detection +Alerts | Implementable | Hard | |
| 854 | WaveTrend with Crosses [LazyBear] | Implementable | Easy | |
| 855 | Wedge and Flag Finder (Multi - zigzag) | Blocked | N/A | Drawing |
| 856 | Weis Wave Volume | Implementable | Easy | |
| 857 | WICK.ED Fractals | Implementable | Easy | |
| 858 | Wolfe Scanner (Multi - zigzag) [HeWhoMustNotBeNamed] | Blocked | N/A | Drawing |
| 859 | Zero Lag MACD Enhanced - Version 1.2 | Implementable | Easy | |
| 860 | Zero Lag Trend Signals (MTF) [AlgoAlpha] | Blocked | N/A | MTF;Table |
| 861 | Zero-Lag MA Trend Levels [ChartPrime] | Implementable | Medium | |
| 862 | Zig Zag Channels [LuxAlgo] | Blocked | N/A | Drawing |
| 863 | ZigZag Multi Time Frame with Fibonacci Retracement | Blocked | N/A | Drawing |
| 864 | Zigzag Trend_Divergence Detector | Blocked | N/A | Table |
| 865 | ZigZag with Fibonacci Levels | Implementable | Hard | |
| 866 | ZigZag++ | Blocked | N/A | Drawing |
| 867 | ZLSMA - Zero Lag LSMA | Implementable | Easy | |

---


## Recommended Implementation Waves

### Wave 1 — Quick Wins (Easy, high-value indicators)

These are popular, well-known indicators that port directly using existing oakscriptjs TA functions.

| # | Indicator | Core Functions Needed |
|---|-----------|---------------------|
| 652 | Squeeze Momentum Indicator [LazyBear] | bb, kc, linreg, sma |
| 854 | WaveTrend with Crosses [LazyBear] | ema, cross, hlc3 |
| 163 | Coral Trend Indicator [LazyBear] | cascaded ema filter |
| 122 | Chandelier Exit | atr, highest, lowest |
| 394 | MACD 4C | macd + color logic |
| 324 | Impulse MACD [LazyBear] | ema arithmetic |
| 47 | ATR Bands | atr, sma |
| 191 | Donchian Trend Ribbon | highest, lowest, sma |
| 159 | Colored Volume Bars [LazyBear] | sma on volume |
| 624 | Schaff Trend Cycle | macd, stoch, ema chain |
| 67 | AWESOME OSCILLATOR V2 by KIVANCfr3762 | sma subtraction |
| 118 | CCT Bollinger Band Oscillator | bb-derived |
| 278 | Heiken Ashi Candles | OHLC arithmetic |
| 509 | Parabolic SAR | sar() direct |
| 867 | ZLSMA - Zero Lag LSMA | linreg |
| 30 | ADX and DI | dmi() direct |
| 355 | KDJ Indicator | stoch, ema |
| 448 | Money Flow Index + Alerts | mfi() direct |
| 482 | OBV MACD Indicator | obv, macd |
| 245 | Forecast Oscillator | linreg |

### Wave 2 — Medium Effort (popular trend/momentum indicators) ✅ DONE

| # | Indicator | Challenge | Status |
|---|-----------|-----------|--------|
| 41 | AlphaTrend | rsi/mfi + atr bands + state | ✅ `alpha-trend.ts` |
| 272 | HalfTrend | atr + peak/trough state | ✅ `half-trend.ts` |
| 557 | QQE MOD | dual QQE + BB overlay | ✅ `qqe-mod.ts` |
| 243 | Follow Line Indicator | bb + atr + state | ✅ `follow-line.ts` |
| 793 | UT Bot Alerts | atr trailing logic | ✅ `ut-bot.ts` |
| 296 | Hull Suite (single-TF only) | wma + sqrt | ✅ `hull-suite.ts` |
| 495 | Optimized Trend Tracker | atr-based trailing | ✅ `optimized-trend-tracker.ts` |
| 761 | Trend Magic | cci + atr | ✅ `trend-magic.ts` |
| 653 | SSL channel | ma crossover state | ✅ `ssl-channel.ts` |
| 779 | TTM Squeeze | bb + kc + momentum | ⏭️ Already exists as `squeeze-momentum.ts` |
| 439 | MavilimW | wma chain | ✅ `mavilimw.ts` |
| 120 | CDC Action Zone V.2 | ema cross + state | ✅ `cdc-action-zone.ts` |
| 659 | STC Indicator | macd + stoch chain | ⏭️ Already exists as `schaff-trend-cycle.ts` |
| 736 | Tillson T3 Moving Average | 6-stage ema | ✅ `tillson-t3.ts` |
| 850 | Waddah Attar Explosion V2 | macd + bb derivative | ✅ `waddah-attar-explosion.ts` |
| 593 | Ripster EMA Clouds | multiple ema pairs | ✅ `ripster-ema-clouds.ts` |
| 536 | Premier RSI Oscillator [LazyBear] | rsi + exp smoothing | ✅ `premier-rsi.ts` |
| 249 | FREE INDICATOR_ Laguerre RSI | recursive filter | ✅ `laguerre-rsi.ts` |
| 602 | RSI Candles | rsi ohlc | ✅ `rsi-candles.ts` |
| 859 | Zero Lag MACD Enhanced | zlema + macd | ✅ `zero-lag-macd.ts` |

### Wave 3 — Hard But Valuable

| # | Indicator | Challenge |
|---|-----------|-----------|
| 94 | Boom Hunter Pro | multi-oscillator combo |
| 419 | Market Cipher A free version 1.1 | WaveTrend + MACD + MFI |
| 420 | Market Cipher B Free version | multi-indicator combo |
| 475 | Nadaraya-Watson Envelope [LuxAlgo] | kernel regression |
| 655 | SSL Hybrid (skip table) | 14 MA types + state |
| 386 | Lorentzian Classification Strategy | ML classification |
| 415 | Machine Learning_ Lorentzian Classification | ML with matrix ops |
| 577-581 | RedK indicators suite | custom smoothing filters |

---

## File Reference

All source PineScript files are located in:
```
docs/official/indicators_community/
```

---

*Last updated: February 25, 2026*
*Assessment based on oakscriptjs v0.2.4 capabilities*
