# Community Indicator Inventory

Community indicators of `lightweight-charts-indicators`: TypeScript ports of community PineScript scripts, built on
[oakscriptjs](https://github.com/deepentropy/oakscriptJS). Each port has the inputs, plots and drawings of its Pine
source. This list is generated from the indicator registry (`indicatorRegistry` in `src/index.ts`).

## Summary

| | Count |
|---|---|
| **Community indicators** | 1683 |
| Drawn on the price pane (overlay) | 1137 |
| Drawn in their own pane | 546 |
| Compared with reference outputs (batches 1-42 and the most liked set) | 1376 |

| Category | Count |
|---|---|
| Trend | 575 |
| Oscillators | 265 |
| Volume | 226 |
| Momentum | 169 |
| Moving Averages | 161 |
| Channels & Bands | 169 |
| Candlestick Patterns | 61 |
| Volatility | 57 |

## Columns

- **Id**: the registry id (`indicatorRegistry.find((e) => e.id === id)`).
- **Pane**: `price` for an overlay indicator, `own` for an indicator in its own pane (some plots, backgrounds or
  candles of an `own` indicator can still be drawn on the price pane, as Pine `force_overlay`).
- **Author**: the author of the Pine source, from the port header (empty when the header does not name one).
- **Check**: the batch in which the port was compared with reference outputs (BITSTAMP:BTCUSD 1D and NASDAQ:AAPL 1D,
  full histories, default inputs and input variants: plots, colours, fills, markers, bar / background colours and
  candles; for the most liked set also lines, boxes, labels and tables, and intraday bars). Empty for the
  earlier ports.

## Indicators

| # | Indicator | Id | Category | Pane | Author | Check |
|---|---|---|---|---|---|---|
| 1 | %R Trend Exhaustion | `r-trend-exhaustion` | Oscillators | own | upslidedown | most liked |
| 2 | + Average Candle Bodies Range | `average-candle-bodies-range` | Volatility | own | ClassicScott | batch 13 |
| 3 | 1-2-3 Pattern (Expo) | `1-2-3-pattern` | Trend | price | Zeiierman | most liked |
| 4 | 10x Bull Vs. Bear VP Intraday Sessions | `10x-bull-vs-bear-vp-intraday-sessions` | Volume | price | KioseffTrading | most liked |
| 5 | 12/26 EMA Inflection Zones by Korax | `12-26-ema-inflection-zones-by-korax` | Moving Averages | price | Korax | batch 16 |
| 6 | 15-Minute Squeeze Scalper (Traffic Light Edition) | `15-minute-squeeze-scalper` | Volatility | own | Universal_Scalper_Pro | batch 36 |
| 7 | 1m Trend Continuation Signals - SSL + BB Filter | `1m-trend-continuation-signals-ssl-bb-filter` | Trend | price | rhariganesh | batch 13 |
| 8 | 2B Reversal Pattern (Expo) | `2b-reversal-pattern` | Trend | price | Zeiierman | most liked |
| 9 | 3 Bar Reversal | `3-bar-reversal` | Candlestick Patterns | price | abbadon9 | batch 40 |
| 10 | 3 Confirmation Bear | `3-confirmation-bear` | Trend | price | AirianM | batch 16 |
| 11 | 3 Confirmation Bull | `3-confirmation-bull` | Trend | price | AirianM | batch 21 |
| 12 | 3 Lines RCI + Psy Signal + RSI Background | `3-lines-rci-psy-signal-rsi-background` | Oscillators | own | masato19810122 | batch 36 |
| 13 | 3-in-1 Custom Moving Average Indicator | `3-in-1-custom-moving-average-indicator` | Moving Averages | price | Mr-Fish | batch 22 |
| 14 | 3rd Wave | `3rd-wave` | Trend | price | LonesomeTheBlue | most liked |
| 15 | 5-Minute Buy/Sell Signal | `5-minute-buy-sell-signal` | Trend | price | Waqas_Khalid | batch 14 |
| 16 | 72s: Adaptive Hull Moving Average+ | `adaptive-hull-ma` | Moving Averages | price | io72signals |  |
| 17 | <50% Body Candle | `50-body-candle` | Candlestick Patterns | price | Dutchinvestor | batch 38 |
| 18 | [RS] Support and Resistance V0 | `rs-support-resistance` | Channels & Bands | price | RicardoSantos (community) |  |
| 19 | _CM_High_Low_Open_Close_Weekly-Intraday | `cm-high-low-open-close-weekly-intraday` | Channels & Bands | price | ChrisMoody | most liked |
| 20 | _CM_Ultimate_MA_MTF_V4 | `cm-ultimate-ma-mtf-v4` | Moving Averages | price | ChrisMoody | most liked |
| 21 | ABC on Recursive Zigzag | `abc-on-recursive-zigzag` | Trend | price | Trendoscope | most liked |
| 22 | Abdullah | `abdullah` | Trend | price | royalsherry888 | batch 35 |
| 23 | Absolute Strength Index | `absolute-strength-index` | Oscillators | own | Zeiierman | batch 3 |
| 24 | Absorption Arrows v2 | `absorption-arrows-v2` | Volume | price | WaveWalker1 | batch 41 |
| 25 | Absorption Bubbles | `absorption-bubbles` | Volume | price | profitprotrading | most liked |
| 26 | Abusuhil Bullish Candles | `abusuhil-bullish-candles` | Candlestick Patterns | price | abusuhil | batch 38 |
| 27 | Acceleration Bands HTF | `acceleration-bands-htf` | Channels & Bands | price | ZoharCho | batch 18 |
| 28 | Accumulation/Distribution Money Flow v1.0 | `ad-money-flow` | Volume | own | kypexin | batch 8 |
| 29 | Accurate Swing Trading | `accurate-swing-trading` | Trend | price |  |  |
| 30 | Activity and Volume Orderflow Profile | `activity-and-volume-orderflow-profile` | Volume | price | AlgoAlpha | most liked |
| 31 | Actually Engulfing Candlesticks | `actually-engulfing-candlesticks` | Candlestick Patterns | price | llbot | batch 40 |
| 32 | Adaptive ALMA 2.0 | `adaptive-alma-2-0` | Moving Averages | price | Zomzi | batch 9 |
| 33 | Adaptive Average Sentiment Oscilator | `adaptive-average-sentiment-oscilator` | Oscillators | own | Zomzi | batch 32 |
| 34 | Adaptive Convergence Divergence | `adaptive-convergence-divergence` | Momentum | own | singhxgurjit | batch 21 |
| 35 | Adaptive Ehlers Filtered Percentile | `adaptive-ehlers-filtered-percentile` | Channels & Bands | price | SchizoQuant | batch 4 |
| 36 | Adaptive Entropy Trend | `adaptive-entropy-trend` | Trend | price | QuantAlgo | batch 6 |
| 37 | Adaptive Friction Filter (AFF) | `adaptive-friction-filter` | Trend | price | QuantAlgo | batch 10 |
| 38 | Adaptive Gaussian AFR | `adaptive-gaussian-afr` | Trend | price | Mattes00 | batch 6 |
| 39 | Adaptive Heikin Ashi | `adaptive-heikin-ashi` | Trend | price | chervolino | batch 13 |
| 40 | Adaptive Kinetic Ribbon | `adaptive-kinetic-ribbon` | Trend | price | QuantAlgo | batch 9 |
| 41 | Adaptive MACD | `adaptive-macd` | Momentum | own |  |  |
| 42 | Adaptive ML Trailing Stop | `adaptive-ml-trailing-stop` | Trend | price | BOSWaves | batch 5 |
| 43 | Adaptive Nadaraya-Watson (Non Repainting) | `adaptive-nadaraya-watson` | Channels & Bands | price | Metrify | batch 10 |
| 44 | Adaptive Pivot Zones | `adaptive-pivot-zones` | Channels & Bands | price | Uncle_the_shooter | batch 17 |
| 45 | Adaptive Rolling Z-Score Channel | `adaptive-rolling-z-score-channel` | Channels & Bands | price | B3AR_Trades | batch 18 |
| 46 | Adaptive RSI \| Lyro RS | `adaptive-rsi-lyro-rs` | Oscillators | own | LyroRS | batch 13 |
| 47 | Adaptive Support and Resistance Zones | `adaptive-support-and-resistance-zones` | Channels & Bands | price | BigBeluga | most liked |
| 48 | Adaptive Trend Channel | `adaptive-trend-channel` | Channels & Bands | price | MarketStructureLab | batch 4 |
| 49 | Adaptive Trend Finder (log) | `adaptive-trend-finder` | Trend | price | Julien_Eche | most liked |
| 50 | Adaptive Trend Flow [QuantAlgo] | `adaptive-trend-flow` | Trend | price | QuantAlgo |  |
| 51 | Adaptive Volatility-Scaled Oscillator | `adaptive-volatility-scaled-oscillator` | Volatility | own | Zeiierman | batch 4 |
| 52 | Adjusted RSI | `adjusted-rsi` | Oscillators | own | JTCapitalNL | batch 11 |
| 53 | ADR Contraction Tightness | `adr-contraction-tightness` | Volatility | own | etfbreakouts | batch 33 |
| 54 | ADR% - Average Daily Range % by MikeC (AKA TheScrutiniser) | `adr-average-daily-range-by-mikec` | Volatility | own | TheScrutiniser | most liked |
| 55 | Advanced Dual Hull Cross Suite v6 - Precision Signals | `advanced-dual-hull-cross-suite-v6-precision-signals` | Moving Averages | price | NitMan279 | batch 36 |
| 56 | Advanced MACD Pro - T3 Themed | `advanced-macd-pro-t3-themed` | Momentum | own | WhiteStone_Ibrahim | batch 27 |
| 57 | Advanced Volume-Driven Breakout Signals | `advanced-volume-driven-breakout-signals` | Volume | price | VolumeVigilante | batch 38 |
| 58 | AdvancedLines (FiboBands) - PaSKaL | `advancedlines-paskal` | Channels & Bands | price | uPaSKaL | batch 19 |
| 59 | ADX and DI | `adx-and-di` | Trend | own | BeikabuOyaji | most liked |
| 60 | ADX and RSI Combo | `adx-and-rsi-combo` | Oscillators | own | Tracks | batch 10 |
| 61 | ADX by cobra | `adx-cobra` | Trend | own | cobra (community) |  |
| 62 | ADX Di+ Di- [Gu5] | `adx-di-gu5` | Trend | own | Gu5tavo71 |  |
| 63 | ADX Extreme Zones + Divergences | `adx-extreme-zones-divergences` | Trend | own | TradeVizion | batch 13 |
| 64 | ADX Trend Strength Filter + TRAMA | `adx-trend-strength-filter-trama` | Trend | price | DotGain | batch 18 |
| 65 | ADX Trend Visualizer with Dual Thresholds | `adx-trend-visualizer-with-dual-thresholds` | Trend | own | crankyprofits | batch 32 |
| 66 | ADX with Shaded Zone | `adx-with-shaded-zone` | Trend | own | MathThomas | batch 20 |
| 67 | ADX-vALMA (N) | `adx-valma` | Trend | own | Zomzi | batch 6 |
| 68 | Aegis Prime Flow | `aegis-prime-flow` | Oscillators | own | wjdtks255 | batch 34 |
| 69 | AG FX - Watermark | `ag-fx-watermark` | Trend | price | AGFXTRADING | most liked |
| 70 | Aggregated Scores Oscillator | `aggregated-scores-oscillator` | Oscillators | own | AlphaExtract | batch 8 |
| 71 | Aggressive Pullback Indicator | `aggressive-pullback-indicator` | Trend | price | ZenAndTheArtOfTrading | batch 1 |
| 72 | Aggressive Volume | `aggressive-volume` | Volume | own | oDouglasAlex | batch 26 |
| 73 | AI Adaptive Oscillator | `ai-adaptive-oscillator` | Oscillators | own | PhenLabs | batch 11 |
| 74 | AI Breakout Bands | `ai-breakout-bands` | Channels & Bands | price | Zeiierman | batch 3 |
| 75 | AI Engulfing Candle | `ai-engulfing` | Candlestick Patterns | price |  |  |
| 76 | AI Infinity | `ai-infinity` | Trend | price | jonathanalbrecht_trader | batch 11 |
| 77 | AI Source Switching Moving Average | `ai-source-switching-moving-average` | Moving Averages | price | Zeiierman | batch 1 |
| 78 | AI Trading Assistant v2 | `ai-trading-assistant-v2` | Trend | price | Alchemical_Carpenter | batch 26 |
| 79 | AI Trend Navigator [K-Neighbor] | `ai-trend-navigator` | Trend | price |  |  |
| 80 | AI Volume Signals | `ai-volume-signals` | Volume | price | szymonsobkowiak | batch 9 |
| 81 | AI-Weighted RSI | `ai-weighted-rsi` | Oscillators | own | Zeiierman | batch 3 |
| 82 | AK MACD BB | `macd-bb` | Momentum | own | Algokid |  |
| 83 | AK TREND ID | `ak-trend-id` | Trend | own | Algokid |  |
| 84 | Al Brooks II.IOI.OO | `al-brooks-ii-ioi-oo` | Candlestick Patterns | price |  | batch 42 |
| 85 | Al Po's Arithmetic Mean | `al-po-s-arithmetic-mean` | Moving Averages | price | sequentialvision | batch 21 |
| 86 | Algo Market Structure | `algo-market-structure` | Trend | price | nephew_sam_ | most liked |
| 87 | All Candlestick Patterns | `all-candlestick-patterns` | Candlestick Patterns | price |  |  |
| 88 | All-In-One MA Stack Scalper | `all-in-one-ma-stack-scalper` | Moving Averages | price | jonesdaniel2112 | batch 33 |
| 89 | ALL-IN-ONE RSI System (Cloud Divergence Stoch RSI CM WVF) | `all-in-one-rsi-system` | Oscillators | own | ethem11 | batch 25 |
| 90 | AllMA Trend Radar | `allma-trend-radar` | Moving Averages | price | trade_lexx | batch 28 |
| 91 | ALMA SD Bands \| RakoQuant | `alma-sd-bands-rakoquant` | Channels & Bands | price | RakoQuant | batch 10 |
| 92 | Almost Zero Lag EMA | `zero-lag-ema` | Moving Averages | price | LazyBear | most liked |
| 93 | Alpha Trading Signal _ Up side Down | `alpha-trading-signal-up-side-down` | Trend | price | giaodichdsmart | batch 19 |
| 94 | Alpha-Sutte Model | `alpha-sutte-model` | Trend | price | SegaRKO | batch 10 |
| 95 | AlphaTrend | `alpha-trend` | Trend | price | KivancOzbilgic |  |
| 96 | AlphaTrend - Screener | `alphatrend-screener` | Trend | price | KivancOzbilgic | most liked |
| 97 | AMD Po3 with Live Edge Stats | `amd-po3-with-live-edge-stats` | Trend | price | WillyAlgoTrader | most liked |
| 98 | Anchored Bollinger Band Range | `anchored-bollinger-band-range` | Channels & Bands | price | Steversteves | batch 20 |
| 99 | Anchored VWAP Pro (Final Visibility Enhanced) | `anchored-vwap-pro` | Volume | price | ImmortalEmerson | batch 17 |
| 100 | Anchored VWAP with Buy/Sell Signals | `anchored-vwap-with-buy-sell-signals` | Volume | price | kmootoo89 | batch 29 |
| 101 | ANDROMEDA - TrendSync | `andromeda-trendsync` | Trend | price | Pedro_Canto | batch 9 |
| 102 | Angle Attack Follow Line Indicator | `angle-attack-follow-line-indicator` | Trend | own | Dreadblitz | most liked |
| 103 | Anti-Volume Stop Loss | `anti-volume-stop` | Trend | price |  |  |
| 104 | Apex Volatility Squeeze & Breakout | `apex-volatility-squeeze-breakout` | Volatility | price | Pineify | batch 33 |
| 105 | Arnaud Legoux Gaussian Flow \| AlphaNatt | `arnaud-legoux-gaussian-flow-alphanatt` | Moving Averages | price | AlphaNatt | batch 17 |
| 106 | Aroon with RSI Confirmation (92.86%) | `aroon-with-rsi-confirmation` | Trend | price | jaydipali622018 | batch 7 |
| 107 | ASDQWE123 2.0 | `asdqwe123-2-0` | Trend | price | luvuoov | batch 34 |
| 108 | Asian & London Session High/Low | `asian-london-session-high-low` | Channels & Bands | price | NikolayBorisov | batch 8 |
| 109 | AsiaSessionHighLowMidLines | `asiasessionhighlowmidlines` | Channels & Bands | price | marekmajer | most liked |
| 110 | Ask-Weighted Averages | `ask-weighted-averages` | Volume | price | DinoTradez | batch 27 |
| 111 | Asset risk metrics | `asset-risk-metrics` | Momentum | price | Sweettz | batch 21 |
| 112 | Asymmetric Volatility Trend Line | `asymmetric-volatility-trend-line` | Trend | price | QuantAlgo | batch 4 |
| 113 | ATR Bands | `atr-bands` | Channels & Bands | price | TheTrdFloor | most liked |
| 114 | ATR Based Zigzag w EMA | `atr-based-zigzag-w-ema` | Trend | price | HabibiBudo | batch 4 |
| 115 | ATR HEMA | `atr-hema` | Moving Averages | price | SeerQuant | batch 2 |
| 116 | ATR Period | `nrtr` | Trend | price |  |  |
| 117 | ATR Period | `profit-maximizer` | Moving Averages | price |  |  |
| 118 | Supertrend - Ladder ATR - 1909Capital [Trendoscope®] | `supertrend-ladder` | Trend | price |  |  |
| 119 | ATR Rope | `atr-rope` | Trend | price | SamRecio | batch 2 |
| 120 | ATR Stop Loss Finder | `atr-stop-loss-finder` | Volatility | price | veryfid | most liked |
| 121 | ATR Trailing Stop with ATR Targets | `atr-trailing-stop-with-atr-targets` | Trend | price | TRDRZone | batch 33 |
| 122 | ATR + Trailing Stops | `atr-trailing-stops` | Trend | price |  |  |
| 123 | ATR Trailing Stoploss | `atr-trailing-stoploss` | Trend | price | ceyhun | most liked |
| 124 | ATR Trend Color | `atr-trend-color` | Trend | price | Aleksin_Aleksandar | batch 31 |
| 125 | ATR Volatility and Trend Analysis | `atr-volatility-and-trend-analysis` | Volatility | price | dchunt-stack | batch 10 |
| 126 | ATR ZLEMA | `atr-zlema` | Trend | price | QuantAlgo | batch 3 |
| 127 | ATR+ Stop Loss Indicator | `atr-plus` | Trend | own | ZenAndTheArtOfTrading |  |
| 128 | ATR-Normalized VWMA Deviation | `atr-normalized-vwma-deviation` | Oscillators | own | exploretranspose | batch 10 |
| 129 | ATR-Scaled Deviation Oscillator | `atr-scaled-deviation-oscillator` | Oscillators | own | C_H_I_P_A | batch 23 |
| 130 | ATR20 SMA x3.5 Trailing Line | `atr20-sma-x3-5-trailing-line` | Volatility | price | hibinomasakazu1991 | batch 30 |
| 131 | Aura Sentiment & Risk Flow | `aura-sentiment-risk-flow` | Oscillators | own | Pineify | batch 34 |
| 132 | Aura Trend & Candlestick Matrix | `aura-trend-candlestick-matrix` | Trend | price | Pineify | batch 9 |
| 133 | Aura Vortex Oscillator | `aura-vortex-oscillator` | Oscillators | own | Pineify | batch 32 |
| 134 | Aura: Adaptive Statistical Smoother | `aura-adaptive-statistical-smoother` | Moving Averages | price | Pineify | batch 15 |
| 135 | Auto AVWAP (Anchored-VWAP) with Breakout Screener | `auto-avwap-with-breakout-screener` | Volume | price | manoharvs | batch 28 |
| 136 | Auto Fib | `auto-fib-theyangguizi` | Channels & Bands | price |  | most liked |
| 137 | Auto Fib Channels by DGT | `auto-fib-channels-by-dgt` | Channels & Bands | price | dgtrd | most liked |
| 138 | Auto Fib Retracement Alerts | `auto-fib-retracement-alerts` | Trend | price | DevLucem | most liked |
| 139 | Auto Fib Speed Resistance Fans by DGT | `auto-fib-speed-resistance-fans-by-dgt` | Trend | price | dgtrd | most liked |
| 140 | Auto Fibo on Indicators | `auto-fibo-indicators` | Oscillators | own | KivancOzbilgic |  |
| 141 | Auto Fibonacci | `auto-fib` | Channels & Bands | price |  |  |
| 142 | Auto Pattern Detector Targets | `auto-pattern-detector-targets` | Trend | price | MarkitTick | most liked |
| 143 | Auto PitchFan, Fib Extension/Retracement and ZigZag by DGT | `auto-pitchfan-fib-extension-retracement-and` | Trend | price | dgtrd | most liked |
| 144 | Auto Pitchfork, Fib Retracement and Zig Zag by DGT | `auto-pitchfork-fib-retracement-zig-zag` | Trend | price | dgtrd | most liked |
| 145 | Auto Trendline [DojiEmoji] | `auto-trendline` | Trend | price |  |  |
| 146 | Auto TrendLines Support Resistance Signal Alerts | `auto-trendlines-support-resistance-signal` | Trend | price | TradingFinder | most liked |
| 147 | Auto-Support | `auto-support` | Channels & Bands | price |  |  |
| 148 | Automated Z-scoring | `automated-z-scoring` | Oscillators | own | JTCapitalNL | batch 14 |
| 149 | Automatic Support & Resistance | `auto-support-resistance` | Channels & Bands | price |  |  |
| 150 | Average Bullish & Bearish Percentage Change | `average-bullish-bearish-percentage-change` | Momentum | own | fract | batch 23 |
| 151 | Average Sentiment Oscillator | `average-sentiment-oscillator` | Oscillators | own |  |  |
| 152 | Average True Range Trailing Stops Colored | `atr-trailing-colored` | Trend | price |  |  |
| 153 | Awesome Oscillator V2 | `awesome-oscillator-v2` | Oscillators | own |  |  |
| 154 | Awesome_Accelerator_Zone Oscillator | `awesome-accelerator-zone-oscillator` | Oscillators | own | pirooz_trader | batch 18 |
| 155 | B + A + D v0.4 | `b-a-d-v0-4` | Momentum | own | wepritz84 | batch 13 |
| 156 | BACAP PRICE STRUCTURE 21 EMA TREND | `bacap-price-structure-21-ema-trend` | Trend | price | Alex_PrimeTrading | batch 19 |
| 157 | Backtesting & Trading Engine | `backtesting-trading-engine` | Trend | price | PineCoders | most liked |
| 158 | Balanced Price Range (BPR) | `balanced-price-range` | Trend | price | tradeforopp | most liked |
| 159 | Banker Fund Flow Trend Oscillator | `banker-fund-flow` | Oscillators | own |  |  |
| 160 | Bar Replay Fix | `bar-replay-fix` | Candlestick Patterns | price | ivanrdgc | batch 42 |
| 161 | BB Breakout Oscillator | `bb-breakout-oscillator` | Oscillators | own | LuxAlgo |  |
| 162 | BB Fibonacci Ratios | `bb-fibonacci-ratios` | Channels & Bands | price |  |  |
| 163 | BB Length | `ideal-bb-ma` | Moving Averages | price |  |  |
| 164 | BB Stochastic RSI Extreme Signal | `bb-stoch-rsi` | Oscillators | price |  |  |
| 165 | Beep Boop | `beep-boop` | Momentum | own | OBSIDE | batch 33 |
| 166 | Bernoulli Process - Binary Entropy | `bernoulli-process-entropy` | Oscillators | own | kocurekc | batch 1 |
| 167 | BEST Supertrend CCI | `supertrend-cci` | Trend | price | Daveatt |  |
| 168 | Best Support And Resistance Indicator V1 | `best-support-and-resistance-indicator-v1` | Channels & Bands | price | ForexBee | most liked |
| 169 | Beta-Weighted Moving Average | `weighted-ma-function` | Moving Averages | price |  |  |
| 170 | Better Volume Indicator | `better-volume` | Volume | own | LazyBear | most liked |
| 171 | Big Snapper Alerts R3.0 | `big-snapper-alerts` | Trend | price |  |  |
| 172 | Big Trades Detector By HF | `big-trades-detector-by-hf` | Volume | price | Nicolas_Favilla | batch 38 |
| 173 | Big Trades Whale Detector By HK | `big-trades-whale-detector-by-hk` | Volume | price | colacorn | batch 38 |
| 174 | Biggest Volume | `biggest-volume` | Volume | own | mikhail_marka | batch 22 |
| 175 | Bilateral Filter For Loop | `bilateral-filter-for-loop` | Trend | own | BackQuant | batch 14 |
| 176 | Binary Options Arrows (example) [TheMightyChicken] | `binary-option-arrows` | Trend | price |  |  |
| 177 | Bitcoin 2Y-SMA Bands\| Astral Vision | `bitcoin-2y-sma-bands-astral-vision` | Channels & Bands | own | AstralVision | batch 34 |
| 178 | Bitcoin Bull/Bear Market Support/Resistance Bands | `bitcoin-bull-bear-market-support-resistance-bands` | Moving Averages | price | JoeSTM | batch 30 |
| 179 | Bitcoin Kill Zones v2 | `bitcoin-kill-zones` | Trend | price |  |  |
| 180 | Bitcoin Log Growth Curves | `bitcoin-log-curves` | Trend | price | Quantadelic |  |
| 181 | Bitcoin: Mayer Multiple | `bitcoin-mayer-multiple` | Oscillators | own | sito4713 | batch 25 |
| 182 | Bitcoin: Pi Cycle Top & Bottom Indicator Z Score | `bitcoin-pi-cycle-top-bottom-indicator-z-score` | Oscillators | own | Commandoum | batch 37 |
| 183 | Bjorgum AutoTrail | `bjorgum-autotrail` | Trend | price | Bjorgum (simplified for auto mode) |  |
| 184 | Bjorgum Key Levels | `bjorgum-key-levels` | Trend | price | Bjorgum | most liked |
| 185 | Bjorgum MTF MA | `bjorgum-mtf-ma` | Moving Averages | price | Bjorgum | most liked |
| 186 | Bjorgum SuperScript | `bjorgum-superscript` | Trend | price | Bjorgum | most liked |
| 187 | Bjorgum TSI | `bjorgum-tsi` | Momentum | own |  |  |
| 188 | Blacklab84 Panel | `blacklab84-panel` | Oscillators | own | blacklab84 | batch 21 |
| 189 | BNF 25/50 MA Pullback Screener (Uptrend-Below / Downtrend-Above) | `bnf-25-50-ma-pullback-screener` | Trend | price | jackson_g_sheehan | batch 35 |
| 190 | Bollinger Adaptive Trend Navigator | `bollinger-adaptive-trend-navigator` | Trend | price | QuantAlgo | batch 16 |
| 191 | Bollinger Awesome Alert R1.1 | `bollinger-awesome-alert` | Trend | price |  |  |
| 192 | Bollinger Free Bars | `bollinger-free-bars` | Channels & Bands | price | pkuliyi | batch 36 |
| 193 | Bollinger Heatmap | `bollinger-heatmap` | Channels & Bands | own | Quantitative | batch 25 |
| 194 | Boom Hunter Pro | `boom-hunter-pro` | Momentum | own | veryfid |  |
| 195 | BOS/CHOCH Demand & Supply | `bos-choch-demand-supply` | Trend | price | s3u1l | most liked |
| 196 | Breakaway Fair Value Gaps | `breakaway-fair-value-gaps` | Trend | price | LuxAlgo | most liked |
| 197 | Breakdown or Buyable Dip? Pullback Depth Can Help | `breakdown-or-buyable-dip-pullback-depth-can-help` | Momentum | own | TradeStation | batch 23 |
| 198 | Breaker Blocks + Order Blocks confirm BBOB Alert | `breaker-blocks-order-blocks-confirm-bbob-alert` | Trend | price | TradingFinder | most liked |
| 199 | Breaker Blocks with Signals | `breaker-blocks-with-signals` | Trend | price | LuxAlgo | most liked |
| 200 | Breakout an Reversal Signal Detector with Colored in Bar Trends | `breakout-an-reversal-signal-detector-with-colored-in-bar-trends` | Channels & Bands | price | AmGlad_Trader | batch 25 |
| 201 | Breakout and Retest Signals | `breakout-and-retest-signals` | Trend | price | AlgoAlpha | most liked |
| 202 | Breakout Boxes | `breakout-boxes` | Volume | price | ChartPrime | most liked |
| 203 | Breakout Finder | `breakout-finder` | Trend | price | LonesomeTheBlue | most liked |
| 204 | Breakout Indicator | `breakout-indicator` | Trend | price | ZenAndTheArtOfTrading | batch 1 |
| 205 | Breakout Pattern Setup | `breakout-pattern-setup` | Channels & Bands | price | WillyAlgoTrader | most liked |
| 206 | Breakout Probability (Expo) | `breakout-probability` | Volatility | price | Zeiierman | most liked |
| 207 | Breakout Targets | `breakout-targets` | Channels & Bands | price | AlgoAlpha | most liked |
| 208 | Breakout Volume Delta \| Flux Charts | `breakout-volume-delta-flux-charts` | Volume | price | fluxchart | most liked |
| 209 | Breakouts with Tests & Retests | `breakouts-with-tests-retests` | Trend | price | LuxAlgo | most liked |
| 210 | BTC Logarithmic Regression Quantile Bands \| Astral Vision | `btc-logarithmic-regression-quantile-bands-astral-vision` | Channels & Bands | price | AstralVision | batch 24 |
| 211 | BTCUSDSHORTS BTCUSDLONGS - Bitfinex BTC Shorts & Longs | `btcusdshorts-btcusdlongs-bitfinex-btc-shorts` | Volume | own | autemox | most liked |
| 212 | Bull Bear Power Trend | `bull-bear-power-trend` | Momentum | own |  |  |
| 213 | Bull Market Support Band (20w SMA, 21w EMA) | `bull-market-support-band` | Moving Averages | price | zkdev | most liked |
| 214 | Bullish Engulfing | `bullish-engulfing-finder` | Candlestick Patterns | price |  |  |
| 215 | Bullish Volume Anomaly | `bullish-volume-anomaly` | Volume | price | UnknownUnicorn13336802 | batch 31 |
| 216 | CM_TotalConsecutive_Up_Down_V2 | `bulls-bears-control` | Trend | own |  |  |
| 217 | Bulls v Bears | `bulls-v-bears` | Momentum | own | Mihkel00 | batch 3 |
| 218 | Buy & Sell - Accurate Signals | `buy-sell-accurate-signals` | Trend | price | Cryptokingworld91 (published as "Buy & Sell - Accurate Signals") | batch 7 |
| 219 | Buy & Sell Pressure | `buy-sell-pressure` | Volume | own |  |  |
| 220 | Buy Low Sell High Composite Upgraded V6 | `buy-low-sell-high-composite-upgraded-v6` | Oscillators | own | kristian6ncqq | batch 15 |
| 221 | Buy on Volume | `buy-on-volume` | Moving Averages | price | Mando4_27 | batch 21 |
| 222 | Buy Sell Signal | `buy-sell-signal-kelfry98` | Trend | price | kelfry98 | most liked |
| 223 | Buy the Dip & Sell the Rip | `buy-the-dip-sell-the-rip` | Momentum | price | vvedding | batch 41 |
| 224 | Buy/Sell Hull Crossover Signals (Fast & Slow) | `buy-sell-hull-crossover-signals` | Moving Averages | price | VibeAlgos | batch 11 |
| 225 | buy/sell signals with Support/Resistance | `buy-sell-signals-with-support-resistance` | Trend | price | InvestyourAsset | most liked |
| 226 | Buyers & Sellers / Range | `buyers-sellers-range` | Oscillators | own | fract | batch 11 |
| 227 | Buyers vs Sellers | `buyers-vs-sellers` | Momentum | own | davorloncarpetrovic | batch 19 |
| 228 | Buying & Selling Pressure | `buying-selling-pressure` | Volatility | own | fract | batch 3 |
| 229 | Buying and Selling Volume Pressure S/R | `buying-and-selling-volume-pressure-s-r` | Volume | price | DinoTradez | batch 16 |
| 230 | Buying Selling Volume | `buying-selling-volume` | Volume | own | ceyhun (community) |  |
| 231 | Buying vs Selling Moving Averages (Scalp Meter) | `buying-vs-selling-moving-averages` | Volume | own | codycolton97 | batch 24 |
| 232 | BuySell Volume Bar Chart | `buysell-volume-bar-chart` | Volume | own | roshbiz1408 | batch 21 |
| 233 | BuySell%_ImtiazH_v2 | `buysell-imtiazh-v2` | Volume | own | a272a59956 | batch 22 |
| 234 | Buyside & Sellside Liquidity | `buyside-sellside-liquidity` | Trend | price | LuxAlgo | most liked |
| 235 | Cabal Dev Indicator | `cabal-dev-indicator` | Oscillators | own | SolanaMemeCoins | batch 26 |
| 236 | Candle Breakout Oscillator | `candle-breakout-oscillator` | Oscillators | own | LuxAlgo | batch 2 |
| 237 | Candle BUY SELL + Support Resistance | `candle-buy-sell-support-resistance` | Channels & Bands | price | JohnsonForexTrader | batch 32 |
| 238 | Candle Channel | `candle-channel` | Channels & Bands | price | Uncle_the_shooter | batch 23 |
| 239 | Candle Color Flip | `candle-color-flip` | Candlestick Patterns | price | LorPlant | batch 42 |
| 240 | Candle Count RSI | `candle-count-rsi` | Oscillators | own | Sherlock_MacGyver | batch 35 |
| 241 | Candle Range Theory (CRT) by Lucas | `candle-range-theory-by-lucas` | Trend | price | lucasfff | batch 15 |
| 242 | Candle Range Theory \| Flux Charts | `candle-range-theory-flux-charts` | Trend | price | fluxchart | most liked |
| 243 | Candle Range Trading (CRT) | `candle-range-trading` | Trend | price | marcostan93 | batch 1 |
| 244 | Candle Spread Oscillator (CS0) | `candle-spread-oscillator` | Oscillators | own | RWCS_LTD | batch 36 |
| 245 | Candle State (The Strat) | `candle-state` | Candlestick Patterns | price | Crinklebine | batch 38 |
| 246 | Candlestick Patterns Identified | `candlestick-patterns-identified` | Candlestick Patterns | price | repo32 | batch 38 |
| 247 | Candlestick Reversal | `candlestick-reversal` | Candlestick Patterns | price | LonesomeTheBlue (community) |  |
| 248 | Candlestick Structure | `candlestick-structure` | Candlestick Patterns | price | LuxAlgo | most liked |
| 249 | Candlestick Trend Indicator v0.5 by JustUncleL | `candlestick-trend-indicator` | Trend | price | JustUncleL | most liked |
| 250 | Candlesticks Patterns Identified | `candlesticks-patterns-identified` | Candlestick Patterns | price | repo32 | most liked |
| 251 | Cardwell RSI by TQ | `cardwell-rsi-by-tq` | Oscillators | own | TradeQUO | batch 24 |
| 252 | Carrier Volatility | `carrier-volatility` | Oscillators | own | et20tradeview | batch 15 |
| 253 | CBC Flip with Volume | `cbc-flip-with-volume` | Trend | price | PtGambler | batch 18 |
| 254 | CCI coded OBV | `cci-obv` | Oscillators | own | LazyBear |  |
| 255 | CCI Pro | `cci-hash-capital` | Oscillators | own | Hash_Capital | batch 24 |
| 256 | CCI Stochastic | `cci-stochastic` | Momentum | own | Daveatt | most liked |
| 257 | CCT Bollinger Band Oscillator | `cct-bbo` | Oscillators | own | LazyBear |  |
| 258 | CD_Average Daily Range Zones- highs and lows of the day | `cd-average-daily-range-zones-highs-and-lows` | Volatility | price | cristian.d | most liked |
| 259 | CDC Action Zone | `cdc-action-zone` | Trend | price |  |  |
| 260 | CDC ActionZone V3 2020 | `cdc-actionzone-v3-2020` | Trend | price | piriya33 | most liked |
| 261 | Center of Gravity Channel | `cog-channel` | Channels & Bands | price |  |  |
| 262 | CHAKRA RISS ENGULFING CANDLESTICK STRATEGY | `chakra-riss-engulfing-candlestick-strategy` | Momentum | price | Tradewith_Riss | batch 18 |
| 263 | Chandelier Exit | `chandelier-exit` | Trend | price |  |  |
| 264 | Chandelier Stop | `chandelier-stop` | Trend | price |  |  |
| 265 | Change in State of Delivery (CISD) | `change-in-state-of-delivery` | Trend | price | LuxAlgo | most liked |
| 266 | Change in State of Delivery CISD | `change-in-state-of-delivery-cisd` | Trend | price | AlgoAlpha | most liked |
| 267 | Change-Point Detection (CUSUM) | `change-point-detection` | Trend | price | LuxAlgo | batch 6 |
| 268 | Channels With Patterns | `channels-with-patterns` | Channels & Bands | price | ChartPrime | most liked |
| 269 | CHN BUY SELL with EMA 200 | `chn-buy-sell-with-ema-200` | Trend | price | CHNTeam | batch 10 |
| 270 | CISD with Alerts | `cisd-with-alerts` | Trend | price | neommxm | most liked |
| 271 | Clean Buy Sell Pro | `clean-buy-sell-pro` | Trend | price | JohnsonForexTrader | batch 40 |
| 272 | Clean Volume Bars (Green/Red + Above Avg Highlight) | `clean-volume-bars` | Volume | own | melospoker80 | batch 37 |
| 273 | Climax Volume Reversal Radar | `climax-volume-reversal-radar` | Volume | own | Ty_yanse | batch 31 |
| 274 | Clustering Volatility (ATR-ADR-ChaikinVol) | `clustering-volatility` | Volatility | own | SDF-Solutions | batch 24 |
| 275 | Clusters Volume Profile | `clusters-volume-profile` | Volume | price | LuxAlgo | most liked |
| 276 | CM EMA Trend Bars | `cm-ema-trend-bars` | Trend | price | ChrisMoody |  |
| 277 | CM Enhanced Ichimoku Cloud V5 | `cm-enhanced-ichimoku` | Channels & Bands | price | ChrisMoody (community) |  |
| 278 | CM_Gann Swing HighLow V2 | `cm-gann-swing` | Trend | price | ChrisMoody (community) |  |
| 279 | CM Guppy EMA | `cm-guppy-ema` | Moving Averages | price | ChrisMoody |  |
| 280 | CM Heikin-Ashi | `cm-heikin-ashi` | Candlestick Patterns | price | ChrisMoody |  |
| 281 | CM Laguerre PPO PercentileRank | `cm-laguerre-ppo` | Oscillators | own | ChrisMoody |  |
| 282 | CM MACD Custom Indicator - Multiple Time Frame - V2 | `cm-macd-custom-mtf-v5` | Momentum | own | ChrisMoody | most liked |
| 283 | CM Price Action Bars | `cm-price-action` | Oscillators | price | ChrisMoody |  |
| 284 | CM RSI Plus EMA | `cm-rsi-ema` | Oscillators | own | ChrisMoody |  |
| 285 | _CM_RSI_2_Strat_Low | `cm-rsi-2-lower` | Oscillators | own | ChrisMoody |  |
| 286 | _CM_RSI_2_HB_MA | `cm-rsi-2-upper` | Oscillators | price | ChrisMoody |  |
| 287 | CM Sling Shot System | `cm-sling-shot` | Trend | price | ChrisMoody |  |
| 288 | CM Stochastic Highlight Bars | `cm-stoch-highlight` | Oscillators | price | ChrisMoody |  |
| 289 | CM Stochastic Multi-TimeFrame | `cm-stochastic-mtf` | Oscillators | own | ChrisMoody | most liked |
| 290 | CM Stochastic POP Method 1 | `stoch-pop-1` | Oscillators | own | ChrisMoody |  |
| 291 | CM Stochastic POP Method 2 | `stoch-pop-2` | Oscillators | own | ChrisMoody |  |
| 292 | CM Time Based Vertical Lines | `cm-time-lines` | Trend | price | ChrisMoody |  |
| 293 | CM Williams Vix Fix V3 | `cm-vix-fix-v3` | Oscillators | own | ChrisMoody |  |
| 294 | CM_OldSchool_Projected_high_Low | `cm-oldschool-projected-high-low` | Channels & Bands | price | ChrisMoody | most liked |
| 295 | CM_Parabolic SAR | `cm-parabolic-sar` | Trend | price | ChrisMoody | most liked |
| 296 | CM_Pivot Points_Custom | `cm-pivot-points-custom` | Trend | price | ChrisMoody | most liked |
| 297 | CM_Pivot Points_M-W-D-4H-1H_Filtered | `cm-pivot-points-filtered` | Trend | price | ChrisMoody | most liked |
| 298 | CM_Ultimate RSI Multi Time Frame | `cm-ultimate-rsi-mtf` | Oscillators | own | ChrisMoody | most liked |
| 299 | CM_Ultimate_MA_MTF_V2 | `cm-ultimate-ma-mtf-v2` | Moving Averages | price | ChrisMoody | most liked |
| 300 | CM_Williams_Vix_Fix_V3_Upper_Text Plots | `cm-vix-fix-v3-upper-text-plots` | Volatility | price | ChrisMoody | most liked |
| 301 | CMO For Loop \| QuantLapse | `cmo-for-loop-quantlapse` | Momentum | own | QuantLapse | batch 19 |
| 302 | Code for All 4 Forex Sessions W/ Background Highlight!!! | `code-for-all-4-forex-sessions-w-background` | Trend | price | ChrisMoody | most liked |
| 303 | Colored Volume Bars | `colored-volume` | Volume | own | LazyBear |  |
| 304 | Combined Up down with volume | `combined-up-down-with-volume` | Volume | price | ChartMantra_ | batch 41 |
| 305 | Combo Oscillator - MACD + Stoch + RSI + EMA | `combo-oscillator-macd-stoch-rsi-ema` | Oscillators | own | Gauder84 | batch 34 |
| 306 | Community MoneyLine | `community-moneyline` | Trend | price | rafstar_kaczmarek | batch 12 |
| 307 | Composite Indicator (CCI + ATR) | `composite-indicator` | Momentum | price | CharLi0t | batch 17 |
| 308 | Trading Toolkit (Michaël van de Poppe) [BigBeluga] | `comprehensive-trading-toolkit` | Oscillators | own | BigBeluga | most liked |
| 309 | Consecutive Candles DevisSo | `consecutive-candles-devisso` | Trend | price | engineerofmoney | batch 11 |
| 310 | Consecutive Higher/Lower Closings | `consecutive-higher-lower-closings` | Trend | price | rahul_joshi_2 | batch 39 |
| 311 | Consolidation Range with Signals | `consolidation-range-with-signals` | Volatility | price | Zeiierman | most liked |
| 312 | Consolidation Zones - Live | `consolidation-zones` | Channels & Bands | price | LonesomeTheBlue |  |
| 313 | Conversion Periods | `ichimoku-oscillator` | Momentum | own |  |  |
| 314 | Coral Trend | `coral-trend` | Trend | price | LazyBear |  |
| 315 | Corrected Moving Average | `corrected-moving-average` | Moving Averages | price | everget | batch 3 |
| 316 | COV Bands ~ C H I P A | `cov-bands-c-h-i-p-a` | Channels & Bands | own | C_H_I_P_A | batch 28 |
| 317 | Crosby Ratio \| QuantumResearch | `crosby-ratio-quantumresearch` | Momentum | own | QuantumResearch | batch 17 |
| 318 | Crossover EMMM | `crossover-emmm` | Trend | price | NunyadzilaTrading | batch 22 |
| 319 | CRT indicator | `crt-indicator` | Trend | price | INTELA | batch 16 |
| 320 | Cumulative Delta Volume | `cumulative-delta-volume` | Volume | own | LonesomeTheBlue | most liked |
| 321 | Cumulative Volume Delta Divergence Periodic EMA | `cumulative-volume-delta-divergence-periodic` | Volume | own | TradingFinder | most liked |
| 322 | Cumulative Volume Delta Strategy \| Flux Charts | `cumulative-volume-delta-strategy-flux-charts` | Volume | price | fluxchart | most liked |
| 323 | Cup Finder | `cup-finder` | Trend | price | LonesomeTheBlue | most liked |
| 324 | Curved Trend Channels | `curved-trend-channels` | Channels & Bands | price | Zeiierman | batch 7 |
| 325 | Custom Buy and Sell Signal with Body Ratio and RSI | `custom-buy-and-sell-signal-with-body-ratio-and-rsi` | Momentum | price | am-solaris | batch 38 |
| 326 | CM_Donchian Channels Modified | `donchian-custom` | Channels & Bands | price |  |  |
| 327 | Customizable RSI/StochRSI Double Confirmation | `customizable-rsi-stochrsi-double-confirmation` | Momentum | price | smile_bad_day | batch 42 |
| 328 | CVD & Big Trade Detector By HK | `cvd-big-trade-detector-by-hk` | Volume | own | colacorn | batch 39 |
| 329 | CVD (Cumulative Volume Delta) | `cvd-rupward` | Volume | own | RUpward | batch 19 |
| 330 | CVD Divergence Background By HK | `cvd-divergence-background-by-hk` | Volume | price | colacorn | batch 42 |
| 331 | CVD Polarity Indicator (With Rolling Smoothed) | `cvd-polarity-indicator` | Volume | own | Cruiser | batch 35 |
| 332 | CVD Reversal Divergence (Exhaustion) | `cvd-reversal-divergence` | Volume | price | somnacin | batch 39 |
| 333 | Cycle & Flow Indicator - D_Quant | `cycle-flow-indicator-d-quant` | Trend | price | D_QUANT | batch 22 |
| 334 | Cycle Low (RSI + StochRSI) – v5 John.K | `cycle-low-v5-john-k` | Momentum | price | John_Kal | batch 22 |
| 335 | Cycle-Synced Channel Breakout | `cycle-synced-channel-breakout` | Channels & Bands | price | TradeTechanalysis | batch 25 |
| 336 | Daily Weekly Monthly Yearly Opens | `daily-weekly-monthly-yearly-opens` | Trend | price | sbtnc | most liked |
| 337 | Dan's Ironclad OB - Simple | `dan-s-ironclad-ob-simple` | Trend | price | hynaxiii | batch 10 |
| 338 | Darvas Box | `darvas-box` | Candlestick Patterns | price |  |  |
| 339 | Dead Simple Reversal | `dead-simple-reversal` | Candlestick Patterns | price | B3AR_Trades (converted from "p2f - Dead Simple Reversal" by paidtofade; | batch 41 |
| 340 | DecisionPoint Volume Swenlin Trading Oscillator | `decisionpoint-volume-swenlin-trading` | Oscillators | own | LazyBear | most liked |
| 341 | DECODE Moving Average Toolkit | `decode-moving-average-toolkit` | Moving Averages | price | decodejar | batch 20 |
| 342 | Delta Flow Profile | `delta-flow-profile` | Volume | price | LuxAlgo | most liked |
| 343 | Delta Ladder | `delta-ladder` | Volume | price | KioseffTrading | most liked |
| 344 | Delta Manipulation Footprint | `delta-manipulation-footprint` | Volume | price | destrobr0685 | batch 39 |
| 345 | Delta Volume Candles | `delta-volume-candles` | Volume | price | LucF | most liked |
| 346 | Delta Volume RSI | `delta-volume-rsi` | Volume | own | destrobr0685 | batch 24 |
| 347 | Delta Zones Buy/Sell Pressure | `delta-zones-buy-sell-pressure` | Volume | price | NathanTradeus | most liked |
| 348 | Delta-RSI Oscillator | `delta-rsi-oscillator` | Momentum | own | tbiktag (simplified) |  |
| 349 | DeltaFlow Volume Profile | `deltaflow-volume-profile` | Volume | price | BigBeluga | most liked |
| 350 | DEMA Flow | `dema-flow` | Trend | price | AlphaExtract | batch 7 |
| 351 | Demand & Supply Zones | `demand-supply-zones` | Channels & Bands | price | BacktestBot | most liked |
| 352 | Demand Index (James Sibbet) | `demand-index` | Volume | own | conair | batch 37 |
| 353 | Deviation Symmetry Breaker ~ C H I P A | `deviation-symmetry-breaker-c-h-i-p-a` | Channels & Bands | own | C_H_I_P_A | batch 18 |
| 354 | Deviation Trend Profile | `deviation-trend-profile` | Trend | price | BigBeluga | most liked |
| 355 | Dip & Rip Patterns - The Quant Science | `dip-rip-patterns-the-quant-science` | Volatility | price | thequantscience | batch 39 |
| 356 | Dip Buy/Sell Signals (Vix Fix + MA Deviation + TRMAD) | `dip-buy-sell-signals` | Volatility | price | DotGain | batch 42 |
| 357 | Directional Indicator Crossovers v1 | `directional-indicator-crossovers-v1` | Trend | own | JopAlgo | batch 7 |
| 358 | Directional Logistic Oscillator | `directional-logistic-oscillator` | Oscillators | own | GainzAlgo | batch 2 |
| 359 | Directional Movement Index + ADX + Ploted KEYLEVEL | `dmi-adx-levels` | Trend | own |  |  |
| 360 | Disparity Index | `disparity-index` | Oscillators | own | HPotter | batch 10 |
| 361 | Divergence for many indicator v3 | `divergence-for-many-indicator-v3` | Momentum | price | LonesomeTheBlue | most liked |
| 362 | Divergence for Many Indicators v4 | `divergence-for-many-indicators-v4` | Momentum | price | LonesomeTheBlue | most liked |
| 363 | Divergence Indicator | `divergence-indicator` | Momentum | price |  |  |
| 364 | Divergence Screener | `divergence-screener` | Oscillators | own | Trendoscope | most liked |
| 365 | DMI Delta by 0xjcf | `dmi-delta-by-0xjcf` | Trend | own | J_O_S_E_ | batch 34 |
| 366 | DMI Histogram Indicator | `dmi-histogram-indicator` | Trend | own | Chart0bserver | batch 32 |
| 367 | DN MACD | `dn-macd` | Momentum | own | lihulu123 | batch 32 |
| 368 | Dominance Signal Apex | `dominance-signal-apex` | Trend | price | chervolino | batch 17 |
| 369 | DonAlt - Smart Money Toolkit | `donalt-smart-money-toolkit` | Trend | price | BigBeluga | most liked |
| 370 | Donchian Reversal Signals with Labels | `donchian-reversal-signals-with-labels` | Channels & Bands | price | Trader-Hitesh | batch 40 |
| 371 | Donchian Trend Ribbon | `donchian-trend-ribbon` | Trend | own | LonesomeTheBlue |  |
| 372 | Dope DPO | `dope-dpo` | Oscillators | own | Sherlock_MacGyver | batch 14 |
| 373 | Double EMA WIth Pullback Buy Sell Signal - Smarter Algo | `double-ema-with-pullback-buy-sell-signal` | Trend | price | hanabil | most liked |
| 374 | Double Median ATR Bands \| MisinkoMaster | `double-median-atr-bands-misinkomaster` | Channels & Bands | price | MisinkoMaster | batch 28 |
| 375 | Double Median SD Bands \| MisinkoMaster | `double-median-sd-bands-misinkomaster` | Channels & Bands | price | MisinkoMaster | batch 30 |
| 376 | Double RSI | `double-rsi` | Momentum | own | Clokivez | batch 9 |
| 377 | Double Top/Bottom - Ultimate (OS) | `double-top-bottom-ultimate` | Trend | price | Trendoscope | most liked |
| 378 | Double Zig Zag with HHLL | `double-zig-zag-with-hhll` | Trend | price | LonesomeTheBlue | most liked |
| 379 | DR/IDR V1 | `dr-idr-v1` | Volatility | price | TheMas7er | most liked |
| 380 | DTFX Algo Zones | `dtfx-algo-zones` | Trend | price | LuxAlgo | most liked |
| 381 | Dual Bayesian For Loop | `dual-bayesian-for-loop` | Momentum | own | QuantAlgo | batch 5 |
| 382 | Dual EMA Trend Ribbon (Multi-Timeframe Trend Confirmation) | `dual-ema-trend-ribbon` | Moving Averages | price | Aleksin_Aleksandar | batch 3 |
| 383 | Dual MA SD Oscillator | `dual-ma-sd-oscillator` | Oscillators | own | SchizoQuant | batch 9 |
| 384 | Dual RSI Smoother | `dual-rsi-smoother` | Oscillators | own | TheUltimator5 | batch 8 |
| 385 | Dynamic Flow Ribbons | `dynamic-flow-ribbons` | Trend | price | BigBeluga | batch 2 |
| 386 | Dynamic Fractal Flow | `dynamic-fractal-flow` | Oscillators | own | AlphaExtract | batch 21 |
| 387 | Dynamic Linear Regression Channels | `dynamic-linear-regression-channels` | Channels & Bands | price | iravan | most liked |
| 388 | Dynamic Liquidity HeatMap Profile | `dynamic-liquidity-heatmap-profile` | Volume | price | BigBeluga | most liked |
| 389 | Dynamic Score PSAR | `dynamic-score-psar` | Trend | own | QuantAlgo | batch 8 |
| 390 | Dynamic Stop Loss & Take Profit | `dynamic-stop-loss-take-profit` | Volatility | price | criptoblast2 | batch 23 |
| 391 | Dynamic Structure Indicator | `dynamic-structure-indicator` | Trend | price |  |  |
| 392 | Dynamic Supply and Demand Zones | `dynamic-supply-and-demand-zones` | Volume | price | AlgoAlpha | most liked |
| 393 | Dynamic Support & Resistance | `dynamic-support-resistance` | Moving Averages | price | ZenAndTheArtOfTrading | batch 1 |
| 394 | Dynamic Swing Anchored VWAP | `dynamic-swing-anchored-vwap` | Volume | price | Zeiierman | most liked |
| 395 | Dynamic Testing | `dynamic-testing` | Oscillators | price | ProfitNomad | batch 9 |
| 396 | Dynamic Trailing | `dynamic-trailing` | Trend | price | Zeiierman | batch 5 |
| 397 | Dynamic Trend Bands | `dynamic-trend-bands` | Channels & Bands | price | ChartPrime | batch 2 |
| 398 | Dynamic Trend Channel (DTC) | `dynamic-trend-channel` | Channels & Bands | price | JohnsonForexTrader | batch 27 |
| 399 | Dynamic Volatility Filter | `dynamic-volatility-filter` | Trend | price | QuantAlgo | batch 4 |
| 400 | Dynamic Volume Clusters with Retest Signals | `dynamic-volume-clusters` | Channels & Bands | price | Zeiierman | batch 2 |
| 401 | Dynamic Volume Profile Oscillator | `dynamic-volume-profile-oscillator` | Volume | own | AlphaNatt | batch 1 |
| 402 | Dynamic VWAP: Fair Value & Divergence Suite | `dynamic-vwap-fair-value-divergence-suite` | Channels & Bands | price | RWCS_LTD | batch 30 |
| 403 | E9 Bollinger Range | `e9-bollinger-range` | Channels & Bands | price | E9XBT | batch 34 |
| 404 | Eagles Compass | `eagles-compass` | Candlestick Patterns | price | zenmarkets | batch 40 |
| 405 | Early MACD Reversal Indicator | `early-macd-reversal-indicator` | Momentum | own | StockSignaler | batch 10 |
| 406 | Early Pivot Alert (price-quantum reversal) • v1a (arrows only) | `early-pivot-alert-v1a` | Trend | price | dirkbiebaut | batch 35 |
| 407 | Easy Entry/Exit Trend Colors | `easy-trend-colors` | Trend | own |  |  |
| 408 | Edward Smart Channel Reversal | `edward-smart-channel-reversal` | Channels & Bands | price | Jos-ProTrader | batch 13 |
| 409 | Effective FVG Indicator - Imran | `effective-fvg-indicator-imran` | Volume | price | imrancrypto | batch 40 |
| 410 | Effective Volume Z-Score | `effective-volume-z-score` | Volume | own | eugencovaci | batch 35 |
| 411 | Efficiency Ratio Trend | `efficiency-ratio-trend` | Trend | price | achirameegasthanne | batch 9 |
| 412 | Ehlers Adaptive RSI | `ehlers-adaptive-rsi` | Oscillators | own | Julien_Exe | batch 14 |
| 413 | Ehlers Adaptive Trend Indicator | `ehlers-adaptive-trend-indicator` | Trend | price | AlphaExtract | batch 18 |
| 414 | Ehlers Instantaneous Trend | `ehlers-instantaneous-trend` | Trend | price |  |  |
| 415 | Ehlers Maclaurin Ultimate Smoother | `ehlers-maclaurin-ultimate-smoother` | Moving Averages | own | Mupsje | batch 33 |
| 416 | Ehlers MESA Adaptive Moving Average | `ehlers-mesa-ma` | Moving Averages | price | Ehlers |  |
| 417 | Ehlers Regime Dynamic Candles | `ehlers-regime-dynamic-candles` | Candlestick Patterns | price | sizzlinsoft | batch 39 |
| 418 | Ehlers Reverse EMA | `ehlers-reverse-ema` | Oscillators | own | AlgoCollective | batch 36 |
| 419 | Ehlers Stochastic CG Oscillator | `ehlers-stochastic-cg` | Oscillators | own |  |  |
| 420 | Elite Oscillator Pro | `elite-oscillator-pro` | Oscillators | own | Alpha_Wizard | batch 34 |
| 421 | Elliot Wave - Impulse | `elliot-wave-impulse` | Trend | price | Trendoscope | most liked |
| 422 | Elliott Impulse Engine | `elliott-impulse-engine` | Trend | price | WillyAlgoTrader | most liked |
| 423 | Elliott Wave | `elliott-wave` | Trend | price | LuxAlgo | most liked |
| 424 | Elliott Wave Oscillator | `elliott-wave-oscillator` | Oscillators | own | Koryu |  |
| 425 | Elliott Wave Oscillator Signals by DGT | `elliott-wave-oscillator-signals-by-dgt` | Oscillators | price | dgtrd | most liked |
| 426 | Elliptic Curve SAR | `elliptic-curve-sar` | Trend | price | TEDCORP2 | batch 26 |
| 427 | EMA & MA Crossover | `ema-ma-crossover` | Moving Averages | price |  |  |
| 428 | EMA & MACD Strategy with SL/TP | `ema-macd-strategy-with-sl-tp` | Trend | price | mamachi- | batch 28 |
| 429 | EMA + RSI Autotrade Webhook - Varun | `ema-rsi-autotrade-webhook-varun` | Moving Averages | price | varuns_back | batch 17 |
| 430 | EMA + SuperTrend | `ema-supertrend` | Moving Averages | price | All_in_Traders |  |
| 431 | EMA + VWMA + ATR Smoothed BuySell (merged) - TOM ZENG 202509 | `ema-vwma-atr-smoothed-buysell-tom-zeng-202509` | Trend | price | zengtom | batch 18 |
| 432 | EMA 20/50/100/200 | `ema-multi` | Moving Averages | price |  |  |
| 433 | EMA 9 / 26 Cross | `ema-9-26-cross` | Moving Averages | price | h0s1m001 | batch 27 |
| 434 | EMA Cloud Trend | `ema-cloud-trend` | Moving Averages | price | ZkalishTR | batch 9 |
| 435 | EMA Cross Signals | `ema-cross-signals` | Moving Averages | price | Jos-ProTrader | batch 29 |
| 436 | EMA Enveloper | `ema-enveloper` | Moving Averages | price |  |  |
| 437 | EMA Oscillator | `ema-oscillator` | Oscillators | own | AlphaExtract | batch 16 |
| 438 | EMA Ribbon | `ema-ribbon` | Moving Averages | price |  |  |
| 439 | EMA Wave Indicator | `ema-wave` | Moving Averages | own |  |  |
| 440 | EMA/RMA clouds by Alpachino | `ema-rma-clouds-by-alpachino` | Moving Averages | price | Alpachino97 | batch 28 |
| 441 | EMA21 Pullback Buy | `ema21-pullback-buy` | Moving Averages | price | Kennedy08 | batch 23 |
| 442 | Emergent Rays - NovaTheMachine | `emergent-rays-novathemachine` | Moving Averages | price | NovaTheMachine | batch 32 |
| 443 | Engulfing + Sweep (Confirmed Only) v6 - bars only | `engulfing-sweep-v6-bars-only` | Candlestick Patterns | price | fanta-grapefruit | batch 38 |
| 444 | Engulfing Candle Indicator | `engulfing-candle-indicator` | Candlestick Patterns | price | The_Forex_Steward | batch 41 |
| 445 | Engulfing Sweeps - Milana Trades | `engulfing-sweeps-milana-trades` | Candlestick Patterns | price | MilanaArsenovna | batch 38 |
| 446 | Enhanced KLSE Banker Flow Oscillator | `enhanced-klse-banker-flow-oscillator` | Oscillators | own | Dr_Leong_Yee_Rock | batch 15 |
| 447 | Enhanced VFI Buyer/Seller Pressure | `enhanced-vfi-buyer-seller-pressure` | Volume | own | ask2maniish | batch 28 |
| 448 | Enhanced VSA Volume & Candle Colors with MA Selection | `enhanced-vsa-volume-candle-colors-with-ma-selection` | Volume | own | ViZiV | batch 27 |
| 449 | Entropy Bands | `entropy-bands` | Channels & Bands | price | TechnoBlooms | batch 20 |
| 450 | Entry / TP / SL Alert Bands (Simple & Stable) | `entry-tp-sl-alert-bands` | Channels & Bands | price | drlicht1 | batch 34 |
| 451 | Entry Points | `entry-points` | Oscillators | price |  |  |
| 452 | Entry Signals (Long/Short) | `entry-signals-long-short` | Trend | price | tradegear9 | batch 1 |
| 453 | Envelope RSI | `envelope-rsi` | Oscillators | price | Saleh_Toodarvari |  |
| 454 | EQH/EQL Liquidity Zones | `eqh-eql-liquidity-zones` | Volume | price | LuxAlgo | most liked |
| 455 | Equalhigh JAPANESE TRIPLE RCI | `equalhigh-japanese-triple-rci` | Oscillators | own | Stevesyl | batch 22 |
| 456 | ERD: Effort-Result Diagnostic | `erd-effort-result-diagnostic` | Channels & Bands | price | DarwinDarma | batch 32 |
| 457 | EREMA Signals | `erema-signals` | Trend | price | AlgoCollective | batch 39 |
| 458 | Euclidean Range | `euclidean-range` | Volatility | own | InvestorUnknown | batch 21 |
| 459 | EURUSD Swing High/Low Projection | `eurusd-swing-high-low-projection` | Channels & Bands | price | tiprolin | batch 37 |
| 460 | Evil MACD Trading System (Pine Script v6) | `evil-macd-trading-system` | Momentum | price | daves723 | batch 37 |
| 461 | Elastic Volume Weighted Moving Average [LazyBear] | `evwma-envelope` | Oscillators | price |  |  |
| 462 | Evasive SuperTrend | `evasive-supertrend` | Trend | price | LuxAlgo | most liked |
| 463 | Exhaustion Zone | `exhaustion-zone` | Channels & Bands | price | rukich | batch 6 |
| 464 | Extrapolated Pivot Connector - Lets Make Support And Resistances | `extrapolated-pivot-connector-lets-make` | Channels & Bands | price | alexgrover | most liked |
| 465 | Extreme Trend Reversal Points | `extreme-trend-reversal-points` | Trend | price | Trendoscope | most liked |
| 466 | Fair value bands / Flowly Indicators | `fair-value-bands-flowly-indicators` | Channels & Bands | price | FlowlyIndicators | most liked |
| 467 | Fair Value Gap | `fair-value-gap-luxalgo` | Trend | price | LuxAlgo | most liked |
| 468 | Fair Value Gap Absorption Indicator | `fair-value-gap-absorption-indicator` | Trend | price | LuxAlgo | most liked |
| 469 | Fair Value Gaps (Volumetric) \| Flux Charts | `fair-value-gaps-flux-charts` | Trend | price | fluxchart | most liked |
| 470 | Fair Value Gaps by DGT | `fair-value-gaps-by-dgt` | Trend | price | dgtrd | most liked |
| 471 | Faith Indicator | `faith-indicator` | Trend | own |  |  |
| 472 | False Breakout (Expo) | `false-breakout` | Channels & Bands | price | Zeiierman |  |
| 473 | Faraz Perfect Structure Scalper + Long Short (Indicator Alerts) | `faraz-perfect-structure-scalper-long-short` | Trend | price | fsaleem03 | batch 29 |
| 474 | Fast Length | `bjorgum-triple-ema` | Moving Averages | price |  |  |
| 475 | Fast WMA | `fast-wma` | Moving Averages | own | Clokivez | batch 25 |
| 476 | Fastlane | `fastlane` | Volume | price | HB5 | batch 40 |
| 477 | Fibo Levels with Volume Profile and Targets | `fibo-levels-with-volume-profile-and-targets` | Volume | price | ChartPrime | most liked |
| 478 | Fibonacci + Support/Resistant + Trendline (Price action) | `fibonacci-support-resistant-trendline` | Trend | price | TrendCrypto2022 | most liked |
| 479 | Fibonacci Auto Trend Scouter | `fibonacci-auto-trend-scouter` | Trend | price | sirkriz | most liked |
| 480 | Fibonacci Bollinger Bands | `fibonacci-bollinger-bands` | Channels & Bands | price | Rashad |  |
| 481 | Fibonacci Confluence Toolkit | `fibonacci-confluence-toolkit` | Trend | price | LuxAlgo | most liked |
| 482 | Fibonacci Entry Bands | `fibonacci-entry-bands` | Trend | price | AlgoAlpha | most liked |
| 483 | Fibonacci Extension / Retracement / Pivot Points by DGT | `fibonacci-extension-retracement-pivot-points` | Trend | price | dgtrd | most liked |
| 484 | Fibonacci HH LL TRAMA Band | `fibonacci-hh-ll-trama-band` | Channels & Bands | price | FibonacciFlux | batch 16 |
| 485 | Fibonacci Levels | `fibonacci-levels` | Channels & Bands | price |  |  |
| 486 | Fibonacci levels MTF | `fibonacci-levels-mtf` | Channels & Bands | price | LonesomeTheBlue | most liked |
| 487 | Fibonacci Moving Averages | `fibonacci-moving-averages` | Moving Averages | price | UkutaLabs | batch 28 |
| 488 | Fibonacci Projection with Volume & Delta Profile | `fibonacci-projection-with-volume-delta-profile` | Volume | price | Zeiierman | most liked |
| 489 | Fibonacci Ranges (Real-Time) | `fibonacci-ranges` | Channels & Bands | price | LuxAlgo | most liked |
| 490 | Fibonacci Structure Engine | `fibonacci-structure-engine` | Trend | price | WillyAlgoTrader | most liked |
| 491 | Fibonacci Time-Price Zones | `fibonacci-time-price-zones` | Trend | price | xxattaxx | most liked |
| 492 | Fibonacci Trend | `fibonacci-trend` | Trend | price | ChartPrime | most liked |
| 493 | Fibonacci Weighted Moving Average | `fibonacci-weighted-moving-average` | Moving Averages | price | everget | batch 12 |
| 494 | Fibonacci Zone | `fibonacci-zone` | Channels & Bands | price |  |  |
| 495 | FibSync - DynamicFibSupport | `fibsync-dynamicfibsupport` | Channels & Bands | price | mr_uponly | batch 34 |
| 496 | Filter Ribbon | `filter-ribbon` | Trend | price | c9indicator | batch 4 |
| 497 | Filter Wave | `filter-wave` | Trend | price | c9indicator | batch 15 |
| 498 | Fisher MPz | `fisher-mpz` | Oscillators | own | B3AR_Trades | batch 30 |
| 499 | Fisher Volume Transform \| AlphaNatt | `fisher-volume-transform-alphanatt` | Oscillators | own | AlphaNatt | batch 16 |
| 500 | Fixed-Range Volume-Profile Zones | `fixed-range-volume-profile-zones` | Volume | own | RWCS_LTD | batch 13 |
| 501 | Flow Control Oscillator (FCO) | `flow-control-oscillator` | Volume | own | WalrusQuant | batch 19 |
| 502 | FlowShift Oscillator | `flowshift-oscillator` | Oscillators | own | BOSWaves | batch 24 |
| 503 | FluidTrades - SMC Lite | `fluidtrades-smc-lite` | Trend | price | Pmgjiv | most liked |
| 504 | Follow Line | `follow-line` | Trend | price | Dreadblitz |  |
| 505 | Footprint IQ Pro | `footprint-iq-pro` | Volume | price | Trading-IQ | most liked |
| 506 | For-Loop Vote Trailing Stop \| MiesOnCharts | `for-loop-vote-trailing-stop-miesoncharts` | Trend | price | MiesOnCharts | batch 31 |
| 507 | Force Pulse | `force-pulse` | Oscillators | own | Uncle_the_shooter | batch 17 |
| 508 | Forecast Oscillator | `forecast-oscillator` | Oscillators | own | KivancOzbilgic |  |
| 509 | Fourier series Model Of The Market | `fourier-series-model-of-the-market` | Oscillators | own | e2e4 | batch 12 |
| 510 | Fractal Exhaustion Band | `fractal-exhaustion-band` | Trend | price | QuantAlgo | batch 2 |
| 511 | Fractal Strength Oscillator | `fractal-strength-oscillator` | Oscillators | own | SurgeQuant | batch 20 |
| 512 | Fractals Trend | `fractals-trend` | Trend | price | BigBeluga | batch 2 |
| 513 | Fractals V9 | `fractals-v9` | Trend | price | RicardoSantos | most liked |
| 514 | Fractional EMA Kalman Filter | `fractional-ema-kalman-filter` | Moving Averages | price | et20tradeview | batch 4 |
| 515 | FSVZO | `fsvzo` | Volume | own | AlphaExtract | batch 5 |
| 516 | Full Candle Higher/Lower (No Repeats) | `full-candle-higher-lower` | Candlestick Patterns | price | devtiqo | batch 41 |
| 517 | Function Savitzky Golay Filter with 7 Vectors V0 | `function-savitzky-golay-filter-with-7-vectors-v0` | Moving Averages | price | RicardoSantos | batch 33 |
| 518 | FuTech V-Spike & V-Highlighter | `futech-v-spike-v-highlighter` | Volume | price | Atmiya_aatubhai | batch 39 |
| 519 | Future Trend Channel | `future-trend-channel` | Channels & Bands | price | ChartPrime | most liked |
| 520 | FVG & IFVG ICT Inversion Fair Value Gap Signal | `fvg-ifvg-ict-inversion-fair-value-gap-signal` | Trend | price | TradingFinder | most liked |
| 521 | FVG Breakout/Breakdown | `fvg-breakout-breakdown` | Trend | price | ICT_Concept_Trading | batch 33 |
| 522 | FVG Candle Highlighter | `fvg-candle-highlighter` | Volatility | price | SmellyTaz | batch 40 |
| 523 | FVG Instantaneous Mitigation Signals | `fvg-instantaneous-mitigation-signals` | Trend | price | LuxAlgo | most liked |
| 524 | FVG Order Blocks | `fvg-order-blocks` | Trend | price | BigBeluga | most liked |
| 525 | FVG Positioning Average | `fvg-positioning-average` | Trend | price | LuxAlgo |  |
| 526 | FVG Sessions | `fvg-sessions` | Trend | price | LuxAlgo | most liked |
| 527 | FX Market Sessions | `fx-market-sessions` | Trend | price | boitoki | most liked |
| 528 | FX Sniper T3-CCI | `fx-sniper-t3-cci` | Oscillators | own |  |  |
| 529 | FXN - Asian Session Range | `fxn-asian-session-range` | Volatility | price | RobMinty | most liked |
| 530 | FXN - Week and Day Separator | `fxn-week-and-day-separator` | Trend | price | RobMinty | most liked |
| 531 | FxShare - CC Reversal | `fxshare-cc-reversal` | Trend | price | FxShareRobots | batch 22 |
| 532 | G-Score \| NAL | `g-score-nal` | Oscillators | own | NordicAlphaLab | batch 13 |
| 533 | Gabriel's Andean Oscillator | `gabriel-s-andean-oscillator` | Trend | own | GabrielAmadeusLau | batch 23 |
| 534 | Gamma + Fibonacci EMA Bands | `gamma-fibonacci-ema-bands` | Moving Averages | price | ky_yule1010 | batch 23 |
| 535 | Gamma Hedging Pressure (Normalized -100 to +100) | `gamma-hedging-pressure` | Momentum | own | uzair2join | batch 20 |
| 536 | Gann High Low | `gann-high-low` | Trend | price | KivancOzbilgic |  |
| 537 | GANN Level (Salil Sir) | `gann-level` | Channels & Bands | price | prabhat76 | batch 12 |
| 538 | Gaps + Imbalances + Wicks (MTF) - By Leviathan | `gaps-imbalances-wicks-by-leviathan` | Trend | price | LeviathanCapital | most liked |
| 539 | Gaussian Acceleration Array | `gaussian-acceleration-array` | Momentum | own | NantzOS | batch 36 |
| 540 | Gaussian Filter Trend | `gaussian-filter-trend` | Trend | price | QuantAlgo | batch 2 |
| 541 | Gaussian Ribbon | `gaussian-ribbon` | Moving Averages | price | NantzOS | batch 13 |
| 542 | Gaussian RSI \| NAL | `gaussian-rsi-nal` | Momentum | own | NordicAlphaLab | batch 7 |
| 543 | GBR Micro Kernel Trend | `gbr-micro-kernel-trend` | Moving Averages | price | THEGBR | batch 36 |
| 544 | Gho$t EMA Cloud | `gho-t-ema-cloud` | Moving Averages | price | Ghostmlt | batch 29 |
| 545 | Ghost Tangent Crossings | `ghost-tangent-crossings` | Trend | price | ChartPrime | most liked |
| 546 | Gideons Gold - ADX Watchman | `gideons-gold-adx-watchman` | Trend | own | gideonsgold | batch 34 |
| 547 | Global (World) Monetary Supply M2 (measured in USD) | `global-monetary-supply-m2` | Trend | own | miguefinance | most liked |
| 548 | Global Liquidity Index | `global-liquidity-index` | Trend | price | QuantitativeAlpha | most liked |
| 549 | GMMA | `gmma-daisuke-gewinn` | Moving Averages | price | daisuke_gewinn | most liked |
| 550 | GMMA Oscillator | `gmma-oscillator` | Trend | own |  |  |
| 551 | Godmode 4.0.2 | `godmode-4-0-2` | Channels & Bands | price | chrysopoetics | most liked |
| 552 | Gold Trend Signal Indicator | `gold-trend-signal-indicator` | Trend | price | CsmillrSirrry | batch 33 |
| 553 | Golden & Death Cross with Re-Activation | `golden-death-cross-with-re-activation` | Moving Averages | price | oberlunar_tr | batch 26 |
| 554 | Golden Ratio Trend Persistence | `golden-ratio-trend-persistence` | Trend | price | YetAnotherTA | batch 9 |
| 555 | Golden/Death Cross Highlighter | `golden-death-cross-highlighter` | Moving Averages | price | dripvesting | batch 36 |
| 556 | Gorgo's Hybrid Oscillator STrategy | `gorgo-s-hybrid-oscillator-strategy` | Oscillators | own | Gorgomannaro | batch 32 |
| 557 | Gradient Trend Filter | `gradient-trend-filter` | Trend | price | ChartPrime | batch 1 |
| 558 | Granville Entry Guide | `granville-entry-guide` | Moving Averages | price | fightpm | batch 17 |
| 559 | Gravity Well Trend \| Lyro RS | `gravity-well-trend-lyro-rs` | Trend | price | LyroRS | batch 10 |
| 560 | Grid Bot Simulator | `grid-bot-simulator` | Channels & Bands | price | xxattaxx | most liked |
| 561 | Gridbot Ping Pong | `gridbot-ping-pong` | Channels & Bands | price | xxattaxx | batch 18 |
| 562 | Guppy MMA | `guppy-mma` | Moving Averages | own | AlphaExtract | batch 15 |
| 563 | Guppy Multiple Moving Average | `gmma` | Moving Averages | price | Daryl Guppy |  |
| 564 | Guppy Oscillator-REvans993 | `guppy-oscillator-revans993` | Oscillators | own | REvans993 | batch 36 |
| 565 | Guppy Wave | `guppy-wave` | Moving Averages | price | UkutaLabs | batch 25 |
| 566 | GWAP (Gamma Weighted Average Price) | `gwap` | Moving Averages | price | EdgeTools | batch 18 |
| 567 | H-Infinity Volatility Filter | `h-infinity-volatility-filter` | Trend | price | QuantAlgo | batch 7 |
| 568 | HalfTrend | `half-trend` | Trend | price | everget |  |
| 569 | HalfTrend Long/Short Signal Engine | `halftrend-long-short-signal-engine` | Trend | price | BigBeluga | most liked |
| 570 | HaP MACD | `hap-macd` | Momentum | own | agahakanaga | batch 1 |
| 571 | Harmonic Pattern Detection | `harmonic-pattern-detection` | Trend | price | LuxAlgo | most liked |
| 572 | Harmonic Pattern Detection, Prediction, and Backtesting Tool | `harmonic-pattern-detection-prediction-and` | Trend | price | reees | most liked |
| 573 | Harmonic Periodicity Matrix | `harmonic-periodicity-matrix` | Oscillators | own | Pineify | batch 29 |
| 574 | Harmonic Sniper Trigger - PyraTime | `harmonic-sniper-trigger-pyratime` | Oscillators | own | PyraTime | batch 27 |
| 575 | HARSI+CBC | `harsi-cbc` | Oscillators | own | mehmetbezgincan | batch 34 |
| 576 | Hash Ribbons | `hash-ribbons` | Moving Averages | own | capriole_charles | most liked |
| 577 | HawkEye Volume | `hawkeye-volume` | Volume | own |  |  |
| 578 | Heatmap Volume | `heatmap-volume` | Volume | own | xdecow |  |
| 579 | Heiken Ashi Candles | `heiken-ashi-candles` | Trend | price | CryptoRox | most liked |
| 580 | Heiken Ashi Ribbon | `heiken-ashi-ribbon` | Trend | price | UkutaLabs | batch 21 |
| 581 | Heikin Ashi Colored Regular OHLC Candles | `heikin-ashi-colored-regular-ohlc-candles` | Candlestick Patterns | price | LuxmiAI | batch 40 |
| 582 | Heikin Ashi Doji with High Volume | `heikin-ashi-doji-with-high-volume` | Candlestick Patterns | price | nwfjf6m8 | batch 42 |
| 583 | Heikin Ashi RSI Oscillator | `heikin-ashi-rsi-oscillator` | Momentum | own | JayRogers |  |
| 584 | Heikin Line - TB365 | `heikin-line-tb365` | Moving Averages | price | tradebot_365 | batch 32 |
| 585 | Heikin-Ashi Reversals with Region & Dots | `heikin-ashi-reversals-with-region-dots` | Candlestick Patterns | price | theRhinoSlayer | batch 42 |
| 586 | HEMA Trend Levels | `hema-trend-levels` | Trend | price | AlgoAlpha |  |
| 587 | Henderson Weighted Moving Average | `henderson-weighted-moving-average` | Moving Averages | price | everget | batch 30 |
| 588 | High For Loop \| MisinkoMaster | `high-for-loop-misinkomaster` | Trend | own | MisinkoMaster | batch 37 |
| 589 | High Probability Order Blocks | `high-probability-order-blocks` | Trend | price | AlgoAlpha | most liked |
| 590 | High Volume Arrow Signals (Ajustável) | `high-volume-arrow-signals` | Volume | price | IdeManson | batch 24 |
| 591 | High Volume Buyers/Sellers+ | `high-volume-buyers-sellers` | Volume | price | avitawill | batch 40 |
| 592 | High Volume Points | `high-volume-points` | Volume | price | BigBeluga | most liked |
| 593 | High-Low of X Bar | `high-low-of-x-bar` | Volatility | own | sam-austin | batch 29 |
| 594 | Higher High Lower Low Strategy (With Source Code) | `higher-high-lower-low-strategy` | Trend | price | LonesomeTheBlue | most liked |
| 595 | Higher order Orderblocks + Breakerblocks + Range + Alerts | `higher-order-orderblocks-breakerblocks-range` | Trend | price |  | most liked |
| 596 | Higher Time Frame Support/Resistance | `higher-time-frame-support-resistance` | Channels & Bands | price | BigBeluga | most liked |
| 597 | Higher Timeframe High & Low | `higher-timeframe-high-low` | Channels & Bands | price | ChartPrime | most liked |
| 598 | Hilega-Milega-RSI-EMA-WMA indicator designed by NK | `hilega-milega-rsi-ema-wma-indicator-designed-by-nk` | Oscillators | own | kshirsagar_n | batch 14 |
| 599 | Historical Liquidity Proximity Heatmap | `liquidity-proximity-heatmap` | Volume | price | LuxAlgo | batch 3 |
| 600 | HMA Breakdown | `hma-breakdown` | Moving Averages | price | NonLinearRookie | batch 11 |
| 601 | Horns Pattern Identifier | `horns-pattern-identifier` | Trend | price | LuxAlgo | most liked |
| 602 | HOTT LOTT | `hott-lott` | Trend | price | KivancOzbilgic |  |
| 603 | Hourly Trading System | `hourly-trading-system` | Trend | price | Zeiierman | most liked |
| 604 | HPDR Bands Indicator | `hpdr-bands-indicator` | Channels & Bands | price | afonso_77 | batch 23 |
| 605 | HTC peppermint_07 CCI w signal + s&r RSI | `htc-peppermint-07-cci-w-signal-s-r-rsi` | Oscillators | own | peppermint07 | batch 14 |
| 606 | HTF Candle Profile | `htf-candle-profile` | Volume | price | ChartPrime | most liked |
| 607 | HTF Candles & Mini Charts by DGT | `htf-candles-mini-charts-by-dgt` | Trend | price | dgtrd | most liked |
| 608 | HTF Liquidity Levels | `htf-liquidity-levels` | Channels & Bands | price | sbtnc | most liked |
| 609 | HTF Reversal Divergences | `htf-reversal-divergences` | Oscillators | own | LuxAlgo | most liked |
| 610 | HTH - WD Gann Square Root Levels | `hth-wd-gann-square-root-levels` | Channels & Bands | price | tamillselvan | batch 27 |
| 611 | Hull Butterfly Oscillator | `hull-butterfly-oscillator` | Momentum | own |  |  |
| 612 | Hull Suite | `hull-suite` | Trend | price |  |  |
| 613 | Hunters Reversal v2.3 | `hunters-reversal-v2-3` | Trend | price | d_jaeger | batch 33 |
| 614 | Hurst-Based Trend Persistence w/Poisson Prediction | `hurst-based-trend-persistence-w-poisson-prediction` | Oscillators | own | garysebastianbrowniii | batch 28 |
| 615 | HyperTrend [LuxAlgo] | `hyper-trend` | Trend | price | LuxAlgo |  |
| 616 | Ichimoku | `ichimoku-hpotter` | Trend | price |  | most liked |
| 617 | Ichimoku ACE Club | `ichimoku-ace-club` | Trend | price | binhmyco | batch 26 |
| 618 | Ichimoku EMA Bands | `ichimoku-ema-bands` | Channels & Bands | price |  |  |
| 619 | Ichimoku Kinko Hyo | `ichimoku-kinko-hyo` | Trend | price | insideandup | batch 32 |
| 620 | Ichimoku Kinkō hyō 目均衡表 | `ichimoku-kink-hy` | Trend | price | RickSimpson | most liked |
| 621 | Ichimoku Score Indicator | `ichimoku-score-indicator` | Trend | own | tanayroy | batch 29 |
| 622 | Ichimoku Theories | `ichimoku-theories` | Trend | price | LuxAlgo | most liked |
| 623 | Ichimoku w/Heikin-Ashi | `ichimoku-w-heikin-ashi` | Trend | price | yasujiy | batch 25 |
| 624 | ICT & RTM Price Action Indicator | `ict-rtm-price-action-indicator` | Channels & Bands | price | behradmojtahedi | batch 21 |
| 625 | ICT Algorithmic Macro Tracker° (Open-Source) by toodegrees | `ict-algorithmic-macro-tracker-by-toodegrees` | Trend | price | toodegrees | most liked |
| 626 | ICT Anchored Market Structures with Validation | `ict-anchored-market-structures-with-validation` | Trend | price | LuxAlgo | most liked |
| 627 | ICT Auto-Validated SMC | `ict-auto-validated-smc` | Trend | price | GoodBadBitcoin | most liked |
| 628 | ICT Concept Order Block \| FVG \| Liquidity Sweeps | `ict-concept-order-block-fvg-liquidity-sweeps` | Trend | price | TradingFinder | most liked |
| 629 | ICT Concepts | `ict-concepts` | Trend | price | LuxAlgo | most liked |
| 630 | ICT Everything | `ict-everything` | Trend | price | coldbrewrosh | most liked |
| 631 | ICT FVG Buy/Sell Signals | `ict-fvg-buy-sell-signals` | Trend | price | svmstellarvisionmedia | batch 5 |
| 632 | ICT HTF Candles (fadi) | `ict-htf-candles` | Trend | price | fadizeidan | most liked |
| 633 | ICT Immediate Rebalance Toolkit | `ict-immediate-rebalance-toolkit` | Trend | price | LuxAlgo | most liked |
| 634 | ICT Implied Fair Value Gap (IFVG) | `ict-implied-fair-value-gap` | Trend | price | LuxAlgo | most liked |
| 635 | ICT Institutional Order Flow (fadi) | `ict-institutional-order-flow` | Trend | price | fadizeidan | most liked |
| 636 | ICT Killzones | `ict-killzones` | Trend | price | LuxAlgo | most liked |
| 637 | ICT Killzones + Pivots | `ict-killzones-pivots-tfo` | Trend | price | tradeforopp | most liked |
| 638 | ICT Killzones Toolkit | `ict-killzones-toolkit` | Trend | price | LuxAlgo | most liked |
| 639 | ICT Liquidity Sweep/Swing Fail Pattern V.1 | `ict-liquidity-sweep-swing-fail-pattern-v-1` | Trend | price | wut_trader | most liked |
| 640 | ICT Macros | `ict-macros` | Trend | price | LuxAlgo | most liked |
| 641 | ICT Power Of Three \| Flux Charts | `ict-power-of-three-flux-charts` | Trend | price | fluxchart | most liked |
| 642 | ICT Seek & Destroy Profile | `ict-seek-destroy-profile` | Volatility | price | tradeforopp | most liked |
| 643 | ICT Sessions | `ict-sessions` | Channels & Bands | price | leonsholo | most liked |
| 644 | ICT Silver Bullet | `ict-silver-bullet` | Trend | price | LuxAlgo | most liked |
| 645 | ICT Turtle Soup \| Flux Charts | `ict-turtle-soup-flux-charts` | Trend | price | fluxchart | most liked |
| 646 | ICT Unicorn \| Flux Charts | `ict-unicorn-flux-charts` | Trend | price | fluxchart | most liked |
| 647 | ICT Unicorn Model | `ict-unicorn-model` | Trend | price | LuxAlgo | most liked |
| 648 | ICT Venom Trading Model SMC NY Session 2025Setup | `ict-venom-trading-model-smc-ny-session` | Trend | price | TradingFinder | most liked |
| 649 | IFVG Sniper Entry Engine | `ifvg-sniper-entry-engine` | Trend | price | tradewsamet | most liked |
| 650 | IIR One-Pole Price Filter | `iir-one-pole-price-filter` | Moving Averages | price | BackQuant | batch 9 |
| 651 | Imbalance Detector | `imbalance-detector` | Trend | price | LuxAlgo | most liked |
| 652 | Impulse MACD | `impulse-macd` | Momentum | own | LazyBear |  |
| 653 | Indicador Millo SMA20-SMA200-AO-RSI M1 | `indicador-millo-sma20-sma200-ao-rsi-m1` | Moving Averages | price | hernangarcia_78 | batch 19 |
| 654 | Indicator: Elder Impulse System | `indicator-elder-impulse-system` | Momentum | own | LazyBear | most liked |
| 655 | Indicator: ElliotWave Oscillator | `elliott-wave-oscillator-lazybear` | Oscillators | own | LazyBear | most liked |
| 656 | Indicator: OBV Oscillator | `obv-oscillator-lazybear` | Volume | own | LazyBear | most liked |
| 657 | Indicator: WaveTrend Oscillator | `wavetrend-oscillator-wt` | Oscillators | own | LazyBear | most liked |
| 658 | Indicator: Weis Wave Volume | `weis-wave-volume-lazybear` | Volume | own | LazyBear | most liked |
| 659 | Indicators: Volume-Weighted MACD Histogram & Sentiment Zone Osc | `indicators-volume-weighted-macd-histogram` | Momentum | own | LazyBear | most liked |
| 660 | Infinite EMA with Alpha Control | `infinite-ema-with-alpha-control` | Moving Averages | price | Sesilya | batch 13 |
| 661 | Initial Balance Breakout Signals | `initial-balance-breakout-signals` | Volatility | price | LuxAlgo | most liked |
| 662 | Inside / Outside Bars | `inside-outside-bars` | Candlestick Patterns | price | Iggy- | batch 42 |
| 663 | Inside Bar (Body-based) Ind/Alert | `inside-bar-ind-alert` | Candlestick Patterns | price | s_b_j | batch 40 |
| 664 | Inside Bar Coloring (Real-time + Historical) w/ Alerts | `inside-bar-coloring-w-alerts` | Candlestick Patterns | price | SpinTrades | batch 42 |
| 665 | Inside Bars (Multiple / Consecutive) | `inside-bars` | Channels & Bands | price | nilstrades_ | batch 5 |
| 666 | Instantaneous Trendline with Cloud | `instantaneous-trendline-with-cloud` | Trend | price | Sesilya | batch 22 |
| 667 | Institutional Composite Moving Average (ICMA) | `institutional-composite-moving-average` | Moving Averages | price | VolumeVigilante | batch 6 |
| 668 | Institutional MACD (Z-Score Edition) | `institutional-macd` | Momentum | own | VolumeVigilante | batch 4 |
| 669 | Institutional Order Flow Strength Classifier | `institutional-order-flow-strength-classifier` | Volume | price | LuxAlgo | most liked |
| 670 | Institutional OrderBlock Pressure | `institutional-orderblock-pressure` | Trend | price | RickSimpson | most liked |
| 671 | Institutional Volume RSI | `institutional-volume-rsi` | Momentum | own | abgthecoder | batch 6 |
| 672 | Internal Candle Strength | `internal-candle-strength` | Volatility | price | LuxAlgo | most liked |
| 673 | Interpolated Median Volatility LSMA \| Otto | `interpolated-median-volatility-lsma-otto` | Channels & Bands | price | oquant | batch 12 |
| 674 | Intraday BUY_SELL | `intraday-buy-sell` | Trend | price |  |  |
| 675 | Intraday TS BB | `intraday-ts-bb` | Oscillators | price |  |  |
| 676 | Intraday Volume Swings | `intraday-volume-swings` | Volume | price | rumpypumpydumpy |  |
| 677 | Intraday vs Overnight Change Tracker | `intraday-vs-overnight-change-tracker` | Momentum | own | TheUltimator5 | batch 12 |
| 678 | Intraday vs Overnight OBV | `intraday-vs-overnight-obv` | Volume | own | TheUltimator5 | batch 21 |
| 679 | Inverse Distance Weighted Moving Average | `inverse-distance-weighted-moving-average` | Moving Averages | price | everget | batch 15 |
| 680 | Inverse Fisher Transform COMBO | `ift-stoch-rsi-cci` | Momentum | own | KivancOzbilgic (creator John Ehlers) | most liked |
| 681 | Inverse FVG with Rejections | `inverse-fvg-with-rejections` | Trend | price | tradeforopp | most liked |
| 682 | Inversion Fair Value Gaps (IFVG) | `inversion-fair-value-gaps` | Trend | price | LuxAlgo | most liked |
| 683 | IPO Date Screener | `ipo-date-screener` | Oscillators | own | starshiptrade | batch 14 |
| 684 | Is it Time for a Pullback? Check Bars Since MA Test | `is-it-time-for-a-pullback-check-bars-since-ma-test` | Trend | own | TradeStation | batch 25 |
| 685 | Isolated Peak and Bottom | `isolated-peak-bottom` | Oscillators | price |  |  |
| 686 | ITG Scalper | `itg-scalper` | Trend | price | Complector | most liked |
| 687 | IU Mean Reversion System | `iu-mean-reversion-system` | Channels & Bands | price | Shivam_Mandrai | batch 12 |
| 688 | IU Smart Flow System | `iu-smart-flow-system` | Trend | price | Shivam_Mandrai | batch 7 |
| 689 | IV Rank (tasty-style) - VIXFix / HV Proxy | `iv-rank-vixfix-hv-proxy` | Volatility | own | steveoptionstrade2025 | batch 30 |
| 690 | John Wick Doji indicator | `john-wick-doji-indicator` | Candlestick Patterns | price | Nossgrr | batch 42 |
| 691 | JOPA Channel (Dual-Volumed) v1 | `jopa-channel-v1` | Channels & Bands | price | JopAlgo | batch 30 |
| 692 | Jurik Moving Average | `jurik-moving-average` | Moving Averages | price | everget | batch 1 |
| 693 | Kalman Ema Crosses | `kalman-ema-crosses` | Moving Averages | price | JTCapitalNL | batch 16 |
| 694 | Kalman Exponentialy Weighted Moving Average \| MisinkoMaster | `kalman-exponentialy-weighted-moving-average-misinkomaster` | Moving Averages | price | MisinkoMaster | batch 25 |
| 695 | Kalman Filter Trend Breakers | `kalman-filter-trend-breakers` | Trend | price | kypexin | batch 29 |
| 696 | Kalman Flow \| Lyro RS | `kalman-flow-lyro-rs` | Trend | price | LyroRS | batch 5 |
| 697 | Kalman Hull Bands For Loop \| RakoQuant | `kalman-hull-bands-for-loop-rakoquant` | Channels & Bands | price | RakoQuant | batch 17 |
| 698 | Kalman Hull Kijun | `kalman-hull-kijun` | Trend | price | BackQuant | batch 12 |
| 699 | Kalman Trend Levels | `kalman-trend-levels` | Trend | price | BigBeluga | most liked |
| 700 | Kalman VWAP Filter | `kalman-vwap-filter` | Moving Averages | price | BackQuant | batch 4 |
| 701 | Kaufman Adaptive Moving Average | `kaufman-adaptive-ma` | Moving Averages | price | everget |  |
| 702 | Kaufman Trend Strength Signal | `kaufman-trend-strength-signal` | Trend | price | PakunFX | batch 34 |
| 703 | KD-NewAutoTrade for Future Trading - Heikin Ashi candles | `kd-newautotrade-for-future-trading-heikin-ashi-candles` | Trend | price | krish16887 | batch 22 |
| 704 | KDJ | `kdj` | Oscillators | own | KingThies |  |
| 705 | KDJ Indicator - @iamaltcoin | `kdj-indicator-iamaltcoin` | Oscillators | own | iamaltcoin | most liked |
| 706 | Keltner-Aroon-EFI Flow | `keltner-aroon-efi-flow` | Trend | price | D_QUANT | batch 20 |
| 707 | Kernel Channel | `kernel-channel` | Channels & Bands | price | BackQuant | batch 6 |
| 708 | KERPD Noise Filter - Kaufman Efficiency Ratio and Price Density | `kerpd-noise-filter-kaufman-efficiency-ratio-and-price-density` | Volatility | own | SensitiveSuit | batch 15 |
| 709 | Key Levels SpacemanBTC IDWM | `key-levels-spacemanbtc-idwm` | Trend | price | spacemanbtc | most liked |
| 710 | Key_TDI | `key-tdi` | Oscillators | own | Fibonacci_Code | batch 31 |
| 711 | Keyzone | `keyzone` | Channels & Bands | price | Uttaya | batch 28 |
| 712 | Kijun-Sen with Buy / Sell Labels & Alerts - Ichimoku simplified | `kijun-sen-with-buy-sell-labels-alerts-ichimoku-simplified` | Trend | price | TaureaYinYang | batch 36 |
| 713 | Kinetic Slippage Index (KSI) | `kinetic-slippage-index` | Volume | own | HPotter | batch 7 |
| 714 | Kiss Of Death | `kiss-of-death` | Trend | price | thanos300693 | batch 37 |
| 715 | kNN Market Architecture | `knn-market-architecture` | Trend | price | LuxAlgo | most liked |
| 716 | L1 Moving Average Fingerprint for Long Entry | `l1-moving-average-fingerprint-for-long-entry` | Trend | price | blackcat1402 | batch 40 |
| 717 | L2 Risk Assessment for Trend Strength | `l2-risk-assessment-for-trend-strength` | Trend | own | blackcat1402 | batch 14 |
| 718 | Ladder StDev | `ladder-stdev` | Volatility | own | jason5480 | batch 30 |
| 719 | Laguerre Filter | `laguerre-filter` | Moving Averages | price | BackQuant | batch 5 |
| 720 | Laguerre RSI | `laguerre-rsi` | Momentum | own | TheLark |  |
| 721 | Laguerre Ultimate Explorations Multicator | `laguerre-ultimate-explorations-multicator` | Moving Averages | own | ImmortalFreedom | batch 20 |
| 722 | Laguerre-Kalman Adaptive Filter \| AlphaNatt | `laguerre-kalman-adaptive-filter-alphanatt` | Moving Averages | price | AlphaNatt | batch 11 |
| 723 | [imba]lance algo | `lance-algo` | Trend | price | IMBA_TRADER | most liked |
| 724 | Left Bars | `pivot-hh-hl-lh-ll` | Trend | price |  |  |
| 725 | Leledc Levels | `leledc-levels` | Candlestick Patterns | price |  |  |
| 726 | Length | `gaussian-channel` | Channels & Bands | price |  |  |
| 727 | Length | `redk-vader` | Oscillators | own | RedKTrader |  |
| 728 | Length | `zlma-trend-levels` | Moving Averages | price |  |  |
| 729 | Level2 Signalfilter Liquidity Protection | `level2-signalfilter-liquidity-protection` | Trend | own | djmad | batch 16 |
| 730 | Leveraged Liquidation Zones | `leveraged-liquidation-zones` | Channels & Bands | price | Fussion_Trader | batch 35 |
| 731 | LGMM (flat buffers) - multivariate poly + latent states | `lgmm-multivariate-poly-latent-states` | Channels & Bands | price | vsov | batch 28 |
| 732 | Linear Predictive Filters (TASC 2025.01) | `linear-predictive-filters` | Oscillators | own | PineCodersTASC | batch 2 |
| 733 | Linear Regression ++ | `linear-regression` | Channels & Bands | price | DevLucem | most liked |
| 734 | Linear Regression Blend Candles | `linear-regression-blend-candles` | Candlestick Patterns | price | B3AR_Trades | batch 39 |
| 735 | Linear Regression Candles | `linear-regression-candles` | Candlestick Patterns | price |  |  |
| 736 | Linear Regression Channel | `linear-regression-channel` | Channels & Bands | price |  |  |
| 737 | Linear Regression Channel / Curve / Slope by DGT | `linear-regression-channel-curve-slope-by-dgt` | Channels & Bands | price | dgtrd | most liked |
| 738 | Linear Regression Oscillator | `linear-regression-oscillator` | Oscillators | own | ChartPrime | most liked |
| 739 | Linear Regression Volume \| Lyro RS | `linear-regression-volume-lyro-rs` | Channels & Bands | price | LyroRS | batch 10 |
| 740 | Linear Volume MACD \| Lyro RS | `linear-volume-macd-lyro-rs` | Momentum | own | LyroRS | batch 9 |
| 741 | LineReg Candles with Hma filter | `linereg-candles-with-hma-filter` | Trend | price | MaximusGains | batch 14 |
| 742 | Liqudation HeatMap | `liqudation-heatmap` | Volume | price | BigBeluga | most liked |
| 743 | Liquidation Levels | `liquidation-levels` | Volume | price | LuxAlgo | most liked |
| 744 | Liquidation Reversal Signals | `liquidation-reversal-signals` | Volume | price | AlgoAlpha | most liked |
| 745 | Liquidations Zones | `liquidations-zones` | Volume | price | ChartPrime | most liked |
| 746 | Liquidity Delta Profiler | `liquidity-delta-profiler` | Volume | price | LuxAlgo | most liked |
| 747 | Liquidity Entry Zones | `liquidity-entry-zones` | Trend | price | tradewsamet | most liked |
| 748 | Liquidity Flow Zones (LFZ) | `liquidity-flow-zones` | Trend | price | ReubenMiles | batch 20 |
| 749 | Liquidity Grab Zones \| Flux Charts | `liquidity-grab-zones-flux-charts` | Volume | price | fluxchart | most liked |
| 750 | Liquidity Grabs | `liquidity-grabs` | Trend | price | fluxchart |  |
| 751 | Liquidity Heatmap | `liquidity-heatmap` | Volume | price | Nephew_Sam_ | most liked |
| 752 | Liquidity Indicator | `liquidity-indicator` | Channels & Bands | price | The_Forex_Steward | batch 22 |
| 753 | Liquidity Levels [LuxAlgo] | `liquidity-levels` | Trend | price | LuxAlgo |  |
| 754 | Liquidity Levels MTF - Sonarlab | `liquidity-levels-mtf-sonarlab` | Trend | price | vuetratrading | most liked |
| 755 | Liquidity Location Detector | `liquidity-location-detector` | Volume | price | BigBeluga | most liked |
| 756 | Liquidity Pools | `liquidity-pools` | Trend | price | LuxAlgo | most liked |
| 757 | Liquidity Pools Pro | `liquidity-pools-pro` | Trend | price | WillyAlgoTrader | most liked |
| 758 | Liquidity Price Depth Chart | `liquidity-price-depth-chart` | Volume | price | LuxAlgo | most liked |
| 759 | Liquidity Sentiment Profile \| LUPEN | `liquidity-sentiment-profile-lupen` | Volume | own | Horazio | batch 20 |
| 760 | Liquidity Sniper Pro | `liquidity-sniper-pro` | Trend | price | VenusJ | most liked |
| 761 | Liquidity Spectrum Visualizer | `liquidity-spectrum-visualizer` | Volume | price | BigBeluga | most liked |
| 762 | Liquidity Structure & Order Flow | `liquidity-structure-order-flow` | Volume | price | LuxAlgo | most liked |
| 763 | Liquidity Sweep Confirmation | `liquidity-sweep-confirmation` | Trend | price | filipiti | batch 38 |
| 764 | Liquidity Sweep Filter | `liquidity-sweep-filter` | Trend | price | AlgoAlpha | most liked |
| 765 | Liquidity Sweep Hunter Algo | `liquidity-sweep-hunter-algo` | Volume | price | AlgoAlpha | most liked |
| 766 | Liquidity Sweeps [LuxAlgo] | `liquidity-sweeps` | Trend | price |  |  |
| 767 | Liquidity Swings | `liquidity-swings` | Volume | price | LuxAlgo | most liked |
| 768 | Liquidity Thermal Map | `liquidity-thermal-map` | Volume | price | BigBeluga | most liked |
| 769 | Liquidity Trap & Reversal bot | `liquidity-trap-reversal-bot` | Channels & Bands | price | pointalgo | batch 28 |
| 770 | Liquidity Trendline With Signals | `liquidity-trendline-with-signals` | Trend | price | BigBeluga | most liked |
| 771 | Liquidity Voids (FVG) | `liquidity-voids` | Volatility | price | LuxAlgo | most liked |
| 772 | Liquidity Zones | `liquidity-zones` | Volume | price | BigBeluga | most liked |
| 773 | Loacally Weighted MA (LWMA) Direction Histogram | `loacally-weighted-ma-direction-histogram` | Trend | own | LuxmiAI | batch 9 |
| 774 | Logarithmic Regression Channel-Trend | `logarithmic-regression-channel-trend` | Trend | price | BigBeluga | most liked |
| 775 | Logistic RSI, STOCH, ROC, AO, ... by DGT | `logistic-rsi-stoch-roc-ao-by-dgt` | Oscillators | own | dgtrd | most liked |
| 776 | Logit RSI | `logit-rsi` | Oscillators | own | AdaptiveRSI | batch 11 |
| 777 | Long Short dom | `long-short-dom` | Trend | own | Robin-Hood-trading | batch 11 |
| 778 | Lorentzian Length Adaptive Moving Average | `lorentzian-length-adaptive-moving-average` | Moving Averages | price | Starcruiser | batch 21 |
| 779 | LOWESS (Locally Weighted Scatterplot Smoothing) | `lowess` | Moving Averages | price | ChartPrime | most liked |
| 780 | Lumina Trend Channels | `lumina-trend-channels` | Channels & Bands | price | Pineify | batch 10 |
| 781 | Luminous Mean Reversion Channels | `luminous-mean-reversion-channels` | Channels & Bands | price | Pineify | batch 7 |
| 782 | Lunar Phase (LUNAR) | `lunar-phase` | Oscillators | own | mihakralj | batch 23 |
| 783 | Luxy BIG beautiful Dynamic ORB | `luxy-big-beautiful-dynamic-orb` | Channels & Bands | price | orenluxy | most liked |
| 784 | MA Cross with Displacement | `ma-cross-with-displacement` | Moving Averages | price | TehThomas | batch 25 |
| 785 | MA Ribbon 5EMA \| 20EMA \| 50SMA \| 200EMA | `ma-ribbon-5ema-20ema-50sma-200ema` | Moving Averages | price | vamsinelluri7 | batch 29 |
| 786 | MA Sabres | `ma-sabres` | Moving Averages | price | LuxAlgo | most liked |
| 787 | MA Shaded Fill Crossover | `ma-shaded-fill` | Moving Averages | price |  |  |
| 788 | MA Strategy Emperor | `ma-strategy-emperor` | Trend | price | insiliconot |  |
| 789 | MA Type | `madrid-ma-ribbon` | Moving Averages | price |  |  |
| 790 | MA Zones | `ma-zones` | Moving Averages | price | ZenAndTheArtOfTrading | batch 7 |
| 791 | MACD & RSI Overlay (Expo) | `macd-rsi-overlay` | Momentum | price | Zeiierman | most liked |
| 792 | MACD (Buy & Sell signals) | `macd-irtov` | Momentum | own | irtov | batch 24 |
| 793 | Macd + Adx Pro by @Eternyworld | `macd-adx-pro-by-eternyworld` | Momentum | own | ETERNYWORLD | batch 26 |
| 794 | MACD 4C | `macd-4c` | Momentum | own | vkno422 |  |
| 795 | MACD Based Price Forecasting | `macd-based-price-forecasting` | Momentum | price | LuxAlgo | most liked |
| 796 | MACD Crossover | `macd-crossover` | Momentum | own |  |  |
| 797 | MacD Custom Indicator-Multiple Time Frame+All Available Options! | `cm-macd-custom-mtf` | Momentum | own | ChrisMoody | most liked |
| 798 | MACD DEMA | `macd-dema` | Momentum | own |  |  |
| 799 | MACD Divergence | `macd-divergence` | Momentum | own |  |  |
| 800 | MACD Dynamic Squeeze Pro | `macd-dynamic-squeeze-pro` | Momentum | own | ZynAlgo | batch 24 |
| 801 | MACD Leader | `macd-leader` | Momentum | own | LazyBear |  |
| 802 | MACD Liquidity Tracker System | `macd-liquidity-tracker-system` | Momentum | own | PROFABIGHI_CAPITAL | batch 29 |
| 803 | MACD Overlay v1 | `macd-overlay-v1` | Momentum | price | JopAlgo | batch 5 |
| 804 | MACD Pro | `macd-pro` | Momentum | own | VEGAlgo | batch 23 |
| 805 | MACD Pseudo Super Smoother | `macd-pseudo-super-smoother` | Oscillators | own | The_Peaceful_Lizard | batch 37 |
| 806 | MACD ReLoaded | `macd-reloaded` | Momentum | own | KivancOzbilgic |  |
| 807 | MACD Sniper | `macd-sniper` | Momentum | own | trade_lexx | batch 15 |
| 808 | MACD Support and Resistance [ChartPrime] | `macd-support-resistance` | Momentum | own | ChartPrime |  |
| 809 | MACD VXI | `macd-vxi` | Momentum | own |  |  |
| 810 | MACD With Crossings and Above Below Zero | `macd-with-crossings-and-above-below-zero` | Momentum | own | Kgroomes | batch 18 |
| 811 | MACD x BB x STDEV x RVI | `macd-x-bb-x-stdev-x-rvi` | Oscillators | own | Vaquant | batch 20 |
| 812 | MACD XD | `macd-xd` | Momentum | own | Zen_Formless | batch 8 |
| 813 | MACD-V (Volatility Normalized MACD) | `macd-v` | Momentum | own | KivancOzbilgic | batch 2 |
| 814 | MACD-V with Volatility Normalisation | `macd-v-with-volatility-normalisation` | Momentum | own | DutchCryptoDad | batch 25 |
| 815 | MACD-X, More Than MACD by DGT | `macd-x-more-than-macd-by-dgt` | Oscillators | own | dgtrd | most liked |
| 816 | MACD1 Fast | `double-macd` | Momentum | own |  |  |
| 817 | MACDAS | `macdas` | Momentum | own |  |  |
| 818 | Machine Learning Price Target Prediction Signals | `machine-learning-price-target-prediction` | Trend | price | AlgoAlpha | most liked |
| 819 | Machine Learning RSI \| AI Classification & Ranking | `machine-learning-rsi-ai-classification-ranking` | Oscillators | own | Zeiierman | most liked |
| 820 | Machine Learning RSI ║ BullVision | `machine-learning-rsi-bullvision` | Oscillators | own | BullVisionCapital | most liked |
| 821 | Machine Learning Supertrend | `machine-learning-supertrend` | Trend | price | Zimord | most liked |
| 822 | Machine Learning: Gaussian Process Regression | `machine-learning-gaussian-process-regression` | Trend | price | LuxAlgo | most liked |
| 823 | Machine Learning: kNN Trend Predictor | `machine-learning-knn-trend-predictor` | Trend | price | tkarolak | batch 11 |
| 824 | Machine Learning: Logistic Regression | `machine-learning-logistic-regression` | Trend | price | capissimo | most liked |
| 825 | Machine Learning: Lorentzian Classification | `lorentzian-classification` | Trend | price | jdehorty | most liked |
| 826 | MAD Trend Detector ~ C H I P A | `mad-trend-detector-c-h-i-p-a` | Trend | own | C_H_I_P_A | batch 36 |
| 827 | Madrid Trend Squeeze | `madrid-trend-squeeze` | Momentum | own |  |  |
| 828 | MADZ - Moving Average Deviation Z-Score | `madz-moving-average-deviation-z-score` | Oscillators | own | MiesOnCharts | batch 32 |
| 829 | Magnet Force + RSI Filter V6 | `magnet-force-rsi-filter-v6` | Channels & Bands | price | mehmetbezgincan | batch 31 |
| 830 | Maket Strat Absorption Bubbles | `maket-strat-absorption-bubbles` | Volume | price | samb817 | batch 41 |
| 831 | MAMA - FAMA (Ehlers) | `mama-fama` | Moving Averages | price | KatherinaNote | batch 31 |
| 832 | Manipulation Candle | `manipulation-candle` | Candlestick Patterns | price | DrauzioFx | batch 39 |
| 833 | Mark Minervini Buy Signal | `mark-minervini-buy-signal` | Trend | price | Dr_Leong_Yee_Rock | batch 18 |
| 834 | Market Cipher A | `market-cipher-a` | Oscillators | price |  |  |
| 835 | Market Cipher A free version 1.1 | `market-cipher-a-free-version-1-1` | Moving Averages | price | falconCoin | most liked |
| 836 | Market Cipher B | `market-cipher-b` | Oscillators | own |  |  |
| 837 | Market Cipher B  Free version with Buy and sell | `market-cipher-b-free-version-with-buy-and-sell` | Oscillators | own | falconCoin | most liked |
| 838 | Market Participation Ratio-MPR | `market-participation-ratio-mpr` | Volume | own | TechnoBlooms | batch 37 |
| 839 | Market Pressure Oscillator | `market-pressure-oscillator` | Oscillators | own | Uncle_the_shooter | batch 8 |
| 840 | Market Profile | `market-profile` | Volume | price | LonesomeTheBlue | most liked |
| 841 | Market Profile with TPO | `market-profile-with-tpo` | Volume | price | drother | most liked |
| 842 | Market Pulse Pro | `market-pulse-pro` | Oscillators | own | Canhoto-Medium | batch 32 |
| 843 | Market Sentiment Technicals | `market-sentiment-technicals` | Oscillators | price | LuxAlgo | most liked |
| 844 | Market Sessions - By Leviathan | `market-sessions-by-leviathan` | Trend | price | LeviathanCapital | most liked |
| 845 | Market sessions and Volume profile - By Leviathan | `market-sessions-volume-profile` | Volume | price | LeviathanCapital | most liked |
| 846 | Market Shift Levels | `market-shift-levels` | Trend | price |  |  |
| 847 | Market Structure - By Leviathan | `market-structure-by-leviathan` | Trend | price | LeviathanCapital | most liked |
| 848 | Market Structure Break & OB Probability Toolkit | `market-structure-break-ob-probability-toolkit` | Trend | price | LuxAlgo | most liked |
| 849 | Market Structure Break & Order Block by EmreKb | `market-structure-break-order-block` | Trend | price | EmreKb | most liked |
| 850 | Market Structure CHoCH/BOS (Fractal) | `market-structure-choch-bos` | Trend | price | LuxAlgo | most liked |
| 851 | Market Structure Confluence | `market-structure-confluence` | Trend | price | AlgoAlpha | most liked |
| 852 | Market Structure Dashboard \| Flux Charts | `market-structure-dashboard-flux-charts` | Trend | price | fluxchart | most liked |
| 853 | Market Structure Inducements ICT CHoch BOS Sweeps | `market-structure-inducements-ict-choch-bos` | Trend | price | TradingFinder | most liked |
| 854 | Market Structure Oscillator | `market-structure-oscillator` | Oscillators | own | LuxAlgo | most liked |
| 855 | Market Structure Trailing Stop | `market-structure-trailing-stop` | Trend | price | LuxAlgo |  |
| 856 | Market Structure Trend | `market-structure-trend` | Trend | price | QuantAlgo | batch 12 |
| 857 | Market Structure Trend Targets | `market-structure-trend-targets` | Trend | price | ChartPrime | most liked |
| 858 | Market Structure with Inducements & Sweeps | `market-structure-with-inducements-sweeps` | Trend | price | LuxAlgo | most liked |
| 859 | Market Structure- ZigZag, Break of Structure & Order Blocks | `market-structure-zigzag-break-of-structure` | Trend | price | The_Forex_Steward | most liked |
| 860 | Market Structures + ZigZag CHoCH/BOS - MSS/MSB | `market-structures-zigzag-choch-bos-mss-msb` | Trend | price | TradingFinder | most liked |
| 861 | Market Trend Levels Detector | `market-trend-levels-detector` | Trend | price | BigBeluga | most liked |
| 862 | Martell MNQ Quantum Scalper Pro | `martell-mnq-quantum-scalper-pro` | Trend | price | JMartell | batch 31 |
| 863 | Marubozu Detector | `marubozu-detector` | Candlestick Patterns | price | toppermost | batch 38 |
| 864 | Master Pattern | `master-pattern` | Trend | price | LuxAlgo | most liked |
| 865 | Matrix Series | `matrix-series` | Oscillators | own |  |  |
| 866 | MavilimW | `mavilimw` | Trend | price | KivancOzbilgic |  |
| 867 | Mean Angles | `mean-angles` | Momentum | own | bharatTrader | batch 9 |
| 868 | Mean Reversion Channel - (fareid's MRI Variant) | `mean-reversion-channel` | Channels & Bands | price | fareidzulkifli | most liked |
| 869 | Measured Pattern Move (Bulkowski) | `measured-pattern-move` | Trend | price | Steversteves | batch 28 |
| 870 | MechArt Moving Average and % Above V1.1 | `mechart-moving-average-and-above-v1-1` | Moving Averages | price | MechArt_ | batch 29 |
| 871 | Median ATR SD Oscillator | `median-atr-sd-oscillator` | Volatility | own | Unknownhodler | batch 37 |
| 872 | Median Gaussian Trend \| NAL | `median-gaussian-trend-nal` | Trend | price | NordicAlphaLab | batch 15 |
| 873 | Median MACD - Mattes | `median-macd-mattes` | Momentum | own | Mattes00 | batch 8 |
| 874 | Median Volume Weighted Deviation | `median-volume-weighted-deviation` | Volume | price | Burggg | batch 30 |
| 875 | MESA Adaptive Ehlers Flow \| AlphaNatt | `mesa-adaptive-ehlers-flow` | Moving Averages | price | AlphaNatt | batch 8 |
| 876 | MESA Phase-Adaptive Band Trend | `mesa-phase-adaptive-band-trend` | Trend | price | SchizoQuant | batch 22 |
| 877 | MFI | `mfi-seiglerj` | Volume | own | seiglerj | most liked |
| 878 | MFI + RSI + EMA Dynamic Signals | `mfi-rsi-ema-dynamic-signals` | Momentum | price | Raisontgh | batch 37 |
| 879 | MFI Nexus Pro | `mfi-nexus-pro` | Volume | own | trade_lexx | batch 10 |
| 880 | Mid-term Ribbon | `mid-term-ribbon` | Moving Averages | price | Gartav388637 | batch 25 |
| 881 | Minervini Trend Template Screener (v5) | `minervini-trend-template-screener` | Trend | price | hibinomasakazu1991 | batch 41 |
| 882 | Minimalist Doji Highlighter | `minimalist-doji-highlighter` | Candlestick Patterns | price | SensitiveSuit | batch 40 |
| 883 | Mirage Liquidity Sweep Pro | `mirage-liquidity-sweep-pro` | Trend | price | WillyAlgoTrader | most liked |
| 884 | Mix1 : Ema Cross + Trend Channel | `mix1-ema-cross-trend-channel` | Moving Averages | price | gu5tavo71 | most liked |
| 885 | Machine Learning Adaptive SuperTrend [AlgoAlpha] | `ml-adaptive-supertrend` | Trend | price |  |  |
| 886 | ML Deep Regression Pro | `ml-deep-regression-pro` | Trend | price | TechnoBlooms | batch 29 |
| 887 | Machine Learning Momentum Index (MLMI) [Zeiierman] | `ml-momentum-index` | Momentum | own |  |  |
| 888 | ML Moving Average | `ml-moving-average` | Moving Averages | price |  |  |
| 889 | ML RSI | `ml-rsi` | Momentum | own |  |  |
| 890 | Machine Learning: kNN-based Strategy | `ml-knn-strategy` | Momentum | price |  |  |
| 891 | Modified Heikin-Ashi | `modified-heikin-ashi` | Candlestick Patterns | price | ChrisMoody |  |
| 892 | Momentum Acceleration by DGT | `momentum-acceleration-by-dgt` | Momentum | price | dgtrd | most liked |
| 893 | Momentum Ghost Machine | `momentum-ghost-machine` | Momentum | own | ChartPrime | most liked |
| 894 | Momentum Shift | `momentum-shift` | Momentum | own | BigBeluga | most liked |
| 895 | Momentum-based ZigZag | `momentum-zigzag` | Trend | price | Peter_O |  |
| 896 | Money Flow Extended | `money-flow-extended` | Volume | own | alexrainman | batch 6 |
| 897 | Money Flow Index + Alerts | `money-flow-index-alerts` | Oscillators | own | DreamsDefined | most liked |
| 898 | Money Flow Profile | `money-flow-profile` | Volume | price | LuxAlgo | most liked |
| 899 | Money Flow Pulse | `money-flow-pulse` | Volume | own | TheLeadingIndicator | batch 35 |
| 900 | Moneyball EMA-MACD indicator | `moneyball-ema-macd-indicator` | Momentum | own | VinnieTheFish | batch 6 |
| 901 | Monotonic Trend Consensus | `monotonic-trend-consensus` | Trend | own | QuantAlgo | batch 16 |
| 902 | MOST + Moving Average Screener | `most-moving-average-screener` | Trend | price | KivancOzbilgic | most liked |
| 903 | Moving Average ADX | `ma-adx` | Moving Averages | price |  |  |
| 904 | Moving Average Candles | `moving-average-candles` | Moving Averages | price | aleskxyz | batch 41 |
| 905 | Moving Average Colored | `ma-colored` | Moving Averages | price |  |  |
| 906 | Moving Average Converging | `ma-converging` | Moving Averages | price | LuxAlgo |  |
| 907 | Moving Average Cross Alert, Multi-Timeframe (MTF) (by ChartArt) | `ma-cross-alert-mtf` | Moving Averages | price | ChartArt | most liked |
| 908 | Moving Average Crossover with Shading Signals | `moving-average-crossover-with-shading-signals` | Moving Averages | price | Decam9 | batch 12 |
| 909 | Moving Average Deviation Rate | `ma-deviation-rate` | Moving Averages | own |  |  |
| 910 | Moving Average Exponential x 4 | `moving-average-exponential-x-4` | Moving Averages | price | krogsgard | most liked |
| 911 | Moving Average Percentage Difference | `moving-average-percentage-difference` | Moving Averages | own | GapLogic | batch 37 |
| 912 | Moving Average Shaded Fill Area Crossover EMA Color - Editable | `moving-average-shaded-fill-area-crossover-ema` | Moving Averages | price | aballard11 | most liked |
| 913 | Moving Average Shift | `ma-shift` | Moving Averages | price |  |  |
| 914 | Moving Average Trend Meter | `moving-average-trend-meter` | Trend | own | UkutaLabs | batch 39 |
| 915 | Moving Averages as Support Resistance MTF | `moving-averages-as-support-resistance-mtf` | Moving Averages | price | LonesomeTheBlue | most liked |
| 916 | Moving Averages With Continuous Periods | `moving-averages-with-continuous-periods` | Moving Averages | price | The_Peaceful_Lizard | batch 15 |
| 917 | Moving Volume-Weighted Avg Price, % Channel, BBs | `moving-volume-weighted-avg-price-channel-bbs` | Channels & Bands | price | NeanderTraderBC | batch 37 |
| 918 | Moving VWAP-KAMA Cloud | `moving-vwap-kama-cloud` | Moving Averages | price | SovereignCharts | batch 12 |
| 919 | MPO4 Lines – Modal Engine | `mpo4-lines-modal-engine` | Oscillators | own | Uncle_the_shooter | batch 15 |
| 920 | mr.crypto731 | `mr-crypto731` | Momentum | own | Ali_Smith | batch 20 |
| 921 | MSL Squeeze Pulse | `msl-squeeze-pulse` | Volatility | own | MarketStructureLab | batch 16 |
| 922 | MTF Break of Structure(BOS) & Market Structure Shift(MSS) | `mtf-break-of-structure-market-structure-shift` | Trend | price | Lenny_Kiruthu | most liked |
| 923 | MTF Order Block Finder | `mtf-order-block-finder` | Trend | price | DasanC | most liked |
| 924 | Multi Kernel Regression | `multi-kernel-regression` | Trend | price | ChartPrime | most liked |
| 925 | Multi Time Frame Candles with Volume Info / 3D | `multi-time-frame-candles-with-volume-info-3d` | Volume | own | LonesomeTheBlue | most liked |
| 926 | Multi Timeframe Support and Resistance | `multi-timeframe-support-and-resistance` | Channels & Bands | price | abainvest | most liked |
| 927 | Multi-Band Trend Line | `multi-band-trend-line` | Trend | price | Mr_Rakun | batch 4 |
| 928 | Multi-Layer Volume Profile | `multi-layer-volume-profile` | Volume | price | BigBeluga | most liked |
| 929 | Multi-Oscillator Adaptive Kernel \| AlphaAlgos | `multi-oscillator-adaptive-kernel-alphaalgos` | Oscillators | own | AlphaNatt | batch 4 |
| 930 | Multicator Table | `signal-table-autofib-sma-ema-rsi-atr-vol` | Trend | price | only_fibonacci | most liked |
| 931 | Multiple Divergences | `multiple-divergences` | Momentum | price | PeterO |  |
| 932 | Multiple Exponential Fibnonacci Moving Averages | `multiple-exponential-fibnonacci-moving-averages` | Moving Averages | price | LensOfChartist | batch 13 |
| 933 | Multiple Moving Averages | `multiple-ma` | Moving Averages | price |  |  |
| 934 | Multiple RSI | `multiple-rsi` | Oscillators | own | PrasadJoshi12 | batch 19 |
| 935 | Multitimeframe Fair Value Gap – FVG | `multitimeframe-fair-value-gap-fvg` | Trend | price | Zeiierman | most liked |
| 936 | Multpile strategies | `multpile-strategies` | Oscillators | own | Lupown | most liked |
| 937 | MurreysOscillator | `murreys-math-osc` | Oscillators | own |  |  |
| 938 | Muses afl script | `muses-afl-script` | Trend | price | mostafa47ab (indicator title "L1 Filter Sig") | batch 31 |
| 939 | Mushir's Inside Candle Indicator | `mushir-s-inside-candle-indicator` | Candlestick Patterns | price | mushirinamdar | batch 42 |
| 940 | My auto dual avwap with Auto swing low/pivot low finder | `my-auto-dual-avwap-with-auto-swing-low-pivot-low-finder` | Volume | price | doqkhanh | batch 22 |
| 941 | N Bar Reversal Detector | `n-bar-reversal-detector` | Trend | price | LuxAlgo | most liked |
| 942 | N Order EMA | `n-order-ema` | Moving Averages | price | The_Peaceful_Lizard | batch 35 |
| 943 | Nadaraya-Watson Envelope | `nadaraya-watson-envelope` | Channels & Bands | price | LuxAlgo | most liked |
| 944 | Nadaraya-Watson Regression Liquidity Sweeps | `nadaraya-watson-regression-liquidity-sweeps` | Oscillators | own | AlgoAlpha | most liked |
| 945 | Nadaraya-Watson Smoothers | `nadaraya-watson-smoothers` | Trend | price | LuxAlgo | most liked |
| 946 | Nadaraya-Watson Trend | `nadaraya-watson-trend` | Trend | price | QuantAlgo | batch 1 |
| 947 | Navier-Cauchy Market Elasticity | `navier-cauchy-market-elasticity` | Oscillators | own | PhenLabs | batch 30 |
| 948 | Neighboring Price Bands | `neighboring-price-bands` | Channels & Bands | price | LuxAlgo | batch 21 |
| 949 | Next Pivot Projection | `next-pivot-projection` | Trend | price | Trendoscope | most liked |
| 950 | Nexus Sentiment & Risk Matrix | `nexus-sentiment-risk-matrix` | Oscillators | own | Pineify | batch 37 |
| 951 | NLMS Volatility Trail | `nlms-volatility-trail` | Trend | price | BackQuant | batch 4 |
| 952 | No wick candles | `no-wick-candles` | Candlestick Patterns | price | KORD_ | batch 39 |
| 953 | Normalized Candles RSI | `normalized-candles-rsi` | Oscillators | own | Jamallo22 | batch 32 |
| 954 | Normalized QQE | `normalized-qqe` | Oscillators | own |  |  |
| 955 | Normalized Quantitative Qualitative Estimation nQQE | `normalized-quantitative-qualitative` | Momentum | own | KivancOzbilgic | most liked |
| 956 | Normalized SPMA \| NAL | `normalized-spma-nal` | Oscillators | own | NordicAlphaLab | batch 30 |
| 957 | Normalized Volume & True Range | `normalized-volume-true-range` | Volume | own | The_Peaceful_Lizard | batch 36 |
| 958 | Nova Flow Lite (Free) | `nova-flow-lite` | Trend | price | NovaQuantX | batch 36 |
| 959 | Nova Statistical Filtering Oscillator | `nova-statistical-filtering-oscillator` | Oscillators | own | Pineify | batch 27 |
| 960 | NR4 & NR7 with Breakouts | `nr4-nr7-with-breakouts` | Volatility | price | LuxAlgo | most liked |
| 961 | NY ORB + Fakeout Detector | `ny-orb-fakeout-detector` | Channels & Bands | price | STEFANGAS | batch 27 |
| 962 | OA - SMES | `oa-smes` | Oscillators | own | onurag | batch 4 |
| 963 | OBV & AD Oscillators with Dual Smoothing Options | `obv-ad-oscillators-with-dual-smoothing-options` | Volume | own | hollowwick (indicator title "OBV, AD, VPT & CDV | batch 27 |
| 964 | OBV (Delta or regular) | `obv-gizmo` | Volume | own | GizmoTheInvestor | batch 37 |
| 965 | OBV + Custom MA Strategy | `obv-custom-ma-strategy` | Volume | own | Rafiki-is-Trading | batch 14 |
| 966 | OBV MACD | `obv-macd` | Volume | own |  |  |
| 967 | OBV Oscillator | `obv-oscillator` | Volume | own |  |  |
| 968 | OBVX Conviction Bias | `obvx-conviction-bias` | Volume | own | TheLeadingIndicator | batch 31 |
| 969 | One Shot One Kill ICT Liquidity MMXM + CISD OTE | `one-shot-one-kill-ict-liquidity-mmxm-cisd-ote` | Trend | price | TradingFinder | most liked |
| 970 | Opal | `opal` | Channels & Bands | price | FlyingSeaHorse | batch 36 |
| 971 | Open Close Cross | `open-close-cross` | Momentum | own | JustUncleL |  |
| 972 | Open Close Cross Alerts NoRepaint Version by JustUncleL | `open-close-cross-alerts-norepaint-version-by` | Trend | own | JustUncleL | most liked |
| 973 | Open Interest Stochastic Money Flow Index | `open-interest-stochastic-money-flow-index` | Volume | own | Noldo (uses the "LibraryCOT" library) | most liked |
| 974 | Open Interest Suite - By Leviathan | `open-interest-suite-by-leviathan` | Volume | own | LeviathanCapital | most liked |
| 975 | Open Liquidity Heatmap | `open-liquidity-heatmap` | Volume | price | BigBeluga | most liked |
| 976 | Opening Range Breakout with 2 Profit Targets. | `opening-range-breakout-with-2-profit-targets` | Trend | price |  | most liked |
| 977 | Opening Range with Breakouts & Targets | `opening-range-breakouts-targets` | Trend | price | LuxAlgo | most liked |
| 978 | Optimized Trend Tracker | `optimized-trend-tracker` | Trend | price | KivancOzbilgic |  |
| 979 | ORB - Opening Range Breakout | `orb-opening-range-breakout` | Trend | price | zzzcrypto123 | most liked |
| 980 | ORB Algo \| Flux Charts | `orb-algo-flux-charts` | Trend | price | fluxchart | most liked |
| 981 | Order Block Detector | `order-block-detector` | Trend | price | LuxAlgo | most liked |
| 982 | Order Block Finder (Experimental) | `order-block-finder` | Trend | price | wugamlo | most liked |
| 983 | Order Block Finder \| Gold \| ProjectSyndicate | `order-block-finder-gold-projectsyndicate` | Trend | price | ProjectSyndicate | most liked |
| 984 | Order Blocks & Breaker Blocks | `order-blocks-breaker-blocks` | Trend | price | LuxAlgo | most liked |
| 985 | Order Blocks Finder Major OB \| Supply and Demand | `order-blocks-finder-major-ob-supply-and-demand` | Channels & Bands | price | TradingFinder | most liked |
| 986 | Order Blocks Volume Delta 3D \| Flux Charts | `order-blocks-volume-delta-3d-flux-charts` | Volume | price | fluxchart | most liked |
| 987 | Order Blocks W/ Realtime Fibs | `order-blocks-w-realtime-fibs` | Trend | price | QuantVue | most liked |
| 988 | Order Blocks with Signals | `order-blocks-signals` | Trend | price | ClayeWeight |  |
| 989 | Order Blocks \| Flux Charts | `order-blocks-flux-charts` | Volume | price | fluxchart | most liked |
| 990 | Order Flow Imbalance Oscillator | `order-flow-imbalance-oscillator` | Volume | own | StrikePriceLabs | batch 33 |
| 991 | Order Flow VWAP Deviation | `order-flow-vwap-deviation` | Volume | price | LuxAlgo | most liked |
| 992 | Orderblocks - Open source | `orderblocks-open-source` | Channels & Bands | price | nephew_sam_ | most liked |
| 993 | Oscillator Matrix | `oscillator-matrix` | Oscillators | own | AlphaExtract | batch 6 |
| 994 | PAFT | `paft` | Momentum | own | TREESinvest | batch 30 |
| 995 | Parabolic Stoch SAR Visualizer | `parabolic-stoch-sar-visualizer` | Oscillators | own | BOSWaves | batch 24 |
| 996 | Parallel Pivot Lines | `parallel-pivot-lines` | Channels & Bands | price | LuxAlgo |  |
| 997 | Pay Attention Candle | `pay-attention-candle` | Candlestick Patterns | price | asenski (inspired by the RexDog Trading System) | batch 41 |
| 998 | PCR Market Regime Indicator | `pcr-market-regime-indicator` | Momentum | own | Aleksin_Aleksandar | batch 31 |
| 999 | Peak Reversal v2 | `peak-reversal-v2` | Channels & Bands | price | Zettt | batch 11 |
| 1000 | Peak Reversal v3 | `peak-reversal-v3` | Channels & Bands | price | Zettt | batch 21 |
| 1001 | Percent Off All-time High (% Off High) | `percent-off-all-time-high` | Oscillators | own | xHmmmmm | batch 19 |
| 1002 | Percentile Rank Oscillator (Price + VWMA) | `percentile-rank-oscillator` | Oscillators | own | exploretranspose | batch 26 |
| 1003 | Percentile-Based BB% Trend - Mattes | `percentile-based-bb-trend-mattes` | Oscillators | own | Mattes00 | batch 7 |
| 1004 | Perfect Hammer Pattern Indicators and Alerts | `perfect-hammer-pattern-indicators-and-alerts` | Candlestick Patterns | price | girishptryambakee | batch 40 |
| 1005 | Perfect RSI | `perfect-rsi` | Oscillators | own | HabibiBudo | batch 26 |
| 1006 | Perforance integral | `perforance-integral` | Momentum | own | Majimbi | batch 37 |
| 1007 | Periodic Linear Regressions | `periodic-linear-regressions` | Channels & Bands | price | LuxAlgo | most liked |
| 1008 | Philakone 55 EMA Swing Trading | `philakone-ema-swing` | Moving Averages | price |  |  |
| 1009 | Pipstocrat Market Participant Analysis | `pipstocrat-market-participant-analysis` | Momentum | own | Delast2 | batch 23 |
| 1010 | Pivot Based Trailing Maxima & Minima | `pivot-trailing-maxmin` | Channels & Bands | price | LuxAlgo |  |
| 1011 | Pivot Breakout High&Low Signals | `pivot-breakout-high-low-signals` | Trend | price | Jos-ProTrader | batch 3 |
| 1012 | Pivot Breakout with Trend Zones | `pivot-breakout-with-trend-zones` | Trend | price | dreamaker7 | batch 33 |
| 1013 | Pivot High/Low Analysis & Forecast | `pivot-high-low-analysis-forecast` | Trend | price | LuxAlgo | most liked |
| 1014 | Pivot Hilo Support n Resistance Levels R3-3 by JustUncleL | `pivot-hilo-support-n-resistance-levels-r3-3` | Trend | price | JustUncleL | most liked |
| 1015 | Pivot Levels | `pivot-levels` | Channels & Bands | price | BigBeluga | most liked |
| 1016 | Pivot Market Structure | `pivot-market-structure` | Trend | price | Daniel_Ge | batch 11 |
| 1017 | Pivot Oscillator | `pivot-oscillator` | Oscillators | own | Uncle_the_shooter | batch 3 |
| 1018 | Pivot Point | `pivot-point-hpotter` | Trend | price | HPotter | most liked |
| 1019 | Pivot Point SuperTrend | `pivot-point-supertrend` | Trend | price | LonesomeTheBlue |  |
| 1020 | Pivot Points High Low & Missed Reversal Levels | `pivot-points-high-low-missed-reversal` | Trend | price | LuxAlgo | most liked |
| 1021 | Pivot Points High Low Multi Time Frame | `pivot-points-high-low-multi-time-frame` | Trend | price | LonesomeTheBlue | most liked |
| 1022 | Pivot Trend | `pivot-trend` | Trend | price | ChartPrime | batch 1 |
| 1023 | Pivot Trendlines with Breaks | `pivot-trendlines-with-breaks` | Trend | price | HoanGhetti | most liked |
| 1024 | PMax on RSI with Tillson T3 | `pmax-on-rsi-with-tillson-t3` | Oscillators | own | KivancOzbilgic | most liked |
| 1025 | POC Volume Bar (Highest Volume in Range) | `poc-volume-bar` | Volume | own | greatbrownball | batch 28 |
| 1026 | Pocket Pivot Breakout | `pocket-pivot-breakout` | Volume | price | simatricks | batch 38 |
| 1027 | POCs and VAHs VALs - All and Non-Broken | `pocs-and-vahs-vals-all-and-non-broken` | Volume | price | Frien_dd-DisDev | most liked |
| 1028 | PolyFilter | `polyfilter` | Moving Averages | price | BackQuant | batch 8 |
| 1029 | Polynomial Regression Moving Average (PRMA) | `polynomial-regression-moving-average` | Moving Averages | price | ZakAlgoTrade | batch 24 |
| 1030 | Polynomial Trend Exhaustion & Divergence | `polynomial-trend-exhaustion-divergence` | Trend | price | B3AR_Trades | batch 40 |
| 1031 | Polyphase MACD (PMACD) | `polyphase-macd` | Momentum | own | The_Peaceful_Lizard | batch 19 |
| 1032 | Poor man's volume clusters | `poor-man-s-volume-clusters` | Volume | price | IldarAkhmetgaleev | most liked |
| 1033 | Position Size Calculator | `position-size-calculator` | Volatility | price | zzzcrypto123 | most liked |
| 1034 | Power Of 3 ICT 01 AMD ICT & SMC Accumulations | `power-of-3-ict-01-amd-ict-smc-accumulations` | Trend | price | TradingFinder | most liked |
| 1035 | PPO Alerts | `ppo-alerts` | Momentum | own |  |  |
| 1036 | PPO Divergence | `ppo-divergence` | Momentum | own | Pekipek |  |
| 1037 | Precision Sniper | `precision-sniper` | Trend | price | WillyAlgoTrader | most liked |
| 1038 | Predictive Channels | `predictive-channels` | Channels & Bands | price | LuxAlgo |  |
| 1039 | Predictive Ranges | `predictive-ranges` | Channels & Bands | price | LuxAlgo | most liked |
| 1040 | Premier RSI Oscillator | `premier-rsi` | Momentum | own |  |  |
| 1041 | Premier Stochastic Oscillator | `premier-stochastic` | Oscillators | own |  |  |
| 1042 | Premium & Discount Delta Volume | `premium-discount-delta-volume` | Volume | price | BigBeluga | most liked |
| 1043 | PREMIUM TRADE ZONES | `premium-trade-zones` | Oscillators | own | ENTRYLAB | batch 27 |
| 1044 | Previous Day High and Low + Separators Daily/Weekly | `previous-day-high-and-low-separators-daily` | Trend | price | Algoryze | most liked |
| 1045 | Previous Day Week Highs & Lows | `previous-day-week-highs-lows` | Trend | price | sbtnc | most liked |
| 1046 | Previous Highs & Lows | `previous-highs-lows` | Channels & Bands | price | LuxAlgo | most liked |
| 1047 | Price & Volume Profile (Expo) | `price-volume-profile` | Volume | price | Zeiierman (community) |  |
| 1048 | Price Acceleration Indicator (PAI) | `price-acceleration-indicator` | Momentum | own | PHICAPITALINVESTMENTS | batch 35 |
| 1049 | Price Action Bands \| Trend & Volatility | `price-action-bands-trend-volatility` | Channels & Bands | price | RadixAlgo | batch 15 |
| 1050 | Price Action Breakout Trend | `price-action-breakout-trend` | Trend | price | QuantAlgo | batch 5 |
| 1051 | Price Action Signals Filtered +EMA | `price-action-signals-filtered-ema` | Trend | price | Aleksin_Aleksandar | batch 11 |
| 1052 | Price Action Smart Money Concepts | `price-action-smart-money-concepts` | Trend | price | BigBeluga | most liked |
| 1053 | Price Action Trading System | `price-action-system` | Oscillators | price |  |  |
| 1054 | Price Action: Engulfing Patterns | `price-action-engulfing-patterns` | Candlestick Patterns | price | Jay9286 | batch 33 |
| 1055 | Price Advance & Decline Range Analysis | `price-advance-decline-range-analysis` | Volatility | own | RicardoSantos | batch 16 |
| 1056 | Price Change Sentiment Index | `price-change-sentiment-index` | Oscillators | own | TradeVizion | batch 23 |
| 1057 | Price Contraction / Expansion | `price-contraction-expansion` | Volatility | price | destrobr0685 | batch 42 |
| 1058 | Price Divergence Detector V3.2 revised by JustUncleL | `price-divergence-detector` | Momentum | price | JustUncleL (original author RicardoSantos) | most liked |
| 1059 | Price Flow - Buy Sell | `price-flow-buy-sell` | Channels & Bands | price | IVTrader1990 | batch 35 |
| 1060 | Price Linear Sequence Counter | `price-linear-sequence-counter` | Momentum | own | RicardoSantos | batch 14 |
| 1061 | Price Momentum Oscillator | `price-momentum-oscillator` | Momentum | own |  |  |
| 1062 | Price/Volume Value Histogram | `price-volume-value-histogram` | Volume | own | dman103 | batch 2 |
| 1063 | Primitive Delta Divergence | `primitive-delta-divergence` | Volume | price | bfoster238 | batch 41 |
| 1064 | Pring Special K\|a2m | `pring-special-k-a2m` | Momentum | own | ask2maniish | batch 34 |
| 1065 | Prism Moving Average Trend | `prism-moving-average-trend` | Trend | price | MisinkoMaster | batch 19 |
| 1066 | Pro Scalper - 2 MinutesTF by Ayoob | `pro-scalper-2-minutestf-by-ayoob` | Trend | price | FGMNDFBF | batch 30 |
| 1067 | Pro Scalper AI | `pro-scalper-ai` | Oscillators | own | BullByte | most liked |
| 1068 | Probabilities Module - The Quant Science | `probabilities-module-the-quant-science` | Oscillators | own | thequantscience | batch 31 |
| 1069 | Projected Crossover Trend | `projected-crossover-trend` | Trend | price | SchizoQuant | batch 4 |
| 1070 | Prometheus Topological Persistent Entropy | `prometheus-topological-persistent-entropy` | Volatility | own | ScorsoneEnterprises | batch 23 |
| 1071 | Protected Highs & Lows | `protected-highs-lows` | Trend | price | tradeforopp | most liked |
| 1072 | Pullback Candles (Candlestick Analysis) Guaranteed Winners!!!! | `pullback-candles-guaranteed-winners` | Candlestick Patterns | price | LuxTradeVenture | most liked |
| 1073 | Pullback SAR | `pullback-sar` | Trend | price | szymonsobkowiak | batch 32 |
| 1074 | Pullback Scalp Trade V2 | `pullback-scalp-trade-v2` | Trend | price | Sinyalbak_App | batch 12 |
| 1075 | Pullback Trading Tool ALT R1.0 by JustUncleL | `pullback-trading-tool-alt-r1-0-by-justunclel` | Moving Averages | price | JustUncleL | most liked |
| 1076 | Pulse Range | `pulse-range` | Trend | price | MarketStructureLab | batch 13 |
| 1077 | Pulse RSI \| Lyro RS | `pulse-rsi-lyro-rs` | Oscillators | own | LyroRS | batch 10 |
| 1078 | PulseWave + Divergence | `pulsewave-divergence` | Oscillators | own | Uncle_the_shooter | batch 7 |
| 1079 | Pump & Dump Detector (sensitive) | `pump-dump-detector` | Volume | price | btcpayer | batch 39 |
| 1080 | Pure Coca | `pure-coca` | Oscillators | own | La_Von | batch 7 |
| 1081 | Pure Price Action ICT Tools | `pure-price-action-ict-tools` | Trend | price | LuxAlgo | most liked |
| 1082 | Pure Price Action Order & Breaker Blocks | `pure-price-action-order-breaker-blocks` | Trend | price | LuxAlgo | most liked |
| 1083 | Pure Price Action Structures | `pure-price-action-structures` | Trend | price | LuxAlgo | most liked |
| 1084 | Q Impulse Entry | `q-impulse-entry` | Trend | price | Quantora | batch 17 |
| 1085 | Q KAMA Clarity Trend | `q-kama-clarity-trend` | Trend | price | Quantora | batch 7 |
| 1086 | Q Wave | `q-wave` | Trend | price | Quantora | batch 36 |
| 1087 | QG-Particle Oscillator | `qg-particle-oscillator` | Oscillators | own | QuantG | batch 35 |
| 1088 | QQE Cross | `qqe-cross` | Trend | price | JustUncleL |  |
| 1089 | QQE MOD | `qqe-mod` | Momentum | own |  |  |
| 1090 | QQE Signals | `qqe-signals` | Oscillators | price | colinmck |  |
| 1091 | QTechLabs Machine Learning Logistic Regression Indicator | `qtechlabs-machine-learning-logistic-regression-indicator` | Oscillators | price | QTechLabsInfo | batch 33 |
| 1092 | Quant VWAP System 3.8 | `quant-vwap-system-3-8` | Oscillators | own | CustomQuantLabs (published as "Quant VWAP System 3.8") | batch 8 |
| 1093 | Quantile Regression Bands | `quantile-regression-bands` | Channels & Bands | price | BackQuant | batch 17 |
| 1094 | Quantitative Qualitative Estimation | `qqe` | Oscillators | own | Glaz |  |
| 1095 | Quantitative Qualitative Estimation QQE | `qqe-kivanc` | Oscillators | own |  | most liked |
| 1096 | Quantum Regression Oscillator | `quantum-regression-oscillator` | Oscillators | own | abgthecoder | batch 32 |
| 1097 | Quantum Trend Signal | `quantum-trend-signal` | Trend | price | ReubenMiles | batch 9 |
| 1098 | QuantumTrend SwiftEdge | `quantumtrend-swiftedge` | Trend | price | SwiftEdge | batch 5 |
| 1099 | Quartile For Loop | `quartile-for-loop` | Trend | own | SeerQuant | batch 6 |
| 1100 | Quasimodo Pattern | `quasimodo-pattern` | Candlestick Patterns | price | anodrr2 | batch 41 |
| 1101 | R:R Trading System Framework | `r-r-trading-system-framework` | Trend | price | carnagecain | most liked |
| 1102 | Radiant Mean Reversion Channels | `radiant-mean-reversion-channels` | Oscillators | own | Pineify | batch 34 |
| 1103 | Radius Trend [ChartPrime] | `radius-trend` | Trend | price | ChartPrime |  |
| 1104 | Rally Base Drop Signals | `rally-base-drop-signals` | Trend | price | LuxAlgo | batch 38 |
| 1105 | Range Analysis - By Leviathan | `range-analysis-by-leviathan` | Volume | price | LeviathanCapital | most liked |
| 1106 | Range Average Retest Model | `range-average-retest-model` | Trend | price | LuxAlgo | most liked |
| 1107 | Range Breakout | `range-breakout` | Channels & Bands | price | BigBeluga | most liked |
| 1108 | Range Channel by Atilla Yurtseven | `range-channel-by-atilla-yurtseven` | Channels & Bands | own | AtillaYurtseven | batch 17 |
| 1109 | Range Detector | `range-detector` | Trend | price | LuxAlgo |  |
| 1110 | Range Filter Buy and Sell 5min - guikroth version | `range-filter-buy-sell-5min` | Trend | price | PHVNTOM_TRADER (original script by DonovanWall, adapted by | most liked |
| 1111 | Range Identifier | `range-identifier` | Channels & Bands | price |  |  |
| 1112 | Range Oscillator | `range-oscillator` | Oscillators | own | Zeiierman | batch 1 |
| 1113 | Range Sentiment Profile | `range-sentiment-profile` | Volume | price | LuxAlgo | most liked |
| 1114 | Range Tightening Indicator (RTI) | `range-tightening-indicator` | Volatility | own | Ollie_AllCaps | batch 2 |
| 1115 | Ranges With Targets | `ranges-with-targets` | Trend | price | ChartPrime | most liked |
| 1116 | Rapid Exponential Moving Average | `rapid-exponential-moving-average` | Moving Averages | price | ImmortalFreedom | batch 28 |
| 1117 | RBT strategy | `rbt-strategy` | Momentum | price | luckykoshti | batch 38 |
| 1118 | RCI3lines | `rci-3lines` | Oscillators | own |  |  |
| 1119 | RCYC Bullish Bearish Indicator | `rcyc-bullish-bearish-indicator` | Momentum | price | bizarro29 | batch 38 |
| 1120 | ReadyFor401ks Just Tell Me When! | `readyfor401ks-just-tell-me-when` | Trend | price | ReadyFor401k | batch 20 |
| 1121 | Real-Time Big Trades Bubbles & Absorbtions & Deep Pressure | `big-trades-bubbles` | Volume | price | samet_lezki | batch 5 |
| 1122 | Realtime Volume Bars | `realtime-volume-bars` | Volume | own | the_MarketWhisperer |  |
| 1123 | RedK Effort Versus Results Explorer v3.0 | `redk-everex` | Momentum | own | RedKTrader |  |
| 1124 | RedK Magic Ribbon | `redk-magic-ribbon` | Moving Averages | price | RedKTrader | batch 2 |
| 1125 | RedK Momentum Bars | `redk-momentum-bars` | Momentum | own | RedKTrader |  |
| 1126 | RedK RSS_WMA | `redk-rss-wma` | Moving Averages | price | RedKTrader |  |
| 1127 | RedK Trader Pressure Index | `redk-tpx` | Momentum | own | RedKTrader |  |
| 1128 | RedK Vol_Weighted RSI: Extending the power of the classic RSI | `redk-vol-weighted-rsi` | Momentum | own | RedKTrader | batch 5 |
| 1129 | Reflex & Trendflex | `reflex-trendflex` | Oscillators | own | e2e4 | batch 6 |
| 1130 | Regression Channel Oscillator | `regression-channel-oscillator` | Oscillators | own | Uncle_the_shooter | batch 27 |
| 1131 | Relative ATR Volatility Indicator | `relative-atr-volatility-indicator` | Volatility | own | ZenAndTheArtOfTrading | batch 20 |
| 1132 | Relative Strength Heatmap | `relative-strength-heatmap` | Momentum | own | BackQuant | batch 22 |
| 1133 | Relative Strength Index - Divergences - Libertus | `relative-strength-index-divergences-libertus` | Momentum | own | Libertus | most liked |
| 1134 | Relative Strength of a stock | `relative-strength-of-a-stock` | Momentum | own | bharatTrader | most liked |
| 1135 | Relative Valuation Oscillator | `relative-valuation-oscillator` | Oscillators | own | QuantAlgo | batch 14 |
| 1136 | Relative Volume Indicator (RVOL) | `relative-volume-indicator` | Volume | own | AlgoCollective | batch 13 |
| 1137 | Renko Boxes | `renko-boxes` | Trend | price | LuxAlgo | batch 4 |
| 1138 | Renko Candles Overlay | `renko-candles-overlay` | Trend | price | LonesomeTheBlue | most liked |
| 1139 | Renko Chart | `renko-chart` | Trend | price | LonesomeTheBlue |  |
| 1140 | Renko Compression Index (RCI) | `renko-compression-index` | Oscillators | own | nasu_is_gaji | batch 34 |
| 1141 | Renko Flip Alert (Traditional Only) | `renko-flip-alert` | Candlestick Patterns | price | deephrenology | batch 41 |
| 1142 | Renko Mod | `renko-mod` | Trend | price | RicardoSantos | batch 13 |
| 1143 | Renko Sniper PRO (Liquidity Sweep + EMA + ST + RSI) | `renko-sniper-pro` | Trend | price | zachsprad | batch 24 |
| 1144 | Renko+Moving Average+RMI Alert R3 by JustUncleL | `renko-moving-average-rmi-alert-r3-by` | Trend | price | JustUncleL | most liked |
| 1145 | Res/Sup With Concavity & Increasing / Decreasing Trend Analysis | `res-sup-with-concavity-increasing-decreasing-trend-analysis` | Trend | price | Celar (published as "Res/Sup With Concavity & Increasing / Decreasing Trend Analysis") | batch 28 |
| 1146 | Retail vs Banker Net Positions – Symmetry Break | `retail-vs-banker-net-positions-symmetry-break` | Volume | own | JasonHyde | batch 17 |
| 1147 | Retest Support Resistance Signals | `retest-support-resistance-signals` | Trend | price | ChartPrime | most liked |
| 1148 | Reversal | `reversal` | Trend | price | HasanRifat | most liked |
| 1149 | Reversal Candle Setup | `reversal-candle-setup` | Candlestick Patterns | price |  |  |
| 1150 | Reversal Candlestick Structure | `reversal-candlestick-structure` | Candlestick Patterns | price | LuxAlgo | most liked |
| 1151 | Reversal Correlation Pressure | `reversal-correlation-pressure` | Oscillators | own | OmegaTools | batch 27 |
| 1152 | Reversal Probability Zone & Levels | `reversal-probability-zone-levels` | Trend | price | LuxAlgo | most liked |
| 1153 | Reversal Scalper 2.0- Adib Noorani | `reversal-scalper-2-0-adib-noorani` | Oscillators | own | AdibNoorani | batch 28 |
| 1154 | Reversal Signals | `reversal-signals` | Momentum | price | LuxAlgo | most liked |
| 1155 | Reversal Trap Probability Bands | `reversal-trap-probability-bands` | Channels & Bands | price | BigBeluga | most liked |
| 1156 | Rhokeo-VW-RSI Histogram for Cumulative Delta by Zeiirman | `rhokeo-vw-rsi-histogram-for-cumulative-delta-by-zeiirman` | Oscillators | own | nabil007 | batch 24 |
| 1157 | Ripster EMA Clouds | `ripster-ema-clouds` | Trend | price | ripster47 |  |
| 1158 | Risk Management Tool | `risk-management-tool` | Volatility | price | LuxAlgo | most liked |
| 1159 | RMA ATR Bands | `rma-atr-bands` | Channels & Bands | price | SchizoQuant | batch 3 |
| 1160 | RMI Length | `rmi-trend-sniper` | Momentum | price | TZack88 |  |
| 1161 | Robby DSS Bressert Colored Dots | `robby-dss-bressert-colored-dots` | Oscillators | own | huatzhi | batch 21 |
| 1162 | ROC-Weighted MA Oscillator | `roc-weighted-ma-oscillator` | Oscillators | own | SeerQuant | batch 2 |
| 1163 | Rolling Liquidity Clusters Channel | `rolling-liquidity-clusters-channel` | Channels & Bands | price | LuxAlgo | batch 12 |
| 1164 | Rolling Sharpe Ratio Oscillator \| Astral Vision | `rolling-sharpe-ratio-oscillator-astral-vision` | Oscillators | own | AstralVision | batch 13 |
| 1165 | Rolling Trendline | `rolling-trendline` | Trend | price | LuxAlgo | batch 5 |
| 1166 | Rolling VWAP | `rolling-vwap` | Volume | price | TradingView | most liked |
| 1167 | Ross Cameron-Inspired Day Trading Strategy | `ross-cameron-inspired-day-trading-strategy` | Momentum | price | manaziir | batch 25 |
| 1168 | RRR EMA Ignition BUY & SELL (Sideways-Proof) | `rrr-ema-ignition-buy-sell` | Trend | price | RAGSTER123 | batch 21 |
| 1169 | RS Rating (1-99) | `rs-rating` | Momentum | own | kulturdesken | batch 16 |
| 1170 | rs_MACD | `rs-macd` | Momentum | price | RicardoSantos | batch 17 |
| 1171 | RSI | `rsi-hash-capital` | Oscillators | own | Hash_Capital | batch 31 |
| 1172 | RSI & BB Oversold Scalper with MACD Confirmation | `rsi-bb-oversold-scalper-with-macd-confirmation` | Momentum | price | DotGain | batch 40 |
| 1173 | RSI & MACD Suite | `rsi-macd-suite` | Oscillators | own | aaboomar | batch 34 |
| 1174 | RSI (14) with Auto Zone Colors - Overbought/Oversold Highlighter | `rsi-with-auto-zone-colors-overbought-oversold-highlighter` | Oscillators | own | tarangbharti18 | batch 29 |
| 1175 | RSI (Kernel Optimized) \| Flux Charts | `rsi-flux-charts` | Momentum | price | fluxchart | most liked |
| 1176 | RSI + ADX + ATR 18-01-25 | `rsi-adx-atr-18-01-25` | Oscillators | own | dipak11298 | batch 37 |
| 1177 | RSI + ADX + ATR Combo | `rsi-adx-atr-combo` | Oscillators | own | shawasutosh | batch 26 |
| 1178 | RSI + BB + Dispersion | `rsi-bb-dispersion` | Oscillators | own |  |  |
| 1179 | RSI + Fibonacci HH LL Support Resistance | `rsi-fibonacci-hh-ll-support-resistance` | Channels & Bands | price | FibonacciFlux | batch 12 |
| 1180 | RSI + MACD (RSI Divergence) V3.2 | `rsi-macd-v3-2` | Oscillators | own | MKhoa | batch 24 |
| 1181 | RSI + STOCH RSI - Marx_Capital | `rsi-stoch-rsi-marx-capital` | Oscillators | own | Marx_Capital | batch 12 |
| 1182 | RSI - 5UP | `rsi-5up` | Oscillators | own | Marrulk | batch 29 |
| 1183 | RSI Bands | `rsi-bands` | Channels & Bands | price |  |  |
| 1184 | RSI Bars - OnlyFlow | `rsi-bars-onlyflow` | Momentum | price | ofderk | batch 10 |
| 1185 | RSI BB StdDev Signal | `rsi-bb-stddev-signal` | Oscillators | own | trade_lexx (Pine title "RSI Signal [trade_lexx]") | batch 8 |
| 1186 | RSI Candle Color | `rsi-candle-color` | Momentum | price | The_Peaceful_Lizard | batch 39 |
| 1187 | RSI Candles | `rsi-candles` | Momentum | own | Glaz |  |
| 1188 | RSI Confirm Trend with Williams (W%R) | `rsi-confirm-trend-with-williams` | Momentum | own | javageek | batch 11 |
| 1189 | RSI Core Levels Heatmap | `rsi-core-levels-heatmap` | Oscillators | own | BigBeluga | most liked |
| 1190 | RSI cyclic smoothed v2 | `rsi-cyclic-smoothed-v2` | Oscillators | own | StockMarketCycles | most liked |
| 1191 | RSI Divergence | `rsi-divergence` | Oscillators | own |  |  |
| 1192 | RSI Entry Engine | `rsi-entry-engine` | Oscillators | own | tradewsamet | most liked |
| 1193 | RSI Games 1.2 | `rsi-games-1-2` | Oscillators | own | petejfjohnson | batch 22 |
| 1194 | RSI HistoAlert Strategy | `rsi-histoalert` | Oscillators | own |  |  |
| 1195 | RSI Length | `most-rsi` | Momentum | own |  |  |
| 1196 | RSI Length | `parabolic-rsi` | Momentum | own |  |  |
| 1197 | RSI Length | `pmax-rsi-t3` | Momentum | own |  |  |
| 1198 | RSI Length | `rsi-cyclic-smoothed` | Momentum | own |  |  |
| 1199 | RSI MA Cross + Divergence Signal (V2) | `rsi-ma-cross-divergence-signal` | Momentum | price | noxum | batch 39 |
| 1200 | RSI Modified | `rsi-modified` | Oscillators | own | Santos_Trader_PT | batch 5 |
| 1201 | RSI Momentum Divergence | `rsi-momentum-divergence` | Oscillators | own | ChartPrime |  |
| 1202 | RSI Multi Length | `rsi-multi-length` | Oscillators | own | LuxAlgo | most liked |
| 1203 | RSI Multi Levels kiawosch 7-14-42 Consolidation | `rsi-multi-levels` | Oscillators | own | TFlab | batch 5 |
| 1204 | RSI Multicolor editable | `rsi-multicolor-editable` | Oscillators | own | Guillaume46 | batch 8 |
| 1205 | RSI PERFECT Flip Dots | `rsi-perfect-flip-dots` | Momentum | price | debanshuchanda6 | batch 42 |
| 1206 | RSI Potential | `rsi-potential` | Momentum | own | nasu_is_gaji | batch 35 |
| 1207 | RSI Snabbel | `rsi-snabbel` | Oscillators | own |  |  |
| 1208 | RSI Strategy | `rsi-strategy` | Momentum | price | HPotter | most liked |
| 1209 | RSI Supply/Demand | `rsi-supply-demand` | Trend | price | shtcoinr / Lij_MC |  |
| 1210 | RSI Support & Resistance by DGT | `rsi-support-resistance-by-dgt` | Momentum | price | dgtrd | most liked |
| 1211 | RSI Swing Indicator v2 | `rsi-swing-indicator-v2` | Momentum | price | MrDinasty (BalintDavid) | most liked |
| 1212 | RSI Swing Signal | `rsi-swing-signal` | Oscillators | own |  |  |
| 1213 | RSI Tops and Bottoms | `rsi-tops-bottoms` | Momentum | own | LonesomeTheBlue |  |
| 1214 | RSI Trend Bias | `rsi-trend-bias` | Oscillators | own | Botnet101 | batch 24 |
| 1215 | RSI Trend Navigator | `rsi-trend-navigator` | Trend | price | QuantAlgo | batch 10 |
| 1216 | RSI Zone Step Lines | `rsi-zone-step-lines` | Channels & Bands | price | Devjames | batch 11 |
| 1217 | RSI+EMA+MZONES with Divergences | `rsi-ema-mzones-with-divergences` | Oscillators | own | lordoflolz | batch 22 |
| 1218 | RSI+Stoch Band Oscillator | `rsi-stoch-band-oscillator` | Oscillators | own | nasu_is_gaji | batch 26 |
| 1219 | RSI-50 Step Line | `rsi-50-step-line` | Trend | price | Devjames | batch 5 |
| 1220 | RSI-Colored Price Candles with Background | `rsi-colored-price-candles-with-background` | Momentum | price | Midgar- | batch 39 |
| 1221 | RSI-EMA-Crossing with Donchian-Stop-Loss | `rsi-ema-crossing-with-donchian-stop-loss` | Channels & Bands | price | Kahael | batch 28 |
| 1222 | RSI: alternative derivation | `rsi-alternative-derivation` | Oscillators | own | AdaptiveRSI | batch 25 |
| 1223 | RVOL Effort Matrix | `rvol-effort-matrix` | Volume | own | TheLeadingIndicator | batch 36 |
| 1224 | RVOL Relative Volume - Intraday | `rvol-relative-volume-intraday` | Volume | own | LonesomeTheBlue | most liked |
| 1225 | S&R Breakout ATR Confirmation | `s-r-breakout-atr-confirmation` | Trend | price | Jos-ProTrader | batch 33 |
| 1226 | SAR + EMA + MACD Signals | `sar-ema-macd` | Oscillators | price |  |  |
| 1227 | Saty ATR Levels | `saty-atr-levels` | Volatility | price | satymahajan | most liked |
| 1228 | Saty Pivot Ribbon | `saty-pivot-ribbon` | Moving Averages | price | satymahajan | most liked |
| 1229 | Savitzky Flow Bands | `savitzky-flow-bands` | Channels & Bands | price | ChartPrime | batch 2 |
| 1230 | Savitzky-Golay Hampel Filter \| AlphaNatt | `savitzky-golay-hampel-filter-alphanatt` | Moving Averages | price | AlphaNatt | batch 15 |
| 1231 | Scalp Pro | `scalp-pro` | Momentum | own | ovelix | most liked |
| 1232 | Scalping Line | `scalping-line` | Oscillators | own | KivancOzbilgic |  |
| 1233 | Scalping PullBack Tool R1 by JustUncleL | `scalping-pullback-tool` | Trend | price | JustUncleL | most liked |
| 1234 | Scalping Swing Trading Tool R1-4 by JustUncleL | `scalping-swing-trading-tool-r1-4-by-justunclel` | Moving Averages | price | JustUncleL | most liked |
| 1235 | Scalping Tool with Dynamic Take Profit & Stop Loss | `scalping-tool-dynamic-tp-sl` | Trend | price | TruFREND | batch 3 |
| 1236 | ScalpMap - EMA Pivot Targets | `scalpmap-ema-pivot-targets` | Trend | price | blockybears | batch 12 |
| 1237 | SCE GANN Predictions | `sce-gann-predictions` | Trend | price | ScorsoneEnterprises | batch 22 |
| 1238 | Schaff Trend Cycle | `schaff-trend-cycle` | Oscillators | price | LazyBear |  |
| 1239 | SCOTTGO Advanced MACD | `scottgo-advanced-macd` | Momentum | own | SCOTTGO (indicator title "MACD: Clean Visuals (Fixed Arrows)") | batch 27 |
| 1240 | Screener - Mean Reversion Channel | `screener-mean-reversion-channel` | Channels & Bands | price | fareidzulkifli | most liked |
| 1241 | Self-Aware Trend System | `self-aware-trend-system` | Trend | price | WillyAlgoTrader | most liked |
| 1242 | Sell & Buy Rates | `sell-buy-rates` | Volume | own | LonesomeTheBlue |  |
| 1243 | Sequential Pattern Strength | `sequential-pattern-strength` | Momentum | own | QuantAlgo | batch 9 |
| 1244 | Session Liquidity | `session-liquidity` | Channels & Bands | price | Infinity_Trading_ | most liked |
| 1245 | Session Streaks | `session-streaks` | Trend | price | LuxAlgo | most liked |
| 1246 | Session Sweeps | `session-sweeps` | Volatility | price | LuxAlgo | most liked |
| 1247 | Session TPO Market Profile | `session-tpo-market-profile` | Volume | price | noop-noop | most liked |
| 1248 | Sessions | `sessions-luxalgo` | Trend | price | LuxAlgo | most liked |
| 1249 | Sessions on Chart | `sessions-on-chart` | Trend | price | Aurocks_AIF | most liked |
| 1250 | Setup 9.1 (Larry Williams) + EMA 50 | `setup-9-1-ema-50` | Moving Averages | price | oDouglasAlex | batch 7 |
| 1251 | SExI - Super Exhaustion Indicator | `sexi-super-exhaustion-indicator` | Oscillators | own | Da_Prof | batch 14 |
| 1252 | Sharp Modified Moving Average | `sharp-modified-moving-average` | Moving Averages | price | everget | batch 18 |
| 1253 | Sharpe Ratio Indicator (180) | `sharpe-ratio-indicator` | Volatility | own | tim_amblard | batch 3 |
| 1254 | Sharpe Ratio v4 | `sharpe-ratio-v4` | Oscillators | own | Zettt | batch 32 |
| 1255 | Sharpshooter 30 – EMA Distance | `sharpshooter-30-ema-distance` | Moving Averages | price | hrak22 | batch 33 |
| 1256 | Shock Percentile Moving Average \| NAL | `shock-percentile-moving-average-nal` | Moving Averages | price | NordicAlphaLab | batch 22 |
| 1257 | Sigmoid RSI \| NAL | `sigmoid-rsi-nal` | Oscillators | own | NordicAlphaLab | batch 11 |
| 1258 | Signal Forge | `signal-forge` | Trend | price | LuxAlgo | most liked |
| 1259 | Signal Moving Average | `signal-ma` | Moving Averages | price | LuxAlgo |  |
| 1260 | Simple Moving Averages | `simple-moving-averages` | Moving Averages | price |  |  |
| 1261 | Simplified Percentile Clustering | `simplified-percentile-clustering` | Oscillators | own | InvestorUnknown | batch 4 |
| 1262 | Sine Weighted Moving Average | `sine-weighted-moving-average` | Moving Averages | price | everget | batch 13 |
| 1263 | SL - 4 EMAs, 2 SMAs & Crossover Signals | `sl-4-emas-2-smas-crossover-signals` | Moving Averages | price | MVP202020205 | batch 27 |
| 1264 | Slow Heiken Ashi | `slow-heiken-ashi` | Candlestick Patterns | price |  |  |
| 1265 | Slow Stochastic | `slow-stochastic` | Oscillators | own | Oshri17 | most liked |
| 1266 | SMA Angle Alerts | `sma-angle-alerts` | Moving Averages | price | readysetfire | batch 21 |
| 1267 | SMA DMA Crossing Signal | `sma-dma-crossing-signal` | Moving Averages | price | tradingqueen18 | batch 31 |
| 1268 | SMA Squeeze Oscillator | `sma-squeeze-oscillator` | Momentum | own | Uncle_the_shooter | batch 23 |
| 1269 | SMA+ADX Filter | `sma-adx-filter` | Trend | price | iping99 | batch 31 |
| 1270 | Smart Breakout Targets | `smart-breakout-targets` | Volatility | price | WillyAlgoTrader | most liked |
| 1271 | Smart MCDX FINAL PRO | `smart-mcdx-final-pro` | Volume | own | Sachse-1980 | batch 30 |
| 1272 | Smart Money Breakout Channels | `smart-money-breakout-channels` | Channels & Bands | price | AlgoAlpha | most liked |
| 1273 | Smart Money Breakout Signals | `smart-money-breakout-signals` | Trend | price | AlgoAlpha | most liked |
| 1274 | Smart Money Breakouts | `smart-money-breakouts` | Trend | price | ChartPrime | most liked |
| 1275 | Smart Money Concepts (SMC) | `smart-money-concepts-luxalgo` | Trend | price | LuxAlgo | most liked |
| 1276 | Smart Money Concepts Probability (Expo) | `smart-money-concepts-probability` | Trend | price | Zeiierman | most liked |
| 1277 | Smart Money Flow Signals | `smart-money-flow-signals` | Volume | own | QuantAlgo | batch 2 |
| 1278 | Smart Money Range | `smart-money-range` | Volume | price | ChartPrime | most liked |
| 1279 | Smart Money Volume Index | `smart-money-volume-index` | Volume | own | AlgoAlpha | most liked |
| 1280 | Smart Trader, Episode 03, by Ata Sabanci, Candles and Tradelines | `smart-trader-episode-03-by-ata-sabanci` | Trend | price | ata_sabanci | most liked |
| 1281 | Smart Trader, Episode 06, Isotropic Trend Lines | `smart-trader-episode-06-isotropic-trend-lines` | Trend | price | ata_sabanci | most liked |
| 1282 | Smart Trend | `smart-trend` | Trend | price | Zofesu | batch 21 |
| 1283 | Smarter SNR (Support and Ressistance, Trendline, MTF OSC) | `smarter-snr` | Trend | price | hanabil | most liked |
| 1284 | SMC Indicator With Webhook | `smc-indicator-with-webhook` | Trend | price | sunwoo101 | most liked |
| 1285 | SMC Statistical Liquidity Walls | `smc-statistical-liquidity-walls` | Channels & Bands | price | PhenLabs | batch 25 |
| 1286 | SMC Structures and FVG | `smc-structures-and-fvg` | Trend | price | LudoGH68 | most liked |
| 1287 | SMIIOL | `smiiol` | Momentum | own | iilter | batch 25 |
| 1288 | Smooth RSI | `smooth-rsi` | Momentum | own | MarktQuant | batch 8 |
| 1289 | Smoothed Heiken Ashi | `smoothed-heiken-ashi` | Trend | price | jackvmk |  |
| 1290 | Smoothed Low-Pass Butterworth Filtered Median | `butterworth-filtered-median` | Moving Averages | price | AlphaNatt | batch 8 |
| 1291 | Smoothed Source Weighted EMA | `smoothed-source-weighted-ema` | Moving Averages | price | Clokivez | batch 13 |
| 1292 | SMT Divergences | `smt-divergences` | Trend | price | LuxAlgo | most liked |
| 1293 | Source | `ott-bands` | Channels & Bands | price | KivancOzbilgic |  |
| 1294 | Source | `otto` | Oscillators | own | KivancOzbilgic |  |
| 1295 | Source | `range-filter-dw` | Trend | price |  |  |
| 1296 | Source-Aligned Oscillators (for Divergences) | `source-aligned-oscillators` | Oscillators | own | QuantNomad | batch 18 |
| 1297 | SP - MACD with Divergence | `sp-macd-with-divergence` | Momentum | own | ca_sidnayak | batch 24 |
| 1298 | Spira Alligator | `spira-alligator` | Trend | price | Markedsignaler | batch 26 |
| 1299 | SPX500 Quick Drop & Rise Alerts | `spx500-quick-drop-rise-alerts` | Momentum | price | PaperChains | batch 41 |
| 1300 | Squeeze Channel | `squeeze-channel` | Channels & Bands | price | B3AR_Trades | batch 16 |
| 1301 | Squeeze Momentum | `squeeze-momentum` | Momentum | own | LazyBear |  |
| 1302 | Squeeze Momentum Indicator Version2 by KıvanÇ fr3762 | `squeeze-momentum-indicator-version2-by-k-van` | Momentum | own | KivancOzbilgic | most liked |
| 1303 | Squeeze Momentum V2 with Divergence | `squeeze-momentum-v2` | Oscillators | own |  |  |
| 1304 | SSL Channel | `ssl-channel` | Trend | price |  |  |
| 1305 | SSL Hybrid | `ssl-hybrid` | Trend | price | Mihkel00 | most liked |
| 1306 | SSL HYBRID Advanced | `ssl-hybrid-advanced` | Trend | price | traderharikrishna (after "SSL Hybrid" by Mihkel00) | most liked |
| 1307 | SSL Hybrid Scalper | `ssl-hybrid-scalper` | Moving Averages | price | nabeel8369 | batch 11 |
| 1308 | ST0P | `st0p` | Oscillators | price |  |  |
| 1309 | Standardized MACD HA | `standardized-macd-ha` | Momentum | own | EliCobra |  |
| 1310 | Start | `lucid-sar` | Trend | price |  |  |
| 1311 | Statistical Price Deviation Index (MAD/VWMA) | `statistical-price-deviation-index` | Oscillators | own | exploretranspose | batch 16 |
| 1312 | STC Indicator - A Better MACD | `stc-indicator-a-better-macd` | Oscillators | own | shayankm | most liked |
| 1313 | STD-Filtered, N-Pole Gaussian Filter | `std-filtered-n-pole-gaussian-filter` | Moving Averages | price | loxx | most liked |
| 1314 | STH Unrealized Profit/Loss Ratio (STH-NUPL) | `sth-unrealized-profit-loss-ratio` | Oscillators | own | DeVrizii | batch 15 |
| 1315 | Stoch VX3 | `stoch-vx3` | Oscillators | own |  |  |
| 1316 | Stochastic Heat Map | `stochastic-heat-map` | Momentum | own | Violent |  |
| 1317 | Stochastic Momentum Index | `stochastic-momentum-index` | Oscillators | own |  |  |
| 1318 | UCS_Stochastic Momentum Index | `smi-ucs` | Oscillators | own |  |  |
| 1319 | Stochastic OTT | `stochastic-ott` | Oscillators | own | KivancOzbilgic |  |
| 1320 | Stockbee ComboBull | `stockbee-combobull` | Momentum | own | traderabhi81 | batch 29 |
| 1321 | Stockbee Reversal Bullish v2 | `stockbee-reversal-bullish-v2` | Momentum | own | traderabhi81 | batch 29 |
| 1322 | Stop/Take Bounds | `stop-take-bounds` | Volatility | price | Y_Goldman | batch 27 |
| 1323 | Strat Assistant | `strat-assistant` | Trend | price | rickyzcarroll | most liked |
| 1324 | Strength of Divergence Across Multiple Indicators | `strength-of-divergence-across-multiple` | Oscillators | price | reees | most liked |
| 1325 | Strong Burst Fader \| ProjectSyndicate | `strong-burst-fader-projectsyndicate` | Volatility | price | ProjectSyndicate | batch 38 |
| 1326 | Strong Demands & Supplies + Liquidity \| Zonas de Compra e Venda | `strong-demands-supplies-liquidity-zonas-de` | Trend | price | Luis_TudoSobreTrading | most liked |
| 1327 | Strong Engulfing Candlestick (With Alerts) | `strong-engulfing-candlestick` | Candlestick Patterns | price | kyjefive | batch 39 |
| 1328 | Super Guppy | `super-guppy` | Trend | price | JustUncleL |  |
| 1329 | Super OrderBlock / FVG / BoS Tools by makuchaku & eFe | `super-orderblock-fvg-bos` | Trend | price | makuchaku | most liked |
| 1330 | Super SMA 5 8 13 + EMA 20/200 Regime Filter (ALIZET) | `super-sma-5-8-13-ema-20-200-regime-filter` | Moving Averages | price | afdzjr69 | batch 19 |
| 1331 | Super Smoothed MACD | `super-smoothed-macd` | Momentum | own |  |  |
| 1332 | Super SuperTrend | `super-supertrend` | Trend | price |  |  |
| 1333 | Super trend V | `super-trend-v` | Trend | price | RafaelZioni | most liked |
| 1334 | SuperBands | `superbands` | Trend | price | The_Peaceful_Lizard | batch 7 |
| 1335 | SuperBollingerTrend (Expo) | `superbollingertrend` | Trend | price | Zeiierman | most liked |
| 1336 | SuperSmoother MA Oscillator | `supersmoother-ma-oscillator` | Oscillators | own | BOSWaves | batch 1 |
| 1337 | SuperTrend + Relative Volume (Kernel Optimized) | `supertrend-relative-volume-kernel` | Trend | price | fluxchart | most liked |
| 1338 | SuperTrend AI Clustering | `supertrend-ai-clustering` | Trend | price |  |  |
| 1339 | SuperTrend Channels | `supertrend-channels` | Channels & Bands | price |  |  |
| 1340 | Supertrend MTF Heikin Ashi | `supertrend-mtf-heikin-ashi` | Trend | price | LonesomeTheBlue | most liked |
| 1341 | SuperTrend Oscillator | `supertrend-oscillator` | Oscillators | own | LuxAlgo | most liked |
| 1342 | Supply & Demand (MTF) \| Flux Charts | `supply-demand-flux-charts` | Trend | price | fluxchart | most liked |
| 1343 | Supply and Demand Anchored | `supply-and-demand-anchored` | Volume | price | LuxAlgo | most liked |
| 1344 | Supply and Demand Daily | `supply-and-demand-daily` | Volume | price | LuxAlgo | most liked |
| 1345 | Supply and Demand Visible Range | `supply-and-demand-visible-range` | Volume | price | LuxAlgo | most liked |
| 1346 | Supply and Demand Zones | `supply-and-demand-zones` | Volume | price | BigBeluga | most liked |
| 1347 | Supply Demand Profiles | `supply-demand-profiles` | Volume | price | LuxAlgo | most liked |
| 1348 | Supply Demand Zones Pro | `supply-demand-zones-pro` | Channels & Bands | price | ProjectSyndicate | most liked |
| 1349 | Support & Resistance Pro Toolkit | `support-resistance-pro-toolkit` | Trend | price | LuxAlgo | most liked |
| 1350 | Support and Resistance (High Volume Boxes) | `support-resistance-high-volume-boxes` | Volume | price | ChartPrime | most liked |
| 1351 | Support and Resistance (MTF) \| Flux Charts | `support-and-resistance-flux-charts` | Trend | price | fluxchart | most liked |
| 1352 | Support and Resistance Levels with Breaks | `sr-levels-breaks` | Channels & Bands | price |  |  |
| 1353 | Support and Resistance Logistic Regression \| Flux Charts | `support-and-resistance-logistic-regression` | Trend | price | fluxchart | most liked |
| 1354 | Support and Resistance Power Channel | `support-resistance-power-channel` | Trend | price | ChartPrime | most liked |
| 1355 | Support and Resistance Signals MTF | `support-resistance-signals-mtf` | Trend | price | LuxAlgo | most liked |
| 1356 | Support Resistance - Dynamic | `support-resistance-dynamic` | Trend | price | LonesomeTheBlue | most liked |
| 1357 | Support Resistance - Dynamic v2 | `support-resistance-dynamic-v2` | Trend | price | LonesomeTheBlue | most liked |
| 1358 | Support Resistance Channels | `support-resistance-channels` | Trend | price | LonesomeTheBlue |  |
| 1359 | Support Resistance Channels/Zones Multi Time Frame | `support-resistance-channels-mtf` | Trend | price | LonesomeTheBlue | most liked |
| 1360 | Support Resistance Classification (VR) | `support-resistance-classification` | Channels & Bands | price | LuxAlgo | most liked |
| 1361 | Support Resistance Interactive | `support-resistance-interactive` | Trend | price | LonesomeTheBlue | most liked |
| 1362 | Support Resistance MTF | `support-resistance-mtf` | Trend | price | LonesomeTheBlue | most liked |
| 1363 | Support Resistance with Breaks and Retests | `support-resistance-with-breaks-and-retests` | Trend | price | HoanGhetti | most liked |
| 1364 | Support/Resistance Channel Breakout | `support-resistance-channel-breakout` | Channels & Bands | price | SuprAlgo | batch 31 |
| 1365 | Support/Resistance V2 Indicator | `support-resistance-v2-indicator` | Trend | price | BarsStallone | most liked |
| 1366 | Suppot and resistance & BUY SELL SIGNALS | `suppot-and-resistance-buy-sell-signals` | Channels & Bands | price | doganayy2 | batch 20 |
| 1367 | Sweep Candle | `sweep-candle` | Candlestick Patterns | price | odnac | batch 41 |
| 1368 | Sweep Engulf 2 Candle | `sweep-engulf-2-candle` | Candlestick Patterns | price | gastrophollic | batch 41 |
| 1369 | Sweep Engulf CHoCH | `sweep-engulf-choch` | Candlestick Patterns | price | gastrophollic | batch 38 |
| 1370 | Sweep institutional | `sweep-institutional` | Trend | price | Algoryze | most liked |
| 1371 | Sweep2Trade Pro | `sweep2trade-pro` | Trend | price | chervolino | batch 8 |
| 1372 | Swing Anchored Vwap | `swing-anchored-vwap` | Volume | price | BigBeluga | most liked |
| 1373 | Swing Breakout Sequence | `swing-breakout-sequence` | Trend | price | LuxAlgo | most liked |
| 1374 | Swing Failure Pattern (SFP) | `swing-failure-pattern` | Trend | price | LuxAlgo | most liked |
| 1375 | Swing Failure Signals | `swing-failure-signals` | Trend | price | AlgoAlpha | most liked |
| 1376 | Swing High/Low (ZigZag) | `swing-high-low` | Trend | price | ChartPrime | most liked |
| 1377 | Swing Highs/Lows & Candle Patterns | `swing-highs-lows-patterns` | Candlestick Patterns | price | LuxAlgo (Pine v5) |  |
| 1378 | Swing Levels and Liquidity - By Leviathan | `swing-levels-and-liquidity-by-leviathan` | Trend | price | LeviathanCapital | most liked |
| 1379 | Swing Points | `swing-points` | Trend | price | CrossTradeTeam | batch 14 |
| 1380 | Swing Profile | `swing-profile` | Volume | price | BigBeluga | most liked |
| 1381 | Swing Support and Resistance | `swing-support-and-resistance` | Trend | price | VSB-2024 | batch 25 |
| 1382 | Swing Trade Signals | `swing-trade-signals` | Oscillators | price | nicks1008 |  |
| 1383 | Swing Volume Profiles | `swing-volume-profiles` | Volume | price | LuxAlgo | most liked |
| 1384 | SwingArm ATR Trend Indicator | `swingarm-atr-trend-indicator` | Trend | price | vsnfnd (script title "Blackflag FTS") | most liked |
| 1385 | T1 Wyckoff Aggressive A/D Setup | `t1-wyckoff-aggressive-a-d-setup` | Volume | price | Teyo69 | batch 38 |
| 1386 | T3 Length | `t3-psar` | Moving Averages | price |  |  |
| 1387 | TA (Miles) Adaptive Trend | `ta-adaptive-trend` | Trend | price | TradingApologist | batch 27 |
| 1388 | Target Trend | `target-trend` | Trend | price | BigBeluga | most liked |
| 1389 | Targets For Many Indicators | `targets-for-many-indicators` | Trend | price | LuxAlgo | most liked |
| 1390 | Targets For Overlay Indicators | `targets-for-overlay-indicators` | Trend | price | LuxAlgo | most liked |
| 1391 | TASC 2025.02 Autocorrelation Indicator | `tasc-2025-02-autocorrelation` | Oscillators | own | PineCodersTASC | batch 6 |
| 1392 | TASC 2025.06 Cybernetic Oscillator | `tasc-2025-06-cybernetic-oscillator` | Oscillators | own | PineCodersTASC | batch 5 |
| 1393 | TASC 2025.09 The Continuation Index | `tasc-2025-09-the-continuation-index` | Trend | own | PineCodersTASC | batch 14 |
| 1394 | TASC 2026.01 The Reversion Index | `tasc-2026-01-the-reversion-index` | Oscillators | own | PineCodersTASC | batch 26 |
| 1395 | TASC 2026.04 A Synthetic Oscillator | `tasc-2026-04-a-synthetic-oscillator` | Oscillators | own | PineCodersTASC | batch 7 |
| 1396 | TASC 2026.05 The AutoTune Filter | `tasc-2026-05-the-autotune-filter` | Oscillators | own | PineCodersTASC | batch 8 |
| 1397 | TASC 2026.09 Adaptive SuperSmoother | `tasc-2026-09-adaptive-supersmoother` | Moving Averages | own | PineCodersTASC | batch 15 |
| 1398 | TDI - Traders Dynamic Index + RSI Divergences + Buy/Sell Signals | `tdi-traders-dynamic-index-rsi-divergences-buy` | Oscillators | own | ZyadaCharts | most liked |
| 1399 | TDI - Traders Dynamic Index [Goldminds] | `tdi-rsi` | Momentum | own |  |  |
| 1400 | Technical Ratings | `technical-ratings` | Oscillators | own |  | most liked |
| 1401 | Tenkan Cloud Signals | `tenkan-cloud-signals` | Trend | price | CodaPro | batch 11 |
| 1402 | Terminal Velocity Stop \| Lyro RS | `terminal-velocity-stop-lyro-rs` | Trend | price | LyroRS | batch 13 |
| 1403 | TFO + ADX with Histogram & Signal | `tfo-adx-with-histogram-signal` | Oscillators | own | WalrusQuant | batch 26 |
| 1404 | The Echo Forecast | `the-echo-forecast` | Trend | price | LuxAlgo | most liked |
| 1405 | The Jewel | `the-jewel` | Oscillators | own | afonso_77 | batch 37 |
| 1406 | The Mean Goose v1 | `the-mean-goose-v1` | Channels & Bands | price | FattyGuinness | batch 15 |
| 1407 | The Next Pivot | `the-next-pivot` | Trend | price | KioseffTrading | most liked |
| 1408 | The Strat | `the-strat` | Candlestick Patterns | price | shayy110 | batch 42 |
| 1409 | Theil-Sen Line Filter | `theil-sen-line-filter` | Moving Averages | price | BackQuant | batch 18 |
| 1410 | Three Bar Reversal Pattern | `three-bar-reversal-pattern` | Trend | price | LuxAlgo | most liked |
| 1411 | Three Drive Pattern Detector | `three-drive-pattern-detector` | Trend | price | LuxAlgo | most liked |
| 1412 | Three Moving Averages | `three-moving-averages` | Moving Averages | price |  |  |
| 1413 | Three-Bar Reversal/Continuation | `three-bar-reversal-continuation` | Candlestick Patterns | price | abuzka | batch 42 |
| 1414 | Tight Range Display with Background | `tight-range-display-with-background` | Volatility | price | rakeshhelva | batch 42 |
| 1415 | Tillson T3 | `tillson-t3` | Trend | price | KivancOzbilgic (fr3762) |  |
| 1416 | Time-based Alerts for Trading Windows | `time-based-alerts-for-trading-windows` | Trend | price | xhmxdir | batch 41 |
| 1417 | TMA Overlay | `tma-overlay` | Moving Averages | price | ArtyFXC | most liked |
| 1418 | TMO (True Momentum Oscillator) | `tmo` | Momentum | own | Coulisnosaj | batch 15 |
| 1419 | Tom DeMark MACD | `td-macd` | Momentum | own |  |  |
| 1420 | TonyUX EMA Scalper | `tonyux-ema-scalper` | Oscillators | price |  |  |
| 1421 | Top & Bottom Candle | `top-bottom-candle` | Candlestick Patterns | own |  |  |
| 1422 | Tops/Bottoms | `tops-bottoms` | Oscillators | price |  |  |
| 1423 | TR High/Low meter | `tr-high-low-meter` | Momentum | own | dman103 | batch 10 |
| 1424 | Trade Price - Spread Compensator Overlay | `trade-price-spread-compensator-overlay` | Channels & Bands | price | The_Forex_Steward | batch 40 |
| 1425 | Trade Prime - Fluid Trend Indicator | `trade-prime-fluid-trend-indicator` | Trend | price | tradeprime01 | batch 31 |
| 1426 | Trader XO Macro Trend Scanner | `trader-xo` | Oscillators | price |  |  |
| 1427 | Traders Dynamic Index Indicator Alert v0.1 by JustUncleL | `traders-dynamic-index-indicator-alert-v0-1-by` | Oscillators | own | JustUncleL | most liked |
| 1428 | Traders Reality Main | `traders-reality-main` | Trend | price | TradersReality | most liked |
| 1429 | Trading ABC | `trading-abc` | Trend | price | LonesomeTheBlue | most liked |
| 1430 | Trading Activity Index | `trading-activity-index` | Volume | own | Zeiierman | batch 2 |
| 1431 | Trading Gaul | `trading-gaul` | Trend | price | investment20223 | batch 26 |
| 1432 | TradingMoja / SQZMOM ADX | `tradingmoja-sqzmom-adx` | Momentum | own | Trading_Moja | batch 32 |
| 1433 | Trailing Stop Loss Indicator by KıvanÇ fr3762 | `trailing-stop-loss-indicator-by-k-van-fr3762` | Trend | price | KivancOzbilgic | most liked |
| 1434 | Transient Zones v1.1 | `transient-zones` | Channels & Bands | price | Jurij (community) |  |
| 1435 | Tremor Tracker | `tremor-tracker` | Volatility | own | TheUltimator5 | batch 19 |
| 1436 | Trend Channels With Liquidity Breaks | `trend-channels-with-liquidity-breaks` | Channels & Bands | price | ChartPrime | most liked |
| 1437 | Trend Direction Helper (ZigZag and S/R and HH/LL labels) | `trend-direction-helper` | Trend | price | Daveatt (zig zag by Ricardo Santos, pivot levels from Backtest Rookies) | most liked |
| 1438 | Trend Direction Zone | `trend-direction-zone` | Trend | price | MarketStructureLab | batch 16 |
| 1439 | Trend Double Pullbackv1.0 | `trend-double-pullback-v1-0` | Trend | price | puduxbt | batch 26 |
| 1440 | Trend Duration Forecast | `trend-duration-forecast` | Trend | price | ChartPrime | most liked |
| 1441 | Trend Filter (2-pole) | `trend-filter` | Trend | price | BigBeluga | batch 1 |
| 1442 | Trend Flow Oscillator (CMF + MFI) + ADX | `trend-flow-oscillator-adx` | Oscillators | own | WalrusQuant | batch 19 |
| 1443 | Trend Following Moving Averages | `trend-following-ma` | Moving Averages | price | LonesomeTheBlue |  |
| 1444 | Trend Heatmap | `trend-heatmap` | Trend | own | autocrp | batch 30 |
| 1445 | Trend Impulse Channels | `trend-impulse-channels` | Trend | price | Zeiierman |  |
| 1446 | Trend Indicator A-V2 (Smoothed Heikin Ashi Cloud) | `trend-indicator-a-v2` | Trend | price | DZIV | most liked |
| 1447 | Trend Levels | `trend-levels` | Trend | price | ChartPrime | most liked |
| 1448 | Trend Line Auto | `trend-line-auto` | Trend | price | HarryBot |  |
| 1449 | Trend Lines | `trend-lines` | Trend | price | LonesomeTheBlue | most liked |
| 1450 | Trend Lines for RSI, CCI, Momentum, OBV | `trend-lines-for-rsi-cci-momentum-obv` | Oscillators | own | LonesomeTheBlue | most liked |
| 1451 | Trend Lines v2 | `trend-lines-v2` | Trend | price | LonesomeTheBlue (Pine v4) |  |
| 1452 | Trend Magic | `trend-magic` | Trend | price |  |  |
| 1453 | Trend Meter | `trend-meter` | Trend | own | Lij_MC | most liked |
| 1454 | Trend Predictor Ribbon Clone - Fixed roj karo moj karo | `trend-predictor-ribbon` | Trend | price | ronitjain18 | batch 6 |
| 1455 | Trend Pulse Oscillator | `trend-pulse-oscillator` | Oscillators | own | ChaosTrader63 | batch 35 |
| 1456 | Trend Range Detector | `trend-range-detector` | Channels & Bands | price | Zeiierman | most liked |
| 1457 | Trend Regularity Adaptive MA | `trama` | Moving Averages | price | LuxAlgo |  |
| 1458 | Trend Scalper | `trend-scalper` | Moving Averages | price | abedmahmood | batch 35 |
| 1459 | Trend State Signals | `trend-state-signals` | Trend | price | MarketStructureLab | batch 4 |
| 1460 | Trend Strength/Direction | `trend-strength-direction` | Trend | own | ddcakez | batch 32 |
| 1461 | Trend Targets | `trend-targets` | Trend | price | AlgoAlpha | most liked |
| 1462 | Trend Trader Strategy | `trend-trader` | Trend | price |  |  |
| 1463 | Trend Trigger Factor | `trend-trigger-factor` | Oscillators | own |  |  |
| 1464 | Trend Type Indicator by BobRivera990 | `trend-type-indicator-by-bobrivera990` | Trend | own | BobRivera990 | most liked |
| 1465 | Trend Volatility Index (TVI) | `trend-volatility-index` | Volatility | own | chikaharu | batch 3 |
| 1466 | Trend with ADX/EMA - Buy & Sell Signals | `trend-with-adx-ema-buy-sell-signals` | Trend | price | RMPM | batch 28 |
| 1467 | Trend-Pro | `trend-pro` | Trend | price | andrwxwy | batch 38 |
| 1468 | TrendCylinder (Expo) | `trendcylinder` | Trend | price | Zeiierman | batch 4 |
| 1469 | Trending Market Toolkit | `trending-market-toolkit` | Trend | price | LuxAlgo | most liked |
| 1470 | Trendline Breakout Navigator | `trendline-breakout-navigator` | Trend | price | LuxAlgo | most liked |
| 1471 | Trendline Breakouts With Targets | `trendline-breakouts-with-targets` | Trend | price | ChartPrime | most liked |
| 1472 | Trendlines - JD | `trendlines-jd` | Trend | price | Duyck | most liked |
| 1473 | Trendlines 2x + | `trendlines-2x` | Trend | price | Lij_MC | most liked |
| 1474 | Trendlines with Breaks [LuxAlgo] | `trendlines-with-breaks` | Trend | price | LuxAlgo |  |
| 1475 | TrendMasterPro_Fekonomi | `trendmasterpro-fekonomi` | Trend | price | fekonomi | batch 20 |
| 1476 | Trendshift | `trendshift` | Trend | price | chervolino | batch 39 |
| 1477 | TrendShift Detector | `trendshift-detector` | Candlestick Patterns | price | GIANESELLI | batch 40 |
| 1478 | TRENDSYNC BUY/SELL BY SIMPLY_DANTE-FX | `trendsync-buy-sell-by-simply-dante-fx` | Trend | price | Simply_Dante-fx | batch 36 |
| 1479 | TrendWave Bands | `trendwave-bands` | Channels & Bands | price | BigBeluga | batch 1 |
| 1480 | Triangular Hull Moving Average + Volatility | `triangular-hull-moving-average-volatility` | Trend | price | BigBeluga | most liked |
| 1481 | Triangular MA Bands | `tma-bands` | Channels & Bands | price |  |  |
| 1482 | Triangular Momentum Oscillator | `triangular-momentum-osc` | Oscillators | own |  |  |
| 1483 | Trimmed Mean ATR Bands | `trimmed-mean-atr-bands` | Channels & Bands | price | CryptoNejc | batch 17 |
| 1484 | Triple Doji Sequence | `triple-doji-sequence` | Candlestick Patterns | price | Marc_Thiart | batch 39 |
| 1485 | Triple Gaussian Smoothed Ribbon | `triple-gaussian-smoothed-ribbon` | Trend | price | BOSWaves | batch 16 |
| 1486 | Triple MA For Loop | `triple-ma-for-loop` | Trend | own | SeerQuant | batch 7 |
| 1487 | Triple MA Forecast | `triple-ma-forecast` | Moving Averages | price | yatrader2 (community) |  |
| 1488 | Triple RSI \| MisinkoMaster | `triple-rsi-misinkomaster` | Momentum | own | MisinkoMaster | batch 19 |
| 1489 | True Breakout Pattern Breakout Signal Indicator | `true-breakout-pattern-breakout-signal` | Trend | price | TradingFinder | most liked |
| 1490 | True High/Low RSI for Divergence | `true-high-low-rsi-for-divergence` | Oscillators | own | Lakt_ | batch 29 |
| 1491 | True Range eXpansion | `true-range-expansion` | Volatility | price | Sherlock_MacGyver | batch 22 |
| 1492 | TTM Squeeze | `ttm-squeeze-greeny` | Momentum | own | Greeny | most liked |
| 1493 | TTM Squeeze Pro | `ttm-squeeze-pro` | Oscillators | own | John Carter |  |
| 1494 | TTrades Daily Bias | `ttrades-daily-bias` | Trend | price | tradeforopp | most liked |
| 1495 | Turtle Soup ICT Strategy FVG + CHoCH/CSD | `turtle-soup-ict-strategy-fvg-choch-csd` | Trend | price | TradingFinder | most liked |
| 1496 | Turtle Trade Channels | `turtle-trade-channels` | Channels & Bands | price | Richard Dennis / William Eckhardt |  |
| 1497 | Tweezers & Kangaroo Tail | `tweezers-kangaroo-tail` | Candlestick Patterns | price | LonesomeTheBlue |  |
| 1498 | Twin Range Filter | `twin-range-filter` | Trend | price | colinmck |  |
| 1499 | Twin Range Filter Visualized | `twin-range-filter-visualized` | Trend | price | KivancOzbilgic | most liked |
| 1500 | Two-Pole Oscillator | `two-pole-oscillator` | Oscillators | own | BigBeluga | most liked |
| 1501 | Ultimate Buy & Sell | `ultimate-buy-sell` | Trend | price |  |  |
| 1502 | Ultimate Moving Average-Multi-TimeFrame-7 MA Types | `ultimate-moving-average-mtf` | Moving Averages | price | ChrisMoody | most liked |
| 1503 | Ultimate Opening Range Breakout | `ultimate-opening-range-breakout` | Volatility | price | LuxAlgo | most liked |
| 1504 | Ultimate RSI [LuxAlgo] | `ultimate-rsi` | Momentum | own | LuxAlgo |  |
| 1505 | Ultra Clean Support / Resistance Levels | `ultra-clean-support-resistance-levels` | Trend | price | Stocktitian | batch 30 |
| 1506 | Ultra Smart Trail | `ultra-smart-trail` | Trend | price | Rathack | batch 18 |
| 1507 | UM EMA SMA WMA HMA with Directional Color Change | `um-ema-sma-wma-hma-with-directional-color-change` | Moving Averages | price | UnderwearMillionaire | batch 30 |
| 1508 | Unicorn Setup Detector (aziz abid) | `unicorn-setup-detector` | Trend | price | mohammedazizabid | batch 40 |
| 1509 | Universal Large Orders Proxy fabio valentini Chat gpt Recreation | `universal-large-orders-proxy-fabio-valentini-chat-gpt-recreation` | Volume | price | boss11233 | batch 18 |
| 1510 | Universal Signal Backtester | `universal-signal-backtester` | Trend | price | LuxAlgo | most liked |
| 1511 | Uptrick: Dynamic Z-Score Deviation | `uptrick-dynamic-z-score-deviation` | Trend | price | Uptrick | batch 6 |
| 1512 | Uptrick: Liquid Reversal Bands | `liquid-reversal-bands` | Channels & Bands | price | Uptrick | batch 3 |
| 1513 | Uptrick: MultiMA_Volume | `uptrick-multima-volume` | Moving Averages | price | Uptrick | batch 16 |
| 1514 | Uptrick: RSI MA Buying/Selling signals | `uptrick-rsi-ma-buying-selling-signals` | Momentum | own | Uptrick | batch 12 |
| 1515 | Uptrick: Trend Analysis | `uptrick-trend-analysis` | Momentum | own | Uptrick | batch 14 |
| 1516 | Uptrick: Volatility Reversion Bands | `uptrick-volatility-reversion-bands` | Channels & Bands | price | Uptrick | batch 4 |
| 1517 | Uptrick: Zero Lag HMA Trend Suite | `zero-lag-hma-trend-suite` | Moving Averages | price | Uptrick | batch 3 |
| 1518 | User Defined Range Selector and Color Changing EMA Line | `user-defined-range-selector-and-color-changing-ema-line` | Moving Averages | price | Crypto_Moses | batch 23 |
| 1519 | UT Bot | `ut-bot` | Trend | price |  |  |
| 1520 | Ut bot - Trend+volume | `ut-bot-trend-volume` | Trend | price | BhargavMeghnathi | batch 40 |
| 1521 | Vacuum Candles | `vacuum-candles` | Volume | price | XrayAlgo | batch 41 |
| 1522 | Variable Moving Average | `variable-ma` | Moving Averages | price | LazyBear |  |
| 1523 | VARIS Zones | `varis-zones` | Channels & Bands | price | IAmTheLiquidity2 | batch 17 |
| 1524 | VCO Fusion | `vco-fusion` | Oscillators | own | Uncle_the_shooter | batch 20 |
| 1525 | Vdub FX Sniper | `vdub-sniper` | Oscillators | price | Vdubus |  |
| 1526 | VDUB_BINARY_PRO_3_V2  FINAL + Strategy | `vdub-binary-pro-3-v2` | Channels & Bands | price | vdubus | most liked |
| 1527 | vdub_Trend_Master_v  /  v1 / v2 / v3 | `vdub-trend-master-v-v1-v2-v3` | Trend | price | vdubus | most liked |
| 1528 | vdubus BinaryPro | `vdubus-binarypro` | Oscillators | price |  |  |
| 1529 | Vdubus Divergence Wave Pattern Generator V1 | `vdubus-divergence-wave-pattern-generator-v1` | Trend | price | vdubus | most liked |
| 1530 | VEGA (Velocity of Efficient Gain Adaptation) | `vega` | Momentum | own | B3AR_Trades | batch 20 |
| 1531 | Vervoort HA LT Candlestick Oscillator | `vervoort-ha-oscillator` | Oscillators | own |  |  |
| 1532 | VIM (Volume in Money) | `vim` | Volume | own | tbtb1111 | batch 29 |
| 1533 | Visualisation tendances | `visualisation-tendances` | Trend | price | Benjamin69 | batch 17 |
| 1534 | Volatility & Big Market Moves | `volatility-big-market-moves` | Volatility | own | nilstrades_ | batch 24 |
| 1535 | Volatility Adaptive Filtered Trend | `volatility-adaptive-filtered-trend` | Trend | price | SchizoQuant | batch 6 |
| 1536 | Volatility Band Cloud with Overextension Signals | `volatility-band-cloud-with-overextension-signals` | Channels & Bands | price | Retire_by_50 | batch 35 |
| 1537 | Volatility Bands | `volatility-bands` | Channels & Bands | price | pmk07 | batch 23 |
| 1538 | Volatility Breakout Pulse (VBP FIX) | `volatility-breakout-pulse` | Channels & Bands | price | JohnsonForexTrader | batch 36 |
| 1539 | Volatility Channel Oscillator | `volatility-channel-oscillator` | Oscillators | own | Uncle_the_shooter | batch 3 |
| 1540 | Volatility Halo \| NAL | `volatility-halo-nal` | Volatility | price | NordicAlphaLab | batch 6 |
| 1541 | Volatility Quality | `volatility-quality` | Volatility | own | AlphaExtract | batch 18 |
| 1542 | Volatility-Driven VWAP Structure | `volatility-driven-vwap-structure` | Channels & Bands | price | Zeiierman | batch 3 |
| 1543 | Volatility-Gated Trend Oscillator | `volatility-gated-trend-oscillator` | Oscillators | own | QuantAlgo | batch 9 |
| 1544 | VOLD Ratio Histogram | `vold-ratio-histogram` | Volume | own | Th16rry | batch 23 |
| 1545 | Volumatic Fair Value Gaps | `volumatic-fair-value-gaps` | Volume | price | BigBeluga | most liked |
| 1546 | Volumatic S/R Levels | `volumatic-sr-levels` | Trend | price | BigBeluga |  |
| 1547 | Volumatic Variable Index Dynamic Average | `volumatic-variable-index-dynamic-average` | Trend | price | BigBeluga | most liked |
| 1548 | Volume + RSI & MA Differential | `volume-rsi-ma-differential` | Volume | own | ozzy_livin | batch 7 |
| 1549 | Volume / Open Interest "Footprint" - By Leviathan | `volume-open-interest-footprint-by-leviathan` | Volume | price | LeviathanCapital | most liked |
| 1550 | Volume Accumulation Percentage | `volume-accumulation-pct` | Volume | own |  |  |
| 1551 | Volume Alert | `volume-alert` | Volume | price | oDouglasAlex | batch 42 |
| 1552 | Volume Analysis - Heatmap and Volume Profile | `volume-analysis-heatmap-and-volume-profile` | Volume | own | LonesomeTheBlue | most liked |
| 1553 | Volume and Volatility Ratio Indicator-WODI | `volume-and-volatility-ratio-indicator-wodi` | Volume | own | W0DI | batch 16 |
| 1554 | Volume Bands | `volume-bands` | Channels & Bands | price | MisinkoMaster | batch 6 |
| 1555 | Volume bar range | `volume-bar-range` | Volume | price | pandorid | batch 25 |
| 1556 | Volume Bars Color | `volume-bars-color` | Volume | own | Evgenyc111 | batch 20 |
| 1557 | Volume Bubbles & Liquidity Heatmap | `volume-bubbles-liquidity-heatmap` | Volume | price | LuxAlgo | most liked |
| 1558 | Volume Buy/Sell Split | `volume-buy-sell-split` | Volume | own | LHAMA-Trading | batch 26 |
| 1559 | Volume Candle Coloring v5 (BARCOLOR STABLE) | `volume-candle-coloring-v5` | Volume | price | sugogou | batch 37 |
| 1560 | Volume Candle Highlighter | `volume-candle-highlighter` | Volume | price | Dougie_dee | batch 5 |
| 1561 | Volume Candles | `volume-candles` | Volume | price | alexrainman | batch 39 |
| 1562 | Volume Colored Bars | `volume-colored-bars` | Volume | own |  |  |
| 1563 | Volume Comparison with Buyer/Seller Pressure | `volume-comparison-with-buyer-seller-pressure` | Volume | own | ask2maniish | batch 26 |
| 1564 | Volume Divergence | `volume-divergence` | Volume | own | baymucuk |  |
| 1565 | Volume Flow Indicator | `volume-flow-indicator` | Volume | own |  |  |
| 1566 | Volume Flow v3 | `volume-flow-v3` | Volume | own | DepthHouse / oh92 (community) |  |
| 1567 | Volume Footprint | `volume-footprint` | Volume | price | LuxAlgo |  |
| 1568 | Volume Footprint: Measuring by Math & Geometry | `volume-footprint-measuring-by-math-geometry` | Volume | price | ata_sabanci | most liked |
| 1569 | Volume Gaps & Imbalances | `volume-gaps-imbalances` | Volume | price | Zeiierman | most liked |
| 1570 | Volume HeatMap Divergence | `volume-heatmap-divergence` | Volume | price | BigBeluga | most liked |
| 1571 | Volume LinReg Trend | `volume-linreg-trend` | Volume | own | LonesomeTheBlue |  |
| 1572 | Volume Order Blocks | `volume-order-blocks` | Volume | price | BigBeluga | most liked |
| 1573 | Volume Orderbook (Expo) | `volume-orderbook` | Volume | price | Zeiierman | most liked |
| 1574 | Volume Positive Negative (VPN) | `volume-positive-negative` | Volume | own | LevelUpTools | batch 2 |
| 1575 | Volume Price Confirmation Indicator | `vpci` | Volume | own |  |  |
| 1576 | Volume Profile | `volume-profile` | Volume | price | LuxAlgo | most liked |
| 1577 | Volume Profile (kv4coins) | `volume-profile-kv4coins` | Volume | price | kv4coins | most liked |
| 1578 | Volume Profile + Pivot Levels | `volume-profile-pivot-levels` | Volume | price | ChartPrime | most liked |
| 1579 | Volume Profile / Fixed Range | `volume-profile-fixed-range` | Volume | price | LonesomeTheBlue | most liked |
| 1580 | Volume Profile Auto | `volume-profile-auto` | Volume | price | fikira | most liked |
| 1581 | Volume Profile Free Pro (25 Levels Value Area VWAP) by RRB | `volume-profile-free-pro-by-rrb` | Volume | price | RagingRocketBull | most liked |
| 1582 | Volume Profile Free Ultra SLI (100 Levels Value Area VWAP) - RRB | `volume-profile-free-ultra-sli` | Volume | price | RagingRocketBull | most liked |
| 1583 | Volume Profile Heatmap | `volume-profile-heatmap` | Volume | price | KeyAlgos | batch 13 |
| 1584 | Volume Profile per day with support/resistance lines | `volume-profile-per-day-with-support` | Volume | price | juliangonzaconde | most liked |
| 1585 | Volume Profile Plus | `volume-profile-plus` | Volume | price | AlphaViz | most liked |
| 1586 | Volume Profile, Pivot Anchored by DGT | `volume-profile-pivot-anchored` | Volume | price | dgtrd | most liked |
| 1587 | Volume Sentiment Breakout Channels | `volume-sentiment-breakout-channels` | Channels & Bands | price | AlgoAlpha | most liked |
| 1588 | Volume Spike and Contraction Indicator | `volume-spike-and-contraction-indicator` | Volume | price | epicurusMcPot | batch 41 |
| 1589 | Volume Spike Indicator | `volume-spike-indicator` | Volume | price | rikyu04 | batch 42 |
| 1590 | Volume Suite - By Leviathan (CVD, Volume Delta, Relative Volume) | `volume-suite-by-leviathan` | Volume | own | LeviathanCapital | most liked |
| 1591 | Volume SuperTrend AI (Expo) | `volume-supertrend-ai` | Trend | price |  |  |
| 1592 | Volume Surge Detector | `volume-surge-detector` | Volume | own | SpeculationLab | batch 19 |
| 1593 | Volume Variation Index Indicator | `volume-variation-index-indicator` | Volume | own | thequantscience | batch 35 |
| 1594 | Volume Weighted MACD V2 | `vw-macd-v2` | Momentum | own |  |  |
| 1595 | VOLUME WEIGHTED MACD V2 | `volume-weighted-macd-v2-vwmacdv2-by-kivan` | Momentum | own | KivancOzbilgic | most liked |
| 1596 | Volume Weighted Median Price (VWMP) | `volume-weighted-median-price` | Moving Averages | price | vsov | batch 14 |
| 1597 | Volume Weighted RSI (VW RSI) | `volume-weighted-rsi` | Momentum | own | CsokosGeza | batch 34 |
| 1598 | Volume Weighted Trend | `volume-weighted-trend` | Trend | price | QuantAlgo | batch 1 |
| 1599 | Volume with Alert | `volume-with-alert` | Volume | own | BullBearSR | batch 30 |
| 1600 | Volume with EMA and Coloring Rules | `volume-with-ema-and-coloring-rules` | Volume | own | itisfilipe | batch 37 |
| 1601 | Volume-Based Moving Average | `volume-based-moving-average` | Moving Averages | price | The_Forex_Steward | batch 36 |
| 1602 | Volume-Based RSI Color Indicator with MAs | `volume-based-rsi-color-indicator-with-mas` | Oscillators | own | Riccardo02 | batch 32 |
| 1603 | Volume-based Support & Resistance Zones | `volume-based-support-resistance-zones` | Volume | price | tommyf1001 | most liked |
| 1604 | Volume-Gated Trend Ribbon | `volume-gated-trend-ribbon` | Trend | price | QuantAlgo | batch 3 |
| 1605 | Volume-Trend Order Block Engine | `volume-trend-order-block-engine` | Trend | price | BigBeluga | most liked |
| 1606 | Volume-Weighted MA Crossover | `volume-weighted-ma-crossover` | Moving Averages | price | AlphaNatt | batch 9 |
| 1607 | Volume-Weighted Money Flow | `volume-weighted-money-flow` | Volume | own | sgbpulse | batch 33 |
| 1608 | Volume-Weighted Order Block Zones | `volume-weighted-order-block-zones` | Volume | price | BigBeluga | most liked |
| 1609 | Volume-Weighted Pivot Bands | `volume-weighted-pivot-bands` | Channels & Bands | price | LeafAlgo | batch 33 |
| 1610 | Volume-Weighted Price Z-Score | `volume-weighted-price-z-score` | Oscillators | own | QuantAlgo | batch 6 |
| 1611 | Volumetric Compressed MA | `volumetric-compressed-ma` | Moving Averages | price | serkany88 | batch 14 |
| 1612 | Volumetric Entropy Index | `volumetric-entropy-index` | Volume | own | Sherlock_MacGyver | batch 27 |
| 1613 | Volumetric Order Flow Structure | `volumetric-order-flow-structure` | Trend | price | LuxAlgo | most liked |
| 1614 | Volumetric Tensegrity | `volumetric-tensegrity` | Volume | own | TheLeadingIndicator | batch 30 |
| 1615 | VolVol | `volvol` | Volume | price | kunalgolani | batch 26 |
| 1616 | Vortex Pro with Moving average | `vortex-pro-with-moving-average` | Oscillators | own | pointalgo | batch 25 |
| 1617 | Voss Predictive Filter | `voss-predictive-filter` | Oscillators | own | e2e4 | batch 8 |
| 1618 | VPSA-VTD | `vpsa-vtd` | Volume | own | CatTheTrader | batch 11 |
| 1619 | Vulkan Profit | `vulkan-profit` | Trend | price | AlgoCollective | batch 33 |
| 1620 | VuManChu Swing Free | `vumanchu-swing` | Trend | price |  |  |
| 1621 | VWAP & Dual MA Ribbon Tracker Pro | `vwap-dual-ma-ribbon-tracker-pro` | Trend | own | Simon20cent | batch 19 |
| 1622 | VWAP Deviation Oscillator | `vwap-deviation-oscillator` | Oscillators | own | BackQuant | batch 9 |
| 1623 | VWAP MTF (Multi Timeframe) | `vwap-mtf` | Volume | price | TheYangGuizi | most liked |
| 1624 | VWAP Periodic Close | `vwap-periodic-close` | Volume | price | LuxAlgo | most liked |
| 1625 | VWAP Predictive Breakout + RSI + OB + Trend/Chop | `vwap-predictive-breakout-rsi-ob-trend-chop` | Volume | price | Viggy02 | batch 31 |
| 1626 | VWAP Stdev Bands v2 Mod | `vwap-stdev-bands-v2-mod` | Channels & Bands | price | TheYangGuizi | most liked |
| 1627 | VWAP Supply & Demand Zones PRO | `vwap-supply-demand-zones-pro` | Channels & Bands | price | Finntech1 | most liked |
| 1628 | VWAP Volume Profile | `vwap-volume-profile` | Volume | price | BigBeluga | most liked |
| 1629 | VWAP/MVWAP/EMA Crossover | `vwap-mvwap-ema-crossover` | Trend | price | DerrickLaFlame |  |
| 1630 | VWMA/SMA Delta Volatility (Statistical Anomaly Detector) | `vwma-sma-delta-volatility` | Volatility | own | tkarolak | batch 14 |
| 1631 | VWMACD-MFI-OBV Composite | `vwmacd-mfi-obv-composite` | Volume | own | munair | batch 27 |
| 1632 | VWRSI Crossovers & Extremes | `vwrsi-crossovers-extremes` | Momentum | own | TheAITradingDesk | batch 35 |
| 1633 | Waddah Attar Explosion | `waddah-attar-explosion` | Momentum | own | LazyBear/ShayanKM |  |
| 1634 | WAE Sniper Scalp XAUUSD M1 Tuned | `wae-sniper-scalp-xauusd-m1-tuned` | Momentum | own | khonthailoei19071983 | batch 19 |
| 1635 | Waindrops | `waindrops` | Volume | price | makit0 | most liked |
| 1636 | Wave N + KDJ + Volumi + SMC + Ichimoku | `wave-n-kdj-volumi-smc-ichimoku` | Trend | price | Nikus63 | batch 31 |
| 1637 | WaveFunction MACD | `wavefunction-macd` | Momentum | own | TechnoBlooms | batch 27 |
| 1638 | Wavelet Filter with Adaptive Upsampling | `wavelet-filter-with-adaptive-upsampling` | Oscillators | own | BackQuant | batch 29 |
| 1639 | Wavelet Transform Trend | `wavelet-transform-trend` | Trend | price | QuantAlgo | batch 12 |
| 1640 | Wavelet-Trend ML Integration | `wavelet-trend-ml-integration` | Oscillators | own | AlphaExtract | batch 1 |
| 1641 | WaveTrend | `wavetrend` | Oscillators | own | LazyBear |  |
| 1642 | WaveTrend Oscillator | `wavetrend-oscillator` | Momentum | own | LazyBear |  |
| 1643 | WaveTrend Oscillator + Divergence  + Direction Detection +Alerts | `wavetrend-oscillator-divergence-direction` | Oscillators | own |  | most liked |
| 1644 | Wedge and Flag Finder (Multi - zigzag) | `wedge-and-flag-finder` | Trend | price | Trendoscope | most liked |
| 1645 | Weierstrass Function (Fractal Cycles) | `weierstrass-function` | Oscillators | own | fract | batch 17 |
| 1646 | Weighted percentile nearest rank | `weighted-percentile-nearest-rank` | Moving Averages | price | gorx1 | batch 10 |
| 1647 | Weighted Regression Bands | `weighted-regression-bands` | Channels & Bands | price | Zeiierman | batch 5 |
| 1648 | Weis Wave Candle | `weis-wave-candle` | Trend | own | Uncle_the_shooter | batch 34 |
| 1649 | Weis Wave Volume | `weis-wave-volume` | Volume | own |  |  |
| 1650 | Whale Activity Impact Oscillator | `whale-activity-impact-oscillator` | Volume | own | mdeacey | batch 18 |
| 1651 | Whale Liquidity and Absorption Profile | `whale-liquidity-and-absorption-profile` | Volume | price | AlgoAlpha | most liked |
| 1652 | Whale Volume Absorption & Aggression @MaxMaserati 3.0 | `whale-volume-absorption-aggression-maxmaserati-3-0` | Volume | own | MaxMaserati | batch 22 |
| 1653 | Wick Volume Alert | `wick-volume-alert` | Candlestick Patterns | price | Shazam77 | batch 41 |
| 1654 | WICK.ED Fractals | `wicked-fractals` | Oscillators | price | Mit Nayi (community) |  |
| 1655 | Williams Alligator + Fractals | `williams-combo` | Trend | price | vlkvr (Pine v3) |  |
| 1656 | Williams BBDiv Signal | `williams-bbdiv-signal` | Oscillators | own | trade_lexx | batch 20 |
| 1657 | Williams Percent Range with Threshold | `williams-percent-range-with-threshold` | Oscillators | own | xdextra | batch 29 |
| 1658 | Williams Vix Fix | `williams-vix-fix` | Volatility | own | ChrisMoody |  |
| 1659 | WLSMA: fast approximation | `wlsma-fast-approximation` | Moving Averages | price | gorx1 | batch 33 |
| 1660 | Wolfe Scanner (Multi - zigzag) | `wolfe-scanner` | Trend | price | Trendoscope | most liked |
| 1661 | Wyckoff Effort vs. Result | `wyckoff-effort-vs-result` | Volume | price | TradeTechanalysis | batch 34 |
| 1662 | x5-smooth-ema | `x5-smooth-ema` | Moving Averages | price | traderninezero | batch 19 |
| 1663 | XAUUSD Buy/Sell Alerts with SL & TP | `xauusd-buy-sell-alerts-with-sl-tp` | Moving Averages | price | alexandrossolomou1 | batch 8 |
| 1664 | XAUUSD Family Scalping (5min) | `xauusd-family-scalping` | Oscillators | price | cupra_inc | batch 8 |
| 1665 | Z-Score | `z-score` | Oscillators | own | joecalledher | batch 21 |
| 1666 | Z-Score Oscillator | `z-score-oscillator` | Oscillators | own | B3AR_Trades | batch 12 |
| 1667 | Z-Score STDEMA Bands | `z-score-stdema-bands` | Oscillators | own | TiagoTF | batch 24 |
| 1668 | Z-Score Trend Monitor | `z-score-trend-monitor` | Oscillators | own | EdgeTerminal | batch 31 |
| 1669 | Zero Lag Liquidity | `zero-lag-liquidity` | Volume | price | AlgoAlpha | most liked |
| 1670 | Zero Lag LSMA (ZLSMA) | `zlsma` | Moving Averages | price | veryfid |  |
| 1671 | Zero Lag MACD | `zero-lag-macd` | Momentum | own | AC (based on Glaz) |  |
| 1672 | Zero Lag Signals For Loop | `zero-lag-signals-for-loop` | Trend | price | QuantAlgo | batch 1 |
| 1673 | Zero Lag Trend Signals (MTF) | `zero-lag-trend-signals` | Trend | price | AlgoAlpha | most liked |
| 1674 | Zero-Lag GARCH Bands \| NAL | `zero-lag-garch-bands-nal` | Volatility | price | NordicAlphaLab | batch 12 |
| 1675 | Zig Zag Channels | `zig-zag-channels` | Channels & Bands | price | LuxAlgo | most liked |
| 1676 | ZigZag Multi Time Frame with Fibonacci Retracement | `zigzag-multi-time-frame-with-fibonacci` | Trend | price | LonesomeTheBlue | most liked |
| 1677 | ZigZag Multiple Methods - Forecast - patterns - labels | `zigzag-multiple-methods-forecast-patterns` | Trend | price | RicardoSantos | most liked |
| 1678 | ZigZag Percent Reversal - Forecast - patterns - labels | `zigzag-percent-reversal-forecast-patterns` | Trend | price | RicardoSantos | most liked |
| 1679 | Zigzag Trend/Divergence Detector | `zigzag-trend-divergence-detector` | Trend | price | Trendoscope | most liked |
| 1680 | ZigZag with Fibonacci Levels | `zigzag-fibonacci` | Trend | price | LonesomeTheBlue |  |
| 1681 | Zone Shift | `zone-shift` | Trend | price | ChartPrime | most liked |
| 1682 | ZVOL - Z-Score Volume Heatmap | `zvol-z-score-volume-heatmap` | Volume | own | TheLeadingIndicator | batch 28 |
| 1683 | 🌊 ALMA Bands | `alma-bands` | Moving Averages | price | B3AR_Trades | batch 26 |
