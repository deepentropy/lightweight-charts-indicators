# Community Indicator Inventory

Community indicators of `lightweight-charts-indicators`: TypeScript ports of community PineScript scripts, built on
[oakscriptjs](https://github.com/deepentropy/oakscriptJS). Each port has the inputs, plots and drawings of its Pine
source. This list is generated from the indicator registry (`indicatorRegistry` in `src/index.ts`).

## Summary

| | Count |
|---|---|
| **Community indicators** | 1699 |
| Drawn on the price pane (overlay) | 1147 |
| Drawn in their own pane | 552 |
| Compared with reference outputs (batches 1-42 and the most liked set) | 1392 |

| Category | Count |
|---|---|
| Trend | 579 |
| Oscillators | 269 |
| Volume | 227 |
| Momentum | 169 |
| Moving Averages | 163 |
| Channels & Bands | 173 |
| Candlestick Patterns | 61 |
| Volatility | 58 |

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
| 77 | AI Moving Average (Expo) | `ai-moving-average` | Moving Averages | price | Zeiierman | most liked |
| 78 | AI Source Switching Moving Average | `ai-source-switching-moving-average` | Moving Averages | price | Zeiierman | batch 1 |
| 79 | AI Trading Assistant v2 | `ai-trading-assistant-v2` | Trend | price | Alchemical_Carpenter | batch 26 |
| 80 | AI Trend Navigator [K-Neighbor] | `ai-trend-navigator` | Trend | price |  |  |
| 81 | AI Volume Signals | `ai-volume-signals` | Volume | price | szymonsobkowiak | batch 9 |
| 82 | AI-Weighted RSI | `ai-weighted-rsi` | Oscillators | own | Zeiierman | batch 3 |
| 83 | AK MACD BB | `macd-bb` | Momentum | own | Algokid |  |
| 84 | AK TREND ID | `ak-trend-id` | Trend | own | Algokid |  |
| 85 | Al Brooks II.IOI.OO | `al-brooks-ii-ioi-oo` | Candlestick Patterns | price |  | batch 42 |
| 86 | Al Po's Arithmetic Mean | `al-po-s-arithmetic-mean` | Moving Averages | price | sequentialvision | batch 21 |
| 87 | Algo Market Structure | `algo-market-structure` | Trend | price | nephew_sam_ | most liked |
| 88 | All Candlestick Patterns | `all-candlestick-patterns` | Candlestick Patterns | price |  |  |
| 89 | All-In-One MA Stack Scalper | `all-in-one-ma-stack-scalper` | Moving Averages | price | jonesdaniel2112 | batch 33 |
| 90 | ALL-IN-ONE RSI System (Cloud Divergence Stoch RSI CM WVF) | `all-in-one-rsi-system` | Oscillators | own | ethem11 | batch 25 |
| 91 | AllMA Trend Radar | `allma-trend-radar` | Moving Averages | price | trade_lexx | batch 28 |
| 92 | ALMA SD Bands \| RakoQuant | `alma-sd-bands-rakoquant` | Channels & Bands | price | RakoQuant | batch 10 |
| 93 | Almost Zero Lag EMA | `zero-lag-ema` | Moving Averages | price | LazyBear | most liked |
| 94 | Alpha Trading Signal _ Up side Down | `alpha-trading-signal-up-side-down` | Trend | price | giaodichdsmart | batch 19 |
| 95 | Alpha-Sutte Model | `alpha-sutte-model` | Trend | price | SegaRKO | batch 10 |
| 96 | AlphaTrend | `alpha-trend` | Trend | price | KivancOzbilgic |  |
| 97 | AlphaTrend - Screener | `alphatrend-screener` | Trend | price | KivancOzbilgic | most liked |
| 98 | AMD Po3 with Live Edge Stats | `amd-po3-with-live-edge-stats` | Trend | price | WillyAlgoTrader | most liked |
| 99 | Anchored Bollinger Band Range | `anchored-bollinger-band-range` | Channels & Bands | price | Steversteves | batch 20 |
| 100 | Anchored VWAP Pro (Final Visibility Enhanced) | `anchored-vwap-pro` | Volume | price | ImmortalEmerson | batch 17 |
| 101 | Anchored VWAP with Buy/Sell Signals | `anchored-vwap-with-buy-sell-signals` | Volume | price | kmootoo89 | batch 29 |
| 102 | ANDROMEDA - TrendSync | `andromeda-trendsync` | Trend | price | Pedro_Canto | batch 9 |
| 103 | Angle Attack Follow Line Indicator | `angle-attack-follow-line-indicator` | Trend | own | Dreadblitz | most liked |
| 104 | Anti-Volume Stop Loss | `anti-volume-stop` | Trend | price |  |  |
| 105 | Apex Volatility Squeeze & Breakout | `apex-volatility-squeeze-breakout` | Volatility | price | Pineify | batch 33 |
| 106 | Arnaud Legoux Gaussian Flow \| AlphaNatt | `arnaud-legoux-gaussian-flow-alphanatt` | Moving Averages | price | AlphaNatt | batch 17 |
| 107 | Aroon with RSI Confirmation (92.86%) | `aroon-with-rsi-confirmation` | Trend | price | jaydipali622018 | batch 7 |
| 108 | ASDQWE123 2.0 | `asdqwe123-2-0` | Trend | price | luvuoov | batch 34 |
| 109 | Asian & London Session High/Low | `asian-london-session-high-low` | Channels & Bands | price | NikolayBorisov | batch 8 |
| 110 | AsiaSessionHighLowMidLines | `asiasessionhighlowmidlines` | Channels & Bands | price | marekmajer | most liked |
| 111 | Ask-Weighted Averages | `ask-weighted-averages` | Volume | price | DinoTradez | batch 27 |
| 112 | Asset risk metrics | `asset-risk-metrics` | Momentum | price | Sweettz | batch 21 |
| 113 | Asymmetric Volatility Trend Line | `asymmetric-volatility-trend-line` | Trend | price | QuantAlgo | batch 4 |
| 114 | ATR Bands | `atr-bands` | Channels & Bands | price | TheTrdFloor | most liked |
| 115 | ATR Based Zigzag w EMA | `atr-based-zigzag-w-ema` | Trend | price | HabibiBudo | batch 4 |
| 116 | ATR Fibonacci Trend Envelopes | `atr-fibonacci-trend-envelopes` | Channels & Bands | price | BigBeluga | most liked |
| 117 | ATR HEMA | `atr-hema` | Moving Averages | price | SeerQuant | batch 2 |
| 118 | ATR Period | `nrtr` | Trend | price |  |  |
| 119 | ATR Period | `profit-maximizer` | Moving Averages | price |  |  |
| 120 | Supertrend - Ladder ATR - 1909Capital [Trendoscope®] | `supertrend-ladder` | Trend | price |  |  |
| 121 | ATR Rope | `atr-rope` | Trend | price | SamRecio | batch 2 |
| 122 | ATR Stop Loss Finder | `atr-stop-loss-finder` | Volatility | price | veryfid | most liked |
| 123 | ATR Trailing Stop with ATR Targets | `atr-trailing-stop-with-atr-targets` | Trend | price | TRDRZone | batch 33 |
| 124 | ATR + Trailing Stops | `atr-trailing-stops` | Trend | price |  |  |
| 125 | ATR Trailing Stoploss | `atr-trailing-stoploss` | Trend | price | ceyhun | most liked |
| 126 | ATR Trend Color | `atr-trend-color` | Trend | price | Aleksin_Aleksandar | batch 31 |
| 127 | ATR Volatility and Trend Analysis | `atr-volatility-and-trend-analysis` | Volatility | price | dchunt-stack | batch 10 |
| 128 | ATR ZLEMA | `atr-zlema` | Trend | price | QuantAlgo | batch 3 |
| 129 | ATR+ Stop Loss Indicator | `atr-plus` | Trend | own | ZenAndTheArtOfTrading |  |
| 130 | ATR-Normalized VWMA Deviation | `atr-normalized-vwma-deviation` | Oscillators | own | exploretranspose | batch 10 |
| 131 | ATR-Scaled Deviation Oscillator | `atr-scaled-deviation-oscillator` | Oscillators | own | C_H_I_P_A | batch 23 |
| 132 | ATR20 SMA x3.5 Trailing Line | `atr20-sma-x3-5-trailing-line` | Volatility | price | hibinomasakazu1991 | batch 30 |
| 133 | Aura Sentiment & Risk Flow | `aura-sentiment-risk-flow` | Oscillators | own | Pineify | batch 34 |
| 134 | Aura Trend & Candlestick Matrix | `aura-trend-candlestick-matrix` | Trend | price | Pineify | batch 9 |
| 135 | Aura Vortex Oscillator | `aura-vortex-oscillator` | Oscillators | own | Pineify | batch 32 |
| 136 | Aura: Adaptive Statistical Smoother | `aura-adaptive-statistical-smoother` | Moving Averages | price | Pineify | batch 15 |
| 137 | Auto AVWAP (Anchored-VWAP) with Breakout Screener | `auto-avwap-with-breakout-screener` | Volume | price | manoharvs | batch 28 |
| 138 | Auto Fib | `auto-fib-theyangguizi` | Channels & Bands | price |  | most liked |
| 139 | Auto Fib Channels by DGT | `auto-fib-channels-by-dgt` | Channels & Bands | price | dgtrd | most liked |
| 140 | Auto Fib Retracement Alerts | `auto-fib-retracement-alerts` | Trend | price | DevLucem | most liked |
| 141 | Auto Fib Speed Resistance Fans by DGT | `auto-fib-speed-resistance-fans-by-dgt` | Trend | price | dgtrd | most liked |
| 142 | Auto Fibo on Indicators | `auto-fibo-indicators` | Oscillators | own | KivancOzbilgic |  |
| 143 | Auto Fibonacci | `auto-fib` | Channels & Bands | price |  |  |
| 144 | Auto Pattern Detector Targets | `auto-pattern-detector-targets` | Trend | price | MarkitTick | most liked |
| 145 | Auto PitchFan, Fib Extension/Retracement and ZigZag by DGT | `auto-pitchfan-fib-extension-retracement-and` | Trend | price | dgtrd | most liked |
| 146 | Auto Pitchfork, Fib Retracement and Zig Zag by DGT | `auto-pitchfork-fib-retracement-zig-zag` | Trend | price | dgtrd | most liked |
| 147 | Auto Trendline [DojiEmoji] | `auto-trendline` | Trend | price |  |  |
| 148 | Auto TrendLines Support Resistance Signal Alerts | `auto-trendlines-support-resistance-signal` | Trend | price | TradingFinder | most liked |
| 149 | Auto-Support | `auto-support` | Channels & Bands | price |  |  |
| 150 | Automated Z-scoring | `automated-z-scoring` | Oscillators | own | JTCapitalNL | batch 14 |
| 151 | Automatic Support & Resistance | `auto-support-resistance` | Channels & Bands | price |  |  |
| 152 | Average Bullish & Bearish Percentage Change | `average-bullish-bearish-percentage-change` | Momentum | own | fract | batch 23 |
| 153 | Average Sentiment Oscillator | `average-sentiment-oscillator` | Oscillators | own |  |  |
| 154 | Average True Range Trailing Stops Colored | `atr-trailing-colored` | Trend | price |  |  |
| 155 | Awesome Oscillator V2 | `awesome-oscillator-v2` | Oscillators | own |  |  |
| 156 | Awesome_Accelerator_Zone Oscillator | `awesome-accelerator-zone-oscillator` | Oscillators | own | pirooz_trader | batch 18 |
| 157 | B + A + D v0.4 | `b-a-d-v0-4` | Momentum | own | wepritz84 | batch 13 |
| 158 | BACAP PRICE STRUCTURE 21 EMA TREND | `bacap-price-structure-21-ema-trend` | Trend | price | Alex_PrimeTrading | batch 19 |
| 159 | Backtesting & Trading Engine | `backtesting-trading-engine` | Trend | price | PineCoders | most liked |
| 160 | Balanced Price Range (BPR) | `balanced-price-range` | Trend | price | tradeforopp | most liked |
| 161 | Banker Fund Flow Trend Oscillator | `banker-fund-flow` | Oscillators | own |  |  |
| 162 | Bar Replay Fix | `bar-replay-fix` | Candlestick Patterns | price | ivanrdgc | batch 42 |
| 163 | BB Breakout Oscillator | `bb-breakout-oscillator` | Oscillators | own | LuxAlgo |  |
| 164 | BB Fibonacci Ratios | `bb-fibonacci-ratios` | Channels & Bands | price |  |  |
| 165 | BB Length | `ideal-bb-ma` | Moving Averages | price |  |  |
| 166 | BB Stochastic RSI Extreme Signal | `bb-stoch-rsi` | Oscillators | price |  |  |
| 167 | Beep Boop | `beep-boop` | Momentum | own | OBSIDE | batch 33 |
| 168 | Bernoulli Process - Binary Entropy | `bernoulli-process-entropy` | Oscillators | own | kocurekc | batch 1 |
| 169 | BEST Supertrend CCI | `supertrend-cci` | Trend | price | Daveatt |  |
| 170 | Best Support And Resistance Indicator V1 | `best-support-and-resistance-indicator-v1` | Channels & Bands | price | ForexBee | most liked |
| 171 | Beta-Weighted Moving Average | `weighted-ma-function` | Moving Averages | price |  |  |
| 172 | Better Volume Indicator | `better-volume` | Volume | own | LazyBear | most liked |
| 173 | Big Snapper Alerts R3.0 | `big-snapper-alerts` | Trend | price |  |  |
| 174 | Big Trades Detector By HF | `big-trades-detector-by-hf` | Volume | price | Nicolas_Favilla | batch 38 |
| 175 | Big Trades Whale Detector By HK | `big-trades-whale-detector-by-hk` | Volume | price | colacorn | batch 38 |
| 176 | Biggest Volume | `biggest-volume` | Volume | own | mikhail_marka | batch 22 |
| 177 | Bilateral Filter For Loop | `bilateral-filter-for-loop` | Trend | own | BackQuant | batch 14 |
| 178 | Binary Options Arrows (example) [TheMightyChicken] | `binary-option-arrows` | Trend | price |  |  |
| 179 | Bitcoin 2Y-SMA Bands\| Astral Vision | `bitcoin-2y-sma-bands-astral-vision` | Channels & Bands | own | AstralVision | batch 34 |
| 180 | Bitcoin Bull/Bear Market Support/Resistance Bands | `bitcoin-bull-bear-market-support-resistance-bands` | Moving Averages | price | JoeSTM | batch 30 |
| 181 | Bitcoin Kill Zones v2 | `bitcoin-kill-zones` | Trend | price |  |  |
| 182 | Bitcoin Log Growth Curves | `bitcoin-log-curves` | Trend | price | Quantadelic |  |
| 183 | Bitcoin: Mayer Multiple | `bitcoin-mayer-multiple` | Oscillators | own | sito4713 | batch 25 |
| 184 | Bitcoin: Pi Cycle Top & Bottom Indicator Z Score | `bitcoin-pi-cycle-top-bottom-indicator-z-score` | Oscillators | own | Commandoum | batch 37 |
| 185 | Bjorgum AutoTrail | `bjorgum-autotrail` | Trend | price | Bjorgum (simplified for auto mode) |  |
| 186 | Bjorgum Key Levels | `bjorgum-key-levels` | Trend | price | Bjorgum | most liked |
| 187 | Bjorgum MTF MA | `bjorgum-mtf-ma` | Moving Averages | price | Bjorgum | most liked |
| 188 | Bjorgum SuperScript | `bjorgum-superscript` | Trend | price | Bjorgum | most liked |
| 189 | Bjorgum TSI | `bjorgum-tsi` | Momentum | own |  |  |
| 190 | Blacklab84 Panel | `blacklab84-panel` | Oscillators | own | blacklab84 | batch 21 |
| 191 | BNF 25/50 MA Pullback Screener (Uptrend-Below / Downtrend-Above) | `bnf-25-50-ma-pullback-screener` | Trend | price | jackson_g_sheehan | batch 35 |
| 192 | Bollinger Adaptive Trend Navigator | `bollinger-adaptive-trend-navigator` | Trend | price | QuantAlgo | batch 16 |
| 193 | Bollinger Awesome Alert R1.1 | `bollinger-awesome-alert` | Trend | price |  |  |
| 194 | Bollinger Bands (Nadaraya Smoothed) \| Flux Charts | `bollinger-bands-flux-charts` | Volatility | price | fluxchart | most liked |
| 195 | Bollinger Free Bars | `bollinger-free-bars` | Channels & Bands | price | pkuliyi | batch 36 |
| 196 | Bollinger Heatmap | `bollinger-heatmap` | Channels & Bands | own | Quantitative | batch 25 |
| 197 | Boom Hunter Pro | `boom-hunter-pro` | Momentum | own | veryfid |  |
| 198 | BOS/CHOCH Demand & Supply | `bos-choch-demand-supply` | Trend | price | s3u1l | most liked |
| 199 | Breakaway Fair Value Gaps | `breakaway-fair-value-gaps` | Trend | price | LuxAlgo | most liked |
| 200 | Breakdown or Buyable Dip? Pullback Depth Can Help | `breakdown-or-buyable-dip-pullback-depth-can-help` | Momentum | own | TradeStation | batch 23 |
| 201 | Breaker Blocks + Order Blocks confirm BBOB Alert | `breaker-blocks-order-blocks-confirm-bbob-alert` | Trend | price | TradingFinder | most liked |
| 202 | Breaker Blocks with Signals | `breaker-blocks-with-signals` | Trend | price | LuxAlgo | most liked |
| 203 | Breakout an Reversal Signal Detector with Colored in Bar Trends | `breakout-an-reversal-signal-detector-with-colored-in-bar-trends` | Channels & Bands | price | AmGlad_Trader | batch 25 |
| 204 | Breakout and Retest Signals | `breakout-and-retest-signals` | Trend | price | AlgoAlpha | most liked |
| 205 | Breakout Boxes | `breakout-boxes` | Volume | price | ChartPrime | most liked |
| 206 | Breakout Finder | `breakout-finder` | Trend | price | LonesomeTheBlue | most liked |
| 207 | Breakout Indicator | `breakout-indicator` | Trend | price | ZenAndTheArtOfTrading | batch 1 |
| 208 | Breakout Pattern Setup | `breakout-pattern-setup` | Channels & Bands | price | WillyAlgoTrader | most liked |
| 209 | Breakout Probability (Expo) | `breakout-probability` | Volatility | price | Zeiierman | most liked |
| 210 | Breakout Targets | `breakout-targets` | Channels & Bands | price | AlgoAlpha | most liked |
| 211 | Breakout Volume Delta \| Flux Charts | `breakout-volume-delta-flux-charts` | Volume | price | fluxchart | most liked |
| 212 | Breakouts with Tests & Retests | `breakouts-with-tests-retests` | Trend | price | LuxAlgo | most liked |
| 213 | BTC Logarithmic Regression Quantile Bands \| Astral Vision | `btc-logarithmic-regression-quantile-bands-astral-vision` | Channels & Bands | price | AstralVision | batch 24 |
| 214 | BTCUSDSHORTS BTCUSDLONGS - Bitfinex BTC Shorts & Longs | `btcusdshorts-btcusdlongs-bitfinex-btc-shorts` | Volume | own | autemox | most liked |
| 215 | Bull Bear Power Trend | `bull-bear-power-trend` | Momentum | own |  |  |
| 216 | Bull Market Support Band (20w SMA, 21w EMA) | `bull-market-support-band` | Moving Averages | price | zkdev | most liked |
| 217 | Bullish Engulfing | `bullish-engulfing-finder` | Candlestick Patterns | price |  |  |
| 218 | Bullish Volume Anomaly | `bullish-volume-anomaly` | Volume | price | UnknownUnicorn13336802 | batch 31 |
| 219 | CM_TotalConsecutive_Up_Down_V2 | `bulls-bears-control` | Trend | own |  |  |
| 220 | Bulls v Bears | `bulls-v-bears` | Momentum | own | Mihkel00 | batch 3 |
| 221 | Buy & Sell - Accurate Signals | `buy-sell-accurate-signals` | Trend | price | Cryptokingworld91 (published as "Buy & Sell - Accurate Signals") | batch 7 |
| 222 | Buy & Sell Pressure | `buy-sell-pressure` | Volume | own |  |  |
| 223 | Buy Low Sell High Composite Upgraded V6 | `buy-low-sell-high-composite-upgraded-v6` | Oscillators | own | kristian6ncqq | batch 15 |
| 224 | Buy on Volume | `buy-on-volume` | Moving Averages | price | Mando4_27 | batch 21 |
| 225 | Buy Sell Signal | `buy-sell-signal-kelfry98` | Trend | price | kelfry98 | most liked |
| 226 | Buy the Dip & Sell the Rip | `buy-the-dip-sell-the-rip` | Momentum | price | vvedding | batch 41 |
| 227 | Buy/Sell Hull Crossover Signals (Fast & Slow) | `buy-sell-hull-crossover-signals` | Moving Averages | price | VibeAlgos | batch 11 |
| 228 | buy/sell signals with Support/Resistance | `buy-sell-signals-with-support-resistance` | Trend | price | InvestyourAsset | most liked |
| 229 | Buy/Sell Volume Totals for Period | `buy-sell-volume-totals-for-period` | Volume | own | vace117 | most liked |
| 230 | Buyers & Sellers / Range | `buyers-sellers-range` | Oscillators | own | fract | batch 11 |
| 231 | Buyers vs Sellers | `buyers-vs-sellers` | Momentum | own | davorloncarpetrovic | batch 19 |
| 232 | Buying & Selling Pressure | `buying-selling-pressure` | Volatility | own | fract | batch 3 |
| 233 | Buying and Selling Volume Pressure S/R | `buying-and-selling-volume-pressure-s-r` | Volume | price | DinoTradez | batch 16 |
| 234 | Buying Selling Volume | `buying-selling-volume` | Volume | own | ceyhun (community) |  |
| 235 | Buying vs Selling Moving Averages (Scalp Meter) | `buying-vs-selling-moving-averages` | Volume | own | codycolton97 | batch 24 |
| 236 | BuySell Volume Bar Chart | `buysell-volume-bar-chart` | Volume | own | roshbiz1408 | batch 21 |
| 237 | BuySell%_ImtiazH_v2 | `buysell-imtiazh-v2` | Volume | own | a272a59956 | batch 22 |
| 238 | Buyside & Sellside Liquidity | `buyside-sellside-liquidity` | Trend | price | LuxAlgo | most liked |
| 239 | Cabal Dev Indicator | `cabal-dev-indicator` | Oscillators | own | SolanaMemeCoins | batch 26 |
| 240 | Candle Breakout Oscillator | `candle-breakout-oscillator` | Oscillators | own | LuxAlgo | batch 2 |
| 241 | Candle BUY SELL + Support Resistance | `candle-buy-sell-support-resistance` | Channels & Bands | price | JohnsonForexTrader | batch 32 |
| 242 | Candle Channel | `candle-channel` | Channels & Bands | price | Uncle_the_shooter | batch 23 |
| 243 | Candle Color Flip | `candle-color-flip` | Candlestick Patterns | price | LorPlant | batch 42 |
| 244 | Candle Count RSI | `candle-count-rsi` | Oscillators | own | Sherlock_MacGyver | batch 35 |
| 245 | Candle Range Theory (CRT) by Lucas | `candle-range-theory-by-lucas` | Trend | price | lucasfff | batch 15 |
| 246 | Candle Range Theory \| Flux Charts | `candle-range-theory-flux-charts` | Trend | price | fluxchart | most liked |
| 247 | Candle Range Trading (CRT) | `candle-range-trading` | Trend | price | marcostan93 | batch 1 |
| 248 | Candle Spread Oscillator (CS0) | `candle-spread-oscillator` | Oscillators | own | RWCS_LTD | batch 36 |
| 249 | Candle State (The Strat) | `candle-state` | Candlestick Patterns | price | Crinklebine | batch 38 |
| 250 | Candlestick Patterns Identified | `candlestick-patterns-identified` | Candlestick Patterns | price | repo32 | batch 38 |
| 251 | Candlestick Reversal | `candlestick-reversal` | Candlestick Patterns | price | LonesomeTheBlue (community) |  |
| 252 | Candlestick Structure | `candlestick-structure` | Candlestick Patterns | price | LuxAlgo | most liked |
| 253 | Candlestick Trend Indicator v0.5 by JustUncleL | `candlestick-trend-indicator` | Trend | price | JustUncleL | most liked |
| 254 | Candlesticks Patterns Identified | `candlesticks-patterns-identified` | Candlestick Patterns | price | repo32 | most liked |
| 255 | Cardwell RSI by TQ | `cardwell-rsi-by-tq` | Oscillators | own | TradeQUO | batch 24 |
| 256 | Carrier Volatility | `carrier-volatility` | Oscillators | own | et20tradeview | batch 15 |
| 257 | CBC Flip with Volume | `cbc-flip-with-volume` | Trend | price | PtGambler | batch 18 |
| 258 | CCI coded OBV | `cci-obv` | Oscillators | own | LazyBear |  |
| 259 | CCI Pro | `cci-hash-capital` | Oscillators | own | Hash_Capital | batch 24 |
| 260 | CCI Stochastic | `cci-stochastic` | Momentum | own | Daveatt | most liked |
| 261 | CCT Bollinger Band Oscillator | `cct-bbo` | Oscillators | own | LazyBear |  |
| 262 | CD_Average Daily Range Zones- highs and lows of the day | `cd-average-daily-range-zones-highs-and-lows` | Volatility | price | cristian.d | most liked |
| 263 | CDC Action Zone | `cdc-action-zone` | Trend | price |  |  |
| 264 | CDC ActionZone V3 2020 | `cdc-actionzone-v3-2020` | Trend | price | piriya33 | most liked |
| 265 | Center of Gravity Channel | `cog-channel` | Channels & Bands | price |  |  |
| 266 | CHAKRA RISS ENGULFING CANDLESTICK STRATEGY | `chakra-riss-engulfing-candlestick-strategy` | Momentum | price | Tradewith_Riss | batch 18 |
| 267 | Chandelier Exit | `chandelier-exit` | Trend | price |  |  |
| 268 | Chandelier Stop | `chandelier-stop` | Trend | price |  |  |
| 269 | Change in State of Delivery (CISD) | `change-in-state-of-delivery` | Trend | price | LuxAlgo | most liked |
| 270 | Change in State of Delivery CISD | `change-in-state-of-delivery-cisd` | Trend | price | AlgoAlpha | most liked |
| 271 | Change-Point Detection (CUSUM) | `change-point-detection` | Trend | price | LuxAlgo | batch 6 |
| 272 | Channels With Patterns | `channels-with-patterns` | Channels & Bands | price | ChartPrime | most liked |
| 273 | CHN BUY SELL with EMA 200 | `chn-buy-sell-with-ema-200` | Trend | price | CHNTeam | batch 10 |
| 274 | CISD with Alerts | `cisd-with-alerts` | Trend | price | neommxm | most liked |
| 275 | Clean Buy Sell Pro | `clean-buy-sell-pro` | Trend | price | JohnsonForexTrader | batch 40 |
| 276 | Clean Volume Bars (Green/Red + Above Avg Highlight) | `clean-volume-bars` | Volume | own | melospoker80 | batch 37 |
| 277 | Climax Volume Reversal Radar | `climax-volume-reversal-radar` | Volume | own | Ty_yanse | batch 31 |
| 278 | Clustering Volatility (ATR-ADR-ChaikinVol) | `clustering-volatility` | Volatility | own | SDF-Solutions | batch 24 |
| 279 | Clusters Volume Profile | `clusters-volume-profile` | Volume | price | LuxAlgo | most liked |
| 280 | CM EMA Trend Bars | `cm-ema-trend-bars` | Trend | price | ChrisMoody |  |
| 281 | CM Enhanced Ichimoku Cloud V5 | `cm-enhanced-ichimoku` | Channels & Bands | price | ChrisMoody (community) |  |
| 282 | CM_Gann Swing HighLow V2 | `cm-gann-swing` | Trend | price | ChrisMoody (community) |  |
| 283 | CM Guppy EMA | `cm-guppy-ema` | Moving Averages | price | ChrisMoody |  |
| 284 | CM Heikin-Ashi | `cm-heikin-ashi` | Candlestick Patterns | price | ChrisMoody |  |
| 285 | CM Laguerre PPO PercentileRank | `cm-laguerre-ppo` | Oscillators | own | ChrisMoody |  |
| 286 | CM MACD Custom Indicator - Multiple Time Frame - V2 | `cm-macd-custom-mtf-v5` | Momentum | own | ChrisMoody | most liked |
| 287 | CM Price Action Bars | `cm-price-action` | Oscillators | price | ChrisMoody |  |
| 288 | CM RSI Plus EMA | `cm-rsi-ema` | Oscillators | own | ChrisMoody |  |
| 289 | _CM_RSI_2_Strat_Low | `cm-rsi-2-lower` | Oscillators | own | ChrisMoody |  |
| 290 | _CM_RSI_2_HB_MA | `cm-rsi-2-upper` | Oscillators | price | ChrisMoody |  |
| 291 | CM Sling Shot System | `cm-sling-shot` | Trend | price | ChrisMoody |  |
| 292 | CM Stochastic Highlight Bars | `cm-stoch-highlight` | Oscillators | price | ChrisMoody |  |
| 293 | CM Stochastic Multi-TimeFrame | `cm-stochastic-mtf` | Oscillators | own | ChrisMoody | most liked |
| 294 | CM Stochastic POP Method 1 | `stoch-pop-1` | Oscillators | own | ChrisMoody |  |
| 295 | CM Stochastic POP Method 2 | `stoch-pop-2` | Oscillators | own | ChrisMoody |  |
| 296 | CM Time Based Vertical Lines | `cm-time-lines` | Trend | price | ChrisMoody |  |
| 297 | CM Williams Vix Fix V3 | `cm-vix-fix-v3` | Oscillators | own | ChrisMoody |  |
| 298 | CM_OldSchool_Projected_high_Low | `cm-oldschool-projected-high-low` | Channels & Bands | price | ChrisMoody | most liked |
| 299 | CM_Parabolic SAR | `cm-parabolic-sar` | Trend | price | ChrisMoody | most liked |
| 300 | CM_Pivot Points_Custom | `cm-pivot-points-custom` | Trend | price | ChrisMoody | most liked |
| 301 | CM_Pivot Points_M-W-D-4H-1H_Filtered | `cm-pivot-points-filtered` | Trend | price | ChrisMoody | most liked |
| 302 | CM_Ultimate RSI Multi Time Frame | `cm-ultimate-rsi-mtf` | Oscillators | own | ChrisMoody | most liked |
| 303 | CM_Ultimate_MA_MTF_V2 | `cm-ultimate-ma-mtf-v2` | Moving Averages | price | ChrisMoody | most liked |
| 304 | CM_Williams_Vix_Fix_V3_Upper_Text Plots | `cm-vix-fix-v3-upper-text-plots` | Volatility | price | ChrisMoody | most liked |
| 305 | CMO For Loop \| QuantLapse | `cmo-for-loop-quantlapse` | Momentum | own | QuantLapse | batch 19 |
| 306 | Code for All 4 Forex Sessions W/ Background Highlight!!! | `code-for-all-4-forex-sessions-w-background` | Trend | price | ChrisMoody | most liked |
| 307 | Code Plots - High, Low, Open, Close—Daily, Weekly, & Monthly!!! | `code-plots-high-low-open-close-daily-weekly` | Channels & Bands | price | ChrisMoody | most liked |
| 308 | Colored Volume Bars | `colored-volume` | Volume | own | LazyBear |  |
| 309 | Combined Up down with volume | `combined-up-down-with-volume` | Volume | price | ChartMantra_ | batch 41 |
| 310 | Combo Oscillator - MACD + Stoch + RSI + EMA | `combo-oscillator-macd-stoch-rsi-ema` | Oscillators | own | Gauder84 | batch 34 |
| 311 | Community MoneyLine | `community-moneyline` | Trend | price | rafstar_kaczmarek | batch 12 |
| 312 | Composite Indicator (CCI + ATR) | `composite-indicator` | Momentum | price | CharLi0t | batch 17 |
| 313 | Trading Toolkit (Michaël van de Poppe) [BigBeluga] | `comprehensive-trading-toolkit` | Oscillators | own | BigBeluga | most liked |
| 314 | Consecutive Candles DevisSo | `consecutive-candles-devisso` | Trend | price | engineerofmoney | batch 11 |
| 315 | Consecutive Higher/Lower Closings | `consecutive-higher-lower-closings` | Trend | price | rahul_joshi_2 | batch 39 |
| 316 | Consolidation Range with Signals | `consolidation-range-with-signals` | Volatility | price | Zeiierman | most liked |
| 317 | Consolidation Zones - Live | `consolidation-zones` | Channels & Bands | price | LonesomeTheBlue |  |
| 318 | Conversion Periods | `ichimoku-oscillator` | Momentum | own |  |  |
| 319 | Coral Trend | `coral-trend` | Trend | price | LazyBear |  |
| 320 | Corrected Moving Average | `corrected-moving-average` | Moving Averages | price | everget | batch 3 |
| 321 | COV Bands ~ C H I P A | `cov-bands-c-h-i-p-a` | Channels & Bands | own | C_H_I_P_A | batch 28 |
| 322 | Crosby Ratio \| QuantumResearch | `crosby-ratio-quantumresearch` | Momentum | own | QuantumResearch | batch 17 |
| 323 | Crossover EMMM | `crossover-emmm` | Trend | price | NunyadzilaTrading | batch 22 |
| 324 | CRT indicator | `crt-indicator` | Trend | price | INTELA | batch 16 |
| 325 | Cumulative Delta Volume | `cumulative-delta-volume` | Volume | own | LonesomeTheBlue | most liked |
| 326 | Cumulative Volume Delta Divergence Periodic EMA | `cumulative-volume-delta-divergence-periodic` | Volume | own | TradingFinder | most liked |
| 327 | Cumulative Volume Delta Strategy \| Flux Charts | `cumulative-volume-delta-strategy-flux-charts` | Volume | price | fluxchart | most liked |
| 328 | Cup Finder | `cup-finder` | Trend | price | LonesomeTheBlue | most liked |
| 329 | Curved Trend Channels | `curved-trend-channels` | Channels & Bands | price | Zeiierman | batch 7 |
| 330 | Custom Buy and Sell Signal with Body Ratio and RSI | `custom-buy-and-sell-signal-with-body-ratio-and-rsi` | Momentum | price | am-solaris | batch 38 |
| 331 | CM_Donchian Channels Modified | `donchian-custom` | Channels & Bands | price |  |  |
| 332 | Customizable RSI/StochRSI Double Confirmation | `customizable-rsi-stochrsi-double-confirmation` | Momentum | price | smile_bad_day | batch 42 |
| 333 | CVD & Big Trade Detector By HK | `cvd-big-trade-detector-by-hk` | Volume | own | colacorn | batch 39 |
| 334 | CVD (Cumulative Volume Delta) | `cvd-rupward` | Volume | own | RUpward | batch 19 |
| 335 | CVD Divergence Background By HK | `cvd-divergence-background-by-hk` | Volume | price | colacorn | batch 42 |
| 336 | CVD Polarity Indicator (With Rolling Smoothed) | `cvd-polarity-indicator` | Volume | own | Cruiser | batch 35 |
| 337 | CVD Reversal Divergence (Exhaustion) | `cvd-reversal-divergence` | Volume | price | somnacin | batch 39 |
| 338 | Cycle & Flow Indicator - D_Quant | `cycle-flow-indicator-d-quant` | Trend | price | D_QUANT | batch 22 |
| 339 | Cycle Low (RSI + StochRSI) – v5 John.K | `cycle-low-v5-john-k` | Momentum | price | John_Kal | batch 22 |
| 340 | Cycle-Synced Channel Breakout | `cycle-synced-channel-breakout` | Channels & Bands | price | TradeTechanalysis | batch 25 |
| 341 | Daily Weekly Monthly Yearly Opens | `daily-weekly-monthly-yearly-opens` | Trend | price | sbtnc | most liked |
| 342 | Dan's Ironclad OB - Simple | `dan-s-ironclad-ob-simple` | Trend | price | hynaxiii | batch 10 |
| 343 | Darvas Box | `darvas-box` | Candlestick Patterns | price |  |  |
| 344 | Dead Simple Reversal | `dead-simple-reversal` | Candlestick Patterns | price | B3AR_Trades (converted from "p2f - Dead Simple Reversal" by paidtofade; | batch 41 |
| 345 | DecisionPoint Volume Swenlin Trading Oscillator | `decisionpoint-volume-swenlin-trading` | Oscillators | own | LazyBear | most liked |
| 346 | DECODE Moving Average Toolkit | `decode-moving-average-toolkit` | Moving Averages | price | decodejar | batch 20 |
| 347 | Delta Flow Profile | `delta-flow-profile` | Volume | price | LuxAlgo | most liked |
| 348 | Delta Ladder | `delta-ladder` | Volume | price | KioseffTrading | most liked |
| 349 | Delta Manipulation Footprint | `delta-manipulation-footprint` | Volume | price | destrobr0685 | batch 39 |
| 350 | Delta Volume Candles | `delta-volume-candles` | Volume | price | LucF | most liked |
| 351 | Delta Volume RSI | `delta-volume-rsi` | Volume | own | destrobr0685 | batch 24 |
| 352 | Delta Zones Buy/Sell Pressure | `delta-zones-buy-sell-pressure` | Volume | price | NathanTradeus | most liked |
| 353 | Delta-RSI Oscillator | `delta-rsi-oscillator` | Momentum | own | tbiktag (simplified) |  |
| 354 | DeltaFlow Volume Profile | `deltaflow-volume-profile` | Volume | price | BigBeluga | most liked |
| 355 | DEMA Flow | `dema-flow` | Trend | price | AlphaExtract | batch 7 |
| 356 | Demand & Supply Zones | `demand-supply-zones` | Channels & Bands | price | BacktestBot | most liked |
| 357 | Demand Index (James Sibbet) | `demand-index` | Volume | own | conair | batch 37 |
| 358 | Deviation Symmetry Breaker ~ C H I P A | `deviation-symmetry-breaker-c-h-i-p-a` | Channels & Bands | own | C_H_I_P_A | batch 18 |
| 359 | Deviation Trend Profile | `deviation-trend-profile` | Trend | price | BigBeluga | most liked |
| 360 | Dip & Rip Patterns - The Quant Science | `dip-rip-patterns-the-quant-science` | Volatility | price | thequantscience | batch 39 |
| 361 | Dip Buy/Sell Signals (Vix Fix + MA Deviation + TRMAD) | `dip-buy-sell-signals` | Volatility | price | DotGain | batch 42 |
| 362 | Directional Indicator Crossovers v1 | `directional-indicator-crossovers-v1` | Trend | own | JopAlgo | batch 7 |
| 363 | Directional Logistic Oscillator | `directional-logistic-oscillator` | Oscillators | own | GainzAlgo | batch 2 |
| 364 | Directional Movement Index + ADX + Ploted KEYLEVEL | `dmi-adx-levels` | Trend | own |  |  |
| 365 | Disparity Index | `disparity-index` | Oscillators | own | HPotter | batch 10 |
| 366 | Divergence for many indicator v3 | `divergence-for-many-indicator-v3` | Momentum | price | LonesomeTheBlue | most liked |
| 367 | Divergence for Many Indicators v4 | `divergence-for-many-indicators-v4` | Momentum | price | LonesomeTheBlue | most liked |
| 368 | Divergence Indicator | `divergence-indicator` | Momentum | price |  |  |
| 369 | Divergence Screener | `divergence-screener` | Oscillators | own | Trendoscope | most liked |
| 370 | DMI Delta by 0xjcf | `dmi-delta-by-0xjcf` | Trend | own | J_O_S_E_ | batch 34 |
| 371 | DMI Histogram Indicator | `dmi-histogram-indicator` | Trend | own | Chart0bserver | batch 32 |
| 372 | DN MACD | `dn-macd` | Momentum | own | lihulu123 | batch 32 |
| 373 | Dominance Signal Apex | `dominance-signal-apex` | Trend | price | chervolino | batch 17 |
| 374 | DonAlt - Smart Money Toolkit | `donalt-smart-money-toolkit` | Trend | price | BigBeluga | most liked |
| 375 | Donchian Reversal Signals with Labels | `donchian-reversal-signals-with-labels` | Channels & Bands | price | Trader-Hitesh | batch 40 |
| 376 | Donchian Trend Ribbon | `donchian-trend-ribbon` | Trend | own | LonesomeTheBlue |  |
| 377 | Dope DPO | `dope-dpo` | Oscillators | own | Sherlock_MacGyver | batch 14 |
| 378 | Double EMA WIth Pullback Buy Sell Signal - Smarter Algo | `double-ema-with-pullback-buy-sell-signal` | Trend | price | hanabil | most liked |
| 379 | Double Median ATR Bands \| MisinkoMaster | `double-median-atr-bands-misinkomaster` | Channels & Bands | price | MisinkoMaster | batch 28 |
| 380 | Double Median SD Bands \| MisinkoMaster | `double-median-sd-bands-misinkomaster` | Channels & Bands | price | MisinkoMaster | batch 30 |
| 381 | Double RSI | `double-rsi` | Momentum | own | Clokivez | batch 9 |
| 382 | Double Top/Bottom - Ultimate (OS) | `double-top-bottom-ultimate` | Trend | price | Trendoscope | most liked |
| 383 | Double Zig Zag with HHLL | `double-zig-zag-with-hhll` | Trend | price | LonesomeTheBlue | most liked |
| 384 | DR/IDR V1 | `dr-idr-v1` | Volatility | price | TheMas7er | most liked |
| 385 | DTFX Algo Zones | `dtfx-algo-zones` | Trend | price | LuxAlgo | most liked |
| 386 | Dual Bayesian For Loop | `dual-bayesian-for-loop` | Momentum | own | QuantAlgo | batch 5 |
| 387 | Dual EMA Trend Ribbon (Multi-Timeframe Trend Confirmation) | `dual-ema-trend-ribbon` | Moving Averages | price | Aleksin_Aleksandar | batch 3 |
| 388 | Dual MA SD Oscillator | `dual-ma-sd-oscillator` | Oscillators | own | SchizoQuant | batch 9 |
| 389 | Dual RSI Smoother | `dual-rsi-smoother` | Oscillators | own | TheUltimator5 | batch 8 |
| 390 | Dynamic Flow Ribbons | `dynamic-flow-ribbons` | Trend | price | BigBeluga | batch 2 |
| 391 | Dynamic Fractal Flow | `dynamic-fractal-flow` | Oscillators | own | AlphaExtract | batch 21 |
| 392 | Dynamic Linear Regression Channels | `dynamic-linear-regression-channels` | Channels & Bands | price | iravan | most liked |
| 393 | Dynamic Liquidity HeatMap Profile | `dynamic-liquidity-heatmap-profile` | Volume | price | BigBeluga | most liked |
| 394 | Dynamic Score PSAR | `dynamic-score-psar` | Trend | own | QuantAlgo | batch 8 |
| 395 | Dynamic Stop Loss & Take Profit | `dynamic-stop-loss-take-profit` | Volatility | price | criptoblast2 | batch 23 |
| 396 | Dynamic Structure Indicator | `dynamic-structure-indicator` | Trend | price |  |  |
| 397 | Dynamic Supply and Demand Zones | `dynamic-supply-and-demand-zones` | Volume | price | AlgoAlpha | most liked |
| 398 | Dynamic Support & Resistance | `dynamic-support-resistance` | Moving Averages | price | ZenAndTheArtOfTrading | batch 1 |
| 399 | Dynamic Support/Resistance Zones | `dynamic-support-resistance-zones` | Channels & Bands | price | ChartPrime | most liked |
| 400 | Dynamic Swing Anchored VWAP | `dynamic-swing-anchored-vwap` | Volume | price | Zeiierman | most liked |
| 401 | Dynamic Testing | `dynamic-testing` | Oscillators | price | ProfitNomad | batch 9 |
| 402 | Dynamic Trailing | `dynamic-trailing` | Trend | price | Zeiierman | batch 5 |
| 403 | Dynamic Trend Bands | `dynamic-trend-bands` | Channels & Bands | price | ChartPrime | batch 2 |
| 404 | Dynamic Trend Channel (DTC) | `dynamic-trend-channel` | Channels & Bands | price | JohnsonForexTrader | batch 27 |
| 405 | Dynamic Volatility Filter | `dynamic-volatility-filter` | Trend | price | QuantAlgo | batch 4 |
| 406 | Dynamic Volume Clusters with Retest Signals | `dynamic-volume-clusters` | Channels & Bands | price | Zeiierman | batch 2 |
| 407 | Dynamic Volume Profile Oscillator | `dynamic-volume-profile-oscillator` | Volume | own | AlphaNatt | batch 1 |
| 408 | Dynamic VWAP: Fair Value & Divergence Suite | `dynamic-vwap-fair-value-divergence-suite` | Channels & Bands | price | RWCS_LTD | batch 30 |
| 409 | E9 Bollinger Range | `e9-bollinger-range` | Channels & Bands | price | E9XBT | batch 34 |
| 410 | Eagles Compass | `eagles-compass` | Candlestick Patterns | price | zenmarkets | batch 40 |
| 411 | Early MACD Reversal Indicator | `early-macd-reversal-indicator` | Momentum | own | StockSignaler | batch 10 |
| 412 | Early Pivot Alert (price-quantum reversal) • v1a (arrows only) | `early-pivot-alert-v1a` | Trend | price | dirkbiebaut | batch 35 |
| 413 | Easy Entry/Exit Trend Colors | `easy-trend-colors` | Trend | own |  |  |
| 414 | Edward Smart Channel Reversal | `edward-smart-channel-reversal` | Channels & Bands | price | Jos-ProTrader | batch 13 |
| 415 | Effective FVG Indicator - Imran | `effective-fvg-indicator-imran` | Volume | price | imrancrypto | batch 40 |
| 416 | Effective Volume Z-Score | `effective-volume-z-score` | Volume | own | eugencovaci | batch 35 |
| 417 | Efficiency Ratio Trend | `efficiency-ratio-trend` | Trend | price | achirameegasthanne | batch 9 |
| 418 | Ehlers Adaptive RSI | `ehlers-adaptive-rsi` | Oscillators | own | Julien_Exe | batch 14 |
| 419 | Ehlers Adaptive Trend Indicator | `ehlers-adaptive-trend-indicator` | Trend | price | AlphaExtract | batch 18 |
| 420 | Ehlers Instantaneous Trend | `ehlers-instantaneous-trend` | Trend | price |  |  |
| 421 | Ehlers Maclaurin Ultimate Smoother | `ehlers-maclaurin-ultimate-smoother` | Moving Averages | own | Mupsje | batch 33 |
| 422 | Ehlers MESA Adaptive Moving Average | `ehlers-mesa-ma` | Moving Averages | price | Ehlers |  |
| 423 | Ehlers Regime Dynamic Candles | `ehlers-regime-dynamic-candles` | Candlestick Patterns | price | sizzlinsoft | batch 39 |
| 424 | Ehlers Reverse EMA | `ehlers-reverse-ema` | Oscillators | own | AlgoCollective | batch 36 |
| 425 | Ehlers Stochastic CG Oscillator | `ehlers-stochastic-cg` | Oscillators | own |  |  |
| 426 | Elite Oscillator Pro | `elite-oscillator-pro` | Oscillators | own | Alpha_Wizard | batch 34 |
| 427 | Elliot Wave - Impulse | `elliot-wave-impulse` | Trend | price | Trendoscope | most liked |
| 428 | Elliott Impulse Engine | `elliott-impulse-engine` | Trend | price | WillyAlgoTrader | most liked |
| 429 | Elliott Wave | `elliott-wave` | Trend | price | LuxAlgo | most liked |
| 430 | Elliott Wave Oscillator | `elliott-wave-oscillator` | Oscillators | own | Koryu |  |
| 431 | Elliott Wave Oscillator Signals by DGT | `elliott-wave-oscillator-signals-by-dgt` | Oscillators | price | dgtrd | most liked |
| 432 | Elliptic Curve SAR | `elliptic-curve-sar` | Trend | price | TEDCORP2 | batch 26 |
| 433 | EMA & MA Crossover | `ema-ma-crossover` | Moving Averages | price |  |  |
| 434 | EMA & MACD Strategy with SL/TP | `ema-macd-strategy-with-sl-tp` | Trend | price | mamachi- | batch 28 |
| 435 | EMA + RSI Autotrade Webhook - Varun | `ema-rsi-autotrade-webhook-varun` | Moving Averages | price | varuns_back | batch 17 |
| 436 | EMA + SuperTrend | `ema-supertrend` | Moving Averages | price | All_in_Traders |  |
| 437 | EMA + VWMA + ATR Smoothed BuySell (merged) - TOM ZENG 202509 | `ema-vwma-atr-smoothed-buysell-tom-zeng-202509` | Trend | price | zengtom | batch 18 |
| 438 | EMA 20/50/100/200 | `ema-multi` | Moving Averages | price |  |  |
| 439 | EMA 9 / 26 Cross | `ema-9-26-cross` | Moving Averages | price | h0s1m001 | batch 27 |
| 440 | EMA Cloud Trend | `ema-cloud-trend` | Moving Averages | price | ZkalishTR | batch 9 |
| 441 | EMA Cross Signals | `ema-cross-signals` | Moving Averages | price | Jos-ProTrader | batch 29 |
| 442 | EMA Enveloper | `ema-enveloper` | Moving Averages | price |  |  |
| 443 | EMA Oscillator | `ema-oscillator` | Oscillators | own | AlphaExtract | batch 16 |
| 444 | EMA Ribbon | `ema-ribbon` | Moving Averages | price |  |  |
| 445 | EMA Wave Indicator | `ema-wave` | Moving Averages | own |  |  |
| 446 | EMA/RMA clouds by Alpachino | `ema-rma-clouds-by-alpachino` | Moving Averages | price | Alpachino97 | batch 28 |
| 447 | EMA21 Pullback Buy | `ema21-pullback-buy` | Moving Averages | price | Kennedy08 | batch 23 |
| 448 | Emergent Rays - NovaTheMachine | `emergent-rays-novathemachine` | Moving Averages | price | NovaTheMachine | batch 32 |
| 449 | Engulfing + Sweep (Confirmed Only) v6 - bars only | `engulfing-sweep-v6-bars-only` | Candlestick Patterns | price | fanta-grapefruit | batch 38 |
| 450 | Engulfing Candle Indicator | `engulfing-candle-indicator` | Candlestick Patterns | price | The_Forex_Steward | batch 41 |
| 451 | Engulfing Sweeps - Milana Trades | `engulfing-sweeps-milana-trades` | Candlestick Patterns | price | MilanaArsenovna | batch 38 |
| 452 | Enhanced KLSE Banker Flow Oscillator | `enhanced-klse-banker-flow-oscillator` | Oscillators | own | Dr_Leong_Yee_Rock | batch 15 |
| 453 | Enhanced VFI Buyer/Seller Pressure | `enhanced-vfi-buyer-seller-pressure` | Volume | own | ask2maniish | batch 28 |
| 454 | Enhanced VSA Volume & Candle Colors with MA Selection | `enhanced-vsa-volume-candle-colors-with-ma-selection` | Volume | own | ViZiV | batch 27 |
| 455 | Entropy Bands | `entropy-bands` | Channels & Bands | price | TechnoBlooms | batch 20 |
| 456 | Entry / TP / SL Alert Bands (Simple & Stable) | `entry-tp-sl-alert-bands` | Channels & Bands | price | drlicht1 | batch 34 |
| 457 | Entry Points | `entry-points` | Oscillators | price |  |  |
| 458 | Entry Signals (Long/Short) | `entry-signals-long-short` | Trend | price | tradegear9 | batch 1 |
| 459 | Envelope RSI | `envelope-rsi` | Oscillators | price | Saleh_Toodarvari |  |
| 460 | EQH/EQL Liquidity Zones | `eqh-eql-liquidity-zones` | Volume | price | LuxAlgo | most liked |
| 461 | Equalhigh JAPANESE TRIPLE RCI | `equalhigh-japanese-triple-rci` | Oscillators | own | Stevesyl | batch 22 |
| 462 | ERD: Effort-Result Diagnostic | `erd-effort-result-diagnostic` | Channels & Bands | price | DarwinDarma | batch 32 |
| 463 | EREMA Signals | `erema-signals` | Trend | price | AlgoCollective | batch 39 |
| 464 | Euclidean Range | `euclidean-range` | Volatility | own | InvestorUnknown | batch 21 |
| 465 | EURUSD Swing High/Low Projection | `eurusd-swing-high-low-projection` | Channels & Bands | price | tiprolin | batch 37 |
| 466 | Evil MACD Trading System (Pine Script v6) | `evil-macd-trading-system` | Momentum | price | daves723 | batch 37 |
| 467 | Elastic Volume Weighted Moving Average [LazyBear] | `evwma-envelope` | Oscillators | price |  |  |
| 468 | Evasive SuperTrend | `evasive-supertrend` | Trend | price | LuxAlgo | most liked |
| 469 | Exhaustion Zone | `exhaustion-zone` | Channels & Bands | price | rukich | batch 6 |
| 470 | Extrapolated Pivot Connector - Lets Make Support And Resistances | `extrapolated-pivot-connector-lets-make` | Channels & Bands | price | alexgrover | most liked |
| 471 | Extreme Trend Reversal Points | `extreme-trend-reversal-points` | Trend | price | Trendoscope | most liked |
| 472 | Fair value bands / Flowly Indicators | `fair-value-bands-flowly-indicators` | Channels & Bands | price | FlowlyIndicators | most liked |
| 473 | Fair Value Gap | `fair-value-gap-luxalgo` | Trend | price | LuxAlgo | most liked |
| 474 | Fair Value Gap Absorption Indicator | `fair-value-gap-absorption-indicator` | Trend | price | LuxAlgo | most liked |
| 475 | Fair Value Gaps (Volumetric) \| Flux Charts | `fair-value-gaps-flux-charts` | Trend | price | fluxchart | most liked |
| 476 | Fair Value Gaps by DGT | `fair-value-gaps-by-dgt` | Trend | price | dgtrd | most liked |
| 477 | Faith Indicator | `faith-indicator` | Trend | own |  |  |
| 478 | False Breakout (Expo) | `false-breakout` | Channels & Bands | price | Zeiierman |  |
| 479 | Faraz Perfect Structure Scalper + Long Short (Indicator Alerts) | `faraz-perfect-structure-scalper-long-short` | Trend | price | fsaleem03 | batch 29 |
| 480 | Fast Length | `bjorgum-triple-ema` | Moving Averages | price |  |  |
| 481 | Fast WMA | `fast-wma` | Moving Averages | own | Clokivez | batch 25 |
| 482 | Fastlane | `fastlane` | Volume | price | HB5 | batch 40 |
| 483 | Fibo Levels with Volume Profile and Targets | `fibo-levels-with-volume-profile-and-targets` | Volume | price | ChartPrime | most liked |
| 484 | Fibonacci + Support/Resistant + Trendline (Price action) | `fibonacci-support-resistant-trendline` | Trend | price | TrendCrypto2022 | most liked |
| 485 | Fibonacci Auto Trend Scouter | `fibonacci-auto-trend-scouter` | Trend | price | sirkriz | most liked |
| 486 | Fibonacci Bollinger Bands | `fibonacci-bollinger-bands` | Channels & Bands | price | Rashad |  |
| 487 | Fibonacci Confluence Toolkit | `fibonacci-confluence-toolkit` | Trend | price | LuxAlgo | most liked |
| 488 | Fibonacci Entry Bands | `fibonacci-entry-bands` | Trend | price | AlgoAlpha | most liked |
| 489 | Fibonacci Extension / Retracement / Pivot Points by DGT | `fibonacci-extension-retracement-pivot-points` | Trend | price | dgtrd | most liked |
| 490 | Fibonacci HH LL TRAMA Band | `fibonacci-hh-ll-trama-band` | Channels & Bands | price | FibonacciFlux | batch 16 |
| 491 | Fibonacci Levels | `fibonacci-levels` | Channels & Bands | price |  |  |
| 492 | Fibonacci levels MTF | `fibonacci-levels-mtf` | Channels & Bands | price | LonesomeTheBlue | most liked |
| 493 | Fibonacci Moving Averages | `fibonacci-moving-averages` | Moving Averages | price | UkutaLabs | batch 28 |
| 494 | Fibonacci Optimal Entry Zone | `fibonacci-optimal-entry-zone` | Trend | price | Zeiierman | most liked |
| 495 | Fibonacci Projection with Volume & Delta Profile | `fibonacci-projection-with-volume-delta-profile` | Volume | price | Zeiierman | most liked |
| 496 | Fibonacci Ranges (Real-Time) | `fibonacci-ranges` | Channels & Bands | price | LuxAlgo | most liked |
| 497 | Fibonacci Structure Engine | `fibonacci-structure-engine` | Trend | price | WillyAlgoTrader | most liked |
| 498 | Fibonacci Time-Price Zones | `fibonacci-time-price-zones` | Trend | price | xxattaxx | most liked |
| 499 | Fibonacci Trend | `fibonacci-trend` | Trend | price | ChartPrime | most liked |
| 500 | Fibonacci Weighted Moving Average | `fibonacci-weighted-moving-average` | Moving Averages | price | everget | batch 12 |
| 501 | Fibonacci Zone | `fibonacci-zone` | Channels & Bands | price |  |  |
| 502 | FibSync - DynamicFibSupport | `fibsync-dynamicfibsupport` | Channels & Bands | price | mr_uponly | batch 34 |
| 503 | Filter Ribbon | `filter-ribbon` | Trend | price | c9indicator | batch 4 |
| 504 | Filter Wave | `filter-wave` | Trend | price | c9indicator | batch 15 |
| 505 | Fisher MPz | `fisher-mpz` | Oscillators | own | B3AR_Trades | batch 30 |
| 506 | Fisher Volume Transform \| AlphaNatt | `fisher-volume-transform-alphanatt` | Oscillators | own | AlphaNatt | batch 16 |
| 507 | Fixed-Range Volume-Profile Zones | `fixed-range-volume-profile-zones` | Volume | own | RWCS_LTD | batch 13 |
| 508 | Flow Control Oscillator (FCO) | `flow-control-oscillator` | Volume | own | WalrusQuant | batch 19 |
| 509 | FlowShift Oscillator | `flowshift-oscillator` | Oscillators | own | BOSWaves | batch 24 |
| 510 | FluidTrades - SMC Lite | `fluidtrades-smc-lite` | Trend | price | Pmgjiv | most liked |
| 511 | Follow Line | `follow-line` | Trend | price | Dreadblitz |  |
| 512 | Footprint IQ Pro | `footprint-iq-pro` | Volume | price | Trading-IQ | most liked |
| 513 | For-Loop Vote Trailing Stop \| MiesOnCharts | `for-loop-vote-trailing-stop-miesoncharts` | Trend | price | MiesOnCharts | batch 31 |
| 514 | Force Pulse | `force-pulse` | Oscillators | own | Uncle_the_shooter | batch 17 |
| 515 | Forecast Oscillator | `forecast-oscillator` | Oscillators | own | KivancOzbilgic |  |
| 516 | Fourier series Model Of The Market | `fourier-series-model-of-the-market` | Oscillators | own | e2e4 | batch 12 |
| 517 | Fractal Exhaustion Band | `fractal-exhaustion-band` | Trend | price | QuantAlgo | batch 2 |
| 518 | Fractal Strength Oscillator | `fractal-strength-oscillator` | Oscillators | own | SurgeQuant | batch 20 |
| 519 | Fractals Trend | `fractals-trend` | Trend | price | BigBeluga | batch 2 |
| 520 | Fractals V9 | `fractals-v9` | Trend | price | RicardoSantos | most liked |
| 521 | Fractional EMA Kalman Filter | `fractional-ema-kalman-filter` | Moving Averages | price | et20tradeview | batch 4 |
| 522 | FSVZO | `fsvzo` | Volume | own | AlphaExtract | batch 5 |
| 523 | Full Candle Higher/Lower (No Repeats) | `full-candle-higher-lower` | Candlestick Patterns | price | devtiqo | batch 41 |
| 524 | Function Savitzky Golay Filter with 7 Vectors V0 | `function-savitzky-golay-filter-with-7-vectors-v0` | Moving Averages | price | RicardoSantos | batch 33 |
| 525 | FuTech V-Spike & V-Highlighter | `futech-v-spike-v-highlighter` | Volume | price | Atmiya_aatubhai | batch 39 |
| 526 | Future Trend Channel | `future-trend-channel` | Channels & Bands | price | ChartPrime | most liked |
| 527 | FVG & IFVG ICT Inversion Fair Value Gap Signal | `fvg-ifvg-ict-inversion-fair-value-gap-signal` | Trend | price | TradingFinder | most liked |
| 528 | FVG Breakout/Breakdown | `fvg-breakout-breakdown` | Trend | price | ICT_Concept_Trading | batch 33 |
| 529 | FVG Candle Highlighter | `fvg-candle-highlighter` | Volatility | price | SmellyTaz | batch 40 |
| 530 | FVG Instantaneous Mitigation Signals | `fvg-instantaneous-mitigation-signals` | Trend | price | LuxAlgo | most liked |
| 531 | FVG Order Blocks | `fvg-order-blocks` | Trend | price | BigBeluga | most liked |
| 532 | FVG Positioning Average | `fvg-positioning-average` | Trend | price | LuxAlgo |  |
| 533 | FVG Sessions | `fvg-sessions` | Trend | price | LuxAlgo | most liked |
| 534 | FX Market Sessions | `fx-market-sessions` | Trend | price | boitoki | most liked |
| 535 | FX Sniper T3-CCI | `fx-sniper-t3-cci` | Oscillators | own |  |  |
| 536 | FX Sniper: T3-CCI Copy Strategy | `fx-sniper-t3-cci-copy-strategy` | Oscillators | own | HPotter | most liked |
| 537 | FXN - Asian Session Range | `fxn-asian-session-range` | Volatility | price | RobMinty | most liked |
| 538 | FXN - Week and Day Separator | `fxn-week-and-day-separator` | Trend | price | RobMinty | most liked |
| 539 | FxShare - CC Reversal | `fxshare-cc-reversal` | Trend | price | FxShareRobots | batch 22 |
| 540 | G-Score \| NAL | `g-score-nal` | Oscillators | own | NordicAlphaLab | batch 13 |
| 541 | Gabriel's Andean Oscillator | `gabriel-s-andean-oscillator` | Trend | own | GabrielAmadeusLau | batch 23 |
| 542 | Gamma + Fibonacci EMA Bands | `gamma-fibonacci-ema-bands` | Moving Averages | price | ky_yule1010 | batch 23 |
| 543 | Gamma Hedging Pressure (Normalized -100 to +100) | `gamma-hedging-pressure` | Momentum | own | uzair2join | batch 20 |
| 544 | Gann Box | `gann-box` | Trend | price | Zeiierman | most liked |
| 545 | Gann High Low | `gann-high-low` | Trend | price | KivancOzbilgic |  |
| 546 | GANN Level (Salil Sir) | `gann-level` | Channels & Bands | price | prabhat76 | batch 12 |
| 547 | Gaps + Imbalances + Wicks (MTF) - By Leviathan | `gaps-imbalances-wicks-by-leviathan` | Trend | price | LeviathanCapital | most liked |
| 548 | Gaussian Acceleration Array | `gaussian-acceleration-array` | Momentum | own | NantzOS | batch 36 |
| 549 | Gaussian Filter Trend | `gaussian-filter-trend` | Trend | price | QuantAlgo | batch 2 |
| 550 | Gaussian Ribbon | `gaussian-ribbon` | Moving Averages | price | NantzOS | batch 13 |
| 551 | Gaussian RSI \| NAL | `gaussian-rsi-nal` | Momentum | own | NordicAlphaLab | batch 7 |
| 552 | GBR Micro Kernel Trend | `gbr-micro-kernel-trend` | Moving Averages | price | THEGBR | batch 36 |
| 553 | Gho$t EMA Cloud | `gho-t-ema-cloud` | Moving Averages | price | Ghostmlt | batch 29 |
| 554 | Ghost Tangent Crossings | `ghost-tangent-crossings` | Trend | price | ChartPrime | most liked |
| 555 | Gideons Gold - ADX Watchman | `gideons-gold-adx-watchman` | Trend | own | gideonsgold | batch 34 |
| 556 | Global (World) Monetary Supply M2 (measured in USD) | `global-monetary-supply-m2` | Trend | own | miguefinance | most liked |
| 557 | Global Liquidity Index | `global-liquidity-index` | Trend | price | QuantitativeAlpha | most liked |
| 558 | GMMA | `gmma-daisuke-gewinn` | Moving Averages | price | daisuke_gewinn | most liked |
| 559 | GMMA Oscillator | `gmma-oscillator` | Trend | own |  |  |
| 560 | Godmode 4.0.2 | `godmode-4-0-2` | Channels & Bands | price | chrysopoetics | most liked |
| 561 | Gold Trend Signal Indicator | `gold-trend-signal-indicator` | Trend | price | CsmillrSirrry | batch 33 |
| 562 | Golden & Death Cross with Re-Activation | `golden-death-cross-with-re-activation` | Moving Averages | price | oberlunar_tr | batch 26 |
| 563 | Golden Ratio Trend Persistence | `golden-ratio-trend-persistence` | Trend | price | YetAnotherTA | batch 9 |
| 564 | Golden/Death Cross Highlighter | `golden-death-cross-highlighter` | Moving Averages | price | dripvesting | batch 36 |
| 565 | Gorgo's Hybrid Oscillator STrategy | `gorgo-s-hybrid-oscillator-strategy` | Oscillators | own | Gorgomannaro | batch 32 |
| 566 | Gradient Trend Filter | `gradient-trend-filter` | Trend | price | ChartPrime | batch 1 |
| 567 | Granville Entry Guide | `granville-entry-guide` | Moving Averages | price | fightpm | batch 17 |
| 568 | Gravity Well Trend \| Lyro RS | `gravity-well-trend-lyro-rs` | Trend | price | LyroRS | batch 10 |
| 569 | Grid Bot Simulator | `grid-bot-simulator` | Channels & Bands | price | xxattaxx | most liked |
| 570 | Gridbot Ping Pong | `gridbot-ping-pong` | Channels & Bands | price | xxattaxx | batch 18 |
| 571 | Guppy MMA | `guppy-mma` | Moving Averages | own | AlphaExtract | batch 15 |
| 572 | Guppy Multiple Moving Average | `gmma` | Moving Averages | price | Daryl Guppy |  |
| 573 | Guppy Oscillator-REvans993 | `guppy-oscillator-revans993` | Oscillators | own | REvans993 | batch 36 |
| 574 | Guppy Wave | `guppy-wave` | Moving Averages | price | UkutaLabs | batch 25 |
| 575 | GWAP (Gamma Weighted Average Price) | `gwap` | Moving Averages | price | EdgeTools | batch 18 |
| 576 | H-Infinity Volatility Filter | `h-infinity-volatility-filter` | Trend | price | QuantAlgo | batch 7 |
| 577 | HalfTrend | `half-trend` | Trend | price | everget |  |
| 578 | HalfTrend Long/Short Signal Engine | `halftrend-long-short-signal-engine` | Trend | price | BigBeluga | most liked |
| 579 | HaP MACD | `hap-macd` | Momentum | own | agahakanaga | batch 1 |
| 580 | Harmonic Pattern Detection | `harmonic-pattern-detection` | Trend | price | LuxAlgo | most liked |
| 581 | Harmonic Pattern Detection, Prediction, and Backtesting Tool | `harmonic-pattern-detection-prediction-and` | Trend | price | reees | most liked |
| 582 | Harmonic Periodicity Matrix | `harmonic-periodicity-matrix` | Oscillators | own | Pineify | batch 29 |
| 583 | Harmonic Sniper Trigger - PyraTime | `harmonic-sniper-trigger-pyratime` | Oscillators | own | PyraTime | batch 27 |
| 584 | HARSI+CBC | `harsi-cbc` | Oscillators | own | mehmetbezgincan | batch 34 |
| 585 | Hash Ribbons | `hash-ribbons` | Moving Averages | own | capriole_charles | most liked |
| 586 | HawkEye Volume | `hawkeye-volume` | Volume | own |  |  |
| 587 | Heatmap Volume | `heatmap-volume` | Volume | own | xdecow |  |
| 588 | Heiken Ashi Candles | `heiken-ashi-candles` | Trend | price | CryptoRox | most liked |
| 589 | Heiken Ashi Ribbon | `heiken-ashi-ribbon` | Trend | price | UkutaLabs | batch 21 |
| 590 | Heikin Ashi Colored Regular OHLC Candles | `heikin-ashi-colored-regular-ohlc-candles` | Candlestick Patterns | price | LuxmiAI | batch 40 |
| 591 | Heikin Ashi Doji with High Volume | `heikin-ashi-doji-with-high-volume` | Candlestick Patterns | price | nwfjf6m8 | batch 42 |
| 592 | Heikin Ashi RSI Oscillator | `heikin-ashi-rsi-oscillator` | Momentum | own | JayRogers |  |
| 593 | Heikin Line - TB365 | `heikin-line-tb365` | Moving Averages | price | tradebot_365 | batch 32 |
| 594 | Heikin-Ashi Reversals with Region & Dots | `heikin-ashi-reversals-with-region-dots` | Candlestick Patterns | price | theRhinoSlayer | batch 42 |
| 595 | HEMA Trend Levels | `hema-trend-levels` | Trend | price | AlgoAlpha |  |
| 596 | Henderson Weighted Moving Average | `henderson-weighted-moving-average` | Moving Averages | price | everget | batch 30 |
| 597 | High For Loop \| MisinkoMaster | `high-for-loop-misinkomaster` | Trend | own | MisinkoMaster | batch 37 |
| 598 | High Probability Order Blocks | `high-probability-order-blocks` | Trend | price | AlgoAlpha | most liked |
| 599 | High Volume Arrow Signals (Ajustável) | `high-volume-arrow-signals` | Volume | price | IdeManson | batch 24 |
| 600 | High Volume Buyers/Sellers+ | `high-volume-buyers-sellers` | Volume | price | avitawill | batch 40 |
| 601 | High Volume Points | `high-volume-points` | Volume | price | BigBeluga | most liked |
| 602 | High-Low of X Bar | `high-low-of-x-bar` | Volatility | own | sam-austin | batch 29 |
| 603 | Higher High Lower Low Strategy (With Source Code) | `higher-high-lower-low-strategy` | Trend | price | LonesomeTheBlue | most liked |
| 604 | Higher order Orderblocks + Breakerblocks + Range + Alerts | `higher-order-orderblocks-breakerblocks-range` | Trend | price |  | most liked |
| 605 | Higher Time Frame Support/Resistance | `higher-time-frame-support-resistance` | Channels & Bands | price | BigBeluga | most liked |
| 606 | Higher Timeframe High & Low | `higher-timeframe-high-low` | Channels & Bands | price | ChartPrime | most liked |
| 607 | Hilega-Milega-RSI-EMA-WMA indicator designed by NK | `hilega-milega-rsi-ema-wma-indicator-designed-by-nk` | Oscillators | own | kshirsagar_n | batch 14 |
| 608 | Historical Liquidity Proximity Heatmap | `liquidity-proximity-heatmap` | Volume | price | LuxAlgo | batch 3 |
| 609 | HMA Breakdown | `hma-breakdown` | Moving Averages | price | NonLinearRookie | batch 11 |
| 610 | Horns Pattern Identifier | `horns-pattern-identifier` | Trend | price | LuxAlgo | most liked |
| 611 | HOTT LOTT | `hott-lott` | Trend | price | KivancOzbilgic |  |
| 612 | Hourly Trading System | `hourly-trading-system` | Trend | price | Zeiierman | most liked |
| 613 | HPDR Bands Indicator | `hpdr-bands-indicator` | Channels & Bands | price | afonso_77 | batch 23 |
| 614 | HTC peppermint_07 CCI w signal + s&r RSI | `htc-peppermint-07-cci-w-signal-s-r-rsi` | Oscillators | own | peppermint07 | batch 14 |
| 615 | HTF Candle Profile | `htf-candle-profile` | Volume | price | ChartPrime | most liked |
| 616 | HTF Candles & Mini Charts by DGT | `htf-candles-mini-charts-by-dgt` | Trend | price | dgtrd | most liked |
| 617 | HTF Liquidity Levels | `htf-liquidity-levels` | Channels & Bands | price | sbtnc | most liked |
| 618 | HTF Reversal Divergences | `htf-reversal-divergences` | Oscillators | own | LuxAlgo | most liked |
| 619 | HTH - WD Gann Square Root Levels | `hth-wd-gann-square-root-levels` | Channels & Bands | price | tamillselvan | batch 27 |
| 620 | Hull Butterfly Oscillator | `hull-butterfly-oscillator` | Momentum | own |  |  |
| 621 | Hull Suite | `hull-suite` | Trend | price |  |  |
| 622 | Hunters Reversal v2.3 | `hunters-reversal-v2-3` | Trend | price | d_jaeger | batch 33 |
| 623 | Hurst-Based Trend Persistence w/Poisson Prediction | `hurst-based-trend-persistence-w-poisson-prediction` | Oscillators | own | garysebastianbrowniii | batch 28 |
| 624 | HyperTrend [LuxAlgo] | `hyper-trend` | Trend | price | LuxAlgo |  |
| 625 | Ichimoku | `ichimoku-hpotter` | Trend | price |  | most liked |
| 626 | Ichimoku ACE Club | `ichimoku-ace-club` | Trend | price | binhmyco | batch 26 |
| 627 | Ichimoku EMA Bands | `ichimoku-ema-bands` | Channels & Bands | price |  |  |
| 628 | Ichimoku Kinko Hyo | `ichimoku-kinko-hyo` | Trend | price | insideandup | batch 32 |
| 629 | Ichimoku Kinkō hyō 目均衡表 | `ichimoku-kink-hy` | Trend | price | RickSimpson | most liked |
| 630 | Ichimoku Score Indicator | `ichimoku-score-indicator` | Trend | own | tanayroy | batch 29 |
| 631 | Ichimoku Theories | `ichimoku-theories` | Trend | price | LuxAlgo | most liked |
| 632 | Ichimoku w/Heikin-Ashi | `ichimoku-w-heikin-ashi` | Trend | price | yasujiy | batch 25 |
| 633 | ICT & RTM Price Action Indicator | `ict-rtm-price-action-indicator` | Channels & Bands | price | behradmojtahedi | batch 21 |
| 634 | ICT Algorithmic Macro Tracker° (Open-Source) by toodegrees | `ict-algorithmic-macro-tracker-by-toodegrees` | Trend | price | toodegrees | most liked |
| 635 | ICT Anchored Market Structures with Validation | `ict-anchored-market-structures-with-validation` | Trend | price | LuxAlgo | most liked |
| 636 | ICT Auto-Validated SMC | `ict-auto-validated-smc` | Trend | price | GoodBadBitcoin | most liked |
| 637 | ICT Concept Order Block \| FVG \| Liquidity Sweeps | `ict-concept-order-block-fvg-liquidity-sweeps` | Trend | price | TradingFinder | most liked |
| 638 | ICT Concepts | `ict-concepts` | Trend | price | LuxAlgo | most liked |
| 639 | ICT Everything | `ict-everything` | Trend | price | coldbrewrosh | most liked |
| 640 | ICT FVG Buy/Sell Signals | `ict-fvg-buy-sell-signals` | Trend | price | svmstellarvisionmedia | batch 5 |
| 641 | ICT HTF Candles (fadi) | `ict-htf-candles` | Trend | price | fadizeidan | most liked |
| 642 | ICT Immediate Rebalance Toolkit | `ict-immediate-rebalance-toolkit` | Trend | price | LuxAlgo | most liked |
| 643 | ICT Implied Fair Value Gap (IFVG) | `ict-implied-fair-value-gap` | Trend | price | LuxAlgo | most liked |
| 644 | ICT Institutional Order Flow (fadi) | `ict-institutional-order-flow` | Trend | price | fadizeidan | most liked |
| 645 | ICT Killzones | `ict-killzones` | Trend | price | LuxAlgo | most liked |
| 646 | ICT Killzones + Pivots | `ict-killzones-pivots-tfo` | Trend | price | tradeforopp | most liked |
| 647 | ICT Killzones Toolkit | `ict-killzones-toolkit` | Trend | price | LuxAlgo | most liked |
| 648 | ICT Liquidity Sweep/Swing Fail Pattern V.1 | `ict-liquidity-sweep-swing-fail-pattern-v-1` | Trend | price | wut_trader | most liked |
| 649 | ICT Macros | `ict-macros` | Trend | price | LuxAlgo | most liked |
| 650 | ICT Power Of Three \| Flux Charts | `ict-power-of-three-flux-charts` | Trend | price | fluxchart | most liked |
| 651 | ICT Seek & Destroy Profile | `ict-seek-destroy-profile` | Volatility | price | tradeforopp | most liked |
| 652 | ICT Sessions | `ict-sessions` | Channels & Bands | price | leonsholo | most liked |
| 653 | ICT Setup 04 SFP Sweep Liquidity Fake CHoCH/BOS | `ict-setup-04-sfp-sweep-liquidity-fake-choch` | Trend | price | TradingFinder | most liked |
| 654 | ICT Silver Bullet | `ict-silver-bullet` | Trend | price | LuxAlgo | most liked |
| 655 | ICT Turtle Soup \| Flux Charts | `ict-turtle-soup-flux-charts` | Trend | price | fluxchart | most liked |
| 656 | ICT Unicorn \| Flux Charts | `ict-unicorn-flux-charts` | Trend | price | fluxchart | most liked |
| 657 | ICT Unicorn Model | `ict-unicorn-model` | Trend | price | LuxAlgo | most liked |
| 658 | ICT Venom Trading Model SMC NY Session 2025Setup | `ict-venom-trading-model-smc-ny-session` | Trend | price | TradingFinder | most liked |
| 659 | IFVG Sniper Entry Engine | `ifvg-sniper-entry-engine` | Trend | price | tradewsamet | most liked |
| 660 | IIR One-Pole Price Filter | `iir-one-pole-price-filter` | Moving Averages | price | BackQuant | batch 9 |
| 661 | Imbalance Detector | `imbalance-detector` | Trend | price | LuxAlgo | most liked |
| 662 | Impulse MACD | `impulse-macd` | Momentum | own | LazyBear |  |
| 663 | Indicador Millo SMA20-SMA200-AO-RSI M1 | `indicador-millo-sma20-sma200-ao-rsi-m1` | Moving Averages | price | hernangarcia_78 | batch 19 |
| 664 | Indicator: Elder Impulse System | `indicator-elder-impulse-system` | Momentum | own | LazyBear | most liked |
| 665 | Indicator: ElliotWave Oscillator | `elliott-wave-oscillator-lazybear` | Oscillators | own | LazyBear | most liked |
| 666 | Indicator: OBV Oscillator | `obv-oscillator-lazybear` | Volume | own | LazyBear | most liked |
| 667 | Indicator: WaveTrend Oscillator | `wavetrend-oscillator-wt` | Oscillators | own | LazyBear | most liked |
| 668 | Indicator: Weis Wave Volume | `weis-wave-volume-lazybear` | Volume | own | LazyBear | most liked |
| 669 | Indicators: Traders Dynamic Index, HLCTrends and Trix Ribbon | `indicators-traders-dynamic-index-hlctrends` | Oscillators | own | LazyBear | most liked |
| 670 | Indicators: Volume-Weighted MACD Histogram & Sentiment Zone Osc | `indicators-volume-weighted-macd-histogram` | Momentum | own | LazyBear | most liked |
| 671 | Infinite EMA with Alpha Control | `infinite-ema-with-alpha-control` | Moving Averages | price | Sesilya | batch 13 |
| 672 | Initial Balance Breakout Signals | `initial-balance-breakout-signals` | Volatility | price | LuxAlgo | most liked |
| 673 | Inside / Outside Bars | `inside-outside-bars` | Candlestick Patterns | price | Iggy- | batch 42 |
| 674 | Inside Bar (Body-based) Ind/Alert | `inside-bar-ind-alert` | Candlestick Patterns | price | s_b_j | batch 40 |
| 675 | Inside Bar Coloring (Real-time + Historical) w/ Alerts | `inside-bar-coloring-w-alerts` | Candlestick Patterns | price | SpinTrades | batch 42 |
| 676 | Inside Bars (Multiple / Consecutive) | `inside-bars` | Channels & Bands | price | nilstrades_ | batch 5 |
| 677 | Instantaneous Trendline with Cloud | `instantaneous-trendline-with-cloud` | Trend | price | Sesilya | batch 22 |
| 678 | Institutional Composite Moving Average (ICMA) | `institutional-composite-moving-average` | Moving Averages | price | VolumeVigilante | batch 6 |
| 679 | Institutional MACD (Z-Score Edition) | `institutional-macd` | Momentum | own | VolumeVigilante | batch 4 |
| 680 | Institutional Order Flow Strength Classifier | `institutional-order-flow-strength-classifier` | Volume | price | LuxAlgo | most liked |
| 681 | Institutional OrderBlock Pressure | `institutional-orderblock-pressure` | Trend | price | RickSimpson | most liked |
| 682 | Institutional Volume RSI | `institutional-volume-rsi` | Momentum | own | abgthecoder | batch 6 |
| 683 | Internal Candle Strength | `internal-candle-strength` | Volatility | price | LuxAlgo | most liked |
| 684 | Interpolated Median Volatility LSMA \| Otto | `interpolated-median-volatility-lsma-otto` | Channels & Bands | price | oquant | batch 12 |
| 685 | Intraday BUY_SELL | `intraday-buy-sell` | Trend | price |  |  |
| 686 | Intraday TS BB | `intraday-ts-bb` | Oscillators | price |  |  |
| 687 | Intraday Volume Swings | `intraday-volume-swings` | Volume | price | rumpypumpydumpy |  |
| 688 | Intraday vs Overnight Change Tracker | `intraday-vs-overnight-change-tracker` | Momentum | own | TheUltimator5 | batch 12 |
| 689 | Intraday vs Overnight OBV | `intraday-vs-overnight-obv` | Volume | own | TheUltimator5 | batch 21 |
| 690 | Inverse Distance Weighted Moving Average | `inverse-distance-weighted-moving-average` | Moving Averages | price | everget | batch 15 |
| 691 | Inverse Fisher Transform COMBO | `ift-stoch-rsi-cci` | Momentum | own | KivancOzbilgic (creator John Ehlers) | most liked |
| 692 | Inverse FVG with Rejections | `inverse-fvg-with-rejections` | Trend | price | tradeforopp | most liked |
| 693 | Inversion Fair Value Gaps (IFVG) | `inversion-fair-value-gaps` | Trend | price | LuxAlgo | most liked |
| 694 | IPO Date Screener | `ipo-date-screener` | Oscillators | own | starshiptrade | batch 14 |
| 695 | Is it Time for a Pullback? Check Bars Since MA Test | `is-it-time-for-a-pullback-check-bars-since-ma-test` | Trend | own | TradeStation | batch 25 |
| 696 | Isolated Peak and Bottom | `isolated-peak-bottom` | Oscillators | price |  |  |
| 697 | ITG Scalper | `itg-scalper` | Trend | price | Complector | most liked |
| 698 | IU Mean Reversion System | `iu-mean-reversion-system` | Channels & Bands | price | Shivam_Mandrai | batch 12 |
| 699 | IU Smart Flow System | `iu-smart-flow-system` | Trend | price | Shivam_Mandrai | batch 7 |
| 700 | IV Rank (tasty-style) - VIXFix / HV Proxy | `iv-rank-vixfix-hv-proxy` | Volatility | own | steveoptionstrade2025 | batch 30 |
| 701 | John Wick Doji indicator | `john-wick-doji-indicator` | Candlestick Patterns | price | Nossgrr | batch 42 |
| 702 | JOPA Channel (Dual-Volumed) v1 | `jopa-channel-v1` | Channels & Bands | price | JopAlgo | batch 30 |
| 703 | Jurik Moving Average | `jurik-moving-average` | Moving Averages | price | everget | batch 1 |
| 704 | Kalman Ema Crosses | `kalman-ema-crosses` | Moving Averages | price | JTCapitalNL | batch 16 |
| 705 | Kalman Exponentialy Weighted Moving Average \| MisinkoMaster | `kalman-exponentialy-weighted-moving-average-misinkomaster` | Moving Averages | price | MisinkoMaster | batch 25 |
| 706 | Kalman Filter Trend Breakers | `kalman-filter-trend-breakers` | Trend | price | kypexin | batch 29 |
| 707 | Kalman Flow \| Lyro RS | `kalman-flow-lyro-rs` | Trend | price | LyroRS | batch 5 |
| 708 | Kalman Hull Bands For Loop \| RakoQuant | `kalman-hull-bands-for-loop-rakoquant` | Channels & Bands | price | RakoQuant | batch 17 |
| 709 | Kalman Hull Kijun | `kalman-hull-kijun` | Trend | price | BackQuant | batch 12 |
| 710 | Kalman Trend Levels | `kalman-trend-levels` | Trend | price | BigBeluga | most liked |
| 711 | Kalman VWAP Filter | `kalman-vwap-filter` | Moving Averages | price | BackQuant | batch 4 |
| 712 | Kaufman Adaptive Moving Average | `kaufman-adaptive-ma` | Moving Averages | price | everget |  |
| 713 | Kaufman Trend Strength Signal | `kaufman-trend-strength-signal` | Trend | price | PakunFX | batch 34 |
| 714 | KD-NewAutoTrade for Future Trading - Heikin Ashi candles | `kd-newautotrade-for-future-trading-heikin-ashi-candles` | Trend | price | krish16887 | batch 22 |
| 715 | KDJ | `kdj` | Oscillators | own | KingThies |  |
| 716 | KDJ Indicator - @iamaltcoin | `kdj-indicator-iamaltcoin` | Oscillators | own | iamaltcoin | most liked |
| 717 | Keltner-Aroon-EFI Flow | `keltner-aroon-efi-flow` | Trend | price | D_QUANT | batch 20 |
| 718 | Kernel Channel | `kernel-channel` | Channels & Bands | price | BackQuant | batch 6 |
| 719 | KERPD Noise Filter - Kaufman Efficiency Ratio and Price Density | `kerpd-noise-filter-kaufman-efficiency-ratio-and-price-density` | Volatility | own | SensitiveSuit | batch 15 |
| 720 | Key Levels SpacemanBTC IDWM | `key-levels-spacemanbtc-idwm` | Trend | price | spacemanbtc | most liked |
| 721 | Key_TDI | `key-tdi` | Oscillators | own | Fibonacci_Code | batch 31 |
| 722 | Keyzone | `keyzone` | Channels & Bands | price | Uttaya | batch 28 |
| 723 | Kijun-Sen with Buy / Sell Labels & Alerts - Ichimoku simplified | `kijun-sen-with-buy-sell-labels-alerts-ichimoku-simplified` | Trend | price | TaureaYinYang | batch 36 |
| 724 | Kinetic Slippage Index (KSI) | `kinetic-slippage-index` | Volume | own | HPotter | batch 7 |
| 725 | Kiss Of Death | `kiss-of-death` | Trend | price | thanos300693 | batch 37 |
| 726 | kNN Market Architecture | `knn-market-architecture` | Trend | price | LuxAlgo | most liked |
| 727 | L1 Moving Average Fingerprint for Long Entry | `l1-moving-average-fingerprint-for-long-entry` | Trend | price | blackcat1402 | batch 40 |
| 728 | L2 Risk Assessment for Trend Strength | `l2-risk-assessment-for-trend-strength` | Trend | own | blackcat1402 | batch 14 |
| 729 | Ladder StDev | `ladder-stdev` | Volatility | own | jason5480 | batch 30 |
| 730 | Laguerre Filter | `laguerre-filter` | Moving Averages | price | BackQuant | batch 5 |
| 731 | Laguerre RSI | `laguerre-rsi` | Momentum | own | TheLark |  |
| 732 | Laguerre Ultimate Explorations Multicator | `laguerre-ultimate-explorations-multicator` | Moving Averages | own | ImmortalFreedom | batch 20 |
| 733 | Laguerre-Kalman Adaptive Filter \| AlphaNatt | `laguerre-kalman-adaptive-filter-alphanatt` | Moving Averages | price | AlphaNatt | batch 11 |
| 734 | [imba]lance algo | `lance-algo` | Trend | price | IMBA_TRADER | most liked |
| 735 | Left Bars | `pivot-hh-hl-lh-ll` | Trend | price |  |  |
| 736 | Leledc Levels | `leledc-levels` | Candlestick Patterns | price |  |  |
| 737 | Length | `gaussian-channel` | Channels & Bands | price |  |  |
| 738 | Length | `redk-vader` | Oscillators | own | RedKTrader |  |
| 739 | Length | `zlma-trend-levels` | Moving Averages | price |  |  |
| 740 | Level2 Signalfilter Liquidity Protection | `level2-signalfilter-liquidity-protection` | Trend | own | djmad | batch 16 |
| 741 | Leveraged Liquidation Zones | `leveraged-liquidation-zones` | Channels & Bands | price | Fussion_Trader | batch 35 |
| 742 | LGMM (flat buffers) - multivariate poly + latent states | `lgmm-multivariate-poly-latent-states` | Channels & Bands | price | vsov | batch 28 |
| 743 | Linear Predictive Filters (TASC 2025.01) | `linear-predictive-filters` | Oscillators | own | PineCodersTASC | batch 2 |
| 744 | Linear Regression ++ | `linear-regression` | Channels & Bands | price | DevLucem | most liked |
| 745 | Linear Regression Blend Candles | `linear-regression-blend-candles` | Candlestick Patterns | price | B3AR_Trades | batch 39 |
| 746 | Linear Regression Candles | `linear-regression-candles` | Candlestick Patterns | price |  |  |
| 747 | Linear Regression Channel | `linear-regression-channel` | Channels & Bands | price |  |  |
| 748 | Linear Regression Channel / Curve / Slope by DGT | `linear-regression-channel-curve-slope-by-dgt` | Channels & Bands | price | dgtrd | most liked |
| 749 | Linear Regression Oscillator | `linear-regression-oscillator` | Oscillators | own | ChartPrime | most liked |
| 750 | Linear Regression Volume \| Lyro RS | `linear-regression-volume-lyro-rs` | Channels & Bands | price | LyroRS | batch 10 |
| 751 | Linear Volume MACD \| Lyro RS | `linear-volume-macd-lyro-rs` | Momentum | own | LyroRS | batch 9 |
| 752 | LineReg Candles with Hma filter | `linereg-candles-with-hma-filter` | Trend | price | MaximusGains | batch 14 |
| 753 | Liqudation HeatMap | `liqudation-heatmap` | Volume | price | BigBeluga | most liked |
| 754 | Liquidation Levels | `liquidation-levels` | Volume | price | LuxAlgo | most liked |
| 755 | Liquidation Reversal Signals | `liquidation-reversal-signals` | Volume | price | AlgoAlpha | most liked |
| 756 | Liquidations Zones | `liquidations-zones` | Volume | price | ChartPrime | most liked |
| 757 | Liquidity Delta Profiler | `liquidity-delta-profiler` | Volume | price | LuxAlgo | most liked |
| 758 | Liquidity Entry Zones | `liquidity-entry-zones` | Trend | price | tradewsamet | most liked |
| 759 | Liquidity Flow Zones (LFZ) | `liquidity-flow-zones` | Trend | price | ReubenMiles | batch 20 |
| 760 | Liquidity Grab Zones \| Flux Charts | `liquidity-grab-zones-flux-charts` | Volume | price | fluxchart | most liked |
| 761 | Liquidity Grabs | `liquidity-grabs` | Trend | price | fluxchart |  |
| 762 | Liquidity Heatmap | `liquidity-heatmap` | Volume | price | Nephew_Sam_ | most liked |
| 763 | Liquidity Indicator | `liquidity-indicator` | Channels & Bands | price | The_Forex_Steward | batch 22 |
| 764 | Liquidity Levels [LuxAlgo] | `liquidity-levels` | Trend | price | LuxAlgo |  |
| 765 | Liquidity Levels MTF - Sonarlab | `liquidity-levels-mtf-sonarlab` | Trend | price | vuetratrading | most liked |
| 766 | Liquidity Location Detector | `liquidity-location-detector` | Volume | price | BigBeluga | most liked |
| 767 | Liquidity Pools | `liquidity-pools` | Trend | price | LuxAlgo | most liked |
| 768 | Liquidity Pools Pro | `liquidity-pools-pro` | Trend | price | WillyAlgoTrader | most liked |
| 769 | Liquidity Price Depth Chart | `liquidity-price-depth-chart` | Volume | price | LuxAlgo | most liked |
| 770 | Liquidity Sentiment Profile \| LUPEN | `liquidity-sentiment-profile-lupen` | Volume | own | Horazio | batch 20 |
| 771 | Liquidity Sniper Pro | `liquidity-sniper-pro` | Trend | price | VenusJ | most liked |
| 772 | Liquidity Spectrum Visualizer | `liquidity-spectrum-visualizer` | Volume | price | BigBeluga | most liked |
| 773 | Liquidity Structure & Order Flow | `liquidity-structure-order-flow` | Volume | price | LuxAlgo | most liked |
| 774 | Liquidity Sweep Confirmation | `liquidity-sweep-confirmation` | Trend | price | filipiti | batch 38 |
| 775 | Liquidity Sweep Filter | `liquidity-sweep-filter` | Trend | price | AlgoAlpha | most liked |
| 776 | Liquidity Sweep Hunter Algo | `liquidity-sweep-hunter-algo` | Volume | price | AlgoAlpha | most liked |
| 777 | Liquidity Sweeps [LuxAlgo] | `liquidity-sweeps` | Trend | price |  |  |
| 778 | Liquidity Swings | `liquidity-swings` | Volume | price | LuxAlgo | most liked |
| 779 | Liquidity Thermal Map | `liquidity-thermal-map` | Volume | price | BigBeluga | most liked |
| 780 | Liquidity Trap & Reversal bot | `liquidity-trap-reversal-bot` | Channels & Bands | price | pointalgo | batch 28 |
| 781 | Liquidity Trendline With Signals | `liquidity-trendline-with-signals` | Trend | price | BigBeluga | most liked |
| 782 | Liquidity Voids (FVG) | `liquidity-voids` | Volatility | price | LuxAlgo | most liked |
| 783 | Liquidity Zones | `liquidity-zones` | Volume | price | BigBeluga | most liked |
| 784 | Loacally Weighted MA (LWMA) Direction Histogram | `loacally-weighted-ma-direction-histogram` | Trend | own | LuxmiAI | batch 9 |
| 785 | Logarithmic Regression Channel-Trend | `logarithmic-regression-channel-trend` | Trend | price | BigBeluga | most liked |
| 786 | Logistic RSI, STOCH, ROC, AO, ... by DGT | `logistic-rsi-stoch-roc-ao-by-dgt` | Oscillators | own | dgtrd | most liked |
| 787 | Logit RSI | `logit-rsi` | Oscillators | own | AdaptiveRSI | batch 11 |
| 788 | Long Short dom | `long-short-dom` | Trend | own | Robin-Hood-trading | batch 11 |
| 789 | Lorentzian Length Adaptive Moving Average | `lorentzian-length-adaptive-moving-average` | Moving Averages | price | Starcruiser | batch 21 |
| 790 | LOWESS (Locally Weighted Scatterplot Smoothing) | `lowess` | Moving Averages | price | ChartPrime | most liked |
| 791 | Lumina Trend Channels | `lumina-trend-channels` | Channels & Bands | price | Pineify | batch 10 |
| 792 | Luminous Mean Reversion Channels | `luminous-mean-reversion-channels` | Channels & Bands | price | Pineify | batch 7 |
| 793 | Lunar Phase (LUNAR) | `lunar-phase` | Oscillators | own | mihakralj | batch 23 |
| 794 | Luxy BIG beautiful Dynamic ORB | `luxy-big-beautiful-dynamic-orb` | Channels & Bands | price | orenluxy | most liked |
| 795 | MA Cross with Displacement | `ma-cross-with-displacement` | Moving Averages | price | TehThomas | batch 25 |
| 796 | MA Ribbon 5EMA \| 20EMA \| 50SMA \| 200EMA | `ma-ribbon-5ema-20ema-50sma-200ema` | Moving Averages | price | vamsinelluri7 | batch 29 |
| 797 | MA Sabres | `ma-sabres` | Moving Averages | price | LuxAlgo | most liked |
| 798 | MA Shaded Fill Crossover | `ma-shaded-fill` | Moving Averages | price |  |  |
| 799 | MA Strategy Emperor | `ma-strategy-emperor` | Trend | price | insiliconot |  |
| 800 | MA Type | `madrid-ma-ribbon` | Moving Averages | price |  |  |
| 801 | MA Zones | `ma-zones` | Moving Averages | price | ZenAndTheArtOfTrading | batch 7 |
| 802 | MACD & RSI Overlay (Expo) | `macd-rsi-overlay` | Momentum | price | Zeiierman | most liked |
| 803 | MACD (Buy & Sell signals) | `macd-irtov` | Momentum | own | irtov | batch 24 |
| 804 | Macd + Adx Pro by @Eternyworld | `macd-adx-pro-by-eternyworld` | Momentum | own | ETERNYWORLD | batch 26 |
| 805 | MACD 4C | `macd-4c` | Momentum | own | vkno422 |  |
| 806 | MACD Based Price Forecasting | `macd-based-price-forecasting` | Momentum | price | LuxAlgo | most liked |
| 807 | MACD Crossover | `macd-crossover` | Momentum | own |  |  |
| 808 | MacD Custom Indicator-Multiple Time Frame+All Available Options! | `cm-macd-custom-mtf` | Momentum | own | ChrisMoody | most liked |
| 809 | MACD DEMA | `macd-dema` | Momentum | own |  |  |
| 810 | MACD Divergence | `macd-divergence` | Momentum | own |  |  |
| 811 | MACD Dynamic Squeeze Pro | `macd-dynamic-squeeze-pro` | Momentum | own | ZynAlgo | batch 24 |
| 812 | MACD Leader | `macd-leader` | Momentum | own | LazyBear |  |
| 813 | MACD Liquidity Tracker System | `macd-liquidity-tracker-system` | Momentum | own | PROFABIGHI_CAPITAL | batch 29 |
| 814 | MACD Overlay v1 | `macd-overlay-v1` | Momentum | price | JopAlgo | batch 5 |
| 815 | MACD Pro | `macd-pro` | Momentum | own | VEGAlgo | batch 23 |
| 816 | MACD Pseudo Super Smoother | `macd-pseudo-super-smoother` | Oscillators | own | The_Peaceful_Lizard | batch 37 |
| 817 | MACD ReLoaded | `macd-reloaded` | Momentum | own | KivancOzbilgic |  |
| 818 | MACD Sniper | `macd-sniper` | Momentum | own | trade_lexx | batch 15 |
| 819 | MACD Support and Resistance [ChartPrime] | `macd-support-resistance` | Momentum | own | ChartPrime |  |
| 820 | MACD VXI | `macd-vxi` | Momentum | own |  |  |
| 821 | MACD With Crossings and Above Below Zero | `macd-with-crossings-and-above-below-zero` | Momentum | own | Kgroomes | batch 18 |
| 822 | MACD x BB x STDEV x RVI | `macd-x-bb-x-stdev-x-rvi` | Oscillators | own | Vaquant | batch 20 |
| 823 | MACD XD | `macd-xd` | Momentum | own | Zen_Formless | batch 8 |
| 824 | MACD-V (Volatility Normalized MACD) | `macd-v` | Momentum | own | KivancOzbilgic | batch 2 |
| 825 | MACD-V with Volatility Normalisation | `macd-v-with-volatility-normalisation` | Momentum | own | DutchCryptoDad | batch 25 |
| 826 | MACD-X, More Than MACD by DGT | `macd-x-more-than-macd-by-dgt` | Oscillators | own | dgtrd | most liked |
| 827 | MACD1 Fast | `double-macd` | Momentum | own |  |  |
| 828 | MACDAS | `macdas` | Momentum | own |  |  |
| 829 | Machine Learning Price Target Prediction Signals | `machine-learning-price-target-prediction` | Trend | price | AlgoAlpha | most liked |
| 830 | Machine Learning RSI \| AI Classification & Ranking | `machine-learning-rsi-ai-classification-ranking` | Oscillators | own | Zeiierman | most liked |
| 831 | Machine Learning RSI ║ BullVision | `machine-learning-rsi-bullvision` | Oscillators | own | BullVisionCapital | most liked |
| 832 | Machine Learning Supertrend | `machine-learning-supertrend` | Trend | price | Zimord | most liked |
| 833 | Machine Learning: Gaussian Process Regression | `machine-learning-gaussian-process-regression` | Trend | price | LuxAlgo | most liked |
| 834 | Machine Learning: kNN Trend Predictor | `machine-learning-knn-trend-predictor` | Trend | price | tkarolak | batch 11 |
| 835 | Machine Learning: Logistic Regression | `machine-learning-logistic-regression` | Trend | price | capissimo | most liked |
| 836 | Machine Learning: Lorentzian Classification | `lorentzian-classification` | Trend | price | jdehorty | most liked |
| 837 | MAD Trend Detector ~ C H I P A | `mad-trend-detector-c-h-i-p-a` | Trend | own | C_H_I_P_A | batch 36 |
| 838 | Madrid MA Ribbon Bar v2 | `madrid-ma-ribbon-bar-v2` | Moving Averages | own | Madrid | most liked |
| 839 | Madrid Trend Squeeze | `madrid-trend-squeeze` | Momentum | own |  |  |
| 840 | MADZ - Moving Average Deviation Z-Score | `madz-moving-average-deviation-z-score` | Oscillators | own | MiesOnCharts | batch 32 |
| 841 | Magnet Force + RSI Filter V6 | `magnet-force-rsi-filter-v6` | Channels & Bands | price | mehmetbezgincan | batch 31 |
| 842 | Maket Strat Absorption Bubbles | `maket-strat-absorption-bubbles` | Volume | price | samb817 | batch 41 |
| 843 | MAMA - FAMA (Ehlers) | `mama-fama` | Moving Averages | price | KatherinaNote | batch 31 |
| 844 | Manipulation Candle | `manipulation-candle` | Candlestick Patterns | price | DrauzioFx | batch 39 |
| 845 | Mark Minervini Buy Signal | `mark-minervini-buy-signal` | Trend | price | Dr_Leong_Yee_Rock | batch 18 |
| 846 | Market Cipher A | `market-cipher-a` | Oscillators | price |  |  |
| 847 | Market Cipher A free version 1.1 | `market-cipher-a-free-version-1-1` | Moving Averages | price | falconCoin | most liked |
| 848 | Market Cipher B | `market-cipher-b` | Oscillators | own |  |  |
| 849 | Market Cipher B  Free version with Buy and sell | `market-cipher-b-free-version-with-buy-and-sell` | Oscillators | own | falconCoin | most liked |
| 850 | Market Participation Ratio-MPR | `market-participation-ratio-mpr` | Volume | own | TechnoBlooms | batch 37 |
| 851 | Market Pressure Oscillator | `market-pressure-oscillator` | Oscillators | own | Uncle_the_shooter | batch 8 |
| 852 | Market Profile | `market-profile` | Volume | price | LonesomeTheBlue | most liked |
| 853 | Market Profile with TPO | `market-profile-with-tpo` | Volume | price | drother | most liked |
| 854 | Market Pulse Pro | `market-pulse-pro` | Oscillators | own | Canhoto-Medium | batch 32 |
| 855 | Market Sentiment Technicals | `market-sentiment-technicals` | Oscillators | price | LuxAlgo | most liked |
| 856 | Market Sessions - By Leviathan | `market-sessions-by-leviathan` | Trend | price | LeviathanCapital | most liked |
| 857 | Market sessions and Volume profile - By Leviathan | `market-sessions-volume-profile` | Volume | price | LeviathanCapital | most liked |
| 858 | Market Shift Levels | `market-shift-levels` | Trend | price |  |  |
| 859 | Market Structure - By Leviathan | `market-structure-by-leviathan` | Trend | price | LeviathanCapital | most liked |
| 860 | Market Structure Break & OB Probability Toolkit | `market-structure-break-ob-probability-toolkit` | Trend | price | LuxAlgo | most liked |
| 861 | Market Structure Break & Order Block by EmreKb | `market-structure-break-order-block` | Trend | price | EmreKb | most liked |
| 862 | Market Structure CHoCH/BOS (Fractal) | `market-structure-choch-bos` | Trend | price | LuxAlgo | most liked |
| 863 | Market Structure Confluence | `market-structure-confluence` | Trend | price | AlgoAlpha | most liked |
| 864 | Market Structure Dashboard \| Flux Charts | `market-structure-dashboard-flux-charts` | Trend | price | fluxchart | most liked |
| 865 | Market Structure Inducements ICT CHoch BOS Sweeps | `market-structure-inducements-ict-choch-bos` | Trend | price | TradingFinder | most liked |
| 866 | Market Structure Oscillator | `market-structure-oscillator` | Oscillators | own | LuxAlgo | most liked |
| 867 | Market Structure Trailing Stop | `market-structure-trailing-stop` | Trend | price | LuxAlgo |  |
| 868 | Market Structure Trend | `market-structure-trend` | Trend | price | QuantAlgo | batch 12 |
| 869 | Market Structure Trend Targets | `market-structure-trend-targets` | Trend | price | ChartPrime | most liked |
| 870 | Market Structure with Inducements & Sweeps | `market-structure-with-inducements-sweeps` | Trend | price | LuxAlgo | most liked |
| 871 | Market Structure- ZigZag, Break of Structure & Order Blocks | `market-structure-zigzag-break-of-structure` | Trend | price | The_Forex_Steward | most liked |
| 872 | Market Structures + ZigZag CHoCH/BOS - MSS/MSB | `market-structures-zigzag-choch-bos-mss-msb` | Trend | price | TradingFinder | most liked |
| 873 | Market Trend Levels Detector | `market-trend-levels-detector` | Trend | price | BigBeluga | most liked |
| 874 | Martell MNQ Quantum Scalper Pro | `martell-mnq-quantum-scalper-pro` | Trend | price | JMartell | batch 31 |
| 875 | Marubozu Detector | `marubozu-detector` | Candlestick Patterns | price | toppermost | batch 38 |
| 876 | Master Pattern | `master-pattern` | Trend | price | LuxAlgo | most liked |
| 877 | Matrix Series | `matrix-series` | Oscillators | own |  |  |
| 878 | MavilimW | `mavilimw` | Trend | price | KivancOzbilgic |  |
| 879 | Mean Angles | `mean-angles` | Momentum | own | bharatTrader | batch 9 |
| 880 | Mean Reversion Channel - (fareid's MRI Variant) | `mean-reversion-channel` | Channels & Bands | price | fareidzulkifli | most liked |
| 881 | Measured Pattern Move (Bulkowski) | `measured-pattern-move` | Trend | price | Steversteves | batch 28 |
| 882 | MechArt Moving Average and % Above V1.1 | `mechart-moving-average-and-above-v1-1` | Moving Averages | price | MechArt_ | batch 29 |
| 883 | Median ATR SD Oscillator | `median-atr-sd-oscillator` | Volatility | own | Unknownhodler | batch 37 |
| 884 | Median Gaussian Trend \| NAL | `median-gaussian-trend-nal` | Trend | price | NordicAlphaLab | batch 15 |
| 885 | Median MACD - Mattes | `median-macd-mattes` | Momentum | own | Mattes00 | batch 8 |
| 886 | Median Volume Weighted Deviation | `median-volume-weighted-deviation` | Volume | price | Burggg | batch 30 |
| 887 | MESA Adaptive Ehlers Flow \| AlphaNatt | `mesa-adaptive-ehlers-flow` | Moving Averages | price | AlphaNatt | batch 8 |
| 888 | MESA Phase-Adaptive Band Trend | `mesa-phase-adaptive-band-trend` | Trend | price | SchizoQuant | batch 22 |
| 889 | MFI | `mfi-seiglerj` | Volume | own | seiglerj | most liked |
| 890 | MFI + RSI + EMA Dynamic Signals | `mfi-rsi-ema-dynamic-signals` | Momentum | price | Raisontgh | batch 37 |
| 891 | MFI Nexus Pro | `mfi-nexus-pro` | Volume | own | trade_lexx | batch 10 |
| 892 | Mid-term Ribbon | `mid-term-ribbon` | Moving Averages | price | Gartav388637 | batch 25 |
| 893 | Minervini Trend Template Screener (v5) | `minervini-trend-template-screener` | Trend | price | hibinomasakazu1991 | batch 41 |
| 894 | Minimalist Doji Highlighter | `minimalist-doji-highlighter` | Candlestick Patterns | price | SensitiveSuit | batch 40 |
| 895 | Mirage Liquidity Sweep Pro | `mirage-liquidity-sweep-pro` | Trend | price | WillyAlgoTrader | most liked |
| 896 | Mix1 : Ema Cross + Trend Channel | `mix1-ema-cross-trend-channel` | Moving Averages | price | gu5tavo71 | most liked |
| 897 | Machine Learning Adaptive SuperTrend [AlgoAlpha] | `ml-adaptive-supertrend` | Trend | price |  |  |
| 898 | ML Deep Regression Pro | `ml-deep-regression-pro` | Trend | price | TechnoBlooms | batch 29 |
| 899 | Machine Learning Momentum Index (MLMI) [Zeiierman] | `ml-momentum-index` | Momentum | own |  |  |
| 900 | ML Moving Average | `ml-moving-average` | Moving Averages | price |  |  |
| 901 | ML RSI | `ml-rsi` | Momentum | own |  |  |
| 902 | Machine Learning: kNN-based Strategy | `ml-knn-strategy` | Momentum | price |  |  |
| 903 | Modified Heikin-Ashi | `modified-heikin-ashi` | Candlestick Patterns | price | ChrisMoody |  |
| 904 | Momentum Acceleration by DGT | `momentum-acceleration-by-dgt` | Momentum | price | dgtrd | most liked |
| 905 | Momentum Ghost Machine | `momentum-ghost-machine` | Momentum | own | ChartPrime | most liked |
| 906 | Momentum Shift | `momentum-shift` | Momentum | own | BigBeluga | most liked |
| 907 | Momentum-based ZigZag | `momentum-zigzag` | Trend | price | Peter_O |  |
| 908 | Money Flow Extended | `money-flow-extended` | Volume | own | alexrainman | batch 6 |
| 909 | Money Flow Index + Alerts | `money-flow-index-alerts` | Oscillators | own | DreamsDefined | most liked |
| 910 | Money Flow Profile | `money-flow-profile` | Volume | price | LuxAlgo | most liked |
| 911 | Money Flow Pulse | `money-flow-pulse` | Volume | own | TheLeadingIndicator | batch 35 |
| 912 | Moneyball EMA-MACD indicator | `moneyball-ema-macd-indicator` | Momentum | own | VinnieTheFish | batch 6 |
| 913 | Monotonic Trend Consensus | `monotonic-trend-consensus` | Trend | own | QuantAlgo | batch 16 |
| 914 | MOST + Moving Average Screener | `most-moving-average-screener` | Trend | price | KivancOzbilgic | most liked |
| 915 | Moving Average ADX | `ma-adx` | Moving Averages | price |  |  |
| 916 | Moving Average Candles | `moving-average-candles` | Moving Averages | price | aleskxyz | batch 41 |
| 917 | Moving Average Colored | `ma-colored` | Moving Averages | price |  |  |
| 918 | Moving Average Converging | `ma-converging` | Moving Averages | price | LuxAlgo |  |
| 919 | Moving Average Cross Alert, Multi-Timeframe (MTF) (by ChartArt) | `ma-cross-alert-mtf` | Moving Averages | price | ChartArt | most liked |
| 920 | Moving Average Crossover with Shading Signals | `moving-average-crossover-with-shading-signals` | Moving Averages | price | Decam9 | batch 12 |
| 921 | Moving Average Deviation Rate | `ma-deviation-rate` | Moving Averages | own |  |  |
| 922 | Moving Average Exponential x 4 | `moving-average-exponential-x-4` | Moving Averages | price | krogsgard | most liked |
| 923 | Moving Average Percentage Difference | `moving-average-percentage-difference` | Moving Averages | own | GapLogic | batch 37 |
| 924 | Moving Average Shaded Fill Area Crossover EMA Color - Editable | `moving-average-shaded-fill-area-crossover-ema` | Moving Averages | price | aballard11 | most liked |
| 925 | Moving Average Shift | `ma-shift` | Moving Averages | price |  |  |
| 926 | Moving Average Trend Meter | `moving-average-trend-meter` | Trend | own | UkutaLabs | batch 39 |
| 927 | Moving Averages as Support Resistance MTF | `moving-averages-as-support-resistance-mtf` | Moving Averages | price | LonesomeTheBlue | most liked |
| 928 | Moving Averages With Continuous Periods | `moving-averages-with-continuous-periods` | Moving Averages | price | The_Peaceful_Lizard | batch 15 |
| 929 | Moving Volume-Weighted Avg Price, % Channel, BBs | `moving-volume-weighted-avg-price-channel-bbs` | Channels & Bands | price | NeanderTraderBC | batch 37 |
| 930 | Moving VWAP-KAMA Cloud | `moving-vwap-kama-cloud` | Moving Averages | price | SovereignCharts | batch 12 |
| 931 | MPO4 Lines – Modal Engine | `mpo4-lines-modal-engine` | Oscillators | own | Uncle_the_shooter | batch 15 |
| 932 | mr.crypto731 | `mr-crypto731` | Momentum | own | Ali_Smith | batch 20 |
| 933 | MSL Squeeze Pulse | `msl-squeeze-pulse` | Volatility | own | MarketStructureLab | batch 16 |
| 934 | MTF Break of Structure(BOS) & Market Structure Shift(MSS) | `mtf-break-of-structure-market-structure-shift` | Trend | price | Lenny_Kiruthu | most liked |
| 935 | MTF Order Block Finder | `mtf-order-block-finder` | Trend | price | DasanC | most liked |
| 936 | Multi Kernel Regression | `multi-kernel-regression` | Trend | price | ChartPrime | most liked |
| 937 | Multi Time Frame Candles with Volume Info / 3D | `multi-time-frame-candles-with-volume-info-3d` | Volume | own | LonesomeTheBlue | most liked |
| 938 | Multi Timeframe Support and Resistance | `multi-timeframe-support-and-resistance` | Channels & Bands | price | abainvest | most liked |
| 939 | Multi ZigZag Harmonic Patterns | `multi-zigzag-harmonic-patterns` | Trend | price | Trendoscope | most liked |
| 940 | Multi-Band Trend Line | `multi-band-trend-line` | Trend | price | Mr_Rakun | batch 4 |
| 941 | Multi-Layer Volume Profile | `multi-layer-volume-profile` | Volume | price | BigBeluga | most liked |
| 942 | Multi-Oscillator Adaptive Kernel \| AlphaAlgos | `multi-oscillator-adaptive-kernel-alphaalgos` | Oscillators | own | AlphaNatt | batch 4 |
| 943 | Multicator Table | `signal-table-autofib-sma-ema-rsi-atr-vol` | Trend | price | only_fibonacci | most liked |
| 944 | Multiple Divergences | `multiple-divergences` | Momentum | price | PeterO |  |
| 945 | Multiple Exponential Fibnonacci Moving Averages | `multiple-exponential-fibnonacci-moving-averages` | Moving Averages | price | LensOfChartist | batch 13 |
| 946 | Multiple Moving Averages | `multiple-ma` | Moving Averages | price |  |  |
| 947 | Multiple RSI | `multiple-rsi` | Oscillators | own | PrasadJoshi12 | batch 19 |
| 948 | Multitimeframe Fair Value Gap – FVG | `multitimeframe-fair-value-gap-fvg` | Trend | price | Zeiierman | most liked |
| 949 | Multpile strategies | `multpile-strategies` | Oscillators | own | Lupown | most liked |
| 950 | MurreysOscillator | `murreys-math-osc` | Oscillators | own |  |  |
| 951 | Muses afl script | `muses-afl-script` | Trend | price | mostafa47ab (indicator title "L1 Filter Sig") | batch 31 |
| 952 | Mushir's Inside Candle Indicator | `mushir-s-inside-candle-indicator` | Candlestick Patterns | price | mushirinamdar | batch 42 |
| 953 | My auto dual avwap with Auto swing low/pivot low finder | `my-auto-dual-avwap-with-auto-swing-low-pivot-low-finder` | Volume | price | doqkhanh | batch 22 |
| 954 | N Bar Reversal Detector | `n-bar-reversal-detector` | Trend | price | LuxAlgo | most liked |
| 955 | N Order EMA | `n-order-ema` | Moving Averages | price | The_Peaceful_Lizard | batch 35 |
| 956 | Nadaraya-Watson Envelope | `nadaraya-watson-envelope` | Channels & Bands | price | LuxAlgo | most liked |
| 957 | Nadaraya-Watson Regression Liquidity Sweeps | `nadaraya-watson-regression-liquidity-sweeps` | Oscillators | own | AlgoAlpha | most liked |
| 958 | Nadaraya-Watson Smoothers | `nadaraya-watson-smoothers` | Trend | price | LuxAlgo | most liked |
| 959 | Nadaraya-Watson Trend | `nadaraya-watson-trend` | Trend | price | QuantAlgo | batch 1 |
| 960 | Navier-Cauchy Market Elasticity | `navier-cauchy-market-elasticity` | Oscillators | own | PhenLabs | batch 30 |
| 961 | Neighboring Price Bands | `neighboring-price-bands` | Channels & Bands | price | LuxAlgo | batch 21 |
| 962 | Next Pivot Projection | `next-pivot-projection` | Trend | price | Trendoscope | most liked |
| 963 | Nexus Sentiment & Risk Matrix | `nexus-sentiment-risk-matrix` | Oscillators | own | Pineify | batch 37 |
| 964 | NLMS Volatility Trail | `nlms-volatility-trail` | Trend | price | BackQuant | batch 4 |
| 965 | No wick candles | `no-wick-candles` | Candlestick Patterns | price | KORD_ | batch 39 |
| 966 | Normalized Candles RSI | `normalized-candles-rsi` | Oscillators | own | Jamallo22 | batch 32 |
| 967 | Normalized QQE | `normalized-qqe` | Oscillators | own |  |  |
| 968 | Normalized Quantitative Qualitative Estimation nQQE | `normalized-quantitative-qualitative` | Momentum | own | KivancOzbilgic | most liked |
| 969 | Normalized SPMA \| NAL | `normalized-spma-nal` | Oscillators | own | NordicAlphaLab | batch 30 |
| 970 | Normalized Volume & True Range | `normalized-volume-true-range` | Volume | own | The_Peaceful_Lizard | batch 36 |
| 971 | Nova Flow Lite (Free) | `nova-flow-lite` | Trend | price | NovaQuantX | batch 36 |
| 972 | Nova Statistical Filtering Oscillator | `nova-statistical-filtering-oscillator` | Oscillators | own | Pineify | batch 27 |
| 973 | NR4 & NR7 with Breakouts | `nr4-nr7-with-breakouts` | Volatility | price | LuxAlgo | most liked |
| 974 | NY ORB + Fakeout Detector | `ny-orb-fakeout-detector` | Channels & Bands | price | STEFANGAS | batch 27 |
| 975 | OA - SMES | `oa-smes` | Oscillators | own | onurag | batch 4 |
| 976 | OBV & AD Oscillators with Dual Smoothing Options | `obv-ad-oscillators-with-dual-smoothing-options` | Volume | own | hollowwick (indicator title "OBV, AD, VPT & CDV | batch 27 |
| 977 | OBV (Delta or regular) | `obv-gizmo` | Volume | own | GizmoTheInvestor | batch 37 |
| 978 | OBV + Custom MA Strategy | `obv-custom-ma-strategy` | Volume | own | Rafiki-is-Trading | batch 14 |
| 979 | OBV MACD | `obv-macd` | Volume | own |  |  |
| 980 | OBV Oscillator | `obv-oscillator` | Volume | own |  |  |
| 981 | OBVX Conviction Bias | `obvx-conviction-bias` | Volume | own | TheLeadingIndicator | batch 31 |
| 982 | One Shot One Kill ICT Liquidity MMXM + CISD OTE | `one-shot-one-kill-ict-liquidity-mmxm-cisd-ote` | Trend | price | TradingFinder | most liked |
| 983 | Opal | `opal` | Channels & Bands | price | FlyingSeaHorse | batch 36 |
| 984 | Open Close Cross | `open-close-cross` | Momentum | own | JustUncleL |  |
| 985 | Open Close Cross Alerts NoRepaint Version by JustUncleL | `open-close-cross-alerts-norepaint-version-by` | Trend | own | JustUncleL | most liked |
| 986 | Open Interest Stochastic Money Flow Index | `open-interest-stochastic-money-flow-index` | Volume | own | Noldo (uses the "LibraryCOT" library) | most liked |
| 987 | Open Interest Suite - By Leviathan | `open-interest-suite-by-leviathan` | Volume | own | LeviathanCapital | most liked |
| 988 | Open Liquidity Heatmap | `open-liquidity-heatmap` | Volume | price | BigBeluga | most liked |
| 989 | Opening Range Breakout with 2 Profit Targets. | `opening-range-breakout-with-2-profit-targets` | Trend | price |  | most liked |
| 990 | Opening Range with Breakouts & Targets | `opening-range-breakouts-targets` | Trend | price | LuxAlgo | most liked |
| 991 | Optimized Trend Tracker | `optimized-trend-tracker` | Trend | price | KivancOzbilgic |  |
| 992 | ORB - Opening Range Breakout | `orb-opening-range-breakout` | Trend | price | zzzcrypto123 | most liked |
| 993 | ORB Algo \| Flux Charts | `orb-algo-flux-charts` | Trend | price | fluxchart | most liked |
| 994 | Order Block Detector | `order-block-detector` | Trend | price | LuxAlgo | most liked |
| 995 | Order Block Finder (Experimental) | `order-block-finder` | Trend | price | wugamlo | most liked |
| 996 | Order Block Finder \| Gold \| ProjectSyndicate | `order-block-finder-gold-projectsyndicate` | Trend | price | ProjectSyndicate | most liked |
| 997 | Order Blocks & Breaker Blocks | `order-blocks-breaker-blocks` | Trend | price | LuxAlgo | most liked |
| 998 | Order Blocks Finder Major OB \| Supply and Demand | `order-blocks-finder-major-ob-supply-and-demand` | Channels & Bands | price | TradingFinder | most liked |
| 999 | Order Blocks Volume Delta 3D \| Flux Charts | `order-blocks-volume-delta-3d-flux-charts` | Volume | price | fluxchart | most liked |
| 1000 | Order Blocks W/ Realtime Fibs | `order-blocks-w-realtime-fibs` | Trend | price | QuantVue | most liked |
| 1001 | Order Blocks with Signals | `order-blocks-signals` | Trend | price | ClayeWeight |  |
| 1002 | Order Blocks \| Flux Charts | `order-blocks-flux-charts` | Volume | price | fluxchart | most liked |
| 1003 | Order Flow Imbalance Oscillator | `order-flow-imbalance-oscillator` | Volume | own | StrikePriceLabs | batch 33 |
| 1004 | Order Flow VWAP Deviation | `order-flow-vwap-deviation` | Volume | price | LuxAlgo | most liked |
| 1005 | Orderblocks - Open source | `orderblocks-open-source` | Channels & Bands | price | nephew_sam_ | most liked |
| 1006 | Oscillator Matrix | `oscillator-matrix` | Oscillators | own | AlphaExtract | batch 6 |
| 1007 | PAFT | `paft` | Momentum | own | TREESinvest | batch 30 |
| 1008 | Parabolic Stoch SAR Visualizer | `parabolic-stoch-sar-visualizer` | Oscillators | own | BOSWaves | batch 24 |
| 1009 | Parallel Pivot Lines | `parallel-pivot-lines` | Channels & Bands | price | LuxAlgo |  |
| 1010 | Pay Attention Candle | `pay-attention-candle` | Candlestick Patterns | price | asenski (inspired by the RexDog Trading System) | batch 41 |
| 1011 | PCR Market Regime Indicator | `pcr-market-regime-indicator` | Momentum | own | Aleksin_Aleksandar | batch 31 |
| 1012 | Peak Reversal v2 | `peak-reversal-v2` | Channels & Bands | price | Zettt | batch 11 |
| 1013 | Peak Reversal v3 | `peak-reversal-v3` | Channels & Bands | price | Zettt | batch 21 |
| 1014 | Percent Off All-time High (% Off High) | `percent-off-all-time-high` | Oscillators | own | xHmmmmm | batch 19 |
| 1015 | Percentile Rank Oscillator (Price + VWMA) | `percentile-rank-oscillator` | Oscillators | own | exploretranspose | batch 26 |
| 1016 | Percentile-Based BB% Trend - Mattes | `percentile-based-bb-trend-mattes` | Oscillators | own | Mattes00 | batch 7 |
| 1017 | Perfect Hammer Pattern Indicators and Alerts | `perfect-hammer-pattern-indicators-and-alerts` | Candlestick Patterns | price | girishptryambakee | batch 40 |
| 1018 | Perfect RSI | `perfect-rsi` | Oscillators | own | HabibiBudo | batch 26 |
| 1019 | Perforance integral | `perforance-integral` | Momentum | own | Majimbi | batch 37 |
| 1020 | Periodic Linear Regressions | `periodic-linear-regressions` | Channels & Bands | price | LuxAlgo | most liked |
| 1021 | Philakone 55 EMA Swing Trading | `philakone-ema-swing` | Moving Averages | price |  |  |
| 1022 | Pipstocrat Market Participant Analysis | `pipstocrat-market-participant-analysis` | Momentum | own | Delast2 | batch 23 |
| 1023 | Pivot Based Trailing Maxima & Minima | `pivot-trailing-maxmin` | Channels & Bands | price | LuxAlgo |  |
| 1024 | Pivot Breakout High&Low Signals | `pivot-breakout-high-low-signals` | Trend | price | Jos-ProTrader | batch 3 |
| 1025 | Pivot Breakout with Trend Zones | `pivot-breakout-with-trend-zones` | Trend | price | dreamaker7 | batch 33 |
| 1026 | Pivot High/Low Analysis & Forecast | `pivot-high-low-analysis-forecast` | Trend | price | LuxAlgo | most liked |
| 1027 | Pivot Hilo Support n Resistance Levels R3-3 by JustUncleL | `pivot-hilo-support-n-resistance-levels-r3-3` | Trend | price | JustUncleL | most liked |
| 1028 | Pivot Levels | `pivot-levels` | Channels & Bands | price | BigBeluga | most liked |
| 1029 | Pivot Market Structure | `pivot-market-structure` | Trend | price | Daniel_Ge | batch 11 |
| 1030 | Pivot Oscillator | `pivot-oscillator` | Oscillators | own | Uncle_the_shooter | batch 3 |
| 1031 | Pivot Point | `pivot-point-hpotter` | Trend | price | HPotter | most liked |
| 1032 | Pivot Point SuperTrend | `pivot-point-supertrend` | Trend | price | LonesomeTheBlue |  |
| 1033 | Pivot Points High Low & Missed Reversal Levels | `pivot-points-high-low-missed-reversal` | Trend | price | LuxAlgo | most liked |
| 1034 | Pivot Points High Low Multi Time Frame | `pivot-points-high-low-multi-time-frame` | Trend | price | LonesomeTheBlue | most liked |
| 1035 | Pivot Trend | `pivot-trend` | Trend | price | ChartPrime | batch 1 |
| 1036 | Pivot Trendlines with Breaks | `pivot-trendlines-with-breaks` | Trend | price | HoanGhetti | most liked |
| 1037 | PMax on RSI with Tillson T3 | `pmax-on-rsi-with-tillson-t3` | Oscillators | own | KivancOzbilgic | most liked |
| 1038 | POC Volume Bar (Highest Volume in Range) | `poc-volume-bar` | Volume | own | greatbrownball | batch 28 |
| 1039 | Pocket Pivot Breakout | `pocket-pivot-breakout` | Volume | price | simatricks | batch 38 |
| 1040 | POCs and VAHs VALs - All and Non-Broken | `pocs-and-vahs-vals-all-and-non-broken` | Volume | price | Frien_dd-DisDev | most liked |
| 1041 | PolyFilter | `polyfilter` | Moving Averages | price | BackQuant | batch 8 |
| 1042 | Polynomial Regression Moving Average (PRMA) | `polynomial-regression-moving-average` | Moving Averages | price | ZakAlgoTrade | batch 24 |
| 1043 | Polynomial Trend Exhaustion & Divergence | `polynomial-trend-exhaustion-divergence` | Trend | price | B3AR_Trades | batch 40 |
| 1044 | Polyphase MACD (PMACD) | `polyphase-macd` | Momentum | own | The_Peaceful_Lizard | batch 19 |
| 1045 | Poor man's volume clusters | `poor-man-s-volume-clusters` | Volume | price | IldarAkhmetgaleev | most liked |
| 1046 | Position Size Calculator | `position-size-calculator` | Volatility | price | zzzcrypto123 | most liked |
| 1047 | Power Of 3 ICT 01 AMD ICT & SMC Accumulations | `power-of-3-ict-01-amd-ict-smc-accumulations` | Trend | price | TradingFinder | most liked |
| 1048 | PPO Alerts | `ppo-alerts` | Momentum | own |  |  |
| 1049 | PPO Divergence | `ppo-divergence` | Momentum | own | Pekipek |  |
| 1050 | Precision Sniper | `precision-sniper` | Trend | price | WillyAlgoTrader | most liked |
| 1051 | Predictive Channels | `predictive-channels` | Channels & Bands | price | LuxAlgo |  |
| 1052 | Predictive Ranges | `predictive-ranges` | Channels & Bands | price | LuxAlgo | most liked |
| 1053 | Premier RSI Oscillator | `premier-rsi` | Momentum | own |  |  |
| 1054 | Premier Stochastic Oscillator | `premier-stochastic` | Oscillators | own |  |  |
| 1055 | Premium & Discount Delta Volume | `premium-discount-delta-volume` | Volume | price | BigBeluga | most liked |
| 1056 | PREMIUM TRADE ZONES | `premium-trade-zones` | Oscillators | own | ENTRYLAB | batch 27 |
| 1057 | Previous Day High and Low + Separators Daily/Weekly | `previous-day-high-and-low-separators-daily` | Trend | price | Algoryze | most liked |
| 1058 | Previous Day Week Highs & Lows | `previous-day-week-highs-lows` | Trend | price | sbtnc | most liked |
| 1059 | Previous Highs & Lows | `previous-highs-lows` | Channels & Bands | price | LuxAlgo | most liked |
| 1060 | Price & Volume Profile (Expo) | `price-volume-profile` | Volume | price | Zeiierman (community) |  |
| 1061 | Price Acceleration Indicator (PAI) | `price-acceleration-indicator` | Momentum | own | PHICAPITALINVESTMENTS | batch 35 |
| 1062 | Price Action Bands \| Trend & Volatility | `price-action-bands-trend-volatility` | Channels & Bands | price | RadixAlgo | batch 15 |
| 1063 | Price Action Breakout Trend | `price-action-breakout-trend` | Trend | price | QuantAlgo | batch 5 |
| 1064 | Price Action Signals Filtered +EMA | `price-action-signals-filtered-ema` | Trend | price | Aleksin_Aleksandar | batch 11 |
| 1065 | Price Action Smart Money Concepts | `price-action-smart-money-concepts` | Trend | price | BigBeluga | most liked |
| 1066 | Price Action Trading System | `price-action-system` | Oscillators | price |  |  |
| 1067 | Price Action: Engulfing Patterns | `price-action-engulfing-patterns` | Candlestick Patterns | price | Jay9286 | batch 33 |
| 1068 | Price Advance & Decline Range Analysis | `price-advance-decline-range-analysis` | Volatility | own | RicardoSantos | batch 16 |
| 1069 | Price Change Sentiment Index | `price-change-sentiment-index` | Oscillators | own | TradeVizion | batch 23 |
| 1070 | Price Contraction / Expansion | `price-contraction-expansion` | Volatility | price | destrobr0685 | batch 42 |
| 1071 | Price Divergence Detector V3.2 revised by JustUncleL | `price-divergence-detector` | Momentum | price | JustUncleL (original author RicardoSantos) | most liked |
| 1072 | Price Flow - Buy Sell | `price-flow-buy-sell` | Channels & Bands | price | IVTrader1990 | batch 35 |
| 1073 | Price Linear Sequence Counter | `price-linear-sequence-counter` | Momentum | own | RicardoSantos | batch 14 |
| 1074 | Price Momentum Oscillator | `price-momentum-oscillator` | Momentum | own |  |  |
| 1075 | Price/Volume Value Histogram | `price-volume-value-histogram` | Volume | own | dman103 | batch 2 |
| 1076 | Primitive Delta Divergence | `primitive-delta-divergence` | Volume | price | bfoster238 | batch 41 |
| 1077 | Pring Special K\|a2m | `pring-special-k-a2m` | Momentum | own | ask2maniish | batch 34 |
| 1078 | Prism Moving Average Trend | `prism-moving-average-trend` | Trend | price | MisinkoMaster | batch 19 |
| 1079 | Pro Scalper - 2 MinutesTF by Ayoob | `pro-scalper-2-minutestf-by-ayoob` | Trend | price | FGMNDFBF | batch 30 |
| 1080 | Pro Scalper AI | `pro-scalper-ai` | Oscillators | own | BullByte | most liked |
| 1081 | Probabilities Module - The Quant Science | `probabilities-module-the-quant-science` | Oscillators | own | thequantscience | batch 31 |
| 1082 | Projected Crossover Trend | `projected-crossover-trend` | Trend | price | SchizoQuant | batch 4 |
| 1083 | Prometheus Topological Persistent Entropy | `prometheus-topological-persistent-entropy` | Volatility | own | ScorsoneEnterprises | batch 23 |
| 1084 | Protected Highs & Lows | `protected-highs-lows` | Trend | price | tradeforopp | most liked |
| 1085 | Pullback Candles (Candlestick Analysis) Guaranteed Winners!!!! | `pullback-candles-guaranteed-winners` | Candlestick Patterns | price | LuxTradeVenture | most liked |
| 1086 | Pullback SAR | `pullback-sar` | Trend | price | szymonsobkowiak | batch 32 |
| 1087 | Pullback Scalp Trade V2 | `pullback-scalp-trade-v2` | Trend | price | Sinyalbak_App | batch 12 |
| 1088 | Pullback Trading Tool ALT R1.0 by JustUncleL | `pullback-trading-tool-alt-r1-0-by-justunclel` | Moving Averages | price | JustUncleL | most liked |
| 1089 | Pulse Range | `pulse-range` | Trend | price | MarketStructureLab | batch 13 |
| 1090 | Pulse RSI \| Lyro RS | `pulse-rsi-lyro-rs` | Oscillators | own | LyroRS | batch 10 |
| 1091 | PulseWave + Divergence | `pulsewave-divergence` | Oscillators | own | Uncle_the_shooter | batch 7 |
| 1092 | Pump & Dump Detector (sensitive) | `pump-dump-detector` | Volume | price | btcpayer | batch 39 |
| 1093 | Pure Coca | `pure-coca` | Oscillators | own | La_Von | batch 7 |
| 1094 | Pure Price Action ICT Tools | `pure-price-action-ict-tools` | Trend | price | LuxAlgo | most liked |
| 1095 | Pure Price Action Order & Breaker Blocks | `pure-price-action-order-breaker-blocks` | Trend | price | LuxAlgo | most liked |
| 1096 | Pure Price Action Structures | `pure-price-action-structures` | Trend | price | LuxAlgo | most liked |
| 1097 | Q Impulse Entry | `q-impulse-entry` | Trend | price | Quantora | batch 17 |
| 1098 | Q KAMA Clarity Trend | `q-kama-clarity-trend` | Trend | price | Quantora | batch 7 |
| 1099 | Q Wave | `q-wave` | Trend | price | Quantora | batch 36 |
| 1100 | QG-Particle Oscillator | `qg-particle-oscillator` | Oscillators | own | QuantG | batch 35 |
| 1101 | QQE Cross | `qqe-cross` | Trend | price | JustUncleL |  |
| 1102 | QQE MOD | `qqe-mod` | Momentum | own |  |  |
| 1103 | QQE Signals | `qqe-signals` | Oscillators | price | colinmck |  |
| 1104 | QTechLabs Machine Learning Logistic Regression Indicator | `qtechlabs-machine-learning-logistic-regression-indicator` | Oscillators | price | QTechLabsInfo | batch 33 |
| 1105 | Quant VWAP System 3.8 | `quant-vwap-system-3-8` | Oscillators | own | CustomQuantLabs (published as "Quant VWAP System 3.8") | batch 8 |
| 1106 | Quantile Regression Bands | `quantile-regression-bands` | Channels & Bands | price | BackQuant | batch 17 |
| 1107 | Quantitative Qualitative Estimation | `qqe` | Oscillators | own | Glaz |  |
| 1108 | Quantitative Qualitative Estimation QQE | `qqe-kivanc` | Oscillators | own |  | most liked |
| 1109 | Quantum Regression Oscillator | `quantum-regression-oscillator` | Oscillators | own | abgthecoder | batch 32 |
| 1110 | Quantum Trend Signal | `quantum-trend-signal` | Trend | price | ReubenMiles | batch 9 |
| 1111 | QuantumTrend SwiftEdge | `quantumtrend-swiftedge` | Trend | price | SwiftEdge | batch 5 |
| 1112 | Quartile For Loop | `quartile-for-loop` | Trend | own | SeerQuant | batch 6 |
| 1113 | Quasimodo Pattern | `quasimodo-pattern` | Candlestick Patterns | price | anodrr2 | batch 41 |
| 1114 | R:R Trading System Framework | `r-r-trading-system-framework` | Trend | price | carnagecain | most liked |
| 1115 | Radiant Mean Reversion Channels | `radiant-mean-reversion-channels` | Oscillators | own | Pineify | batch 34 |
| 1116 | Radius Trend [ChartPrime] | `radius-trend` | Trend | price | ChartPrime |  |
| 1117 | Rally Base Drop Signals | `rally-base-drop-signals` | Trend | price | LuxAlgo | batch 38 |
| 1118 | Range Analysis - By Leviathan | `range-analysis-by-leviathan` | Volume | price | LeviathanCapital | most liked |
| 1119 | Range Average Retest Model | `range-average-retest-model` | Trend | price | LuxAlgo | most liked |
| 1120 | Range Breakout | `range-breakout` | Channels & Bands | price | BigBeluga | most liked |
| 1121 | Range Channel by Atilla Yurtseven | `range-channel-by-atilla-yurtseven` | Channels & Bands | own | AtillaYurtseven | batch 17 |
| 1122 | Range Detector | `range-detector` | Trend | price | LuxAlgo |  |
| 1123 | Range Filter Buy and Sell 5min - guikroth version | `range-filter-buy-sell-5min` | Trend | price | PHVNTOM_TRADER (original script by DonovanWall, adapted by | most liked |
| 1124 | Range Identifier | `range-identifier` | Channels & Bands | price |  |  |
| 1125 | Range Oscillator | `range-oscillator` | Oscillators | own | Zeiierman | batch 1 |
| 1126 | Range Sentiment Profile | `range-sentiment-profile` | Volume | price | LuxAlgo | most liked |
| 1127 | Range Tightening Indicator (RTI) | `range-tightening-indicator` | Volatility | own | Ollie_AllCaps | batch 2 |
| 1128 | Ranges With Targets | `ranges-with-targets` | Trend | price | ChartPrime | most liked |
| 1129 | Rapid Exponential Moving Average | `rapid-exponential-moving-average` | Moving Averages | price | ImmortalFreedom | batch 28 |
| 1130 | RBT strategy | `rbt-strategy` | Momentum | price | luckykoshti | batch 38 |
| 1131 | RCI3lines | `rci-3lines` | Oscillators | own |  |  |
| 1132 | RCYC Bullish Bearish Indicator | `rcyc-bullish-bearish-indicator` | Momentum | price | bizarro29 | batch 38 |
| 1133 | ReadyFor401ks Just Tell Me When! | `readyfor401ks-just-tell-me-when` | Trend | price | ReadyFor401k | batch 20 |
| 1134 | Real-Time Big Trades Bubbles & Absorbtions & Deep Pressure | `big-trades-bubbles` | Volume | price | samet_lezki | batch 5 |
| 1135 | Realtime Volume Bars | `realtime-volume-bars` | Volume | own | the_MarketWhisperer |  |
| 1136 | RedK Effort Versus Results Explorer v3.0 | `redk-everex` | Momentum | own | RedKTrader |  |
| 1137 | RedK Magic Ribbon | `redk-magic-ribbon` | Moving Averages | price | RedKTrader | batch 2 |
| 1138 | RedK Momentum Bars | `redk-momentum-bars` | Momentum | own | RedKTrader |  |
| 1139 | RedK RSS_WMA | `redk-rss-wma` | Moving Averages | price | RedKTrader |  |
| 1140 | RedK Trader Pressure Index | `redk-tpx` | Momentum | own | RedKTrader |  |
| 1141 | RedK Vol_Weighted RSI: Extending the power of the classic RSI | `redk-vol-weighted-rsi` | Momentum | own | RedKTrader | batch 5 |
| 1142 | Reflex & Trendflex | `reflex-trendflex` | Oscillators | own | e2e4 | batch 6 |
| 1143 | Regression Channel Oscillator | `regression-channel-oscillator` | Oscillators | own | Uncle_the_shooter | batch 27 |
| 1144 | Relative ATR Volatility Indicator | `relative-atr-volatility-indicator` | Volatility | own | ZenAndTheArtOfTrading | batch 20 |
| 1145 | Relative Strength Heatmap | `relative-strength-heatmap` | Momentum | own | BackQuant | batch 22 |
| 1146 | Relative Strength Index - Divergences - Libertus | `relative-strength-index-divergences-libertus` | Momentum | own | Libertus | most liked |
| 1147 | Relative Strength of a stock | `relative-strength-of-a-stock` | Momentum | own | bharatTrader | most liked |
| 1148 | Relative Valuation Oscillator | `relative-valuation-oscillator` | Oscillators | own | QuantAlgo | batch 14 |
| 1149 | Relative Volume Indicator (RVOL) | `relative-volume-indicator` | Volume | own | AlgoCollective | batch 13 |
| 1150 | Renko Boxes | `renko-boxes` | Trend | price | LuxAlgo | batch 4 |
| 1151 | Renko Candles Overlay | `renko-candles-overlay` | Trend | price | LonesomeTheBlue | most liked |
| 1152 | Renko Chart | `renko-chart` | Trend | price | LonesomeTheBlue |  |
| 1153 | Renko Compression Index (RCI) | `renko-compression-index` | Oscillators | own | nasu_is_gaji | batch 34 |
| 1154 | Renko Flip Alert (Traditional Only) | `renko-flip-alert` | Candlestick Patterns | price | deephrenology | batch 41 |
| 1155 | Renko Mod | `renko-mod` | Trend | price | RicardoSantos | batch 13 |
| 1156 | Renko Sniper PRO (Liquidity Sweep + EMA + ST + RSI) | `renko-sniper-pro` | Trend | price | zachsprad | batch 24 |
| 1157 | Renko+Moving Average+RMI Alert R3 by JustUncleL | `renko-moving-average-rmi-alert-r3-by` | Trend | price | JustUncleL | most liked |
| 1158 | Res/Sup With Concavity & Increasing / Decreasing Trend Analysis | `res-sup-with-concavity-increasing-decreasing-trend-analysis` | Trend | price | Celar (published as "Res/Sup With Concavity & Increasing / Decreasing Trend Analysis") | batch 28 |
| 1159 | Retail vs Banker Net Positions – Symmetry Break | `retail-vs-banker-net-positions-symmetry-break` | Volume | own | JasonHyde | batch 17 |
| 1160 | Retest Support Resistance Signals | `retest-support-resistance-signals` | Trend | price | ChartPrime | most liked |
| 1161 | Reversal | `reversal` | Trend | price | HasanRifat | most liked |
| 1162 | Reversal Candle Setup | `reversal-candle-setup` | Candlestick Patterns | price |  |  |
| 1163 | Reversal Candlestick Structure | `reversal-candlestick-structure` | Candlestick Patterns | price | LuxAlgo | most liked |
| 1164 | Reversal Correlation Pressure | `reversal-correlation-pressure` | Oscillators | own | OmegaTools | batch 27 |
| 1165 | Reversal Probability Zone & Levels | `reversal-probability-zone-levels` | Trend | price | LuxAlgo | most liked |
| 1166 | Reversal Scalper 2.0- Adib Noorani | `reversal-scalper-2-0-adib-noorani` | Oscillators | own | AdibNoorani | batch 28 |
| 1167 | Reversal Signals | `reversal-signals` | Momentum | price | LuxAlgo | most liked |
| 1168 | Reversal Trap Probability Bands | `reversal-trap-probability-bands` | Channels & Bands | price | BigBeluga | most liked |
| 1169 | Rhokeo-VW-RSI Histogram for Cumulative Delta by Zeiirman | `rhokeo-vw-rsi-histogram-for-cumulative-delta-by-zeiirman` | Oscillators | own | nabil007 | batch 24 |
| 1170 | Ripster EMA Clouds | `ripster-ema-clouds` | Trend | price | ripster47 |  |
| 1171 | Risk Management Tool | `risk-management-tool` | Volatility | price | LuxAlgo | most liked |
| 1172 | RMA ATR Bands | `rma-atr-bands` | Channels & Bands | price | SchizoQuant | batch 3 |
| 1173 | RMI Length | `rmi-trend-sniper` | Momentum | price | TZack88 |  |
| 1174 | Robby DSS Bressert Colored Dots | `robby-dss-bressert-colored-dots` | Oscillators | own | huatzhi | batch 21 |
| 1175 | ROC-Weighted MA Oscillator | `roc-weighted-ma-oscillator` | Oscillators | own | SeerQuant | batch 2 |
| 1176 | Rolling Liquidity Clusters Channel | `rolling-liquidity-clusters-channel` | Channels & Bands | price | LuxAlgo | batch 12 |
| 1177 | Rolling Sharpe Ratio Oscillator \| Astral Vision | `rolling-sharpe-ratio-oscillator-astral-vision` | Oscillators | own | AstralVision | batch 13 |
| 1178 | Rolling Trendline | `rolling-trendline` | Trend | price | LuxAlgo | batch 5 |
| 1179 | Rolling VWAP | `rolling-vwap` | Volume | price | TradingView | most liked |
| 1180 | Ross Cameron-Inspired Day Trading Strategy | `ross-cameron-inspired-day-trading-strategy` | Momentum | price | manaziir | batch 25 |
| 1181 | RRR EMA Ignition BUY & SELL (Sideways-Proof) | `rrr-ema-ignition-buy-sell` | Trend | price | RAGSTER123 | batch 21 |
| 1182 | RS Rating (1-99) | `rs-rating` | Momentum | own | kulturdesken | batch 16 |
| 1183 | rs_MACD | `rs-macd` | Momentum | price | RicardoSantos | batch 17 |
| 1184 | RSI | `rsi-hash-capital` | Oscillators | own | Hash_Capital | batch 31 |
| 1185 | RSI & BB Oversold Scalper with MACD Confirmation | `rsi-bb-oversold-scalper-with-macd-confirmation` | Momentum | price | DotGain | batch 40 |
| 1186 | RSI & MACD Suite | `rsi-macd-suite` | Oscillators | own | aaboomar | batch 34 |
| 1187 | RSI (14) with Auto Zone Colors - Overbought/Oversold Highlighter | `rsi-with-auto-zone-colors-overbought-oversold-highlighter` | Oscillators | own | tarangbharti18 | batch 29 |
| 1188 | RSI (Kernel Optimized) \| Flux Charts | `rsi-flux-charts` | Momentum | price | fluxchart | most liked |
| 1189 | RSI + ADX + ATR 18-01-25 | `rsi-adx-atr-18-01-25` | Oscillators | own | dipak11298 | batch 37 |
| 1190 | RSI + ADX + ATR Combo | `rsi-adx-atr-combo` | Oscillators | own | shawasutosh | batch 26 |
| 1191 | RSI + BB + Dispersion | `rsi-bb-dispersion` | Oscillators | own |  |  |
| 1192 | RSI + Fibonacci HH LL Support Resistance | `rsi-fibonacci-hh-ll-support-resistance` | Channels & Bands | price | FibonacciFlux | batch 12 |
| 1193 | RSI + MACD (RSI Divergence) V3.2 | `rsi-macd-v3-2` | Oscillators | own | MKhoa | batch 24 |
| 1194 | RSI + STOCH RSI - Marx_Capital | `rsi-stoch-rsi-marx-capital` | Oscillators | own | Marx_Capital | batch 12 |
| 1195 | RSI - 5UP | `rsi-5up` | Oscillators | own | Marrulk | batch 29 |
| 1196 | RSI Bands | `rsi-bands` | Channels & Bands | price |  |  |
| 1197 | RSI Bars - OnlyFlow | `rsi-bars-onlyflow` | Momentum | price | ofderk | batch 10 |
| 1198 | RSI BB StdDev Signal | `rsi-bb-stddev-signal` | Oscillators | own | trade_lexx (Pine title "RSI Signal [trade_lexx]") | batch 8 |
| 1199 | RSI Candle Color | `rsi-candle-color` | Momentum | price | The_Peaceful_Lizard | batch 39 |
| 1200 | RSI Candles | `rsi-candles` | Momentum | own | Glaz |  |
| 1201 | RSI Confirm Trend with Williams (W%R) | `rsi-confirm-trend-with-williams` | Momentum | own | javageek | batch 11 |
| 1202 | RSI Core Levels Heatmap | `rsi-core-levels-heatmap` | Oscillators | own | BigBeluga | most liked |
| 1203 | RSI cyclic smoothed v2 | `rsi-cyclic-smoothed-v2` | Oscillators | own | StockMarketCycles | most liked |
| 1204 | RSI Divergence | `rsi-divergence` | Oscillators | own |  |  |
| 1205 | RSI Entry Engine | `rsi-entry-engine` | Oscillators | own | tradewsamet | most liked |
| 1206 | RSI Games 1.2 | `rsi-games-1-2` | Oscillators | own | petejfjohnson | batch 22 |
| 1207 | RSI HistoAlert Strategy | `rsi-histoalert` | Oscillators | own |  |  |
| 1208 | RSI Length | `most-rsi` | Momentum | own |  |  |
| 1209 | RSI Length | `parabolic-rsi` | Momentum | own |  |  |
| 1210 | RSI Length | `pmax-rsi-t3` | Momentum | own |  |  |
| 1211 | RSI Length | `rsi-cyclic-smoothed` | Momentum | own |  |  |
| 1212 | RSI MA Cross + Divergence Signal (V2) | `rsi-ma-cross-divergence-signal` | Momentum | price | noxum | batch 39 |
| 1213 | RSI Modified | `rsi-modified` | Oscillators | own | Santos_Trader_PT | batch 5 |
| 1214 | RSI Momentum Divergence | `rsi-momentum-divergence` | Oscillators | own | ChartPrime |  |
| 1215 | RSI Multi Length | `rsi-multi-length` | Oscillators | own | LuxAlgo | most liked |
| 1216 | RSI Multi Levels kiawosch 7-14-42 Consolidation | `rsi-multi-levels` | Oscillators | own | TFlab | batch 5 |
| 1217 | RSI Multicolor editable | `rsi-multicolor-editable` | Oscillators | own | Guillaume46 | batch 8 |
| 1218 | RSI PERFECT Flip Dots | `rsi-perfect-flip-dots` | Momentum | price | debanshuchanda6 | batch 42 |
| 1219 | RSI Potential | `rsi-potential` | Momentum | own | nasu_is_gaji | batch 35 |
| 1220 | RSI Snabbel | `rsi-snabbel` | Oscillators | own |  |  |
| 1221 | RSI Strategy | `rsi-strategy` | Momentum | price | HPotter | most liked |
| 1222 | RSI Supply/Demand | `rsi-supply-demand` | Trend | price | shtcoinr / Lij_MC |  |
| 1223 | RSI Support & Resistance by DGT | `rsi-support-resistance-by-dgt` | Momentum | price | dgtrd | most liked |
| 1224 | RSI Swing Indicator v2 | `rsi-swing-indicator-v2` | Momentum | price | MrDinasty (BalintDavid) | most liked |
| 1225 | RSI Swing Signal | `rsi-swing-signal` | Oscillators | own |  |  |
| 1226 | RSI Tops and Bottoms | `rsi-tops-bottoms` | Momentum | own | LonesomeTheBlue |  |
| 1227 | RSI Trend Bias | `rsi-trend-bias` | Oscillators | own | Botnet101 | batch 24 |
| 1228 | RSI Trend Navigator | `rsi-trend-navigator` | Trend | price | QuantAlgo | batch 10 |
| 1229 | RSI Trendlines with Breakouts | `rsi-trendlines-with-breakouts` | Oscillators | own | HoanGhetti | most liked |
| 1230 | RSI Zone Step Lines | `rsi-zone-step-lines` | Channels & Bands | price | Devjames | batch 11 |
| 1231 | RSI+EMA+MZONES with Divergences | `rsi-ema-mzones-with-divergences` | Oscillators | own | lordoflolz | batch 22 |
| 1232 | RSI+Stoch Band Oscillator | `rsi-stoch-band-oscillator` | Oscillators | own | nasu_is_gaji | batch 26 |
| 1233 | RSI-50 Step Line | `rsi-50-step-line` | Trend | price | Devjames | batch 5 |
| 1234 | RSI-Colored Price Candles with Background | `rsi-colored-price-candles-with-background` | Momentum | price | Midgar- | batch 39 |
| 1235 | RSI-EMA-Crossing with Donchian-Stop-Loss | `rsi-ema-crossing-with-donchian-stop-loss` | Channels & Bands | price | Kahael | batch 28 |
| 1236 | RSI: alternative derivation | `rsi-alternative-derivation` | Oscillators | own | AdaptiveRSI | batch 25 |
| 1237 | RVOL Effort Matrix | `rvol-effort-matrix` | Volume | own | TheLeadingIndicator | batch 36 |
| 1238 | RVOL Relative Volume - Intraday | `rvol-relative-volume-intraday` | Volume | own | LonesomeTheBlue | most liked |
| 1239 | S&R Breakout ATR Confirmation | `s-r-breakout-atr-confirmation` | Trend | price | Jos-ProTrader | batch 33 |
| 1240 | SAR + EMA + MACD Signals | `sar-ema-macd` | Oscillators | price |  |  |
| 1241 | Saty ATR Levels | `saty-atr-levels` | Volatility | price | satymahajan | most liked |
| 1242 | Saty Pivot Ribbon | `saty-pivot-ribbon` | Moving Averages | price | satymahajan | most liked |
| 1243 | Savitzky Flow Bands | `savitzky-flow-bands` | Channels & Bands | price | ChartPrime | batch 2 |
| 1244 | Savitzky-Golay Hampel Filter \| AlphaNatt | `savitzky-golay-hampel-filter-alphanatt` | Moving Averages | price | AlphaNatt | batch 15 |
| 1245 | Scalp Pro | `scalp-pro` | Momentum | own | ovelix | most liked |
| 1246 | Scalping Line | `scalping-line` | Oscillators | own | KivancOzbilgic |  |
| 1247 | Scalping PullBack Tool R1 by JustUncleL | `scalping-pullback-tool` | Trend | price | JustUncleL | most liked |
| 1248 | Scalping Swing Trading Tool R1-4 by JustUncleL | `scalping-swing-trading-tool-r1-4-by-justunclel` | Moving Averages | price | JustUncleL | most liked |
| 1249 | Scalping Tool with Dynamic Take Profit & Stop Loss | `scalping-tool-dynamic-tp-sl` | Trend | price | TruFREND | batch 3 |
| 1250 | ScalpMap - EMA Pivot Targets | `scalpmap-ema-pivot-targets` | Trend | price | blockybears | batch 12 |
| 1251 | SCE GANN Predictions | `sce-gann-predictions` | Trend | price | ScorsoneEnterprises | batch 22 |
| 1252 | Schaff Trend Cycle | `schaff-trend-cycle` | Oscillators | price | LazyBear |  |
| 1253 | SCOTTGO Advanced MACD | `scottgo-advanced-macd` | Momentum | own | SCOTTGO (indicator title "MACD: Clean Visuals (Fixed Arrows)") | batch 27 |
| 1254 | Screener - Mean Reversion Channel | `screener-mean-reversion-channel` | Channels & Bands | price | fareidzulkifli | most liked |
| 1255 | Self-Aware Trend System | `self-aware-trend-system` | Trend | price | WillyAlgoTrader | most liked |
| 1256 | Sell & Buy Rates | `sell-buy-rates` | Volume | own | LonesomeTheBlue |  |
| 1257 | Sequential Pattern Strength | `sequential-pattern-strength` | Momentum | own | QuantAlgo | batch 9 |
| 1258 | Session Liquidity | `session-liquidity` | Channels & Bands | price | Infinity_Trading_ | most liked |
| 1259 | Session Streaks | `session-streaks` | Trend | price | LuxAlgo | most liked |
| 1260 | Session Sweeps | `session-sweeps` | Volatility | price | LuxAlgo | most liked |
| 1261 | Session TPO Market Profile | `session-tpo-market-profile` | Volume | price | noop-noop | most liked |
| 1262 | Sessions | `sessions-luxalgo` | Trend | price | LuxAlgo | most liked |
| 1263 | Sessions on Chart | `sessions-on-chart` | Trend | price | Aurocks_AIF | most liked |
| 1264 | Setup 9.1 (Larry Williams) + EMA 50 | `setup-9-1-ema-50` | Moving Averages | price | oDouglasAlex | batch 7 |
| 1265 | SExI - Super Exhaustion Indicator | `sexi-super-exhaustion-indicator` | Oscillators | own | Da_Prof | batch 14 |
| 1266 | Sharp Modified Moving Average | `sharp-modified-moving-average` | Moving Averages | price | everget | batch 18 |
| 1267 | Sharpe Ratio Indicator (180) | `sharpe-ratio-indicator` | Volatility | own | tim_amblard | batch 3 |
| 1268 | Sharpe Ratio v4 | `sharpe-ratio-v4` | Oscillators | own | Zettt | batch 32 |
| 1269 | Sharpshooter 30 – EMA Distance | `sharpshooter-30-ema-distance` | Moving Averages | price | hrak22 | batch 33 |
| 1270 | Shock Percentile Moving Average \| NAL | `shock-percentile-moving-average-nal` | Moving Averages | price | NordicAlphaLab | batch 22 |
| 1271 | Sigmoid RSI \| NAL | `sigmoid-rsi-nal` | Oscillators | own | NordicAlphaLab | batch 11 |
| 1272 | Signal Forge | `signal-forge` | Trend | price | LuxAlgo | most liked |
| 1273 | Signal Moving Average | `signal-ma` | Moving Averages | price | LuxAlgo |  |
| 1274 | Simple Moving Averages | `simple-moving-averages` | Moving Averages | price |  |  |
| 1275 | Simplified Percentile Clustering | `simplified-percentile-clustering` | Oscillators | own | InvestorUnknown | batch 4 |
| 1276 | Sine Weighted Moving Average | `sine-weighted-moving-average` | Moving Averages | price | everget | batch 13 |
| 1277 | SL - 4 EMAs, 2 SMAs & Crossover Signals | `sl-4-emas-2-smas-crossover-signals` | Moving Averages | price | MVP202020205 | batch 27 |
| 1278 | Slow Heiken Ashi | `slow-heiken-ashi` | Candlestick Patterns | price |  |  |
| 1279 | Slow Stochastic | `slow-stochastic` | Oscillators | own | Oshri17 | most liked |
| 1280 | SMA Angle Alerts | `sma-angle-alerts` | Moving Averages | price | readysetfire | batch 21 |
| 1281 | SMA DMA Crossing Signal | `sma-dma-crossing-signal` | Moving Averages | price | tradingqueen18 | batch 31 |
| 1282 | SMA Squeeze Oscillator | `sma-squeeze-oscillator` | Momentum | own | Uncle_the_shooter | batch 23 |
| 1283 | SMA+ADX Filter | `sma-adx-filter` | Trend | price | iping99 | batch 31 |
| 1284 | Smart Breakout Targets | `smart-breakout-targets` | Volatility | price | WillyAlgoTrader | most liked |
| 1285 | Smart MCDX FINAL PRO | `smart-mcdx-final-pro` | Volume | own | Sachse-1980 | batch 30 |
| 1286 | Smart Money Breakout Channels | `smart-money-breakout-channels` | Channels & Bands | price | AlgoAlpha | most liked |
| 1287 | Smart Money Breakout Signals | `smart-money-breakout-signals` | Trend | price | AlgoAlpha | most liked |
| 1288 | Smart Money Breakouts | `smart-money-breakouts` | Trend | price | ChartPrime | most liked |
| 1289 | Smart Money Concepts (SMC) | `smart-money-concepts-luxalgo` | Trend | price | LuxAlgo | most liked |
| 1290 | Smart Money Concepts Probability (Expo) | `smart-money-concepts-probability` | Trend | price | Zeiierman | most liked |
| 1291 | Smart Money Flow Signals | `smart-money-flow-signals` | Volume | own | QuantAlgo | batch 2 |
| 1292 | Smart Money Range | `smart-money-range` | Volume | price | ChartPrime | most liked |
| 1293 | Smart Money Volume Index | `smart-money-volume-index` | Volume | own | AlgoAlpha | most liked |
| 1294 | Smart Trader, Episode 03, by Ata Sabanci, Candles and Tradelines | `smart-trader-episode-03-by-ata-sabanci` | Trend | price | ata_sabanci | most liked |
| 1295 | Smart Trader, Episode 06, Isotropic Trend Lines | `smart-trader-episode-06-isotropic-trend-lines` | Trend | price | ata_sabanci | most liked |
| 1296 | Smart Trend | `smart-trend` | Trend | price | Zofesu | batch 21 |
| 1297 | Smarter SNR (Support and Ressistance, Trendline, MTF OSC) | `smarter-snr` | Trend | price | hanabil | most liked |
| 1298 | SMC Indicator With Webhook | `smc-indicator-with-webhook` | Trend | price | sunwoo101 | most liked |
| 1299 | SMC Statistical Liquidity Walls | `smc-statistical-liquidity-walls` | Channels & Bands | price | PhenLabs | batch 25 |
| 1300 | SMC Structures and FVG | `smc-structures-and-fvg` | Trend | price | LudoGH68 | most liked |
| 1301 | SMIIOL | `smiiol` | Momentum | own | iilter | batch 25 |
| 1302 | Smooth RSI | `smooth-rsi` | Momentum | own | MarktQuant | batch 8 |
| 1303 | Smoothed Heiken Ashi | `smoothed-heiken-ashi` | Trend | price | jackvmk |  |
| 1304 | Smoothed Low-Pass Butterworth Filtered Median | `butterworth-filtered-median` | Moving Averages | price | AlphaNatt | batch 8 |
| 1305 | Smoothed Source Weighted EMA | `smoothed-source-weighted-ema` | Moving Averages | price | Clokivez | batch 13 |
| 1306 | SMT Divergences | `smt-divergences` | Trend | price | LuxAlgo | most liked |
| 1307 | Source | `ott-bands` | Channels & Bands | price | KivancOzbilgic |  |
| 1308 | Source | `otto` | Oscillators | own | KivancOzbilgic |  |
| 1309 | Source | `range-filter-dw` | Trend | price |  |  |
| 1310 | Source-Aligned Oscillators (for Divergences) | `source-aligned-oscillators` | Oscillators | own | QuantNomad | batch 18 |
| 1311 | SP - MACD with Divergence | `sp-macd-with-divergence` | Momentum | own | ca_sidnayak | batch 24 |
| 1312 | Spira Alligator | `spira-alligator` | Trend | price | Markedsignaler | batch 26 |
| 1313 | SPX500 Quick Drop & Rise Alerts | `spx500-quick-drop-rise-alerts` | Momentum | price | PaperChains | batch 41 |
| 1314 | Squeeze Channel | `squeeze-channel` | Channels & Bands | price | B3AR_Trades | batch 16 |
| 1315 | Squeeze Momentum | `squeeze-momentum` | Momentum | own | LazyBear |  |
| 1316 | Squeeze Momentum Indicator Version2 by KıvanÇ fr3762 | `squeeze-momentum-indicator-version2-by-k-van` | Momentum | own | KivancOzbilgic | most liked |
| 1317 | Squeeze Momentum V2 with Divergence | `squeeze-momentum-v2` | Oscillators | own |  |  |
| 1318 | SSL Channel | `ssl-channel` | Trend | price |  |  |
| 1319 | SSL Hybrid | `ssl-hybrid` | Trend | price | Mihkel00 | most liked |
| 1320 | SSL HYBRID Advanced | `ssl-hybrid-advanced` | Trend | price | traderharikrishna (after "SSL Hybrid" by Mihkel00) | most liked |
| 1321 | SSL Hybrid Scalper | `ssl-hybrid-scalper` | Moving Averages | price | nabeel8369 | batch 11 |
| 1322 | ST0P | `st0p` | Oscillators | price |  |  |
| 1323 | Standardized MACD HA | `standardized-macd-ha` | Momentum | own | EliCobra |  |
| 1324 | Start | `lucid-sar` | Trend | price |  |  |
| 1325 | Statistical Price Deviation Index (MAD/VWMA) | `statistical-price-deviation-index` | Oscillators | own | exploretranspose | batch 16 |
| 1326 | STC Indicator - A Better MACD | `stc-indicator-a-better-macd` | Oscillators | own | shayankm | most liked |
| 1327 | STD-Filtered, N-Pole Gaussian Filter | `std-filtered-n-pole-gaussian-filter` | Moving Averages | price | loxx | most liked |
| 1328 | STH Unrealized Profit/Loss Ratio (STH-NUPL) | `sth-unrealized-profit-loss-ratio` | Oscillators | own | DeVrizii | batch 15 |
| 1329 | Stoch VX3 | `stoch-vx3` | Oscillators | own |  |  |
| 1330 | Stochastic Heat Map | `stochastic-heat-map` | Momentum | own | Violent |  |
| 1331 | Stochastic Momentum Index | `stochastic-momentum-index` | Oscillators | own |  |  |
| 1332 | UCS_Stochastic Momentum Index | `smi-ucs` | Oscillators | own |  |  |
| 1333 | Stochastic OTT | `stochastic-ott` | Oscillators | own | KivancOzbilgic |  |
| 1334 | Stochastic Z-Score | `stochastic-z-score` | Oscillators | own | AlgoAlpha | most liked |
| 1335 | Stockbee ComboBull | `stockbee-combobull` | Momentum | own | traderabhi81 | batch 29 |
| 1336 | Stockbee Reversal Bullish v2 | `stockbee-reversal-bullish-v2` | Momentum | own | traderabhi81 | batch 29 |
| 1337 | Stop/Take Bounds | `stop-take-bounds` | Volatility | price | Y_Goldman | batch 27 |
| 1338 | Strat Assistant | `strat-assistant` | Trend | price | rickyzcarroll | most liked |
| 1339 | Strength of Divergence Across Multiple Indicators | `strength-of-divergence-across-multiple` | Oscillators | price | reees | most liked |
| 1340 | Strong Burst Fader \| ProjectSyndicate | `strong-burst-fader-projectsyndicate` | Volatility | price | ProjectSyndicate | batch 38 |
| 1341 | Strong Demands & Supplies + Liquidity \| Zonas de Compra e Venda | `strong-demands-supplies-liquidity-zonas-de` | Trend | price | Luis_TudoSobreTrading | most liked |
| 1342 | Strong Engulfing Candlestick (With Alerts) | `strong-engulfing-candlestick` | Candlestick Patterns | price | kyjefive | batch 39 |
| 1343 | Super Guppy | `super-guppy` | Trend | price | JustUncleL |  |
| 1344 | Super OrderBlock / FVG / BoS Tools by makuchaku & eFe | `super-orderblock-fvg-bos` | Trend | price | makuchaku | most liked |
| 1345 | Super SMA 5 8 13 + EMA 20/200 Regime Filter (ALIZET) | `super-sma-5-8-13-ema-20-200-regime-filter` | Moving Averages | price | afdzjr69 | batch 19 |
| 1346 | Super Smoothed MACD | `super-smoothed-macd` | Momentum | own |  |  |
| 1347 | Super SuperTrend | `super-supertrend` | Trend | price |  |  |
| 1348 | Super trend V | `super-trend-v` | Trend | price | RafaelZioni | most liked |
| 1349 | SuperBands | `superbands` | Trend | price | The_Peaceful_Lizard | batch 7 |
| 1350 | SuperBollingerTrend (Expo) | `superbollingertrend` | Trend | price | Zeiierman | most liked |
| 1351 | SuperSmoother MA Oscillator | `supersmoother-ma-oscillator` | Oscillators | own | BOSWaves | batch 1 |
| 1352 | SuperTrend + Relative Volume (Kernel Optimized) | `supertrend-relative-volume-kernel` | Trend | price | fluxchart | most liked |
| 1353 | SuperTrend AI Clustering | `supertrend-ai-clustering` | Trend | price |  |  |
| 1354 | SuperTrend Channels | `supertrend-channels` | Channels & Bands | price |  |  |
| 1355 | Supertrend MTF Heikin Ashi | `supertrend-mtf-heikin-ashi` | Trend | price | LonesomeTheBlue | most liked |
| 1356 | SuperTrend Oscillator | `supertrend-oscillator` | Oscillators | own | LuxAlgo | most liked |
| 1357 | Supply & Demand (MTF) \| Flux Charts | `supply-demand-flux-charts` | Trend | price | fluxchart | most liked |
| 1358 | Supply and Demand Anchored | `supply-and-demand-anchored` | Volume | price | LuxAlgo | most liked |
| 1359 | Supply and Demand Daily | `supply-and-demand-daily` | Volume | price | LuxAlgo | most liked |
| 1360 | Supply and Demand Visible Range | `supply-and-demand-visible-range` | Volume | price | LuxAlgo | most liked |
| 1361 | Supply and Demand Zones | `supply-and-demand-zones` | Volume | price | BigBeluga | most liked |
| 1362 | Supply Demand Profiles | `supply-demand-profiles` | Volume | price | LuxAlgo | most liked |
| 1363 | Supply Demand Zones Pro | `supply-demand-zones-pro` | Channels & Bands | price | ProjectSyndicate | most liked |
| 1364 | Support & Resistance AI (K means/median) | `support-resistance-ai` | Channels & Bands | price | ThinkLogicAI | most liked |
| 1365 | Support & Resistance Pro Toolkit | `support-resistance-pro-toolkit` | Trend | price | LuxAlgo | most liked |
| 1366 | Support and Resistance (High Volume Boxes) | `support-resistance-high-volume-boxes` | Volume | price | ChartPrime | most liked |
| 1367 | Support and Resistance (MTF) \| Flux Charts | `support-and-resistance-flux-charts` | Trend | price | fluxchart | most liked |
| 1368 | Support and Resistance Levels with Breaks | `sr-levels-breaks` | Channels & Bands | price |  |  |
| 1369 | Support and Resistance Logistic Regression \| Flux Charts | `support-and-resistance-logistic-regression` | Trend | price | fluxchart | most liked |
| 1370 | Support and Resistance Power Channel | `support-resistance-power-channel` | Trend | price | ChartPrime | most liked |
| 1371 | Support and Resistance Signals MTF | `support-resistance-signals-mtf` | Trend | price | LuxAlgo | most liked |
| 1372 | Support Resistance - Dynamic | `support-resistance-dynamic` | Trend | price | LonesomeTheBlue | most liked |
| 1373 | Support Resistance - Dynamic v2 | `support-resistance-dynamic-v2` | Trend | price | LonesomeTheBlue | most liked |
| 1374 | Support Resistance Channels | `support-resistance-channels` | Trend | price | LonesomeTheBlue |  |
| 1375 | Support Resistance Channels/Zones Multi Time Frame | `support-resistance-channels-mtf` | Trend | price | LonesomeTheBlue | most liked |
| 1376 | Support Resistance Classification (VR) | `support-resistance-classification` | Channels & Bands | price | LuxAlgo | most liked |
| 1377 | Support Resistance Interactive | `support-resistance-interactive` | Trend | price | LonesomeTheBlue | most liked |
| 1378 | Support Resistance MTF | `support-resistance-mtf` | Trend | price | LonesomeTheBlue | most liked |
| 1379 | Support Resistance with Breaks and Retests | `support-resistance-with-breaks-and-retests` | Trend | price | HoanGhetti | most liked |
| 1380 | Support/Resistance Channel Breakout | `support-resistance-channel-breakout` | Channels & Bands | price | SuprAlgo | batch 31 |
| 1381 | Support/Resistance V2 Indicator | `support-resistance-v2-indicator` | Trend | price | BarsStallone | most liked |
| 1382 | Suppot and resistance & BUY SELL SIGNALS | `suppot-and-resistance-buy-sell-signals` | Channels & Bands | price | doganayy2 | batch 20 |
| 1383 | Sweep Candle | `sweep-candle` | Candlestick Patterns | price | odnac | batch 41 |
| 1384 | Sweep Engulf 2 Candle | `sweep-engulf-2-candle` | Candlestick Patterns | price | gastrophollic | batch 41 |
| 1385 | Sweep Engulf CHoCH | `sweep-engulf-choch` | Candlestick Patterns | price | gastrophollic | batch 38 |
| 1386 | Sweep institutional | `sweep-institutional` | Trend | price | Algoryze | most liked |
| 1387 | Sweep2Trade Pro | `sweep2trade-pro` | Trend | price | chervolino | batch 8 |
| 1388 | Swing Anchored Vwap | `swing-anchored-vwap` | Volume | price | BigBeluga | most liked |
| 1389 | Swing Breakout Sequence | `swing-breakout-sequence` | Trend | price | LuxAlgo | most liked |
| 1390 | Swing Failure Pattern (SFP) | `swing-failure-pattern` | Trend | price | LuxAlgo | most liked |
| 1391 | Swing Failure Signals | `swing-failure-signals` | Trend | price | AlgoAlpha | most liked |
| 1392 | Swing High/Low (ZigZag) | `swing-high-low` | Trend | price | ChartPrime | most liked |
| 1393 | Swing Highs/Lows & Candle Patterns | `swing-highs-lows-patterns` | Candlestick Patterns | price | LuxAlgo (Pine v5) |  |
| 1394 | Swing Levels and Liquidity - By Leviathan | `swing-levels-and-liquidity-by-leviathan` | Trend | price | LeviathanCapital | most liked |
| 1395 | Swing Points | `swing-points` | Trend | price | CrossTradeTeam | batch 14 |
| 1396 | Swing Profile | `swing-profile` | Volume | price | BigBeluga | most liked |
| 1397 | Swing Support and Resistance | `swing-support-and-resistance` | Trend | price | VSB-2024 | batch 25 |
| 1398 | Swing Trade Signals | `swing-trade-signals` | Oscillators | price | nicks1008 |  |
| 1399 | Swing Volume Profiles | `swing-volume-profiles` | Volume | price | LuxAlgo | most liked |
| 1400 | SwingArm ATR Trend Indicator | `swingarm-atr-trend-indicator` | Trend | price | vsnfnd (script title "Blackflag FTS") | most liked |
| 1401 | T1 Wyckoff Aggressive A/D Setup | `t1-wyckoff-aggressive-a-d-setup` | Volume | price | Teyo69 | batch 38 |
| 1402 | T3 Length | `t3-psar` | Moving Averages | price |  |  |
| 1403 | TA (Miles) Adaptive Trend | `ta-adaptive-trend` | Trend | price | TradingApologist | batch 27 |
| 1404 | Target Trend | `target-trend` | Trend | price | BigBeluga | most liked |
| 1405 | Targets For Many Indicators | `targets-for-many-indicators` | Trend | price | LuxAlgo | most liked |
| 1406 | Targets For Overlay Indicators | `targets-for-overlay-indicators` | Trend | price | LuxAlgo | most liked |
| 1407 | TASC 2025.02 Autocorrelation Indicator | `tasc-2025-02-autocorrelation` | Oscillators | own | PineCodersTASC | batch 6 |
| 1408 | TASC 2025.06 Cybernetic Oscillator | `tasc-2025-06-cybernetic-oscillator` | Oscillators | own | PineCodersTASC | batch 5 |
| 1409 | TASC 2025.09 The Continuation Index | `tasc-2025-09-the-continuation-index` | Trend | own | PineCodersTASC | batch 14 |
| 1410 | TASC 2026.01 The Reversion Index | `tasc-2026-01-the-reversion-index` | Oscillators | own | PineCodersTASC | batch 26 |
| 1411 | TASC 2026.04 A Synthetic Oscillator | `tasc-2026-04-a-synthetic-oscillator` | Oscillators | own | PineCodersTASC | batch 7 |
| 1412 | TASC 2026.05 The AutoTune Filter | `tasc-2026-05-the-autotune-filter` | Oscillators | own | PineCodersTASC | batch 8 |
| 1413 | TASC 2026.09 Adaptive SuperSmoother | `tasc-2026-09-adaptive-supersmoother` | Moving Averages | own | PineCodersTASC | batch 15 |
| 1414 | TDI - Traders Dynamic Index + RSI Divergences + Buy/Sell Signals | `tdi-traders-dynamic-index-rsi-divergences-buy` | Oscillators | own | ZyadaCharts | most liked |
| 1415 | TDI - Traders Dynamic Index [Goldminds] | `tdi-rsi` | Momentum | own |  |  |
| 1416 | Technical Ratings | `technical-ratings` | Oscillators | own |  | most liked |
| 1417 | Tenkan Cloud Signals | `tenkan-cloud-signals` | Trend | price | CodaPro | batch 11 |
| 1418 | Terminal Velocity Stop \| Lyro RS | `terminal-velocity-stop-lyro-rs` | Trend | price | LyroRS | batch 13 |
| 1419 | TFO + ADX with Histogram & Signal | `tfo-adx-with-histogram-signal` | Oscillators | own | WalrusQuant | batch 26 |
| 1420 | The Echo Forecast | `the-echo-forecast` | Trend | price | LuxAlgo | most liked |
| 1421 | The Jewel | `the-jewel` | Oscillators | own | afonso_77 | batch 37 |
| 1422 | The Mean Goose v1 | `the-mean-goose-v1` | Channels & Bands | price | FattyGuinness | batch 15 |
| 1423 | The Next Pivot | `the-next-pivot` | Trend | price | KioseffTrading | most liked |
| 1424 | The Strat | `the-strat` | Candlestick Patterns | price | shayy110 | batch 42 |
| 1425 | Theil-Sen Line Filter | `theil-sen-line-filter` | Moving Averages | price | BackQuant | batch 18 |
| 1426 | Three Bar Reversal Pattern | `three-bar-reversal-pattern` | Trend | price | LuxAlgo | most liked |
| 1427 | Three Drive Pattern Detector | `three-drive-pattern-detector` | Trend | price | LuxAlgo | most liked |
| 1428 | Three Moving Averages | `three-moving-averages` | Moving Averages | price |  |  |
| 1429 | Three-Bar Reversal/Continuation | `three-bar-reversal-continuation` | Candlestick Patterns | price | abuzka | batch 42 |
| 1430 | Tight Range Display with Background | `tight-range-display-with-background` | Volatility | price | rakeshhelva | batch 42 |
| 1431 | Tillson T3 | `tillson-t3` | Trend | price | KivancOzbilgic (fr3762) |  |
| 1432 | Time-based Alerts for Trading Windows | `time-based-alerts-for-trading-windows` | Trend | price | xhmxdir | batch 41 |
| 1433 | TMA Overlay | `tma-overlay` | Moving Averages | price | ArtyFXC | most liked |
| 1434 | TMO (True Momentum Oscillator) | `tmo` | Momentum | own | Coulisnosaj | batch 15 |
| 1435 | Tom DeMark MACD | `td-macd` | Momentum | own |  |  |
| 1436 | TonyUX EMA Scalper | `tonyux-ema-scalper` | Oscillators | price |  |  |
| 1437 | Top & Bottom Candle | `top-bottom-candle` | Candlestick Patterns | own |  |  |
| 1438 | Tops/Bottoms | `tops-bottoms` | Oscillators | price |  |  |
| 1439 | TR High/Low meter | `tr-high-low-meter` | Momentum | own | dman103 | batch 10 |
| 1440 | Trade Price - Spread Compensator Overlay | `trade-price-spread-compensator-overlay` | Channels & Bands | price | The_Forex_Steward | batch 40 |
| 1441 | Trade Prime - Fluid Trend Indicator | `trade-prime-fluid-trend-indicator` | Trend | price | tradeprime01 | batch 31 |
| 1442 | Trader XO Macro Trend Scanner | `trader-xo` | Oscillators | price |  |  |
| 1443 | Traders Dynamic Index Indicator Alert v0.1 by JustUncleL | `traders-dynamic-index-indicator-alert-v0-1-by` | Oscillators | own | JustUncleL | most liked |
| 1444 | Traders Reality Main | `traders-reality-main` | Trend | price | TradersReality | most liked |
| 1445 | Trading ABC | `trading-abc` | Trend | price | LonesomeTheBlue | most liked |
| 1446 | Trading Activity Index | `trading-activity-index` | Volume | own | Zeiierman | batch 2 |
| 1447 | Trading Gaul | `trading-gaul` | Trend | price | investment20223 | batch 26 |
| 1448 | TradingMoja / SQZMOM ADX | `tradingmoja-sqzmom-adx` | Momentum | own | Trading_Moja | batch 32 |
| 1449 | Trailing Stop Loss Indicator by KıvanÇ fr3762 | `trailing-stop-loss-indicator-by-k-van-fr3762` | Trend | price | KivancOzbilgic | most liked |
| 1450 | Transient Zones v1.1 | `transient-zones` | Channels & Bands | price | Jurij (community) |  |
| 1451 | Tremor Tracker | `tremor-tracker` | Volatility | own | TheUltimator5 | batch 19 |
| 1452 | Trend Channels With Liquidity Breaks | `trend-channels-with-liquidity-breaks` | Channels & Bands | price | ChartPrime | most liked |
| 1453 | Trend Direction Helper (ZigZag and S/R and HH/LL labels) | `trend-direction-helper` | Trend | price | Daveatt (zig zag by Ricardo Santos, pivot levels from Backtest Rookies) | most liked |
| 1454 | Trend Direction Zone | `trend-direction-zone` | Trend | price | MarketStructureLab | batch 16 |
| 1455 | Trend Double Pullbackv1.0 | `trend-double-pullback-v1-0` | Trend | price | puduxbt | batch 26 |
| 1456 | Trend Duration Forecast | `trend-duration-forecast` | Trend | price | ChartPrime | most liked |
| 1457 | Trend Filter (2-pole) | `trend-filter` | Trend | price | BigBeluga | batch 1 |
| 1458 | Trend Flow Oscillator (CMF + MFI) + ADX | `trend-flow-oscillator-adx` | Oscillators | own | WalrusQuant | batch 19 |
| 1459 | Trend Following Moving Averages | `trend-following-ma` | Moving Averages | price | LonesomeTheBlue |  |
| 1460 | Trend Heatmap | `trend-heatmap` | Trend | own | autocrp | batch 30 |
| 1461 | Trend Impulse Channels | `trend-impulse-channels` | Trend | price | Zeiierman |  |
| 1462 | Trend Indicator A-V2 (Smoothed Heikin Ashi Cloud) | `trend-indicator-a-v2` | Trend | price | DZIV | most liked |
| 1463 | Trend Levels | `trend-levels` | Trend | price | ChartPrime | most liked |
| 1464 | Trend Line Auto | `trend-line-auto` | Trend | price | HarryBot |  |
| 1465 | Trend Lines | `trend-lines` | Trend | price | LonesomeTheBlue | most liked |
| 1466 | Trend Lines for RSI, CCI, Momentum, OBV | `trend-lines-for-rsi-cci-momentum-obv` | Oscillators | own | LonesomeTheBlue | most liked |
| 1467 | Trend Lines v2 | `trend-lines-v2` | Trend | price | LonesomeTheBlue (Pine v4) |  |
| 1468 | Trend Magic | `trend-magic` | Trend | price |  |  |
| 1469 | Trend Meter | `trend-meter` | Trend | own | Lij_MC | most liked |
| 1470 | Trend Predictor Ribbon Clone - Fixed roj karo moj karo | `trend-predictor-ribbon` | Trend | price | ronitjain18 | batch 6 |
| 1471 | Trend Pulse Oscillator | `trend-pulse-oscillator` | Oscillators | own | ChaosTrader63 | batch 35 |
| 1472 | Trend Range Detector | `trend-range-detector` | Channels & Bands | price | Zeiierman | most liked |
| 1473 | Trend Regularity Adaptive MA | `trama` | Moving Averages | price | LuxAlgo |  |
| 1474 | Trend Scalper | `trend-scalper` | Moving Averages | price | abedmahmood | batch 35 |
| 1475 | Trend State Signals | `trend-state-signals` | Trend | price | MarketStructureLab | batch 4 |
| 1476 | Trend Strength/Direction | `trend-strength-direction` | Trend | own | ddcakez | batch 32 |
| 1477 | Trend Targets | `trend-targets` | Trend | price | AlgoAlpha | most liked |
| 1478 | Trend Trader Strategy | `trend-trader` | Trend | price |  |  |
| 1479 | Trend Trigger Factor | `trend-trigger-factor` | Oscillators | own |  |  |
| 1480 | Trend Type Indicator by BobRivera990 | `trend-type-indicator-by-bobrivera990` | Trend | own | BobRivera990 | most liked |
| 1481 | Trend Volatility Index (TVI) | `trend-volatility-index` | Volatility | own | chikaharu | batch 3 |
| 1482 | Trend with ADX/EMA - Buy & Sell Signals | `trend-with-adx-ema-buy-sell-signals` | Trend | price | RMPM | batch 28 |
| 1483 | Trend-Pro | `trend-pro` | Trend | price | andrwxwy | batch 38 |
| 1484 | TrendCylinder (Expo) | `trendcylinder` | Trend | price | Zeiierman | batch 4 |
| 1485 | Trending Market Toolkit | `trending-market-toolkit` | Trend | price | LuxAlgo | most liked |
| 1486 | Trendline Breakout Navigator | `trendline-breakout-navigator` | Trend | price | LuxAlgo | most liked |
| 1487 | Trendline Breakouts With Targets | `trendline-breakouts-with-targets` | Trend | price | ChartPrime | most liked |
| 1488 | Trendlines - JD | `trendlines-jd` | Trend | price | Duyck | most liked |
| 1489 | Trendlines 2x + | `trendlines-2x` | Trend | price | Lij_MC | most liked |
| 1490 | Trendlines with Breaks [LuxAlgo] | `trendlines-with-breaks` | Trend | price | LuxAlgo |  |
| 1491 | TrendMasterPro_Fekonomi | `trendmasterpro-fekonomi` | Trend | price | fekonomi | batch 20 |
| 1492 | Trendshift | `trendshift` | Trend | price | chervolino | batch 39 |
| 1493 | TrendShift Detector | `trendshift-detector` | Candlestick Patterns | price | GIANESELLI | batch 40 |
| 1494 | TRENDSYNC BUY/SELL BY SIMPLY_DANTE-FX | `trendsync-buy-sell-by-simply-dante-fx` | Trend | price | Simply_Dante-fx | batch 36 |
| 1495 | TrendWave Bands | `trendwave-bands` | Channels & Bands | price | BigBeluga | batch 1 |
| 1496 | Triangular Hull Moving Average + Volatility | `triangular-hull-moving-average-volatility` | Trend | price | BigBeluga | most liked |
| 1497 | Triangular MA Bands | `tma-bands` | Channels & Bands | price |  |  |
| 1498 | Triangular Momentum Oscillator | `triangular-momentum-osc` | Oscillators | own |  |  |
| 1499 | Trimmed Mean ATR Bands | `trimmed-mean-atr-bands` | Channels & Bands | price | CryptoNejc | batch 17 |
| 1500 | Triple Doji Sequence | `triple-doji-sequence` | Candlestick Patterns | price | Marc_Thiart | batch 39 |
| 1501 | Triple Gaussian Smoothed Ribbon | `triple-gaussian-smoothed-ribbon` | Trend | price | BOSWaves | batch 16 |
| 1502 | Triple MA For Loop | `triple-ma-for-loop` | Trend | own | SeerQuant | batch 7 |
| 1503 | Triple MA Forecast | `triple-ma-forecast` | Moving Averages | price | yatrader2 (community) |  |
| 1504 | Triple RSI \| MisinkoMaster | `triple-rsi-misinkomaster` | Momentum | own | MisinkoMaster | batch 19 |
| 1505 | True Breakout Pattern Breakout Signal Indicator | `true-breakout-pattern-breakout-signal` | Trend | price | TradingFinder | most liked |
| 1506 | True High/Low RSI for Divergence | `true-high-low-rsi-for-divergence` | Oscillators | own | Lakt_ | batch 29 |
| 1507 | True Range eXpansion | `true-range-expansion` | Volatility | price | Sherlock_MacGyver | batch 22 |
| 1508 | TTM Squeeze | `ttm-squeeze-greeny` | Momentum | own | Greeny | most liked |
| 1509 | TTM Squeeze Pro | `ttm-squeeze-pro` | Oscillators | own | John Carter |  |
| 1510 | TTrades Daily Bias | `ttrades-daily-bias` | Trend | price | tradeforopp | most liked |
| 1511 | Turtle Soup ICT Strategy FVG + CHoCH/CSD | `turtle-soup-ict-strategy-fvg-choch-csd` | Trend | price | TradingFinder | most liked |
| 1512 | Turtle Trade Channels | `turtle-trade-channels` | Channels & Bands | price | Richard Dennis / William Eckhardt |  |
| 1513 | Tweezers & Kangaroo Tail | `tweezers-kangaroo-tail` | Candlestick Patterns | price | LonesomeTheBlue |  |
| 1514 | Twin Range Filter | `twin-range-filter` | Trend | price | colinmck |  |
| 1515 | Twin Range Filter Visualized | `twin-range-filter-visualized` | Trend | price | KivancOzbilgic | most liked |
| 1516 | Two-Pole Oscillator | `two-pole-oscillator` | Oscillators | own | BigBeluga | most liked |
| 1517 | Ultimate Buy & Sell | `ultimate-buy-sell` | Trend | price |  |  |
| 1518 | Ultimate Moving Average-Multi-TimeFrame-7 MA Types | `ultimate-moving-average-mtf` | Moving Averages | price | ChrisMoody | most liked |
| 1519 | Ultimate Opening Range Breakout | `ultimate-opening-range-breakout` | Volatility | price | LuxAlgo | most liked |
| 1520 | Ultimate RSI [LuxAlgo] | `ultimate-rsi` | Momentum | own | LuxAlgo |  |
| 1521 | Ultra Clean Support / Resistance Levels | `ultra-clean-support-resistance-levels` | Trend | price | Stocktitian | batch 30 |
| 1522 | Ultra Smart Trail | `ultra-smart-trail` | Trend | price | Rathack | batch 18 |
| 1523 | UM EMA SMA WMA HMA with Directional Color Change | `um-ema-sma-wma-hma-with-directional-color-change` | Moving Averages | price | UnderwearMillionaire | batch 30 |
| 1524 | Unicorn Setup Detector (aziz abid) | `unicorn-setup-detector` | Trend | price | mohammedazizabid | batch 40 |
| 1525 | Universal Large Orders Proxy fabio valentini Chat gpt Recreation | `universal-large-orders-proxy-fabio-valentini-chat-gpt-recreation` | Volume | price | boss11233 | batch 18 |
| 1526 | Universal Signal Backtester | `universal-signal-backtester` | Trend | price | LuxAlgo | most liked |
| 1527 | Uptrick: Dynamic Z-Score Deviation | `uptrick-dynamic-z-score-deviation` | Trend | price | Uptrick | batch 6 |
| 1528 | Uptrick: Liquid Reversal Bands | `liquid-reversal-bands` | Channels & Bands | price | Uptrick | batch 3 |
| 1529 | Uptrick: MultiMA_Volume | `uptrick-multima-volume` | Moving Averages | price | Uptrick | batch 16 |
| 1530 | Uptrick: RSI MA Buying/Selling signals | `uptrick-rsi-ma-buying-selling-signals` | Momentum | own | Uptrick | batch 12 |
| 1531 | Uptrick: Trend Analysis | `uptrick-trend-analysis` | Momentum | own | Uptrick | batch 14 |
| 1532 | Uptrick: Volatility Reversion Bands | `uptrick-volatility-reversion-bands` | Channels & Bands | price | Uptrick | batch 4 |
| 1533 | Uptrick: Zero Lag HMA Trend Suite | `zero-lag-hma-trend-suite` | Moving Averages | price | Uptrick | batch 3 |
| 1534 | User Defined Range Selector and Color Changing EMA Line | `user-defined-range-selector-and-color-changing-ema-line` | Moving Averages | price | Crypto_Moses | batch 23 |
| 1535 | UT Bot | `ut-bot` | Trend | price |  |  |
| 1536 | Ut bot - Trend+volume | `ut-bot-trend-volume` | Trend | price | BhargavMeghnathi | batch 40 |
| 1537 | Vacuum Candles | `vacuum-candles` | Volume | price | XrayAlgo | batch 41 |
| 1538 | Variable Moving Average | `variable-ma` | Moving Averages | price | LazyBear |  |
| 1539 | VARIS Zones | `varis-zones` | Channels & Bands | price | IAmTheLiquidity2 | batch 17 |
| 1540 | VCO Fusion | `vco-fusion` | Oscillators | own | Uncle_the_shooter | batch 20 |
| 1541 | Vdub FX Sniper | `vdub-sniper` | Oscillators | price | Vdubus |  |
| 1542 | VDUB_BINARY_PRO_3_V2  FINAL + Strategy | `vdub-binary-pro-3-v2` | Channels & Bands | price | vdubus | most liked |
| 1543 | vdub_Trend_Master_v  /  v1 / v2 / v3 | `vdub-trend-master-v-v1-v2-v3` | Trend | price | vdubus | most liked |
| 1544 | vdubus BinaryPro | `vdubus-binarypro` | Oscillators | price |  |  |
| 1545 | Vdubus Divergence Wave Pattern Generator V1 | `vdubus-divergence-wave-pattern-generator-v1` | Trend | price | vdubus | most liked |
| 1546 | VEGA (Velocity of Efficient Gain Adaptation) | `vega` | Momentum | own | B3AR_Trades | batch 20 |
| 1547 | Vervoort HA LT Candlestick Oscillator | `vervoort-ha-oscillator` | Oscillators | own |  |  |
| 1548 | VIM (Volume in Money) | `vim` | Volume | own | tbtb1111 | batch 29 |
| 1549 | Visualisation tendances | `visualisation-tendances` | Trend | price | Benjamin69 | batch 17 |
| 1550 | Volatility & Big Market Moves | `volatility-big-market-moves` | Volatility | own | nilstrades_ | batch 24 |
| 1551 | Volatility Adaptive Filtered Trend | `volatility-adaptive-filtered-trend` | Trend | price | SchizoQuant | batch 6 |
| 1552 | Volatility Band Cloud with Overextension Signals | `volatility-band-cloud-with-overextension-signals` | Channels & Bands | price | Retire_by_50 | batch 35 |
| 1553 | Volatility Bands | `volatility-bands` | Channels & Bands | price | pmk07 | batch 23 |
| 1554 | Volatility Breakout Pulse (VBP FIX) | `volatility-breakout-pulse` | Channels & Bands | price | JohnsonForexTrader | batch 36 |
| 1555 | Volatility Channel Oscillator | `volatility-channel-oscillator` | Oscillators | own | Uncle_the_shooter | batch 3 |
| 1556 | Volatility Halo \| NAL | `volatility-halo-nal` | Volatility | price | NordicAlphaLab | batch 6 |
| 1557 | Volatility Quality | `volatility-quality` | Volatility | own | AlphaExtract | batch 18 |
| 1558 | Volatility-Driven VWAP Structure | `volatility-driven-vwap-structure` | Channels & Bands | price | Zeiierman | batch 3 |
| 1559 | Volatility-Gated Trend Oscillator | `volatility-gated-trend-oscillator` | Oscillators | own | QuantAlgo | batch 9 |
| 1560 | VOLD Ratio Histogram | `vold-ratio-histogram` | Volume | own | Th16rry | batch 23 |
| 1561 | Volumatic Fair Value Gaps | `volumatic-fair-value-gaps` | Volume | price | BigBeluga | most liked |
| 1562 | Volumatic S/R Levels | `volumatic-sr-levels` | Trend | price | BigBeluga |  |
| 1563 | Volumatic Variable Index Dynamic Average | `volumatic-variable-index-dynamic-average` | Trend | price | BigBeluga | most liked |
| 1564 | Volume + RSI & MA Differential | `volume-rsi-ma-differential` | Volume | own | ozzy_livin | batch 7 |
| 1565 | Volume / Open Interest "Footprint" - By Leviathan | `volume-open-interest-footprint-by-leviathan` | Volume | price | LeviathanCapital | most liked |
| 1566 | Volume Accumulation Percentage | `volume-accumulation-pct` | Volume | own |  |  |
| 1567 | Volume Alert | `volume-alert` | Volume | price | oDouglasAlex | batch 42 |
| 1568 | Volume Analysis - Heatmap and Volume Profile | `volume-analysis-heatmap-and-volume-profile` | Volume | own | LonesomeTheBlue | most liked |
| 1569 | Volume and Volatility Ratio Indicator-WODI | `volume-and-volatility-ratio-indicator-wodi` | Volume | own | W0DI | batch 16 |
| 1570 | Volume Bands | `volume-bands` | Channels & Bands | price | MisinkoMaster | batch 6 |
| 1571 | Volume bar range | `volume-bar-range` | Volume | price | pandorid | batch 25 |
| 1572 | Volume Bars Color | `volume-bars-color` | Volume | own | Evgenyc111 | batch 20 |
| 1573 | Volume Bubbles & Liquidity Heatmap | `volume-bubbles-liquidity-heatmap` | Volume | price | LuxAlgo | most liked |
| 1574 | Volume Buy/Sell Split | `volume-buy-sell-split` | Volume | own | LHAMA-Trading | batch 26 |
| 1575 | Volume Candle Coloring v5 (BARCOLOR STABLE) | `volume-candle-coloring-v5` | Volume | price | sugogou | batch 37 |
| 1576 | Volume Candle Highlighter | `volume-candle-highlighter` | Volume | price | Dougie_dee | batch 5 |
| 1577 | Volume Candles | `volume-candles` | Volume | price | alexrainman | batch 39 |
| 1578 | Volume Colored Bars | `volume-colored-bars` | Volume | own |  |  |
| 1579 | Volume Comparison with Buyer/Seller Pressure | `volume-comparison-with-buyer-seller-pressure` | Volume | own | ask2maniish | batch 26 |
| 1580 | Volume Divergence | `volume-divergence` | Volume | own | baymucuk |  |
| 1581 | Volume Flow Indicator | `volume-flow-indicator` | Volume | own |  |  |
| 1582 | Volume Flow v3 | `volume-flow-v3` | Volume | own | DepthHouse / oh92 (community) |  |
| 1583 | Volume Footprint | `volume-footprint` | Volume | price | LuxAlgo |  |
| 1584 | Volume Footprint: Measuring by Math & Geometry | `volume-footprint-measuring-by-math-geometry` | Volume | price | ata_sabanci | most liked |
| 1585 | Volume Gaps & Imbalances | `volume-gaps-imbalances` | Volume | price | Zeiierman | most liked |
| 1586 | Volume HeatMap Divergence | `volume-heatmap-divergence` | Volume | price | BigBeluga | most liked |
| 1587 | Volume LinReg Trend | `volume-linreg-trend` | Volume | own | LonesomeTheBlue |  |
| 1588 | Volume Order Blocks | `volume-order-blocks` | Volume | price | BigBeluga | most liked |
| 1589 | Volume Orderbook (Expo) | `volume-orderbook` | Volume | price | Zeiierman | most liked |
| 1590 | Volume Positive Negative (VPN) | `volume-positive-negative` | Volume | own | LevelUpTools | batch 2 |
| 1591 | Volume Price Confirmation Indicator | `vpci` | Volume | own |  |  |
| 1592 | Volume Profile | `volume-profile` | Volume | price | LuxAlgo | most liked |
| 1593 | Volume Profile (kv4coins) | `volume-profile-kv4coins` | Volume | price | kv4coins | most liked |
| 1594 | Volume Profile + Pivot Levels | `volume-profile-pivot-levels` | Volume | price | ChartPrime | most liked |
| 1595 | Volume Profile / Fixed Range | `volume-profile-fixed-range` | Volume | price | LonesomeTheBlue | most liked |
| 1596 | Volume Profile Auto | `volume-profile-auto` | Volume | price | fikira | most liked |
| 1597 | Volume Profile Free Pro (25 Levels Value Area VWAP) by RRB | `volume-profile-free-pro-by-rrb` | Volume | price | RagingRocketBull | most liked |
| 1598 | Volume Profile Free Ultra SLI (100 Levels Value Area VWAP) - RRB | `volume-profile-free-ultra-sli` | Volume | price | RagingRocketBull | most liked |
| 1599 | Volume Profile Heatmap | `volume-profile-heatmap` | Volume | price | KeyAlgos | batch 13 |
| 1600 | Volume Profile per day with support/resistance lines | `volume-profile-per-day-with-support` | Volume | price | juliangonzaconde | most liked |
| 1601 | Volume Profile Plus | `volume-profile-plus` | Volume | price | AlphaViz | most liked |
| 1602 | Volume Profile, Pivot Anchored by DGT | `volume-profile-pivot-anchored` | Volume | price | dgtrd | most liked |
| 1603 | Volume Sentiment Breakout Channels | `volume-sentiment-breakout-channels` | Channels & Bands | price | AlgoAlpha | most liked |
| 1604 | Volume Spike and Contraction Indicator | `volume-spike-and-contraction-indicator` | Volume | price | epicurusMcPot | batch 41 |
| 1605 | Volume Spike Indicator | `volume-spike-indicator` | Volume | price | rikyu04 | batch 42 |
| 1606 | Volume Suite - By Leviathan (CVD, Volume Delta, Relative Volume) | `volume-suite-by-leviathan` | Volume | own | LeviathanCapital | most liked |
| 1607 | Volume SuperTrend AI (Expo) | `volume-supertrend-ai` | Trend | price |  |  |
| 1608 | Volume Surge Detector | `volume-surge-detector` | Volume | own | SpeculationLab | batch 19 |
| 1609 | Volume Variation Index Indicator | `volume-variation-index-indicator` | Volume | own | thequantscience | batch 35 |
| 1610 | Volume Weighted MACD V2 | `vw-macd-v2` | Momentum | own |  |  |
| 1611 | VOLUME WEIGHTED MACD V2 | `volume-weighted-macd-v2-vwmacdv2-by-kivan` | Momentum | own | KivancOzbilgic | most liked |
| 1612 | Volume Weighted Median Price (VWMP) | `volume-weighted-median-price` | Moving Averages | price | vsov | batch 14 |
| 1613 | Volume Weighted RSI (VW RSI) | `volume-weighted-rsi` | Momentum | own | CsokosGeza | batch 34 |
| 1614 | Volume Weighted Trend | `volume-weighted-trend` | Trend | price | QuantAlgo | batch 1 |
| 1615 | Volume with Alert | `volume-with-alert` | Volume | own | BullBearSR | batch 30 |
| 1616 | Volume with EMA and Coloring Rules | `volume-with-ema-and-coloring-rules` | Volume | own | itisfilipe | batch 37 |
| 1617 | Volume-Based Moving Average | `volume-based-moving-average` | Moving Averages | price | The_Forex_Steward | batch 36 |
| 1618 | Volume-Based RSI Color Indicator with MAs | `volume-based-rsi-color-indicator-with-mas` | Oscillators | own | Riccardo02 | batch 32 |
| 1619 | Volume-based Support & Resistance Zones | `volume-based-support-resistance-zones` | Volume | price | tommyf1001 | most liked |
| 1620 | Volume-Gated Trend Ribbon | `volume-gated-trend-ribbon` | Trend | price | QuantAlgo | batch 3 |
| 1621 | Volume-Trend Order Block Engine | `volume-trend-order-block-engine` | Trend | price | BigBeluga | most liked |
| 1622 | Volume-Weighted MA Crossover | `volume-weighted-ma-crossover` | Moving Averages | price | AlphaNatt | batch 9 |
| 1623 | Volume-Weighted Money Flow | `volume-weighted-money-flow` | Volume | own | sgbpulse | batch 33 |
| 1624 | Volume-Weighted Order Block Zones | `volume-weighted-order-block-zones` | Volume | price | BigBeluga | most liked |
| 1625 | Volume-Weighted Pivot Bands | `volume-weighted-pivot-bands` | Channels & Bands | price | LeafAlgo | batch 33 |
| 1626 | Volume-Weighted Price Z-Score | `volume-weighted-price-z-score` | Oscillators | own | QuantAlgo | batch 6 |
| 1627 | Volumetric Compressed MA | `volumetric-compressed-ma` | Moving Averages | price | serkany88 | batch 14 |
| 1628 | Volumetric Entropy Index | `volumetric-entropy-index` | Volume | own | Sherlock_MacGyver | batch 27 |
| 1629 | Volumetric Order Flow Structure | `volumetric-order-flow-structure` | Trend | price | LuxAlgo | most liked |
| 1630 | Volumetric Tensegrity | `volumetric-tensegrity` | Volume | own | TheLeadingIndicator | batch 30 |
| 1631 | VolVol | `volvol` | Volume | price | kunalgolani | batch 26 |
| 1632 | Vortex Pro with Moving average | `vortex-pro-with-moving-average` | Oscillators | own | pointalgo | batch 25 |
| 1633 | Voss Predictive Filter | `voss-predictive-filter` | Oscillators | own | e2e4 | batch 8 |
| 1634 | VPSA-VTD | `vpsa-vtd` | Volume | own | CatTheTrader | batch 11 |
| 1635 | Vulkan Profit | `vulkan-profit` | Trend | price | AlgoCollective | batch 33 |
| 1636 | VuManChu Swing Free | `vumanchu-swing` | Trend | price |  |  |
| 1637 | VWAP & Dual MA Ribbon Tracker Pro | `vwap-dual-ma-ribbon-tracker-pro` | Trend | own | Simon20cent | batch 19 |
| 1638 | VWAP Deviation Oscillator | `vwap-deviation-oscillator` | Oscillators | own | BackQuant | batch 9 |
| 1639 | VWAP MTF (Multi Timeframe) | `vwap-mtf` | Volume | price | TheYangGuizi | most liked |
| 1640 | VWAP Periodic Close | `vwap-periodic-close` | Volume | price | LuxAlgo | most liked |
| 1641 | VWAP Predictive Breakout + RSI + OB + Trend/Chop | `vwap-predictive-breakout-rsi-ob-trend-chop` | Volume | price | Viggy02 | batch 31 |
| 1642 | VWAP Stdev Bands v2 Mod | `vwap-stdev-bands-v2-mod` | Channels & Bands | price | TheYangGuizi | most liked |
| 1643 | VWAP Supply & Demand Zones PRO | `vwap-supply-demand-zones-pro` | Channels & Bands | price | Finntech1 | most liked |
| 1644 | VWAP Volume Profile | `vwap-volume-profile` | Volume | price | BigBeluga | most liked |
| 1645 | VWAP/MVWAP/EMA Crossover | `vwap-mvwap-ema-crossover` | Trend | price | DerrickLaFlame |  |
| 1646 | VWMA/SMA Delta Volatility (Statistical Anomaly Detector) | `vwma-sma-delta-volatility` | Volatility | own | tkarolak | batch 14 |
| 1647 | VWMACD-MFI-OBV Composite | `vwmacd-mfi-obv-composite` | Volume | own | munair | batch 27 |
| 1648 | VWRSI Crossovers & Extremes | `vwrsi-crossovers-extremes` | Momentum | own | TheAITradingDesk | batch 35 |
| 1649 | Waddah Attar Explosion | `waddah-attar-explosion` | Momentum | own | LazyBear/ShayanKM |  |
| 1650 | WAE Sniper Scalp XAUUSD M1 Tuned | `wae-sniper-scalp-xauusd-m1-tuned` | Momentum | own | khonthailoei19071983 | batch 19 |
| 1651 | Waindrops | `waindrops` | Volume | price | makit0 | most liked |
| 1652 | Wave N + KDJ + Volumi + SMC + Ichimoku | `wave-n-kdj-volumi-smc-ichimoku` | Trend | price | Nikus63 | batch 31 |
| 1653 | WaveFunction MACD | `wavefunction-macd` | Momentum | own | TechnoBlooms | batch 27 |
| 1654 | Wavelet Filter with Adaptive Upsampling | `wavelet-filter-with-adaptive-upsampling` | Oscillators | own | BackQuant | batch 29 |
| 1655 | Wavelet Transform Trend | `wavelet-transform-trend` | Trend | price | QuantAlgo | batch 12 |
| 1656 | Wavelet-Trend ML Integration | `wavelet-trend-ml-integration` | Oscillators | own | AlphaExtract | batch 1 |
| 1657 | WaveTrend | `wavetrend` | Oscillators | own | LazyBear |  |
| 1658 | WaveTrend Oscillator | `wavetrend-oscillator` | Momentum | own | LazyBear |  |
| 1659 | WaveTrend Oscillator + Divergence  + Direction Detection +Alerts | `wavetrend-oscillator-divergence-direction` | Oscillators | own |  | most liked |
| 1660 | Wedge and Flag Finder (Multi - zigzag) | `wedge-and-flag-finder` | Trend | price | Trendoscope | most liked |
| 1661 | Weierstrass Function (Fractal Cycles) | `weierstrass-function` | Oscillators | own | fract | batch 17 |
| 1662 | Weighted percentile nearest rank | `weighted-percentile-nearest-rank` | Moving Averages | price | gorx1 | batch 10 |
| 1663 | Weighted Regression Bands | `weighted-regression-bands` | Channels & Bands | price | Zeiierman | batch 5 |
| 1664 | Weis Wave Candle | `weis-wave-candle` | Trend | own | Uncle_the_shooter | batch 34 |
| 1665 | Weis Wave Volume | `weis-wave-volume` | Volume | own |  |  |
| 1666 | Whale Activity Impact Oscillator | `whale-activity-impact-oscillator` | Volume | own | mdeacey | batch 18 |
| 1667 | Whale Liquidity and Absorption Profile | `whale-liquidity-and-absorption-profile` | Volume | price | AlgoAlpha | most liked |
| 1668 | Whale Volume Absorption & Aggression @MaxMaserati 3.0 | `whale-volume-absorption-aggression-maxmaserati-3-0` | Volume | own | MaxMaserati | batch 22 |
| 1669 | Wick Volume Alert | `wick-volume-alert` | Candlestick Patterns | price | Shazam77 | batch 41 |
| 1670 | WICK.ED Fractals | `wicked-fractals` | Oscillators | price | Mit Nayi (community) |  |
| 1671 | Williams Alligator + Fractals | `williams-combo` | Trend | price | vlkvr (Pine v3) |  |
| 1672 | Williams BBDiv Signal | `williams-bbdiv-signal` | Oscillators | own | trade_lexx | batch 20 |
| 1673 | Williams Percent Range with Threshold | `williams-percent-range-with-threshold` | Oscillators | own | xdextra | batch 29 |
| 1674 | Williams Vix Fix | `williams-vix-fix` | Volatility | own | ChrisMoody |  |
| 1675 | WLSMA: fast approximation | `wlsma-fast-approximation` | Moving Averages | price | gorx1 | batch 33 |
| 1676 | Wolfe Scanner (Multi - zigzag) | `wolfe-scanner` | Trend | price | Trendoscope | most liked |
| 1677 | Wyckoff Effort vs. Result | `wyckoff-effort-vs-result` | Volume | price | TradeTechanalysis | batch 34 |
| 1678 | x5-smooth-ema | `x5-smooth-ema` | Moving Averages | price | traderninezero | batch 19 |
| 1679 | XAUUSD Buy/Sell Alerts with SL & TP | `xauusd-buy-sell-alerts-with-sl-tp` | Moving Averages | price | alexandrossolomou1 | batch 8 |
| 1680 | XAUUSD Family Scalping (5min) | `xauusd-family-scalping` | Oscillators | price | cupra_inc | batch 8 |
| 1681 | Z-Score | `z-score` | Oscillators | own | joecalledher | batch 21 |
| 1682 | Z-Score Oscillator | `z-score-oscillator` | Oscillators | own | B3AR_Trades | batch 12 |
| 1683 | Z-Score STDEMA Bands | `z-score-stdema-bands` | Oscillators | own | TiagoTF | batch 24 |
| 1684 | Z-Score Trend Monitor | `z-score-trend-monitor` | Oscillators | own | EdgeTerminal | batch 31 |
| 1685 | Zero Lag Liquidity | `zero-lag-liquidity` | Volume | price | AlgoAlpha | most liked |
| 1686 | Zero Lag LSMA (ZLSMA) | `zlsma` | Moving Averages | price | veryfid |  |
| 1687 | Zero Lag MACD | `zero-lag-macd` | Momentum | own | AC (based on Glaz) |  |
| 1688 | Zero Lag Signals For Loop | `zero-lag-signals-for-loop` | Trend | price | QuantAlgo | batch 1 |
| 1689 | Zero Lag Trend Signals (MTF) | `zero-lag-trend-signals` | Trend | price | AlgoAlpha | most liked |
| 1690 | Zero-Lag GARCH Bands \| NAL | `zero-lag-garch-bands-nal` | Volatility | price | NordicAlphaLab | batch 12 |
| 1691 | Zig Zag Channels | `zig-zag-channels` | Channels & Bands | price | LuxAlgo | most liked |
| 1692 | ZigZag Multi Time Frame with Fibonacci Retracement | `zigzag-multi-time-frame-with-fibonacci` | Trend | price | LonesomeTheBlue | most liked |
| 1693 | ZigZag Multiple Methods - Forecast - patterns - labels | `zigzag-multiple-methods-forecast-patterns` | Trend | price | RicardoSantos | most liked |
| 1694 | ZigZag Percent Reversal - Forecast - patterns - labels | `zigzag-percent-reversal-forecast-patterns` | Trend | price | RicardoSantos | most liked |
| 1695 | Zigzag Trend/Divergence Detector | `zigzag-trend-divergence-detector` | Trend | price | Trendoscope | most liked |
| 1696 | ZigZag with Fibonacci Levels | `zigzag-fibonacci` | Trend | price | LonesomeTheBlue |  |
| 1697 | Zone Shift | `zone-shift` | Trend | price | ChartPrime | most liked |
| 1698 | ZVOL - Z-Score Volume Heatmap | `zvol-z-score-volume-heatmap` | Volume | own | TheLeadingIndicator | batch 28 |
| 1699 | 🌊 ALMA Bands | `alma-bands` | Moving Averages | price | B3AR_Trades | batch 26 |
