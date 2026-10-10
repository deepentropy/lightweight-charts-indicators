# Community Indicator Inventory

Community indicators of `lightweight-charts-indicators`: TypeScript ports of community PineScript scripts, built on
[oakscriptjs](https://github.com/deepentropy/oakscriptJS). Each port has the inputs, plots and drawings of its Pine
source. This list is generated from the indicator registry (`indicatorRegistry` in `src/index.ts`).

## Summary

| | Count |
|---|---|
| **Community indicators** | 1198 |
| Drawn on the price pane (overlay) | 711 |
| Drawn in their own pane | 487 |
| Compared with reference outputs (batches 1-42 and the most liked set) | 880 |

| Category | Count |
|---|---|
| Trend | 322 |
| Oscillators | 232 |
| Momentum | 149 |
| Moving Averages | 145 |
| Volume | 133 |
| Channels & Bands | 121 |
| Candlestick Patterns | 57 |
| Volatility | 39 |

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
| 1 | + Average Candle Bodies Range | `average-candle-bodies-range` | Volatility | own | ClassicScott | batch 13 |
| 2 | 12/26 EMA Inflection Zones by Korax | `12-26-ema-inflection-zones-by-korax` | Moving Averages | price | Korax | batch 16 |
| 3 | 15-Minute Squeeze Scalper (Traffic Light Edition) | `15-minute-squeeze-scalper` | Volatility | own | Universal_Scalper_Pro | batch 36 |
| 4 | 1m Trend Continuation Signals - SSL + BB Filter | `1m-trend-continuation-signals-ssl-bb-filter` | Trend | price | rhariganesh | batch 13 |
| 5 | 3 Bar Reversal | `3-bar-reversal` | Candlestick Patterns | price | abbadon9 | batch 40 |
| 6 | 3 Confirmation Bear | `3-confirmation-bear` | Trend | price | AirianM | batch 16 |
| 7 | 3 Confirmation Bull | `3-confirmation-bull` | Trend | price | AirianM | batch 21 |
| 8 | 3 Lines RCI + Psy Signal + RSI Background | `3-lines-rci-psy-signal-rsi-background` | Oscillators | own | masato19810122 | batch 36 |
| 9 | 3-in-1 Custom Moving Average Indicator | `3-in-1-custom-moving-average-indicator` | Moving Averages | price | Mr-Fish | batch 22 |
| 10 | 5-Minute Buy/Sell Signal | `5-minute-buy-sell-signal` | Trend | price | Waqas_Khalid | batch 14 |
| 11 | 72s: Adaptive Hull Moving Average+ | `adaptive-hull-ma` | Moving Averages | price | io72signals |  |
| 12 | <50% Body Candle | `50-body-candle` | Candlestick Patterns | price | Dutchinvestor | batch 38 |
| 13 | [RS] Support and Resistance V0 | `rs-support-resistance` | Channels & Bands | price | RicardoSantos (community) |  |
| 14 | Abdullah | `abdullah` | Trend | price | royalsherry888 | batch 35 |
| 15 | Absolute Strength Index | `absolute-strength-index` | Oscillators | own | Zeiierman | batch 3 |
| 16 | Absorption Arrows v2 | `absorption-arrows-v2` | Volume | price | WaveWalker1 | batch 41 |
| 17 | Abusuhil Bullish Candles | `abusuhil-bullish-candles` | Candlestick Patterns | price | abusuhil | batch 38 |
| 18 | Acceleration Bands HTF | `acceleration-bands-htf` | Channels & Bands | price | ZoharCho | batch 18 |
| 19 | Accumulation/Distribution Money Flow v1.0 | `ad-money-flow` | Volume | own | kypexin | batch 8 |
| 20 | Accurate Swing Trading | `accurate-swing-trading` | Trend | price |  |  |
| 21 | Actually Engulfing Candlesticks | `actually-engulfing-candlesticks` | Candlestick Patterns | price | llbot | batch 40 |
| 22 | Adaptive ALMA 2.0 | `adaptive-alma-2-0` | Moving Averages | price | Zomzi | batch 9 |
| 23 | Adaptive Average Sentiment Oscilator | `adaptive-average-sentiment-oscilator` | Oscillators | own | Zomzi | batch 32 |
| 24 | Adaptive Convergence Divergence | `adaptive-convergence-divergence` | Momentum | own | singhxgurjit | batch 21 |
| 25 | Adaptive Ehlers Filtered Percentile | `adaptive-ehlers-filtered-percentile` | Channels & Bands | price | SchizoQuant | batch 4 |
| 26 | Adaptive Entropy Trend | `adaptive-entropy-trend` | Trend | price | QuantAlgo | batch 6 |
| 27 | Adaptive Friction Filter (AFF) | `adaptive-friction-filter` | Trend | price | QuantAlgo | batch 10 |
| 28 | Adaptive Gaussian AFR | `adaptive-gaussian-afr` | Trend | price | Mattes00 | batch 6 |
| 29 | Adaptive Heikin Ashi | `adaptive-heikin-ashi` | Trend | price | chervolino | batch 13 |
| 30 | Adaptive Kinetic Ribbon | `adaptive-kinetic-ribbon` | Trend | price | QuantAlgo | batch 9 |
| 31 | Adaptive MACD | `adaptive-macd` | Momentum | own |  |  |
| 32 | Adaptive ML Trailing Stop | `adaptive-ml-trailing-stop` | Trend | price | BOSWaves | batch 5 |
| 33 | Adaptive Nadaraya-Watson (Non Repainting) | `adaptive-nadaraya-watson` | Channels & Bands | price | Metrify | batch 10 |
| 34 | Adaptive Pivot Zones | `adaptive-pivot-zones` | Channels & Bands | price | Uncle_the_shooter | batch 17 |
| 35 | Adaptive Rolling Z-Score Channel | `adaptive-rolling-z-score-channel` | Channels & Bands | price | B3AR_Trades | batch 18 |
| 36 | Adaptive RSI \| Lyro RS | `adaptive-rsi-lyro-rs` | Oscillators | own | LyroRS | batch 13 |
| 37 | Adaptive Trend Channel | `adaptive-trend-channel` | Channels & Bands | price | MarketStructureLab | batch 4 |
| 38 | Adaptive Trend Flow [QuantAlgo] | `adaptive-trend-flow` | Trend | price | QuantAlgo |  |
| 39 | Adaptive Volatility-Scaled Oscillator | `adaptive-volatility-scaled-oscillator` | Volatility | own | Zeiierman | batch 4 |
| 40 | Adjusted RSI | `adjusted-rsi` | Oscillators | own | JTCapitalNL | batch 11 |
| 41 | ADR Contraction Tightness | `adr-contraction-tightness` | Volatility | own | etfbreakouts | batch 33 |
| 42 | Advanced Dual Hull Cross Suite v6 - Precision Signals | `advanced-dual-hull-cross-suite-v6-precision-signals` | Moving Averages | price | NitMan279 | batch 36 |
| 43 | Advanced MACD Pro - T3 Themed | `advanced-macd-pro-t3-themed` | Momentum | own | WhiteStone_Ibrahim | batch 27 |
| 44 | Advanced Volume-Driven Breakout Signals | `advanced-volume-driven-breakout-signals` | Volume | price | VolumeVigilante | batch 38 |
| 45 | AdvancedLines (FiboBands) - PaSKaL | `advancedlines-paskal` | Channels & Bands | price | uPaSKaL | batch 19 |
| 46 | ADX and DI | `adx-and-di` | Trend | own | BeikabuOyaji | most liked |
| 47 | ADX and RSI Combo | `adx-and-rsi-combo` | Oscillators | own | Tracks | batch 10 |
| 48 | ADX by cobra | `adx-cobra` | Trend | own | cobra (community) |  |
| 49 | ADX Di+ Di- [Gu5] | `adx-di-gu5` | Trend | own | Gu5tavo71 |  |
| 50 | ADX Extreme Zones + Divergences | `adx-extreme-zones-divergences` | Trend | own | TradeVizion | batch 13 |
| 51 | ADX Trend Strength Filter + TRAMA | `adx-trend-strength-filter-trama` | Trend | price | DotGain | batch 18 |
| 52 | ADX Trend Visualizer with Dual Thresholds | `adx-trend-visualizer-with-dual-thresholds` | Trend | own | crankyprofits | batch 32 |
| 53 | ADX with Shaded Zone | `adx-with-shaded-zone` | Trend | own | MathThomas | batch 20 |
| 54 | ADX-vALMA (N) | `adx-valma` | Trend | own | Zomzi | batch 6 |
| 55 | Aegis Prime Flow | `aegis-prime-flow` | Oscillators | own | wjdtks255 | batch 34 |
| 56 | Aggregated Scores Oscillator | `aggregated-scores-oscillator` | Oscillators | own | AlphaExtract | batch 8 |
| 57 | Aggressive Pullback Indicator | `aggressive-pullback-indicator` | Trend | price | ZenAndTheArtOfTrading | batch 1 |
| 58 | Aggressive Volume | `aggressive-volume` | Volume | own | oDouglasAlex | batch 26 |
| 59 | AI Adaptive Oscillator | `ai-adaptive-oscillator` | Oscillators | own | PhenLabs | batch 11 |
| 60 | AI Breakout Bands | `ai-breakout-bands` | Channels & Bands | price | Zeiierman | batch 3 |
| 61 | AI Engulfing Candle | `ai-engulfing` | Candlestick Patterns | price |  |  |
| 62 | AI Infinity | `ai-infinity` | Trend | price | jonathanalbrecht_trader | batch 11 |
| 63 | AI Source Switching Moving Average | `ai-source-switching-moving-average` | Moving Averages | price | Zeiierman | batch 1 |
| 64 | AI Trading Assistant v2 | `ai-trading-assistant-v2` | Trend | price | Alchemical_Carpenter | batch 26 |
| 65 | AI Trend Navigator [K-Neighbor] | `ai-trend-navigator` | Trend | price |  |  |
| 66 | AI Volume Signals | `ai-volume-signals` | Volume | price | szymonsobkowiak | batch 9 |
| 67 | AI-Weighted RSI | `ai-weighted-rsi` | Oscillators | own | Zeiierman | batch 3 |
| 68 | AK MACD BB | `macd-bb` | Momentum | own | Algokid |  |
| 69 | AK TREND ID | `ak-trend-id` | Trend | own | Algokid |  |
| 70 | Al Brooks II.IOI.OO | `al-brooks-ii-ioi-oo` | Candlestick Patterns | price |  | batch 42 |
| 71 | Al Po's Arithmetic Mean | `al-po-s-arithmetic-mean` | Moving Averages | price | sequentialvision | batch 21 |
| 72 | All Candlestick Patterns | `all-candlestick-patterns` | Candlestick Patterns | price |  |  |
| 73 | All-In-One MA Stack Scalper | `all-in-one-ma-stack-scalper` | Moving Averages | price | jonesdaniel2112 | batch 33 |
| 74 | ALL-IN-ONE RSI System (Cloud Divergence Stoch RSI CM WVF) | `all-in-one-rsi-system` | Oscillators | own | ethem11 | batch 25 |
| 75 | AllMA Trend Radar | `allma-trend-radar` | Moving Averages | price | trade_lexx | batch 28 |
| 76 | ALMA SD Bands \| RakoQuant | `alma-sd-bands-rakoquant` | Channels & Bands | price | RakoQuant | batch 10 |
| 77 | Alpha Trading Signal _ Up side Down | `alpha-trading-signal-up-side-down` | Trend | price | giaodichdsmart | batch 19 |
| 78 | Alpha-Sutte Model | `alpha-sutte-model` | Trend | price | SegaRKO | batch 10 |
| 79 | AlphaTrend | `alpha-trend` | Trend | price | KivancOzbilgic |  |
| 80 | Anchored Bollinger Band Range | `anchored-bollinger-band-range` | Channels & Bands | price | Steversteves | batch 20 |
| 81 | Anchored VWAP Pro (Final Visibility Enhanced) | `anchored-vwap-pro` | Volume | price | ImmortalEmerson | batch 17 |
| 82 | Anchored VWAP with Buy/Sell Signals | `anchored-vwap-with-buy-sell-signals` | Volume | price | kmootoo89 | batch 29 |
| 83 | ANDROMEDA - TrendSync | `andromeda-trendsync` | Trend | price | Pedro_Canto | batch 9 |
| 84 | Anti-Volume Stop Loss | `anti-volume-stop` | Trend | price |  |  |
| 85 | Apex Volatility Squeeze & Breakout | `apex-volatility-squeeze-breakout` | Volatility | price | Pineify | batch 33 |
| 86 | Arnaud Legoux Gaussian Flow \| AlphaNatt | `arnaud-legoux-gaussian-flow-alphanatt` | Moving Averages | price | AlphaNatt | batch 17 |
| 87 | Aroon with RSI Confirmation (92.86%) | `aroon-with-rsi-confirmation` | Trend | price | jaydipali622018 | batch 7 |
| 88 | ASDQWE123 2.0 | `asdqwe123-2-0` | Trend | price | luvuoov | batch 34 |
| 89 | Asian & London Session High/Low | `asian-london-session-high-low` | Channels & Bands | price | NikolayBorisov | batch 8 |
| 90 | Ask-Weighted Averages | `ask-weighted-averages` | Volume | price | DinoTradez | batch 27 |
| 91 | Asset risk metrics | `asset-risk-metrics` | Momentum | price | Sweettz | batch 21 |
| 92 | Asymmetric Volatility Trend Line | `asymmetric-volatility-trend-line` | Trend | price | QuantAlgo | batch 4 |
| 93 | ATR Based Zigzag w EMA | `atr-based-zigzag-w-ema` | Trend | price | HabibiBudo | batch 4 |
| 94 | ATR HEMA | `atr-hema` | Moving Averages | price | SeerQuant | batch 2 |
| 95 | ATR Period | `nrtr` | Trend | price |  |  |
| 96 | ATR Period | `profit-maximizer` | Moving Averages | price |  |  |
| 97 | ATR Period | `supertrend-ladder` | Trend | price |  |  |
| 98 | ATR Rope | `atr-rope` | Trend | price | SamRecio | batch 2 |
| 99 | ATR Trailing Stop with ATR Targets | `atr-trailing-stop-with-atr-targets` | Trend | price | TRDRZone | batch 33 |
| 100 | ATR Trailing Stops | `atr-trailing-stops` | Trend | price |  |  |
| 101 | ATR Trend Color | `atr-trend-color` | Trend | price | Aleksin_Aleksandar | batch 31 |
| 102 | ATR Volatility and Trend Analysis | `atr-volatility-and-trend-analysis` | Volatility | price | dchunt-stack | batch 10 |
| 103 | ATR ZLEMA | `atr-zlema` | Trend | price | QuantAlgo | batch 3 |
| 104 | ATR+ Stop Loss Indicator | `atr-plus` | Trend | own | ZenAndTheArtOfTrading |  |
| 105 | ATR-Normalized VWMA Deviation | `atr-normalized-vwma-deviation` | Oscillators | own | exploretranspose | batch 10 |
| 106 | ATR-Scaled Deviation Oscillator | `atr-scaled-deviation-oscillator` | Oscillators | own | C_H_I_P_A | batch 23 |
| 107 | ATR20 SMA x3.5 Trailing Line | `atr20-sma-x3-5-trailing-line` | Volatility | price | hibinomasakazu1991 | batch 30 |
| 108 | Aura Sentiment & Risk Flow | `aura-sentiment-risk-flow` | Oscillators | own | Pineify | batch 34 |
| 109 | Aura Trend & Candlestick Matrix | `aura-trend-candlestick-matrix` | Trend | price | Pineify | batch 9 |
| 110 | Aura Vortex Oscillator | `aura-vortex-oscillator` | Oscillators | own | Pineify | batch 32 |
| 111 | Aura: Adaptive Statistical Smoother | `aura-adaptive-statistical-smoother` | Moving Averages | price | Pineify | batch 15 |
| 112 | Auto AVWAP (Anchored-VWAP) with Breakout Screener | `auto-avwap-with-breakout-screener` | Volume | price | manoharvs | batch 28 |
| 113 | Auto Fibo on Indicators | `auto-fibo-indicators` | Oscillators | own | KivancOzbilgic |  |
| 114 | Auto Fibonacci | `auto-fib` | Channels & Bands | price |  |  |
| 115 | Auto Trendline [DojiEmoji] | `auto-trendline` | Trend | price |  |  |
| 116 | Auto-Support | `auto-support` | Channels & Bands | price |  |  |
| 117 | Automated Z-scoring | `automated-z-scoring` | Oscillators | own | JTCapitalNL | batch 14 |
| 118 | Automatic Support & Resistance | `auto-support-resistance` | Channels & Bands | price |  |  |
| 119 | Average Bullish & Bearish Percentage Change | `average-bullish-bearish-percentage-change` | Momentum | own | fract | batch 23 |
| 120 | Average Sentiment Oscillator | `average-sentiment-oscillator` | Oscillators | own |  |  |
| 121 | Average True Range Trailing Stops Colored | `atr-trailing-colored` | Trend | price |  |  |
| 122 | Awesome Oscillator V2 | `awesome-oscillator-v2` | Oscillators | own |  |  |
| 123 | Awesome_Accelerator_Zone Oscillator | `awesome-accelerator-zone-oscillator` | Oscillators | own | pirooz_trader | batch 18 |
| 124 | B + A + D v0.4 | `b-a-d-v0-4` | Momentum | own | wepritz84 | batch 13 |
| 125 | BACAP PRICE STRUCTURE 21 EMA TREND | `bacap-price-structure-21-ema-trend` | Trend | price | Alex_PrimeTrading | batch 19 |
| 126 | Banker Fund Flow Trend Oscillator | `banker-fund-flow` | Oscillators | own |  |  |
| 127 | Bar Replay Fix | `bar-replay-fix` | Candlestick Patterns | price | ivanrdgc | batch 42 |
| 128 | BB Breakout Oscillator | `bb-breakout-oscillator` | Oscillators | own | LuxAlgo |  |
| 129 | BB Fibonacci Ratios | `bb-fibonacci-ratios` | Channels & Bands | price |  |  |
| 130 | BB Length | `ideal-bb-ma` | Moving Averages | price |  |  |
| 131 | BB Stochastic RSI Extreme Signal | `bb-stoch-rsi` | Oscillators | price |  |  |
| 132 | Beep Boop | `beep-boop` | Momentum | own | OBSIDE | batch 33 |
| 133 | Bernoulli Process - Binary Entropy | `bernoulli-process-entropy` | Oscillators | own | kocurekc | batch 1 |
| 134 | BEST Supertrend CCI | `supertrend-cci` | Trend | price | Daveatt |  |
| 135 | Beta-Weighted Moving Average | `weighted-ma-function` | Moving Averages | price |  |  |
| 136 | Better Volume Indicator | `better-volume` | Volume | own | LazyBear |  |
| 137 | Big Snapper Alerts R3.0 | `big-snapper-alerts` | Trend | price |  |  |
| 138 | Big Trades Detector By HF | `big-trades-detector-by-hf` | Volume | price | Nicolas_Favilla | batch 38 |
| 139 | Big Trades Whale Detector By HK | `big-trades-whale-detector-by-hk` | Volume | price | colacorn | batch 38 |
| 140 | Biggest Volume | `biggest-volume` | Volume | own | mikhail_marka | batch 22 |
| 141 | Bilateral Filter For Loop | `bilateral-filter-for-loop` | Trend | own | BackQuant | batch 14 |
| 142 | Binary Option Arrows | `binary-option-arrows` | Trend | price |  |  |
| 143 | Bitcoin 2Y-SMA Bands\| Astral Vision | `bitcoin-2y-sma-bands-astral-vision` | Channels & Bands | own | AstralVision | batch 34 |
| 144 | Bitcoin Bull/Bear Market Support/Resistance Bands | `bitcoin-bull-bear-market-support-resistance-bands` | Moving Averages | price | JoeSTM | batch 30 |
| 145 | Bitcoin Kill Zones v2 | `bitcoin-kill-zones` | Trend | price |  |  |
| 146 | Bitcoin Log Growth Curves | `bitcoin-log-curves` | Trend | price | Quantadelic |  |
| 147 | Bitcoin: Mayer Multiple | `bitcoin-mayer-multiple` | Oscillators | own | sito4713 | batch 25 |
| 148 | Bitcoin: Pi Cycle Top & Bottom Indicator Z Score | `bitcoin-pi-cycle-top-bottom-indicator-z-score` | Oscillators | own | Commandoum | batch 37 |
| 149 | Bjorgum AutoTrail | `bjorgum-autotrail` | Trend | price | Bjorgum (simplified for auto mode) |  |
| 150 | Bjorgum Key Levels | `bjorgum-key-levels` | Trend | price | Bjorgum | most liked |
| 151 | Bjorgum TSI | `bjorgum-tsi` | Momentum | own |  |  |
| 152 | Blacklab84 Panel | `blacklab84-panel` | Oscillators | own | blacklab84 | batch 21 |
| 153 | BNF 25/50 MA Pullback Screener (Uptrend-Below / Downtrend-Above) | `bnf-25-50-ma-pullback-screener` | Trend | price | jackson_g_sheehan | batch 35 |
| 154 | Bollinger Adaptive Trend Navigator | `bollinger-adaptive-trend-navigator` | Trend | price | QuantAlgo | batch 16 |
| 155 | Bollinger Awesome Alert R1.1 | `bollinger-awesome-alert` | Trend | price |  |  |
| 156 | Bollinger Free Bars | `bollinger-free-bars` | Channels & Bands | price | pkuliyi | batch 36 |
| 157 | Bollinger Heatmap | `bollinger-heatmap` | Channels & Bands | own | Quantitative | batch 25 |
| 158 | Boom Hunter Pro | `boom-hunter-pro` | Momentum | own | veryfid |  |
| 159 | Breakdown or Buyable Dip? Pullback Depth Can Help | `breakdown-or-buyable-dip-pullback-depth-can-help` | Momentum | own | TradeStation | batch 23 |
| 160 | Breakout an Reversal Signal Detector with Colored in Bar Trends | `breakout-an-reversal-signal-detector-with-colored-in-bar-trends` | Channels & Bands | price | AmGlad_Trader | batch 25 |
| 161 | Breakout Finder | `breakout-finder` | Trend | price | LonesomeTheBlue | most liked |
| 162 | Breakout Indicator | `breakout-indicator` | Trend | price | ZenAndTheArtOfTrading | batch 1 |
| 163 | Breakout Probability (Expo) | `breakout-probability` | Volatility | price | Zeiierman | most liked |
| 164 | BTC Logarithmic Regression Quantile Bands \| Astral Vision | `btc-logarithmic-regression-quantile-bands-astral-vision` | Channels & Bands | price | AstralVision | batch 24 |
| 165 | Bull Bear Power Trend | `bull-bear-power-trend` | Momentum | own |  |  |
| 166 | Bullish Engulfing Finder | `bullish-engulfing-finder` | Candlestick Patterns | price |  |  |
| 167 | Bullish Volume Anomaly | `bullish-volume-anomaly` | Volume | price | UnknownUnicorn13336802 | batch 31 |
| 168 | Bulls or Bears in Control | `bulls-bears-control` | Trend | own |  |  |
| 169 | Bulls v Bears | `bulls-v-bears` | Momentum | own | Mihkel00 | batch 3 |
| 170 | Buy & Sell - Accurate Signals | `buy-sell-accurate-signals` | Trend | price | Cryptokingworld91 (published as "Buy & Sell - Accurate Signals") | batch 7 |
| 171 | Buy & Sell Pressure | `buy-sell-pressure` | Volume | own |  |  |
| 172 | Buy Low Sell High Composite Upgraded V6 | `buy-low-sell-high-composite-upgraded-v6` | Oscillators | own | kristian6ncqq | batch 15 |
| 173 | Buy on Volume | `buy-on-volume` | Moving Averages | price | Mando4_27 | batch 21 |
| 174 | Buy the Dip & Sell the Rip | `buy-the-dip-sell-the-rip` | Momentum | price | vvedding | batch 41 |
| 175 | Buy/Sell Hull Crossover Signals (Fast & Slow) | `buy-sell-hull-crossover-signals` | Moving Averages | price | VibeAlgos | batch 11 |
| 176 | Buyers & Sellers / Range | `buyers-sellers-range` | Oscillators | own | fract | batch 11 |
| 177 | Buyers vs Sellers | `buyers-vs-sellers` | Momentum | own | davorloncarpetrovic | batch 19 |
| 178 | Buying & Selling Pressure | `buying-selling-pressure` | Volatility | own | fract | batch 3 |
| 179 | Buying and Selling Volume Pressure S/R | `buying-and-selling-volume-pressure-s-r` | Volume | price | DinoTradez | batch 16 |
| 180 | Buying Selling Volume | `buying-selling-volume` | Volume | own | ceyhun (community) |  |
| 181 | Buying vs Selling Moving Averages (Scalp Meter) | `buying-vs-selling-moving-averages` | Volume | own | codycolton97 | batch 24 |
| 182 | BuySell Volume Bar Chart | `buysell-volume-bar-chart` | Volume | own | roshbiz1408 | batch 21 |
| 183 | BuySell%_ImtiazH_v2 | `buysell-imtiazh-v2` | Volume | own | a272a59956 | batch 22 |
| 184 | Buyside & Sellside Liquidity | `buyside-sellside-liquidity` | Trend | price | LuxAlgo | most liked |
| 185 | Cabal Dev Indicator | `cabal-dev-indicator` | Oscillators | own | SolanaMemeCoins | batch 26 |
| 186 | Candle Breakout Oscillator | `candle-breakout-oscillator` | Oscillators | own | LuxAlgo | batch 2 |
| 187 | Candle BUY SELL + Support Resistance | `candle-buy-sell-support-resistance` | Channels & Bands | price | JohnsonForexTrader | batch 32 |
| 188 | Candle Channel | `candle-channel` | Channels & Bands | price | Uncle_the_shooter | batch 23 |
| 189 | Candle Color Flip | `candle-color-flip` | Candlestick Patterns | price | LorPlant | batch 42 |
| 190 | Candle Count RSI | `candle-count-rsi` | Oscillators | own | Sherlock_MacGyver | batch 35 |
| 191 | Candle Range Theory (CRT) by Lucas | `candle-range-theory-by-lucas` | Trend | price | lucasfff | batch 15 |
| 192 | Candle Range Trading (CRT) | `candle-range-trading` | Trend | price | marcostan93 | batch 1 |
| 193 | Candle Spread Oscillator (CS0) | `candle-spread-oscillator` | Oscillators | own | RWCS_LTD | batch 36 |
| 194 | Candle State (The Strat) | `candle-state` | Candlestick Patterns | price | Crinklebine | batch 38 |
| 195 | Candlestick Patterns Identified | `candlestick-patterns-identified` | Candlestick Patterns | price | repo32 | batch 38 |
| 196 | Candlestick Reversal | `candlestick-reversal` | Candlestick Patterns | price | LonesomeTheBlue (community) |  |
| 197 | Cardwell RSI by TQ | `cardwell-rsi-by-tq` | Oscillators | own | TradeQUO | batch 24 |
| 198 | Carrier Volatility | `carrier-volatility` | Oscillators | own | et20tradeview | batch 15 |
| 199 | CBC Flip with Volume | `cbc-flip-with-volume` | Trend | price | PtGambler | batch 18 |
| 200 | CCI coded OBV | `cci-obv` | Oscillators | own | LazyBear |  |
| 201 | CCI Length | `cci-stochastic` | Momentum | own |  |  |
| 202 | CCI Pro | `cci-hash-capital` | Oscillators | own | Hash_Capital | batch 24 |
| 203 | CCT Bollinger Band Oscillator | `cct-bbo` | Oscillators | own | LazyBear |  |
| 204 | CDC Action Zone | `cdc-action-zone` | Trend | price |  |  |
| 205 | Center of Gravity Channel | `cog-channel` | Channels & Bands | price |  |  |
| 206 | CHAKRA RISS ENGULFING CANDLESTICK STRATEGY | `chakra-riss-engulfing-candlestick-strategy` | Momentum | price | Tradewith_Riss | batch 18 |
| 207 | Chandelier Exit | `chandelier-exit` | Trend | price |  |  |
| 208 | Chandelier Stop | `chandelier-stop` | Trend | price |  |  |
| 209 | Change-Point Detection (CUSUM) | `change-point-detection` | Trend | price | LuxAlgo | batch 6 |
| 210 | CHN BUY SELL with EMA 200 | `chn-buy-sell-with-ema-200` | Trend | price | CHNTeam | batch 10 |
| 211 | Clean Buy Sell Pro | `clean-buy-sell-pro` | Trend | price | JohnsonForexTrader | batch 40 |
| 212 | Clean Volume Bars (Green/Red + Above Avg Highlight) | `clean-volume-bars` | Volume | own | melospoker80 | batch 37 |
| 213 | Climax Volume Reversal Radar | `climax-volume-reversal-radar` | Volume | own | Ty_yanse | batch 31 |
| 214 | Clustering Volatility (ATR-ADR-ChaikinVol) | `clustering-volatility` | Volatility | own | SDF-Solutions | batch 24 |
| 215 | CM EMA Trend Bars | `cm-ema-trend-bars` | Trend | price | ChrisMoody |  |
| 216 | CM Enhanced Ichimoku Cloud V5 | `cm-enhanced-ichimoku` | Channels & Bands | price | ChrisMoody (community) |  |
| 217 | CM Gann Swing High Low V2 | `cm-gann-swing` | Trend | price | ChrisMoody (community) |  |
| 218 | CM Guppy EMA | `cm-guppy-ema` | Moving Averages | price | ChrisMoody |  |
| 219 | CM Heikin-Ashi | `cm-heikin-ashi` | Candlestick Patterns | price | ChrisMoody |  |
| 220 | CM Laguerre PPO PercentileRank | `cm-laguerre-ppo` | Oscillators | own | ChrisMoody |  |
| 221 | CM Price Action Bars | `cm-price-action` | Oscillators | price | ChrisMoody |  |
| 222 | CM RSI Plus EMA | `cm-rsi-ema` | Oscillators | own | ChrisMoody |  |
| 223 | CM RSI-2 Strategy Lower | `cm-rsi-2-lower` | Oscillators | own | ChrisMoody |  |
| 224 | CM RSI-2 Strategy Upper | `cm-rsi-2-upper` | Oscillators | price | ChrisMoody |  |
| 225 | CM Sling Shot System | `cm-sling-shot` | Trend | price | ChrisMoody |  |
| 226 | CM Stochastic Highlight Bars | `cm-stoch-highlight` | Oscillators | price | ChrisMoody |  |
| 227 | CM Stochastic Multi-TimeFrame | `cm-stochastic-mtf` | Oscillators | own | ChrisMoody | most liked |
| 228 | CM Stochastic POP Method 1 | `stoch-pop-1` | Oscillators | own | ChrisMoody |  |
| 229 | CM Stochastic POP Method 2 | `stoch-pop-2` | Oscillators | own | ChrisMoody |  |
| 230 | CM Time Based Vertical Lines | `cm-time-lines` | Trend | price | ChrisMoody |  |
| 231 | CM Williams Vix Fix V3 | `cm-vix-fix-v3` | Oscillators | own | ChrisMoody |  |
| 232 | CM_Pivot Points_M-W-D-4H-1H_Filtered | `cm-pivot-points-filtered` | Trend | price | ChrisMoody | most liked |
| 233 | CM_Ultimate RSI Multi Time Frame | `cm-ultimate-rsi-mtf` | Oscillators | own | ChrisMoody | most liked |
| 234 | CM_Ultimate_MA_MTF_V2 | `cm-ultimate-ma-mtf-v2` | Moving Averages | price | ChrisMoody | most liked |
| 235 | CMO For Loop \| QuantLapse | `cmo-for-loop-quantlapse` | Momentum | own | QuantLapse | batch 19 |
| 236 | Colored Volume Bars | `colored-volume` | Volume | own | LazyBear |  |
| 237 | Combined Up down with volume | `combined-up-down-with-volume` | Volume | price | ChartMantra_ | batch 41 |
| 238 | Combo Oscillator - MACD + Stoch + RSI + EMA | `combo-oscillator-macd-stoch-rsi-ema` | Oscillators | own | Gauder84 | batch 34 |
| 239 | Community MoneyLine | `community-moneyline` | Trend | price | rafstar_kaczmarek | batch 12 |
| 240 | Composite Indicator (CCI + ATR) | `composite-indicator` | Momentum | price | CharLi0t | batch 17 |
| 241 | Consecutive Candles DevisSo | `consecutive-candles-devisso` | Trend | price | engineerofmoney | batch 11 |
| 242 | Consecutive Higher/Lower Closings | `consecutive-higher-lower-closings` | Trend | price | rahul_joshi_2 | batch 39 |
| 243 | Consolidation Zones - Live | `consolidation-zones` | Channels & Bands | price | LonesomeTheBlue |  |
| 244 | Conversion Periods | `ichimoku-oscillator` | Momentum | own |  |  |
| 245 | Coral Trend | `coral-trend` | Trend | price | LazyBear |  |
| 246 | Corrected Moving Average | `corrected-moving-average` | Moving Averages | price | everget | batch 3 |
| 247 | COV Bands ~ C H I P A | `cov-bands-c-h-i-p-a` | Channels & Bands | own | C_H_I_P_A | batch 28 |
| 248 | Crosby Ratio \| QuantumResearch | `crosby-ratio-quantumresearch` | Momentum | own | QuantumResearch | batch 17 |
| 249 | Crossover EMMM | `crossover-emmm` | Trend | price | NunyadzilaTrading | batch 22 |
| 250 | CRT indicator | `crt-indicator` | Trend | price | INTELA | batch 16 |
| 251 | Curved Trend Channels | `curved-trend-channels` | Channels & Bands | price | Zeiierman | batch 7 |
| 252 | Custom Buy and Sell Signal with Body Ratio and RSI | `custom-buy-and-sell-signal-with-body-ratio-and-rsi` | Momentum | price | am-solaris | batch 38 |
| 253 | Custom Donchian Channels | `donchian-custom` | Channels & Bands | price |  |  |
| 254 | Customizable RSI/StochRSI Double Confirmation | `customizable-rsi-stochrsi-double-confirmation` | Momentum | price | smile_bad_day | batch 42 |
| 255 | CVD & Big Trade Detector By HK | `cvd-big-trade-detector-by-hk` | Volume | own | colacorn | batch 39 |
| 256 | CVD (Cumulative Volume Delta) | `cvd-rupward` | Volume | own | RUpward | batch 19 |
| 257 | CVD Divergence Background By HK | `cvd-divergence-background-by-hk` | Volume | price | colacorn | batch 42 |
| 258 | CVD Polarity Indicator (With Rolling Smoothed) | `cvd-polarity-indicator` | Volume | own | Cruiser | batch 35 |
| 259 | CVD Reversal Divergence (Exhaustion) | `cvd-reversal-divergence` | Volume | price | somnacin | batch 39 |
| 260 | Cycle & Flow Indicator - D_Quant | `cycle-flow-indicator-d-quant` | Trend | price | D_QUANT | batch 22 |
| 261 | Cycle Low (RSI + StochRSI) – v5 John.K | `cycle-low-v5-john-k` | Momentum | price | John_Kal | batch 22 |
| 262 | Cycle-Synced Channel Breakout | `cycle-synced-channel-breakout` | Channels & Bands | price | TradeTechanalysis | batch 25 |
| 263 | Dan's Ironclad OB - Simple | `dan-s-ironclad-ob-simple` | Trend | price | hynaxiii | batch 10 |
| 264 | Darvas Box | `darvas-box` | Candlestick Patterns | price |  |  |
| 265 | Dead Simple Reversal | `dead-simple-reversal` | Candlestick Patterns | price | B3AR_Trades (converted from "p2f - Dead Simple Reversal" by paidtofade; | batch 41 |
| 266 | DECODE Moving Average Toolkit | `decode-moving-average-toolkit` | Moving Averages | price | decodejar | batch 20 |
| 267 | Delta Manipulation Footprint | `delta-manipulation-footprint` | Volume | price | destrobr0685 | batch 39 |
| 268 | Delta Volume RSI | `delta-volume-rsi` | Volume | own | destrobr0685 | batch 24 |
| 269 | Delta-RSI Oscillator | `delta-rsi-oscillator` | Momentum | own | tbiktag (simplified) |  |
| 270 | DEMA Flow | `dema-flow` | Trend | price | AlphaExtract | batch 7 |
| 271 | Demand Index (James Sibbet) | `demand-index` | Volume | own | conair | batch 37 |
| 272 | Deviation Symmetry Breaker ~ C H I P A | `deviation-symmetry-breaker-c-h-i-p-a` | Channels & Bands | own | C_H_I_P_A | batch 18 |
| 273 | Dip & Rip Patterns - The Quant Science | `dip-rip-patterns-the-quant-science` | Volatility | price | thequantscience | batch 39 |
| 274 | Dip Buy/Sell Signals (Vix Fix + MA Deviation + TRMAD) | `dip-buy-sell-signals` | Volatility | price | DotGain | batch 42 |
| 275 | Directional Indicator Crossovers v1 | `directional-indicator-crossovers-v1` | Trend | own | JopAlgo | batch 7 |
| 276 | Directional Logistic Oscillator | `directional-logistic-oscillator` | Oscillators | own | GainzAlgo | batch 2 |
| 277 | Directional Movement Index + ADX & Key Levels | `dmi-adx-levels` | Trend | own |  |  |
| 278 | Disparity Index | `disparity-index` | Oscillators | own | HPotter | batch 10 |
| 279 | Divergence for Many Indicators v4 | `divergence-for-many-indicators-v4` | Momentum | price | LonesomeTheBlue | most liked |
| 280 | Divergence Indicator | `divergence-indicator` | Momentum | price |  |  |
| 281 | DMI Delta by 0xjcf | `dmi-delta-by-0xjcf` | Trend | own | J_O_S_E_ | batch 34 |
| 282 | DMI Histogram Indicator | `dmi-histogram-indicator` | Trend | own | Chart0bserver | batch 32 |
| 283 | DN MACD | `dn-macd` | Momentum | own | lihulu123 | batch 32 |
| 284 | Dominance Signal Apex | `dominance-signal-apex` | Trend | price | chervolino | batch 17 |
| 285 | Donchian Reversal Signals with Labels | `donchian-reversal-signals-with-labels` | Channels & Bands | price | Trader-Hitesh | batch 40 |
| 286 | Donchian Trend Ribbon | `donchian-trend-ribbon` | Trend | own | LonesomeTheBlue |  |
| 287 | Dope DPO | `dope-dpo` | Oscillators | own | Sherlock_MacGyver | batch 14 |
| 288 | Double Median ATR Bands \| MisinkoMaster | `double-median-atr-bands-misinkomaster` | Channels & Bands | price | MisinkoMaster | batch 28 |
| 289 | Double Median SD Bands \| MisinkoMaster | `double-median-sd-bands-misinkomaster` | Channels & Bands | price | MisinkoMaster | batch 30 |
| 290 | Double RSI | `double-rsi` | Momentum | own | Clokivez | batch 9 |
| 291 | Dual Bayesian For Loop | `dual-bayesian-for-loop` | Momentum | own | QuantAlgo | batch 5 |
| 292 | Dual EMA Trend Ribbon (Multi-Timeframe Trend Confirmation) | `dual-ema-trend-ribbon` | Moving Averages | price | Aleksin_Aleksandar | batch 3 |
| 293 | Dual MA SD Oscillator | `dual-ma-sd-oscillator` | Oscillators | own | SchizoQuant | batch 9 |
| 294 | Dual RSI Smoother | `dual-rsi-smoother` | Oscillators | own | TheUltimator5 | batch 8 |
| 295 | Dynamic Flow Ribbons | `dynamic-flow-ribbons` | Trend | price | BigBeluga | batch 2 |
| 296 | Dynamic Fractal Flow | `dynamic-fractal-flow` | Oscillators | own | AlphaExtract | batch 21 |
| 297 | Dynamic Score PSAR | `dynamic-score-psar` | Trend | own | QuantAlgo | batch 8 |
| 298 | Dynamic Stop Loss & Take Profit | `dynamic-stop-loss-take-profit` | Volatility | price | criptoblast2 | batch 23 |
| 299 | Dynamic Structure Indicator | `dynamic-structure-indicator` | Trend | price |  |  |
| 300 | Dynamic Support & Resistance | `dynamic-support-resistance` | Moving Averages | price | ZenAndTheArtOfTrading | batch 1 |
| 301 | Dynamic Testing | `dynamic-testing` | Oscillators | price | ProfitNomad | batch 9 |
| 302 | Dynamic Trailing | `dynamic-trailing` | Trend | price | Zeiierman | batch 5 |
| 303 | Dynamic Trend Bands | `dynamic-trend-bands` | Channels & Bands | price | ChartPrime | batch 2 |
| 304 | Dynamic Trend Channel (DTC) | `dynamic-trend-channel` | Channels & Bands | price | JohnsonForexTrader | batch 27 |
| 305 | Dynamic Volatility Filter | `dynamic-volatility-filter` | Trend | price | QuantAlgo | batch 4 |
| 306 | Dynamic Volume Clusters with Retest Signals | `dynamic-volume-clusters` | Channels & Bands | price | Zeiierman | batch 2 |
| 307 | Dynamic Volume Profile Oscillator | `dynamic-volume-profile-oscillator` | Volume | own | AlphaNatt | batch 1 |
| 308 | Dynamic VWAP: Fair Value & Divergence Suite | `dynamic-vwap-fair-value-divergence-suite` | Channels & Bands | price | RWCS_LTD | batch 30 |
| 309 | E9 Bollinger Range | `e9-bollinger-range` | Channels & Bands | price | E9XBT | batch 34 |
| 310 | Eagles Compass | `eagles-compass` | Candlestick Patterns | price | zenmarkets | batch 40 |
| 311 | Early MACD Reversal Indicator | `early-macd-reversal-indicator` | Momentum | own | StockSignaler | batch 10 |
| 312 | Early Pivot Alert (price-quantum reversal) • v1a (arrows only) | `early-pivot-alert-v1a` | Trend | price | dirkbiebaut | batch 35 |
| 313 | Easy Entry/Exit Trend Colors | `easy-trend-colors` | Trend | own |  |  |
| 314 | Edward Smart Channel Reversal | `edward-smart-channel-reversal` | Channels & Bands | price | Jos-ProTrader | batch 13 |
| 315 | Effective FVG Indicator - Imran | `effective-fvg-indicator-imran` | Volume | price | imrancrypto | batch 40 |
| 316 | Effective Volume Z-Score | `effective-volume-z-score` | Volume | own | eugencovaci | batch 35 |
| 317 | Efficiency Ratio Trend | `efficiency-ratio-trend` | Trend | price | achirameegasthanne | batch 9 |
| 318 | Ehlers Adaptive RSI | `ehlers-adaptive-rsi` | Oscillators | own | Julien_Exe | batch 14 |
| 319 | Ehlers Adaptive Trend Indicator | `ehlers-adaptive-trend-indicator` | Trend | price | AlphaExtract | batch 18 |
| 320 | Ehlers Instantaneous Trend | `ehlers-instantaneous-trend` | Trend | price |  |  |
| 321 | Ehlers Maclaurin Ultimate Smoother | `ehlers-maclaurin-ultimate-smoother` | Moving Averages | own | Mupsje | batch 33 |
| 322 | Ehlers MESA Adaptive Moving Average | `ehlers-mesa-ma` | Moving Averages | price | Ehlers |  |
| 323 | Ehlers Regime Dynamic Candles | `ehlers-regime-dynamic-candles` | Candlestick Patterns | price | sizzlinsoft | batch 39 |
| 324 | Ehlers Reverse EMA | `ehlers-reverse-ema` | Oscillators | own | AlgoCollective | batch 36 |
| 325 | Ehlers Stochastic CG Oscillator | `ehlers-stochastic-cg` | Oscillators | own |  |  |
| 326 | Elite Oscillator Pro | `elite-oscillator-pro` | Oscillators | own | Alpha_Wizard | batch 34 |
| 327 | Elliott Wave Oscillator | `elliott-wave-oscillator` | Oscillators | own | Koryu |  |
| 328 | Elliptic Curve SAR | `elliptic-curve-sar` | Trend | price | TEDCORP2 | batch 26 |
| 329 | EMA & MA Crossover | `ema-ma-crossover` | Moving Averages | price |  |  |
| 330 | EMA & MACD Strategy with SL/TP | `ema-macd-strategy-with-sl-tp` | Trend | price | mamachi- | batch 28 |
| 331 | EMA + RSI Autotrade Webhook - Varun | `ema-rsi-autotrade-webhook-varun` | Moving Averages | price | varuns_back | batch 17 |
| 332 | EMA + SuperTrend | `ema-supertrend` | Moving Averages | price | All_in_Traders |  |
| 333 | EMA + VWMA + ATR Smoothed BuySell (merged) - TOM ZENG 202509 | `ema-vwma-atr-smoothed-buysell-tom-zeng-202509` | Trend | price | zengtom | batch 18 |
| 334 | EMA 20/50/100/200 | `ema-multi` | Moving Averages | price |  |  |
| 335 | EMA 9 / 26 Cross | `ema-9-26-cross` | Moving Averages | price | h0s1m001 | batch 27 |
| 336 | EMA Cloud Trend | `ema-cloud-trend` | Moving Averages | price | ZkalishTR | batch 9 |
| 337 | EMA Cross Signals | `ema-cross-signals` | Moving Averages | price | Jos-ProTrader | batch 29 |
| 338 | EMA Enveloper | `ema-enveloper` | Moving Averages | price |  |  |
| 339 | EMA Oscillator | `ema-oscillator` | Oscillators | own | AlphaExtract | batch 16 |
| 340 | EMA Ribbon | `ema-ribbon` | Moving Averages | price |  |  |
| 341 | EMA Wave Indicator | `ema-wave` | Moving Averages | own |  |  |
| 342 | EMA/RMA clouds by Alpachino | `ema-rma-clouds-by-alpachino` | Moving Averages | price | Alpachino97 | batch 28 |
| 343 | EMA21 Pullback Buy | `ema21-pullback-buy` | Moving Averages | price | Kennedy08 | batch 23 |
| 344 | Emergent Rays - NovaTheMachine | `emergent-rays-novathemachine` | Moving Averages | price | NovaTheMachine | batch 32 |
| 345 | Engulfing + Sweep (Confirmed Only) v6 - bars only | `engulfing-sweep-v6-bars-only` | Candlestick Patterns | price | fanta-grapefruit | batch 38 |
| 346 | Engulfing Candle Indicator | `engulfing-candle-indicator` | Candlestick Patterns | price | The_Forex_Steward | batch 41 |
| 347 | Engulfing Sweeps - Milana Trades | `engulfing-sweeps-milana-trades` | Candlestick Patterns | price | MilanaArsenovna | batch 38 |
| 348 | Enhanced KLSE Banker Flow Oscillator | `enhanced-klse-banker-flow-oscillator` | Oscillators | own | Dr_Leong_Yee_Rock | batch 15 |
| 349 | Enhanced VFI Buyer/Seller Pressure | `enhanced-vfi-buyer-seller-pressure` | Volume | own | ask2maniish | batch 28 |
| 350 | Enhanced VSA Volume & Candle Colors with MA Selection | `enhanced-vsa-volume-candle-colors-with-ma-selection` | Volume | own | ViZiV | batch 27 |
| 351 | Entropy Bands | `entropy-bands` | Channels & Bands | price | TechnoBlooms | batch 20 |
| 352 | Entry / TP / SL Alert Bands (Simple & Stable) | `entry-tp-sl-alert-bands` | Channels & Bands | price | drlicht1 | batch 34 |
| 353 | Entry Points | `entry-points` | Oscillators | price |  |  |
| 354 | Entry Signals (Long/Short) | `entry-signals-long-short` | Trend | price | tradegear9 | batch 1 |
| 355 | Envelope RSI | `envelope-rsi` | Oscillators | price | Saleh_Toodarvari |  |
| 356 | Equalhigh JAPANESE TRIPLE RCI | `equalhigh-japanese-triple-rci` | Oscillators | own | Stevesyl | batch 22 |
| 357 | ERD: Effort-Result Diagnostic | `erd-effort-result-diagnostic` | Channels & Bands | price | DarwinDarma | batch 32 |
| 358 | EREMA Signals | `erema-signals` | Trend | price | AlgoCollective | batch 39 |
| 359 | Euclidean Range | `euclidean-range` | Volatility | own | InvestorUnknown | batch 21 |
| 360 | EURUSD Swing High/Low Projection | `eurusd-swing-high-low-projection` | Channels & Bands | price | tiprolin | batch 37 |
| 361 | Evil MACD Trading System (Pine Script v6) | `evil-macd-trading-system` | Momentum | price | daves723 | batch 37 |
| 362 | EVWMA Envelope | `evwma-envelope` | Oscillators | price |  |  |
| 363 | Exhaustion Zone | `exhaustion-zone` | Channels & Bands | price | rukich | batch 6 |
| 364 | Fair Value Gap | `fair-value-gap-luxalgo` | Trend | price | LuxAlgo | most liked |
| 365 | Faith Indicator | `faith-indicator` | Trend | own |  |  |
| 366 | False Breakout (Expo) | `false-breakout` | Channels & Bands | price | Zeiierman |  |
| 367 | Faraz Perfect Structure Scalper + Long Short (Indicator Alerts) | `faraz-perfect-structure-scalper-long-short` | Trend | price | fsaleem03 | batch 29 |
| 368 | Fast Length | `bjorgum-triple-ema` | Moving Averages | price |  |  |
| 369 | Fast WMA | `fast-wma` | Moving Averages | own | Clokivez | batch 25 |
| 370 | Fastlane | `fastlane` | Volume | price | HB5 | batch 40 |
| 371 | Fibonacci Bollinger Bands | `fibonacci-bollinger-bands` | Channels & Bands | price | Rashad |  |
| 372 | Fibonacci HH LL TRAMA Band | `fibonacci-hh-ll-trama-band` | Channels & Bands | price | FibonacciFlux | batch 16 |
| 373 | Fibonacci Levels | `fibonacci-levels` | Channels & Bands | price |  |  |
| 374 | Fibonacci Moving Averages | `fibonacci-moving-averages` | Moving Averages | price | UkutaLabs | batch 28 |
| 375 | Fibonacci Weighted Moving Average | `fibonacci-weighted-moving-average` | Moving Averages | price | everget | batch 12 |
| 376 | Fibonacci Zone | `fibonacci-zone` | Channels & Bands | price |  |  |
| 377 | FibSync - DynamicFibSupport | `fibsync-dynamicfibsupport` | Channels & Bands | price | mr_uponly | batch 34 |
| 378 | Filter Ribbon | `filter-ribbon` | Trend | price | c9indicator | batch 4 |
| 379 | Filter Wave | `filter-wave` | Trend | price | c9indicator | batch 15 |
| 380 | Fisher MPz | `fisher-mpz` | Oscillators | own | B3AR_Trades | batch 30 |
| 381 | Fisher Volume Transform \| AlphaNatt | `fisher-volume-transform-alphanatt` | Oscillators | own | AlphaNatt | batch 16 |
| 382 | Fixed-Range Volume-Profile Zones | `fixed-range-volume-profile-zones` | Volume | own | RWCS_LTD | batch 13 |
| 383 | Flow Control Oscillator (FCO) | `flow-control-oscillator` | Volume | own | WalrusQuant | batch 19 |
| 384 | FlowShift Oscillator | `flowshift-oscillator` | Oscillators | own | BOSWaves | batch 24 |
| 385 | FluidTrades - SMC Lite | `fluidtrades-smc-lite` | Trend | price | Pmgjiv | most liked |
| 386 | Follow Line | `follow-line` | Trend | price | Dreadblitz |  |
| 387 | For-Loop Vote Trailing Stop \| MiesOnCharts | `for-loop-vote-trailing-stop-miesoncharts` | Trend | price | MiesOnCharts | batch 31 |
| 388 | Force Pulse | `force-pulse` | Oscillators | own | Uncle_the_shooter | batch 17 |
| 389 | Forecast Oscillator | `forecast-oscillator` | Oscillators | own | KivancOzbilgic |  |
| 390 | Forex Sessions | `forex-sessions` | Oscillators | own |  |  |
| 391 | Fourier series Model Of The Market | `fourier-series-model-of-the-market` | Oscillators | own | e2e4 | batch 12 |
| 392 | Fractal Exhaustion Band | `fractal-exhaustion-band` | Trend | price | QuantAlgo | batch 2 |
| 393 | Fractal Strength Oscillator | `fractal-strength-oscillator` | Oscillators | own | SurgeQuant | batch 20 |
| 394 | Fractals Trend | `fractals-trend` | Trend | price | BigBeluga | batch 2 |
| 395 | Fractional EMA Kalman Filter | `fractional-ema-kalman-filter` | Moving Averages | price | et20tradeview | batch 4 |
| 396 | FSVZO | `fsvzo` | Volume | own | AlphaExtract | batch 5 |
| 397 | Full Candle Higher/Lower (No Repeats) | `full-candle-higher-lower` | Candlestick Patterns | price | devtiqo | batch 41 |
| 398 | Function Savitzky Golay Filter with 7 Vectors V0 | `function-savitzky-golay-filter-with-7-vectors-v0` | Moving Averages | price | RicardoSantos | batch 33 |
| 399 | FuTech V-Spike & V-Highlighter | `futech-v-spike-v-highlighter` | Volume | price | Atmiya_aatubhai | batch 39 |
| 400 | FVG Breakout/Breakdown | `fvg-breakout-breakdown` | Trend | price | ICT_Concept_Trading | batch 33 |
| 401 | FVG Candle Highlighter | `fvg-candle-highlighter` | Volatility | price | SmellyTaz | batch 40 |
| 402 | FVG Order Blocks | `fvg-order-blocks` | Trend | price | BigBeluga | most liked |
| 403 | FVG Positioning Average | `fvg-positioning-average` | Trend | price | LuxAlgo |  |
| 404 | FX Sniper T3-CCI | `fx-sniper-t3-cci` | Oscillators | own |  |  |
| 405 | FxShare - CC Reversal | `fxshare-cc-reversal` | Trend | price | FxShareRobots | batch 22 |
| 406 | G-Score \| NAL | `g-score-nal` | Oscillators | own | NordicAlphaLab | batch 13 |
| 407 | Gabriel's Andean Oscillator | `gabriel-s-andean-oscillator` | Trend | own | GabrielAmadeusLau | batch 23 |
| 408 | Gamma + Fibonacci EMA Bands | `gamma-fibonacci-ema-bands` | Moving Averages | price | ky_yule1010 | batch 23 |
| 409 | Gamma Hedging Pressure (Normalized -100 to +100) | `gamma-hedging-pressure` | Momentum | own | uzair2join | batch 20 |
| 410 | Gann High Low | `gann-high-low` | Trend | price | KivancOzbilgic |  |
| 411 | GANN Level (Salil Sir) | `gann-level` | Channels & Bands | price | prabhat76 | batch 12 |
| 412 | Gaussian Acceleration Array | `gaussian-acceleration-array` | Momentum | own | NantzOS | batch 36 |
| 413 | Gaussian Filter Trend | `gaussian-filter-trend` | Trend | price | QuantAlgo | batch 2 |
| 414 | Gaussian Ribbon | `gaussian-ribbon` | Moving Averages | price | NantzOS | batch 13 |
| 415 | Gaussian RSI \| NAL | `gaussian-rsi-nal` | Momentum | own | NordicAlphaLab | batch 7 |
| 416 | GBR Micro Kernel Trend | `gbr-micro-kernel-trend` | Moving Averages | price | THEGBR | batch 36 |
| 417 | Gho$t EMA Cloud | `gho-t-ema-cloud` | Moving Averages | price | Ghostmlt | batch 29 |
| 418 | Gideons Gold - ADX Watchman | `gideons-gold-adx-watchman` | Trend | own | gideonsgold | batch 34 |
| 419 | GMMA Oscillator | `gmma-oscillator` | Trend | own |  |  |
| 420 | Gold Trend Signal Indicator | `gold-trend-signal-indicator` | Trend | price | CsmillrSirrry | batch 33 |
| 421 | Golden & Death Cross with Re-Activation | `golden-death-cross-with-re-activation` | Moving Averages | price | oberlunar_tr | batch 26 |
| 422 | Golden Ratio Trend Persistence | `golden-ratio-trend-persistence` | Trend | price | YetAnotherTA | batch 9 |
| 423 | Golden/Death Cross Highlighter | `golden-death-cross-highlighter` | Moving Averages | price | dripvesting | batch 36 |
| 424 | Gorgo's Hybrid Oscillator STrategy | `gorgo-s-hybrid-oscillator-strategy` | Oscillators | own | Gorgomannaro | batch 32 |
| 425 | Gradient Trend Filter | `gradient-trend-filter` | Trend | price | ChartPrime | batch 1 |
| 426 | Granville Entry Guide | `granville-entry-guide` | Moving Averages | price | fightpm | batch 17 |
| 427 | Gravity Well Trend \| Lyro RS | `gravity-well-trend-lyro-rs` | Trend | price | LyroRS | batch 10 |
| 428 | Gridbot Ping Pong | `gridbot-ping-pong` | Channels & Bands | price | xxattaxx | batch 18 |
| 429 | Guppy MMA | `guppy-mma` | Moving Averages | own | AlphaExtract | batch 15 |
| 430 | Guppy Multiple Moving Average | `gmma` | Moving Averages | price | Daryl Guppy |  |
| 431 | Guppy Oscillator-REvans993 | `guppy-oscillator-revans993` | Oscillators | own | REvans993 | batch 36 |
| 432 | Guppy Wave | `guppy-wave` | Moving Averages | price | UkutaLabs | batch 25 |
| 433 | GWAP (Gamma Weighted Average Price) | `gwap` | Moving Averages | price | EdgeTools | batch 18 |
| 434 | H-Infinity Volatility Filter | `h-infinity-volatility-filter` | Trend | price | QuantAlgo | batch 7 |
| 435 | HalfTrend | `half-trend` | Trend | price | everget |  |
| 436 | HaP MACD | `hap-macd` | Momentum | own | agahakanaga | batch 1 |
| 437 | Harmonic Periodicity Matrix | `harmonic-periodicity-matrix` | Oscillators | own | Pineify | batch 29 |
| 438 | Harmonic Sniper Trigger - PyraTime | `harmonic-sniper-trigger-pyratime` | Oscillators | own | PyraTime | batch 27 |
| 439 | HARSI+CBC | `harsi-cbc` | Oscillators | own | mehmetbezgincan | batch 34 |
| 440 | HawkEye Volume | `hawkeye-volume` | Volume | own |  |  |
| 441 | Heatmap Volume | `heatmap-volume` | Volume | own | xdecow |  |
| 442 | Heiken Ashi Ribbon | `heiken-ashi-ribbon` | Trend | price | UkutaLabs | batch 21 |
| 443 | Heikin Ashi Colored Regular OHLC Candles | `heikin-ashi-colored-regular-ohlc-candles` | Candlestick Patterns | price | LuxmiAI | batch 40 |
| 444 | Heikin Ashi Doji with High Volume | `heikin-ashi-doji-with-high-volume` | Candlestick Patterns | price | nwfjf6m8 | batch 42 |
| 445 | Heikin Ashi RSI Oscillator | `heikin-ashi-rsi-oscillator` | Momentum | own | JayRogers |  |
| 446 | Heikin Line - TB365 | `heikin-line-tb365` | Moving Averages | price | tradebot_365 | batch 32 |
| 447 | Heikin-Ashi Reversals with Region & Dots | `heikin-ashi-reversals-with-region-dots` | Candlestick Patterns | price | theRhinoSlayer | batch 42 |
| 448 | HEMA Trend Levels | `hema-trend-levels` | Trend | price | AlgoAlpha |  |
| 449 | Henderson Weighted Moving Average | `henderson-weighted-moving-average` | Moving Averages | price | everget | batch 30 |
| 450 | High For Loop \| MisinkoMaster | `high-for-loop-misinkomaster` | Trend | own | MisinkoMaster | batch 37 |
| 451 | High Volume Arrow Signals (Ajustável) | `high-volume-arrow-signals` | Volume | price | IdeManson | batch 24 |
| 452 | High Volume Buyers/Sellers+ | `high-volume-buyers-sellers` | Volume | price | avitawill | batch 40 |
| 453 | High-Low of X Bar | `high-low-of-x-bar` | Volatility | own | sam-austin | batch 29 |
| 454 | Hilega-Milega-RSI-EMA-WMA indicator designed by NK | `hilega-milega-rsi-ema-wma-indicator-designed-by-nk` | Oscillators | own | kshirsagar_n | batch 14 |
| 455 | Historical Liquidity Proximity Heatmap | `liquidity-proximity-heatmap` | Volume | price | LuxAlgo | batch 3 |
| 456 | HMA Breakdown | `hma-breakdown` | Moving Averages | price | NonLinearRookie | batch 11 |
| 457 | HOTT LOTT | `hott-lott` | Trend | price | KivancOzbilgic |  |
| 458 | HPDR Bands Indicator | `hpdr-bands-indicator` | Channels & Bands | price | afonso_77 | batch 23 |
| 459 | HTC peppermint_07 CCI w signal + s&r RSI | `htc-peppermint-07-cci-w-signal-s-r-rsi` | Oscillators | own | peppermint07 | batch 14 |
| 460 | HTH - WD Gann Square Root Levels | `hth-wd-gann-square-root-levels` | Channels & Bands | price | tamillselvan | batch 27 |
| 461 | Hull Butterfly Oscillator | `hull-butterfly-oscillator` | Momentum | own |  |  |
| 462 | Hull Suite | `hull-suite` | Trend | price |  |  |
| 463 | Hunters Reversal v2.3 | `hunters-reversal-v2-3` | Trend | price | d_jaeger | batch 33 |
| 464 | Hurst-Based Trend Persistence w/Poisson Prediction | `hurst-based-trend-persistence-w-poisson-prediction` | Oscillators | own | garysebastianbrowniii | batch 28 |
| 465 | HyperTrend [LuxAlgo] | `hyper-trend` | Trend | price | LuxAlgo |  |
| 466 | Ichimoku ACE Club | `ichimoku-ace-club` | Trend | price | binhmyco | batch 26 |
| 467 | Ichimoku EMA Bands | `ichimoku-ema-bands` | Channels & Bands | price |  |  |
| 468 | Ichimoku Kinko Hyo | `ichimoku-kinko-hyo` | Trend | price | insideandup | batch 32 |
| 469 | Ichimoku Score Indicator | `ichimoku-score-indicator` | Trend | own | tanayroy | batch 29 |
| 470 | Ichimoku w/Heikin-Ashi | `ichimoku-w-heikin-ashi` | Trend | price | yasujiy | batch 25 |
| 471 | ICT & RTM Price Action Indicator | `ict-rtm-price-action-indicator` | Channels & Bands | price | behradmojtahedi | batch 21 |
| 472 | ICT Concepts | `ict-concepts` | Trend | price | LuxAlgo | most liked |
| 473 | ICT FVG Buy/Sell Signals | `ict-fvg-buy-sell-signals` | Trend | price | svmstellarvisionmedia | batch 5 |
| 474 | ICT Killzones + Pivots | `ict-killzones-pivots-tfo` | Trend | price | tradeforopp | most liked |
| 475 | ICT Killzones Toolkit | `ict-killzones-toolkit` | Trend | price | LuxAlgo | most liked |
| 476 | Ideal Entry Point | `ideal-entry-point` | Trend | price |  |  |
| 477 | IFT Stoch RSI CCI | `ift-stoch-rsi-cci` | Momentum | own | KivancOzbilgic |  |
| 478 | IIR One-Pole Price Filter | `iir-one-pole-price-filter` | Moving Averages | price | BackQuant | batch 9 |
| 479 | Impulse MACD | `impulse-macd` | Momentum | own | LazyBear |  |
| 480 | Indicador Millo SMA20-SMA200-AO-RSI M1 | `indicador-millo-sma20-sma200-ao-rsi-m1` | Moving Averages | price | hernangarcia_78 | batch 19 |
| 481 | Indicator: WaveTrend Oscillator | `wavetrend-oscillator-wt` | Oscillators | own | LazyBear | most liked |
| 482 | Infinite EMA with Alpha Control | `infinite-ema-with-alpha-control` | Moving Averages | price | Sesilya | batch 13 |
| 483 | Inside / Outside Bars | `inside-outside-bars` | Candlestick Patterns | price | Iggy- | batch 42 |
| 484 | Inside Bar (Body-based) Ind/Alert | `inside-bar-ind-alert` | Candlestick Patterns | price | s_b_j | batch 40 |
| 485 | Inside Bar Coloring (Real-time + Historical) w/ Alerts | `inside-bar-coloring-w-alerts` | Candlestick Patterns | price | SpinTrades | batch 42 |
| 486 | Inside Bars (Multiple / Consecutive) | `inside-bars` | Channels & Bands | price | nilstrades_ | batch 5 |
| 487 | Instantaneous Trendline with Cloud | `instantaneous-trendline-with-cloud` | Trend | price | Sesilya | batch 22 |
| 488 | Institutional Composite Moving Average (ICMA) | `institutional-composite-moving-average` | Moving Averages | price | VolumeVigilante | batch 6 |
| 489 | Institutional MACD (Z-Score Edition) | `institutional-macd` | Momentum | own | VolumeVigilante | batch 4 |
| 490 | Institutional Volume RSI | `institutional-volume-rsi` | Momentum | own | abgthecoder | batch 6 |
| 491 | Interpolated Median Volatility LSMA \| Otto | `interpolated-median-volatility-lsma-otto` | Channels & Bands | price | oquant | batch 12 |
| 492 | Intraday BUY_SELL | `intraday-buy-sell` | Trend | price |  |  |
| 493 | Intraday TS BB | `intraday-ts-bb` | Oscillators | price |  |  |
| 494 | Intraday Volume Swings | `intraday-volume-swings` | Volume | price | rumpypumpydumpy |  |
| 495 | Intraday vs Overnight Change Tracker | `intraday-vs-overnight-change-tracker` | Momentum | own | TheUltimator5 | batch 12 |
| 496 | Intraday vs Overnight OBV | `intraday-vs-overnight-obv` | Volume | own | TheUltimator5 | batch 21 |
| 497 | Inverse Distance Weighted Moving Average | `inverse-distance-weighted-moving-average` | Moving Averages | price | everget | batch 15 |
| 498 | IPO Date Screener | `ipo-date-screener` | Oscillators | own | starshiptrade | batch 14 |
| 499 | Is it Time for a Pullback? Check Bars Since MA Test | `is-it-time-for-a-pullback-check-bars-since-ma-test` | Trend | own | TradeStation | batch 25 |
| 500 | Isolated Peak and Bottom | `isolated-peak-bottom` | Oscillators | price |  |  |
| 501 | IU Mean Reversion System | `iu-mean-reversion-system` | Channels & Bands | price | Shivam_Mandrai | batch 12 |
| 502 | IU Smart Flow System | `iu-smart-flow-system` | Trend | price | Shivam_Mandrai | batch 7 |
| 503 | IV Rank (tasty-style) - VIXFix / HV Proxy | `iv-rank-vixfix-hv-proxy` | Volatility | own | steveoptionstrade2025 | batch 30 |
| 504 | John Wick Doji indicator | `john-wick-doji-indicator` | Candlestick Patterns | price | Nossgrr | batch 42 |
| 505 | JOPA Channel (Dual-Volumed) v1 | `jopa-channel-v1` | Channels & Bands | price | JopAlgo | batch 30 |
| 506 | Jurik Moving Average | `jurik-moving-average` | Moving Averages | price | everget | batch 1 |
| 507 | Kalman Ema Crosses | `kalman-ema-crosses` | Moving Averages | price | JTCapitalNL | batch 16 |
| 508 | Kalman Exponentialy Weighted Moving Average \| MisinkoMaster | `kalman-exponentialy-weighted-moving-average-misinkomaster` | Moving Averages | price | MisinkoMaster | batch 25 |
| 509 | Kalman Filter Trend Breakers | `kalman-filter-trend-breakers` | Trend | price | kypexin | batch 29 |
| 510 | Kalman Flow \| Lyro RS | `kalman-flow-lyro-rs` | Trend | price | LyroRS | batch 5 |
| 511 | Kalman Hull Bands For Loop \| RakoQuant | `kalman-hull-bands-for-loop-rakoquant` | Channels & Bands | price | RakoQuant | batch 17 |
| 512 | Kalman Hull Kijun | `kalman-hull-kijun` | Trend | price | BackQuant | batch 12 |
| 513 | Kalman VWAP Filter | `kalman-vwap-filter` | Moving Averages | price | BackQuant | batch 4 |
| 514 | Kaufman Adaptive Moving Average | `kaufman-adaptive-ma` | Moving Averages | price | everget |  |
| 515 | Kaufman Trend Strength Signal | `kaufman-trend-strength-signal` | Trend | price | PakunFX | batch 34 |
| 516 | KD-NewAutoTrade for Future Trading - Heikin Ashi candles | `kd-newautotrade-for-future-trading-heikin-ashi-candles` | Trend | price | krish16887 | batch 22 |
| 517 | KDJ | `kdj` | Oscillators | own | KingThies |  |
| 518 | Keltner-Aroon-EFI Flow | `keltner-aroon-efi-flow` | Trend | price | D_QUANT | batch 20 |
| 519 | Kernel Channel | `kernel-channel` | Channels & Bands | price | BackQuant | batch 6 |
| 520 | KERPD Noise Filter - Kaufman Efficiency Ratio and Price Density | `kerpd-noise-filter-kaufman-efficiency-ratio-and-price-density` | Volatility | own | SensitiveSuit | batch 15 |
| 521 | Key_TDI | `key-tdi` | Oscillators | own | Fibonacci_Code | batch 31 |
| 522 | Keyzone | `keyzone` | Channels & Bands | price | Uttaya | batch 28 |
| 523 | Kijun-Sen with Buy / Sell Labels & Alerts - Ichimoku simplified | `kijun-sen-with-buy-sell-labels-alerts-ichimoku-simplified` | Trend | price | TaureaYinYang | batch 36 |
| 524 | Kinetic Slippage Index (KSI) | `kinetic-slippage-index` | Volume | own | HPotter | batch 7 |
| 525 | Kiss Of Death | `kiss-of-death` | Trend | price | thanos300693 | batch 37 |
| 526 | L1 Moving Average Fingerprint for Long Entry | `l1-moving-average-fingerprint-for-long-entry` | Trend | price | blackcat1402 | batch 40 |
| 527 | L2 Risk Assessment for Trend Strength | `l2-risk-assessment-for-trend-strength` | Trend | own | blackcat1402 | batch 14 |
| 528 | Ladder StDev | `ladder-stdev` | Volatility | own | jason5480 | batch 30 |
| 529 | Laguerre Filter | `laguerre-filter` | Moving Averages | price | BackQuant | batch 5 |
| 530 | Laguerre RSI | `laguerre-rsi` | Momentum | own | TheLark |  |
| 531 | Laguerre Ultimate Explorations Multicator | `laguerre-ultimate-explorations-multicator` | Moving Averages | own | ImmortalFreedom | batch 20 |
| 532 | Laguerre-Kalman Adaptive Filter \| AlphaNatt | `laguerre-kalman-adaptive-filter-alphanatt` | Moving Averages | price | AlphaNatt | batch 11 |
| 533 | Left Bars | `pivot-hh-hl-lh-ll` | Trend | price |  |  |
| 534 | Leledc Levels | `leledc-levels` | Candlestick Patterns | price |  |  |
| 535 | Length | `gaussian-channel` | Channels & Bands | price |  |  |
| 536 | Length | `redk-vader` | Oscillators | own | RedKTrader |  |
| 537 | Length | `zlma-trend-levels` | Moving Averages | price |  |  |
| 538 | Level2 Signalfilter Liquidity Protection | `level2-signalfilter-liquidity-protection` | Trend | own | djmad | batch 16 |
| 539 | Leveraged Liquidation Zones | `leveraged-liquidation-zones` | Channels & Bands | price | Fussion_Trader | batch 35 |
| 540 | LGMM (flat buffers) - multivariate poly + latent states | `lgmm-multivariate-poly-latent-states` | Channels & Bands | price | vsov | batch 28 |
| 541 | Linear Predictive Filters (TASC 2025.01) | `linear-predictive-filters` | Oscillators | own | PineCodersTASC | batch 2 |
| 542 | Linear Regression Blend Candles | `linear-regression-blend-candles` | Candlestick Patterns | price | B3AR_Trades | batch 39 |
| 543 | Linear Regression Candles | `linear-regression-candles` | Candlestick Patterns | price |  |  |
| 544 | Linear Regression Channel | `linear-regression-channel` | Channels & Bands | price |  |  |
| 545 | Linear Regression Volume \| Lyro RS | `linear-regression-volume-lyro-rs` | Channels & Bands | price | LyroRS | batch 10 |
| 546 | Linear Volume MACD \| Lyro RS | `linear-volume-macd-lyro-rs` | Momentum | own | LyroRS | batch 9 |
| 547 | LineReg Candles with Hma filter | `linereg-candles-with-hma-filter` | Trend | price | MaximusGains | batch 14 |
| 548 | Liquidity Flow Zones (LFZ) | `liquidity-flow-zones` | Trend | price | ReubenMiles | batch 20 |
| 549 | Liquidity Grabs | `liquidity-grabs` | Trend | price | fluxchart |  |
| 550 | Liquidity Indicator | `liquidity-indicator` | Channels & Bands | price | The_Forex_Steward | batch 22 |
| 551 | Liquidity Levels [LuxAlgo] | `liquidity-levels` | Trend | price | LuxAlgo |  |
| 552 | Liquidity Pools | `liquidity-pools` | Trend | price | LuxAlgo | most liked |
| 553 | Liquidity Sentiment Profile \| LUPEN | `liquidity-sentiment-profile-lupen` | Volume | own | Horazio | batch 20 |
| 554 | Liquidity Sweep Confirmation | `liquidity-sweep-confirmation` | Trend | price | filipiti | batch 38 |
| 555 | Liquidity Sweeps [LuxAlgo] | `liquidity-sweeps` | Trend | price |  |  |
| 556 | Liquidity Swings | `liquidity-swings` | Volume | price | LuxAlgo | most liked |
| 557 | Liquidity Trap & Reversal bot | `liquidity-trap-reversal-bot` | Channels & Bands | price | pointalgo | batch 28 |
| 558 | Loacally Weighted MA (LWMA) Direction Histogram | `loacally-weighted-ma-direction-histogram` | Trend | own | LuxmiAI | batch 9 |
| 559 | Logit RSI | `logit-rsi` | Oscillators | own | AdaptiveRSI | batch 11 |
| 560 | Long Short dom | `long-short-dom` | Trend | own | Robin-Hood-trading | batch 11 |
| 561 | Lorentzian Length Adaptive Moving Average | `lorentzian-length-adaptive-moving-average` | Moving Averages | price | Starcruiser | batch 21 |
| 562 | Lumina Trend Channels | `lumina-trend-channels` | Channels & Bands | price | Pineify | batch 10 |
| 563 | Luminous Mean Reversion Channels | `luminous-mean-reversion-channels` | Channels & Bands | price | Pineify | batch 7 |
| 564 | Lunar Phase (LUNAR) | `lunar-phase` | Oscillators | own | mihakralj | batch 23 |
| 565 | MA Cross with Displacement | `ma-cross-with-displacement` | Moving Averages | price | TehThomas | batch 25 |
| 566 | MA Ribbon 5EMA \| 20EMA \| 50SMA \| 200EMA | `ma-ribbon-5ema-20ema-50sma-200ema` | Moving Averages | price | vamsinelluri7 | batch 29 |
| 567 | MA Shaded Fill Crossover | `ma-shaded-fill` | Moving Averages | price |  |  |
| 568 | MA Strategy Emperor | `ma-strategy-emperor` | Trend | price | insiliconot |  |
| 569 | MA Type | `madrid-ma-ribbon` | Moving Averages | price |  |  |
| 570 | MA Zones | `ma-zones` | Moving Averages | price | ZenAndTheArtOfTrading | batch 7 |
| 571 | MACD (Buy & Sell signals) | `macd-irtov` | Momentum | own | irtov | batch 24 |
| 572 | Macd + Adx Pro by @Eternyworld | `macd-adx-pro-by-eternyworld` | Momentum | own | ETERNYWORLD | batch 26 |
| 573 | MACD 4C | `macd-4c` | Momentum | own | vkno422 |  |
| 574 | MACD Crossover | `macd-crossover` | Momentum | own |  |  |
| 575 | MacD Custom Indicator-Multiple Time Frame+All Available Options! | `cm-macd-custom-mtf` | Momentum | own | ChrisMoody | most liked |
| 576 | MACD DEMA | `macd-dema` | Momentum | own |  |  |
| 577 | MACD Divergence | `macd-divergence` | Momentum | own |  |  |
| 578 | MACD Dynamic Squeeze Pro | `macd-dynamic-squeeze-pro` | Momentum | own | ZynAlgo | batch 24 |
| 579 | MACD Leader | `macd-leader` | Momentum | own | LazyBear |  |
| 580 | MACD Liquidity Tracker System | `macd-liquidity-tracker-system` | Momentum | own | PROFABIGHI_CAPITAL | batch 29 |
| 581 | MACD Overlay v1 | `macd-overlay-v1` | Momentum | price | JopAlgo | batch 5 |
| 582 | MACD Pro | `macd-pro` | Momentum | own | VEGAlgo | batch 23 |
| 583 | MACD Pseudo Super Smoother | `macd-pseudo-super-smoother` | Oscillators | own | The_Peaceful_Lizard | batch 37 |
| 584 | MACD ReLoaded | `macd-reloaded` | Momentum | own | KivancOzbilgic |  |
| 585 | MACD Sniper | `macd-sniper` | Momentum | own | trade_lexx | batch 15 |
| 586 | MACD Support and Resistance [ChartPrime] | `macd-support-resistance` | Momentum | own | ChartPrime |  |
| 587 | MACD VXI | `macd-vxi` | Momentum | own |  |  |
| 588 | MACD With Crossings and Above Below Zero | `macd-with-crossings-and-above-below-zero` | Momentum | own | Kgroomes | batch 18 |
| 589 | MACD x BB x STDEV x RVI | `macd-x-bb-x-stdev-x-rvi` | Oscillators | own | Vaquant | batch 20 |
| 590 | MACD XD | `macd-xd` | Momentum | own | Zen_Formless | batch 8 |
| 591 | MACD-V (Volatility Normalized MACD) | `macd-v` | Momentum | own | KivancOzbilgic | batch 2 |
| 592 | MACD-V with Volatility Normalisation | `macd-v-with-volatility-normalisation` | Momentum | own | DutchCryptoDad | batch 25 |
| 593 | MACD1 Fast | `double-macd` | Momentum | own |  |  |
| 594 | MACDAS | `macdas` | Momentum | own |  |  |
| 595 | Machine Learning: kNN Trend Predictor | `machine-learning-knn-trend-predictor` | Trend | price | tkarolak | batch 11 |
| 596 | Machine Learning: Lorentzian Classification | `lorentzian-classification` | Trend | price | jdehorty | most liked |
| 597 | MAD Trend Detector ~ C H I P A | `mad-trend-detector-c-h-i-p-a` | Trend | own | C_H_I_P_A | batch 36 |
| 598 | Madrid Trend Squeeze | `madrid-trend-squeeze` | Momentum | own |  |  |
| 599 | MADZ - Moving Average Deviation Z-Score | `madz-moving-average-deviation-z-score` | Oscillators | own | MiesOnCharts | batch 32 |
| 600 | Magnet Force + RSI Filter V6 | `magnet-force-rsi-filter-v6` | Channels & Bands | price | mehmetbezgincan | batch 31 |
| 601 | Maket Strat Absorption Bubbles | `maket-strat-absorption-bubbles` | Volume | price | samb817 | batch 41 |
| 602 | MAMA - FAMA (Ehlers) | `mama-fama` | Moving Averages | price | KatherinaNote | batch 31 |
| 603 | Manipulation Candle | `manipulation-candle` | Candlestick Patterns | price | DrauzioFx | batch 39 |
| 604 | Mark Minervini Buy Signal | `mark-minervini-buy-signal` | Trend | price | Dr_Leong_Yee_Rock | batch 18 |
| 605 | Market Cipher A | `market-cipher-a` | Oscillators | price |  |  |
| 606 | Market Cipher B | `market-cipher-b` | Oscillators | own |  |  |
| 607 | Market Participation Ratio-MPR | `market-participation-ratio-mpr` | Volume | own | TechnoBlooms | batch 37 |
| 608 | Market Pressure Oscillator | `market-pressure-oscillator` | Oscillators | own | Uncle_the_shooter | batch 8 |
| 609 | Market Pulse Pro | `market-pulse-pro` | Oscillators | own | Canhoto-Medium | batch 32 |
| 610 | Market sessions and Volume profile - By Leviathan | `market-sessions-volume-profile` | Volume | price | LeviathanCapital | most liked |
| 611 | Market Shift Levels | `market-shift-levels` | Trend | price |  |  |
| 612 | Market Structure Break & Order Block by EmreKb | `market-structure-break-order-block` | Trend | price | EmreKb | most liked |
| 613 | Market Structure Trailing Stop | `market-structure-trailing-stop` | Trend | price | LuxAlgo |  |
| 614 | Market Structure Trend | `market-structure-trend` | Trend | price | QuantAlgo | batch 12 |
| 615 | Martell MNQ Quantum Scalper Pro | `martell-mnq-quantum-scalper-pro` | Trend | price | JMartell | batch 31 |
| 616 | Marubozu Detector | `marubozu-detector` | Candlestick Patterns | price | toppermost | batch 38 |
| 617 | Matrix Series | `matrix-series` | Oscillators | own |  |  |
| 618 | MavilimW | `mavilimw` | Trend | price | KivancOzbilgic |  |
| 619 | Mean Angles | `mean-angles` | Momentum | own | bharatTrader | batch 9 |
| 620 | Measured Pattern Move (Bulkowski) | `measured-pattern-move` | Trend | price | Steversteves | batch 28 |
| 621 | MechArt Moving Average and % Above V1.1 | `mechart-moving-average-and-above-v1-1` | Moving Averages | price | MechArt_ | batch 29 |
| 622 | Median ATR SD Oscillator | `median-atr-sd-oscillator` | Volatility | own | Unknownhodler | batch 37 |
| 623 | Median Gaussian Trend \| NAL | `median-gaussian-trend-nal` | Trend | price | NordicAlphaLab | batch 15 |
| 624 | Median MACD - Mattes | `median-macd-mattes` | Momentum | own | Mattes00 | batch 8 |
| 625 | Median Volume Weighted Deviation | `median-volume-weighted-deviation` | Volume | price | Burggg | batch 30 |
| 626 | MESA Adaptive Ehlers Flow \| AlphaNatt | `mesa-adaptive-ehlers-flow` | Moving Averages | price | AlphaNatt | batch 8 |
| 627 | MESA Phase-Adaptive Band Trend | `mesa-phase-adaptive-band-trend` | Trend | price | SchizoQuant | batch 22 |
| 628 | MFI + RSI + EMA Dynamic Signals | `mfi-rsi-ema-dynamic-signals` | Momentum | price | Raisontgh | batch 37 |
| 629 | MFI Nexus Pro | `mfi-nexus-pro` | Volume | own | trade_lexx | batch 10 |
| 630 | MFI/RSI Bollinger Bands | `mfi-rsi-bb` | Oscillators | own |  |  |
| 631 | Mid-term Ribbon | `mid-term-ribbon` | Moving Averages | price | Gartav388637 | batch 25 |
| 632 | Minervini Trend Template Screener (v5) | `minervini-trend-template-screener` | Trend | price | hibinomasakazu1991 | batch 41 |
| 633 | Minimalist Doji Highlighter | `minimalist-doji-highlighter` | Candlestick Patterns | price | SensitiveSuit | batch 40 |
| 634 | ML Adaptive SuperTrend | `ml-adaptive-supertrend` | Trend | price |  |  |
| 635 | ML Deep Regression Pro | `ml-deep-regression-pro` | Trend | price | TechnoBlooms | batch 29 |
| 636 | ML Momentum Index | `ml-momentum-index` | Momentum | own |  |  |
| 637 | ML Moving Average | `ml-moving-average` | Moving Averages | price |  |  |
| 638 | ML RSI | `ml-rsi` | Momentum | own |  |  |
| 639 | ML: kNN Strategy | `ml-knn-strategy` | Momentum | own |  |  |
| 640 | Modified Heikin-Ashi | `modified-heikin-ashi` | Candlestick Patterns | price | ChrisMoody |  |
| 641 | Momentum-based ZigZag | `momentum-zigzag` | Trend | price | Peter_O |  |
| 642 | Money Flow Extended | `money-flow-extended` | Volume | own | alexrainman | batch 6 |
| 643 | Money Flow Pulse | `money-flow-pulse` | Volume | own | TheLeadingIndicator | batch 35 |
| 644 | Moneyball EMA-MACD indicator | `moneyball-ema-macd-indicator` | Momentum | own | VinnieTheFish | batch 6 |
| 645 | Monotonic Trend Consensus | `monotonic-trend-consensus` | Trend | own | QuantAlgo | batch 16 |
| 646 | Moving Average ADX | `ma-adx` | Moving Averages | price |  |  |
| 647 | Moving Average Candles | `moving-average-candles` | Moving Averages | price | aleskxyz | batch 41 |
| 648 | Moving Average Colored | `ma-colored` | Moving Averages | price |  |  |
| 649 | Moving Average Converging | `ma-converging` | Moving Averages | price | LuxAlgo |  |
| 650 | Moving Average Cross Alert, Multi-Timeframe (MTF) (by ChartArt) | `ma-cross-alert-mtf` | Moving Averages | price | ChartArt | most liked |
| 651 | Moving Average Crossover with Shading Signals | `moving-average-crossover-with-shading-signals` | Moving Averages | price | Decam9 | batch 12 |
| 652 | Moving Average Deviation Rate | `ma-deviation-rate` | Moving Averages | own |  |  |
| 653 | Moving Average Percentage Difference | `moving-average-percentage-difference` | Moving Averages | own | GapLogic | batch 37 |
| 654 | Moving Average Shift | `ma-shift` | Moving Averages | price |  |  |
| 655 | Moving Average Trend Meter | `moving-average-trend-meter` | Trend | own | UkutaLabs | batch 39 |
| 656 | Moving Averages With Continuous Periods | `moving-averages-with-continuous-periods` | Moving Averages | price | The_Peaceful_Lizard | batch 15 |
| 657 | Moving Volume-Weighted Avg Price, % Channel, BBs | `moving-volume-weighted-avg-price-channel-bbs` | Channels & Bands | price | NeanderTraderBC | batch 37 |
| 658 | Moving VWAP-KAMA Cloud | `moving-vwap-kama-cloud` | Moving Averages | price | SovereignCharts | batch 12 |
| 659 | MPO4 Lines – Modal Engine | `mpo4-lines-modal-engine` | Oscillators | own | Uncle_the_shooter | batch 15 |
| 660 | mr.crypto731 | `mr-crypto731` | Momentum | own | Ali_Smith | batch 20 |
| 661 | MSL Squeeze Pulse | `msl-squeeze-pulse` | Volatility | own | MarketStructureLab | batch 16 |
| 662 | Multi-Band Trend Line | `multi-band-trend-line` | Trend | price | Mr_Rakun | batch 4 |
| 663 | Multi-Oscillator Adaptive Kernel \| AlphaAlgos | `multi-oscillator-adaptive-kernel-alphaalgos` | Oscillators | own | AlphaNatt | batch 4 |
| 664 | Multiple Divergences | `multiple-divergences` | Momentum | price | PeterO |  |
| 665 | Multiple Exponential Fibnonacci Moving Averages | `multiple-exponential-fibnonacci-moving-averages` | Moving Averages | price | LensOfChartist | batch 13 |
| 666 | Multiple Moving Averages | `multiple-ma` | Moving Averages | price |  |  |
| 667 | Multiple RSI | `multiple-rsi` | Oscillators | own | PrasadJoshi12 | batch 19 |
| 668 | MurreysOscillator | `murreys-math-osc` | Oscillators | own |  |  |
| 669 | Muses afl script | `muses-afl-script` | Trend | price | mostafa47ab (indicator title "L1 Filter Sig") | batch 31 |
| 670 | Mushir's Inside Candle Indicator | `mushir-s-inside-candle-indicator` | Candlestick Patterns | price | mushirinamdar | batch 42 |
| 671 | My auto dual avwap with Auto swing low/pivot low finder | `my-auto-dual-avwap-with-auto-swing-low-pivot-low-finder` | Volume | price | doqkhanh | batch 22 |
| 672 | N Order EMA | `n-order-ema` | Moving Averages | price | The_Peaceful_Lizard | batch 35 |
| 673 | Nadaraya-Watson Envelope | `nadaraya-watson-envelope` | Channels & Bands | price | LuxAlgo | most liked |
| 674 | Nadaraya-Watson Trend | `nadaraya-watson-trend` | Trend | price | QuantAlgo | batch 1 |
| 675 | Navier-Cauchy Market Elasticity | `navier-cauchy-market-elasticity` | Oscillators | own | PhenLabs | batch 30 |
| 676 | Neighboring Price Bands | `neighboring-price-bands` | Channels & Bands | price | LuxAlgo | batch 21 |
| 677 | Nexus Sentiment & Risk Matrix | `nexus-sentiment-risk-matrix` | Oscillators | own | Pineify | batch 37 |
| 678 | NLMS Volatility Trail | `nlms-volatility-trail` | Trend | price | BackQuant | batch 4 |
| 679 | No wick candles | `no-wick-candles` | Candlestick Patterns | price | KORD_ | batch 39 |
| 680 | Normalized Candles RSI | `normalized-candles-rsi` | Oscillators | own | Jamallo22 | batch 32 |
| 681 | Normalized QQE | `normalized-qqe` | Oscillators | own |  |  |
| 682 | Normalized SPMA \| NAL | `normalized-spma-nal` | Oscillators | own | NordicAlphaLab | batch 30 |
| 683 | Normalized Volume & True Range | `normalized-volume-true-range` | Volume | own | The_Peaceful_Lizard | batch 36 |
| 684 | Nova Flow Lite (Free) | `nova-flow-lite` | Trend | price | NovaQuantX | batch 36 |
| 685 | Nova Statistical Filtering Oscillator | `nova-statistical-filtering-oscillator` | Oscillators | own | Pineify | batch 27 |
| 686 | NY ORB + Fakeout Detector | `ny-orb-fakeout-detector` | Channels & Bands | price | STEFANGAS | batch 27 |
| 687 | OA - SMES | `oa-smes` | Oscillators | own | onurag | batch 4 |
| 688 | OBV & AD Oscillators with Dual Smoothing Options | `obv-ad-oscillators-with-dual-smoothing-options` | Volume | own | hollowwick (indicator title "OBV, AD, VPT & CDV | batch 27 |
| 689 | OBV (Delta or regular) | `obv-gizmo` | Volume | own | GizmoTheInvestor | batch 37 |
| 690 | OBV + Custom MA Strategy | `obv-custom-ma-strategy` | Volume | own | Rafiki-is-Trading | batch 14 |
| 691 | OBV MACD | `obv-macd` | Volume | own |  |  |
| 692 | OBV Oscillator | `obv-oscillator` | Volume | own |  |  |
| 693 | OBVX Conviction Bias | `obvx-conviction-bias` | Volume | own | TheLeadingIndicator | batch 31 |
| 694 | Opal | `opal` | Channels & Bands | price | FlyingSeaHorse | batch 36 |
| 695 | Open Close Cross | `open-close-cross` | Momentum | own | JustUncleL |  |
| 696 | Opening Range with Breakouts & Targets | `opening-range-breakouts-targets` | Trend | price | LuxAlgo | most liked |
| 697 | Optimized Trend Tracker | `optimized-trend-tracker` | Trend | price | KivancOzbilgic |  |
| 698 | Order Block Detector | `order-block-detector` | Trend | price | LuxAlgo | most liked |
| 699 | Order Block Finder (Experimental) | `order-block-finder` | Trend | price | wugamlo | most liked |
| 700 | Order Blocks & Breaker Blocks | `order-blocks-breaker-blocks` | Trend | price | LuxAlgo | most liked |
| 701 | Order Blocks with Signals | `order-blocks-signals` | Trend | price | ClayeWeight |  |
| 702 | Order Blocks \| Flux Charts | `order-blocks-flux-charts` | Volume | price | fluxchart | most liked |
| 703 | Order Flow Imbalance Oscillator | `order-flow-imbalance-oscillator` | Volume | own | StrikePriceLabs | batch 33 |
| 704 | Oscillator Matrix | `oscillator-matrix` | Oscillators | own | AlphaExtract | batch 6 |
| 705 | PAFT | `paft` | Momentum | own | TREESinvest | batch 30 |
| 706 | Parabolic Stoch SAR Visualizer | `parabolic-stoch-sar-visualizer` | Oscillators | own | BOSWaves | batch 24 |
| 707 | Parallel Pivot Lines | `parallel-pivot-lines` | Channels & Bands | price | LuxAlgo |  |
| 708 | Pay Attention Candle | `pay-attention-candle` | Candlestick Patterns | price | asenski (inspired by the RexDog Trading System) | batch 41 |
| 709 | PCR Market Regime Indicator | `pcr-market-regime-indicator` | Momentum | own | Aleksin_Aleksandar | batch 31 |
| 710 | Peak Reversal v2 | `peak-reversal-v2` | Channels & Bands | price | Zettt | batch 11 |
| 711 | Peak Reversal v3 | `peak-reversal-v3` | Channels & Bands | price | Zettt | batch 21 |
| 712 | Percent Off All-time High (% Off High) | `percent-off-all-time-high` | Oscillators | own | xHmmmmm | batch 19 |
| 713 | Percentile Rank Oscillator (Price + VWMA) | `percentile-rank-oscillator` | Oscillators | own | exploretranspose | batch 26 |
| 714 | Percentile-Based BB% Trend - Mattes | `percentile-based-bb-trend-mattes` | Oscillators | own | Mattes00 | batch 7 |
| 715 | Perfect Hammer Pattern Indicators and Alerts | `perfect-hammer-pattern-indicators-and-alerts` | Candlestick Patterns | price | girishptryambakee | batch 40 |
| 716 | Perfect RSI | `perfect-rsi` | Oscillators | own | HabibiBudo | batch 26 |
| 717 | Perforance integral | `perforance-integral` | Momentum | own | Majimbi | batch 37 |
| 718 | Philakone 55 EMA Swing Trading | `philakone-ema-swing` | Moving Averages | price |  |  |
| 719 | Pipstocrat Market Participant Analysis | `pipstocrat-market-participant-analysis` | Momentum | own | Delast2 | batch 23 |
| 720 | Pivot Based Trailing Maxima & Minima | `pivot-trailing-maxmin` | Channels & Bands | price | LuxAlgo |  |
| 721 | Pivot Breakout High&Low Signals | `pivot-breakout-high-low-signals` | Trend | price | Jos-ProTrader | batch 3 |
| 722 | Pivot Breakout with Trend Zones | `pivot-breakout-with-trend-zones` | Trend | price | dreamaker7 | batch 33 |
| 723 | Pivot Market Structure | `pivot-market-structure` | Trend | price | Daniel_Ge | batch 11 |
| 724 | Pivot Oscillator | `pivot-oscillator` | Oscillators | own | Uncle_the_shooter | batch 3 |
| 725 | Pivot Point SuperTrend | `pivot-point-supertrend` | Trend | price | LonesomeTheBlue |  |
| 726 | Pivot Points High Low & Missed Reversal Levels | `pivot-points-high-low-missed-reversal` | Trend | price | LuxAlgo | most liked |
| 727 | Pivot Trend | `pivot-trend` | Trend | price | ChartPrime | batch 1 |
| 728 | POC Volume Bar (Highest Volume in Range) | `poc-volume-bar` | Volume | own | greatbrownball | batch 28 |
| 729 | Pocket Pivot Breakout | `pocket-pivot-breakout` | Volume | price | simatricks | batch 38 |
| 730 | PolyFilter | `polyfilter` | Moving Averages | price | BackQuant | batch 8 |
| 731 | Polynomial Regression Moving Average (PRMA) | `polynomial-regression-moving-average` | Moving Averages | price | ZakAlgoTrade | batch 24 |
| 732 | Polynomial Trend Exhaustion & Divergence | `polynomial-trend-exhaustion-divergence` | Trend | price | B3AR_Trades | batch 40 |
| 733 | Polyphase MACD (PMACD) | `polyphase-macd` | Momentum | own | The_Peaceful_Lizard | batch 19 |
| 734 | PPO Alerts | `ppo-alerts` | Momentum | own |  |  |
| 735 | PPO Divergence | `ppo-divergence` | Momentum | own | Pekipek |  |
| 736 | Predictive Channels | `predictive-channels` | Channels & Bands | price | LuxAlgo |  |
| 737 | Premier RSI Oscillator | `premier-rsi` | Momentum | own |  |  |
| 738 | Premier Stochastic Oscillator | `premier-stochastic` | Oscillators | own |  |  |
| 739 | PREMIUM TRADE ZONES | `premium-trade-zones` | Oscillators | own | ENTRYLAB | batch 27 |
| 740 | Price & Volume Profile (Expo) | `price-volume-profile` | Volume | price | Zeiierman (community) |  |
| 741 | Price Acceleration Indicator (PAI) | `price-acceleration-indicator` | Momentum | own | PHICAPITALINVESTMENTS | batch 35 |
| 742 | Price Action Bands \| Trend & Volatility | `price-action-bands-trend-volatility` | Channels & Bands | price | RadixAlgo | batch 15 |
| 743 | Price Action Breakout Trend | `price-action-breakout-trend` | Trend | price | QuantAlgo | batch 5 |
| 744 | Price Action Signals Filtered +EMA | `price-action-signals-filtered-ema` | Trend | price | Aleksin_Aleksandar | batch 11 |
| 745 | Price Action Smart Money Concepts | `price-action-smart-money-concepts` | Trend | price | BigBeluga | most liked |
| 746 | Price Action Trading System | `price-action-system` | Oscillators | price |  |  |
| 747 | Price Action: Engulfing Patterns | `price-action-engulfing-patterns` | Candlestick Patterns | price | Jay9286 | batch 33 |
| 748 | Price Advance & Decline Range Analysis | `price-advance-decline-range-analysis` | Volatility | own | RicardoSantos | batch 16 |
| 749 | Price Change Sentiment Index | `price-change-sentiment-index` | Oscillators | own | TradeVizion | batch 23 |
| 750 | Price Contraction / Expansion | `price-contraction-expansion` | Volatility | price | destrobr0685 | batch 42 |
| 751 | Price Divergence Detector | `price-divergence-detector` | Momentum | price | JustUncleL |  |
| 752 | Price Flow - Buy Sell | `price-flow-buy-sell` | Channels & Bands | price | IVTrader1990 | batch 35 |
| 753 | Price Linear Sequence Counter | `price-linear-sequence-counter` | Momentum | own | RicardoSantos | batch 14 |
| 754 | Price Momentum Oscillator | `price-momentum-oscillator` | Momentum | own |  |  |
| 755 | Price/Volume Value Histogram | `price-volume-value-histogram` | Volume | own | dman103 | batch 2 |
| 756 | Primitive Delta Divergence | `primitive-delta-divergence` | Volume | price | bfoster238 | batch 41 |
| 757 | Pring Special K\|a2m | `pring-special-k-a2m` | Momentum | own | ask2maniish | batch 34 |
| 758 | Prism Moving Average Trend | `prism-moving-average-trend` | Trend | price | MisinkoMaster | batch 19 |
| 759 | Pro Scalper - 2 MinutesTF by Ayoob | `pro-scalper-2-minutestf-by-ayoob` | Trend | price | FGMNDFBF | batch 30 |
| 760 | Probabilities Module - The Quant Science | `probabilities-module-the-quant-science` | Oscillators | own | thequantscience | batch 31 |
| 761 | Projected Crossover Trend | `projected-crossover-trend` | Trend | price | SchizoQuant | batch 4 |
| 762 | Prometheus Topological Persistent Entropy | `prometheus-topological-persistent-entropy` | Volatility | own | ScorsoneEnterprises | batch 23 |
| 763 | Pullback SAR | `pullback-sar` | Trend | price | szymonsobkowiak | batch 32 |
| 764 | Pullback Scalp Trade V2 | `pullback-scalp-trade-v2` | Trend | price | Sinyalbak_App | batch 12 |
| 765 | Pulse Range | `pulse-range` | Trend | price | MarketStructureLab | batch 13 |
| 766 | Pulse RSI \| Lyro RS | `pulse-rsi-lyro-rs` | Oscillators | own | LyroRS | batch 10 |
| 767 | PulseWave + Divergence | `pulsewave-divergence` | Oscillators | own | Uncle_the_shooter | batch 7 |
| 768 | Pump & Dump Detector (sensitive) | `pump-dump-detector` | Volume | price | btcpayer | batch 39 |
| 769 | Pure Coca | `pure-coca` | Oscillators | own | La_Von | batch 7 |
| 770 | Q Impulse Entry | `q-impulse-entry` | Trend | price | Quantora | batch 17 |
| 771 | Q KAMA Clarity Trend | `q-kama-clarity-trend` | Trend | price | Quantora | batch 7 |
| 772 | Q Wave | `q-wave` | Trend | price | Quantora | batch 36 |
| 773 | QG-Particle Oscillator | `qg-particle-oscillator` | Oscillators | own | QuantG | batch 35 |
| 774 | QQE Cross | `qqe-cross` | Trend | price | JustUncleL |  |
| 775 | QQE MOD | `qqe-mod` | Momentum | own |  |  |
| 776 | QQE Signals | `qqe-signals` | Oscillators | price | colinmck |  |
| 777 | QTechLabs Machine Learning Logistic Regression Indicator | `qtechlabs-machine-learning-logistic-regression-indicator` | Oscillators | price | QTechLabsInfo | batch 33 |
| 778 | Quant VWAP System 3.8 | `quant-vwap-system-3-8` | Oscillators | own | CustomQuantLabs (published as "Quant VWAP System 3.8") | batch 8 |
| 779 | Quantile Regression Bands | `quantile-regression-bands` | Channels & Bands | price | BackQuant | batch 17 |
| 780 | Quantitative Qualitative Estimation | `qqe` | Oscillators | own | Glaz |  |
| 781 | Quantum Regression Oscillator | `quantum-regression-oscillator` | Oscillators | own | abgthecoder | batch 32 |
| 782 | Quantum Trend Signal | `quantum-trend-signal` | Trend | price | ReubenMiles | batch 9 |
| 783 | QuantumTrend SwiftEdge | `quantumtrend-swiftedge` | Trend | price | SwiftEdge | batch 5 |
| 784 | Quartile For Loop | `quartile-for-loop` | Trend | own | SeerQuant | batch 6 |
| 785 | Quasimodo Pattern | `quasimodo-pattern` | Candlestick Patterns | price | anodrr2 | batch 41 |
| 786 | Radiant Mean Reversion Channels | `radiant-mean-reversion-channels` | Oscillators | own | Pineify | batch 34 |
| 787 | Radius Trend [ChartPrime] | `radius-trend` | Trend | price | ChartPrime |  |
| 788 | Rally Base Drop Signals | `rally-base-drop-signals` | Trend | price | LuxAlgo | batch 38 |
| 789 | Range Channel by Atilla Yurtseven | `range-channel-by-atilla-yurtseven` | Channels & Bands | own | AtillaYurtseven | batch 17 |
| 790 | Range Detector | `range-detector` | Trend | price | LuxAlgo |  |
| 791 | Range Identifier | `range-identifier` | Channels & Bands | price |  |  |
| 792 | Range Oscillator | `range-oscillator` | Oscillators | own | Zeiierman | batch 1 |
| 793 | Range Tightening Indicator (RTI) | `range-tightening-indicator` | Volatility | own | Ollie_AllCaps | batch 2 |
| 794 | Rapid Exponential Moving Average | `rapid-exponential-moving-average` | Moving Averages | price | ImmortalFreedom | batch 28 |
| 795 | RBT strategy | `rbt-strategy` | Momentum | price | luckykoshti | batch 38 |
| 796 | RCI 3 Lines | `rci-3lines` | Oscillators | own |  |  |
| 797 | RCYC Bullish Bearish Indicator | `rcyc-bullish-bearish-indicator` | Momentum | price | bizarro29 | batch 38 |
| 798 | ReadyFor401ks Just Tell Me When! | `readyfor401ks-just-tell-me-when` | Trend | price | ReadyFor401k | batch 20 |
| 799 | Real-Time Big Trades Bubbles & Absorbtions & Deep Pressure | `big-trades-bubbles` | Volume | price | samet_lezki | batch 5 |
| 800 | Realtime Volume Bars | `realtime-volume-bars` | Volume | own | the_MarketWhisperer |  |
| 801 | RedK EVEREX | `redk-everex` | Momentum | own | RedKTrader |  |
| 802 | RedK Magic Ribbon | `redk-magic-ribbon` | Moving Averages | price | RedKTrader | batch 2 |
| 803 | RedK Momentum Bars | `redk-momentum-bars` | Momentum | own | RedKTrader |  |
| 804 | RedK RSS_WMA | `redk-rss-wma` | Moving Averages | price | RedKTrader |  |
| 805 | RedK Trader Pressure Index | `redk-tpx` | Momentum | own | RedKTrader |  |
| 806 | RedK Vol_Weighted RSI: Extending the power of the classic RSI | `redk-vol-weighted-rsi` | Momentum | own | RedKTrader | batch 5 |
| 807 | Reflex & Trendflex | `reflex-trendflex` | Oscillators | own | e2e4 | batch 6 |
| 808 | Regression Channel Oscillator | `regression-channel-oscillator` | Oscillators | own | Uncle_the_shooter | batch 27 |
| 809 | Relative ATR Volatility Indicator | `relative-atr-volatility-indicator` | Volatility | own | ZenAndTheArtOfTrading | batch 20 |
| 810 | Relative Strength Heatmap | `relative-strength-heatmap` | Momentum | own | BackQuant | batch 22 |
| 811 | Relative Valuation Oscillator | `relative-valuation-oscillator` | Oscillators | own | QuantAlgo | batch 14 |
| 812 | Relative Volume Indicator (RVOL) | `relative-volume-indicator` | Volume | own | AlgoCollective | batch 13 |
| 813 | Renko Boxes | `renko-boxes` | Trend | price | LuxAlgo | batch 4 |
| 814 | Renko Chart | `renko-chart` | Trend | price | LonesomeTheBlue |  |
| 815 | Renko Compression Index (RCI) | `renko-compression-index` | Oscillators | own | nasu_is_gaji | batch 34 |
| 816 | Renko Flip Alert (Traditional Only) | `renko-flip-alert` | Candlestick Patterns | price | deephrenology | batch 41 |
| 817 | Renko Mod | `renko-mod` | Trend | price | RicardoSantos | batch 13 |
| 818 | Renko Sniper PRO (Liquidity Sweep + EMA + ST + RSI) | `renko-sniper-pro` | Trend | price | zachsprad | batch 24 |
| 819 | Res/Sup With Concavity & Increasing / Decreasing Trend Analysis | `res-sup-with-concavity-increasing-decreasing-trend-analysis` | Trend | price | Celar (published as "Res/Sup With Concavity & Increasing / Decreasing Trend Analysis") | batch 28 |
| 820 | Retail vs Banker Net Positions – Symmetry Break | `retail-vs-banker-net-positions-symmetry-break` | Volume | own | JasonHyde | batch 17 |
| 821 | Reversal Candle Setup | `reversal-candle-setup` | Candlestick Patterns | price |  |  |
| 822 | Reversal Correlation Pressure | `reversal-correlation-pressure` | Oscillators | own | OmegaTools | batch 27 |
| 823 | Reversal Scalper 2.0- Adib Noorani | `reversal-scalper-2-0-adib-noorani` | Oscillators | own | AdibNoorani | batch 28 |
| 824 | Rhokeo-VW-RSI Histogram for Cumulative Delta by Zeiirman | `rhokeo-vw-rsi-histogram-for-cumulative-delta-by-zeiirman` | Oscillators | own | nabil007 | batch 24 |
| 825 | Ripster EMA Clouds | `ripster-ema-clouds` | Trend | price | ripster47 |  |
| 826 | RMA ATR Bands | `rma-atr-bands` | Channels & Bands | price | SchizoQuant | batch 3 |
| 827 | RMI Length | `rmi-trend-sniper` | Momentum | price | TZack88 |  |
| 828 | Robby DSS Bressert Colored Dots | `robby-dss-bressert-colored-dots` | Oscillators | own | huatzhi | batch 21 |
| 829 | ROC-Weighted MA Oscillator | `roc-weighted-ma-oscillator` | Oscillators | own | SeerQuant | batch 2 |
| 830 | Rolling Liquidity Clusters Channel | `rolling-liquidity-clusters-channel` | Channels & Bands | price | LuxAlgo | batch 12 |
| 831 | Rolling Sharpe Ratio Oscillator \| Astral Vision | `rolling-sharpe-ratio-oscillator-astral-vision` | Oscillators | own | AstralVision | batch 13 |
| 832 | Rolling Trendline | `rolling-trendline` | Trend | price | LuxAlgo | batch 5 |
| 833 | Ross Cameron-Inspired Day Trading Strategy | `ross-cameron-inspired-day-trading-strategy` | Momentum | price | manaziir | batch 25 |
| 834 | RRR EMA Ignition BUY & SELL (Sideways-Proof) | `rrr-ema-ignition-buy-sell` | Trend | price | RAGSTER123 | batch 21 |
| 835 | RS Rating (1-99) | `rs-rating` | Momentum | own | kulturdesken | batch 16 |
| 836 | rs_MACD | `rs-macd` | Momentum | price | RicardoSantos | batch 17 |
| 837 | RSI | `rsi-hash-capital` | Oscillators | own | Hash_Capital | batch 31 |
| 838 | RSI & BB Oversold Scalper with MACD Confirmation | `rsi-bb-oversold-scalper-with-macd-confirmation` | Momentum | price | DotGain | batch 40 |
| 839 | RSI & MACD Suite | `rsi-macd-suite` | Oscillators | own | aaboomar | batch 34 |
| 840 | RSI (14) with Auto Zone Colors - Overbought/Oversold Highlighter | `rsi-with-auto-zone-colors-overbought-oversold-highlighter` | Oscillators | own | tarangbharti18 | batch 29 |
| 841 | RSI + ADX + ATR 18-01-25 | `rsi-adx-atr-18-01-25` | Oscillators | own | dipak11298 | batch 37 |
| 842 | RSI + ADX + ATR Combo | `rsi-adx-atr-combo` | Oscillators | own | shawasutosh | batch 26 |
| 843 | RSI + BB + Dispersion | `rsi-bb-dispersion` | Oscillators | own |  |  |
| 844 | RSI + Fibonacci HH LL Support Resistance | `rsi-fibonacci-hh-ll-support-resistance` | Channels & Bands | price | FibonacciFlux | batch 12 |
| 845 | RSI + MACD (RSI Divergence) V3.2 | `rsi-macd-v3-2` | Oscillators | own | MKhoa | batch 24 |
| 846 | RSI + STOCH RSI - Marx_Capital | `rsi-stoch-rsi-marx-capital` | Oscillators | own | Marx_Capital | batch 12 |
| 847 | RSI - 5UP | `rsi-5up` | Oscillators | own | Marrulk | batch 29 |
| 848 | RSI Bands | `rsi-bands` | Channels & Bands | price |  |  |
| 849 | RSI Bars - OnlyFlow | `rsi-bars-onlyflow` | Momentum | price | ofderk | batch 10 |
| 850 | RSI BB StdDev Signal | `rsi-bb-stddev-signal` | Oscillators | own | trade_lexx (Pine title "RSI Signal [trade_lexx]") | batch 8 |
| 851 | RSI Candle Color | `rsi-candle-color` | Momentum | price | The_Peaceful_Lizard | batch 39 |
| 852 | RSI Candles | `rsi-candles` | Momentum | own | Glaz |  |
| 853 | RSI Confirm Trend with Williams (W%R) | `rsi-confirm-trend-with-williams` | Momentum | own | javageek | batch 11 |
| 854 | RSI Divergence | `rsi-divergence` | Oscillators | own |  |  |
| 855 | RSI Games 1.2 | `rsi-games-1-2` | Oscillators | own | petejfjohnson | batch 22 |
| 856 | RSI HistoAlert | `rsi-histoalert` | Oscillators | own |  |  |
| 857 | RSI Length | `most-rsi` | Momentum | own |  |  |
| 858 | RSI Length | `parabolic-rsi` | Momentum | own |  |  |
| 859 | RSI Length | `pmax-rsi-t3` | Momentum | own |  |  |
| 860 | RSI Length | `rsi-cyclic-smoothed` | Momentum | own |  |  |
| 861 | RSI MA Cross + Divergence Signal (V2) | `rsi-ma-cross-divergence-signal` | Momentum | price | noxum | batch 39 |
| 862 | RSI Modified | `rsi-modified` | Oscillators | own | Santos_Trader_PT | batch 5 |
| 863 | RSI Momentum Divergence | `rsi-momentum-divergence` | Oscillators | own | ChartPrime |  |
| 864 | RSI Multi Levels kiawosch 7-14-42 Consolidation | `rsi-multi-levels` | Oscillators | own | TFlab | batch 5 |
| 865 | RSI Multicolor editable | `rsi-multicolor-editable` | Oscillators | own | Guillaume46 | batch 8 |
| 866 | RSI PERFECT Flip Dots | `rsi-perfect-flip-dots` | Momentum | price | debanshuchanda6 | batch 42 |
| 867 | RSI Potential | `rsi-potential` | Momentum | own | nasu_is_gaji | batch 35 |
| 868 | RSI Snabbel | `rsi-snabbel` | Oscillators | own |  |  |
| 869 | RSI Supply/Demand | `rsi-supply-demand` | Trend | price | shtcoinr / Lij_MC |  |
| 870 | RSI Swing Signal | `rsi-swing-signal` | Oscillators | own |  |  |
| 871 | RSI Tops and Bottoms | `rsi-tops-bottoms` | Momentum | own | LonesomeTheBlue |  |
| 872 | RSI Trend Bias | `rsi-trend-bias` | Oscillators | own | Botnet101 | batch 24 |
| 873 | RSI Trend Navigator | `rsi-trend-navigator` | Trend | price | QuantAlgo | batch 10 |
| 874 | RSI Zone Step Lines | `rsi-zone-step-lines` | Channels & Bands | price | Devjames | batch 11 |
| 875 | RSI+EMA+MZONES with Divergences | `rsi-ema-mzones-with-divergences` | Oscillators | own | lordoflolz | batch 22 |
| 876 | RSI+Stoch Band Oscillator | `rsi-stoch-band-oscillator` | Oscillators | own | nasu_is_gaji | batch 26 |
| 877 | RSI-50 Step Line | `rsi-50-step-line` | Trend | price | Devjames | batch 5 |
| 878 | RSI-Colored Price Candles with Background | `rsi-colored-price-candles-with-background` | Momentum | price | Midgar- | batch 39 |
| 879 | RSI-EMA-Crossing with Donchian-Stop-Loss | `rsi-ema-crossing-with-donchian-stop-loss` | Channels & Bands | price | Kahael | batch 28 |
| 880 | RSI: alternative derivation | `rsi-alternative-derivation` | Oscillators | own | AdaptiveRSI | batch 25 |
| 881 | RVOL Effort Matrix | `rvol-effort-matrix` | Volume | own | TheLeadingIndicator | batch 36 |
| 882 | S&R Breakout ATR Confirmation | `s-r-breakout-atr-confirmation` | Trend | price | Jos-ProTrader | batch 33 |
| 883 | SAR + EMA + MACD Signals | `sar-ema-macd` | Oscillators | price |  |  |
| 884 | Savitzky Flow Bands | `savitzky-flow-bands` | Channels & Bands | price | ChartPrime | batch 2 |
| 885 | Savitzky-Golay Hampel Filter \| AlphaNatt | `savitzky-golay-hampel-filter-alphanatt` | Moving Averages | price | AlphaNatt | batch 15 |
| 886 | Scalping Line | `scalping-line` | Oscillators | own | KivancOzbilgic |  |
| 887 | Scalping PullBack Tool R1 by JustUncleL | `scalping-pullback-tool` | Trend | price | JustUncleL | most liked |
| 888 | Scalping Tool with Dynamic Take Profit & Stop Loss | `scalping-tool-dynamic-tp-sl` | Trend | price | TruFREND | batch 3 |
| 889 | ScalpMap - EMA Pivot Targets | `scalpmap-ema-pivot-targets` | Trend | price | blockybears | batch 12 |
| 890 | SCE GANN Predictions | `sce-gann-predictions` | Trend | price | ScorsoneEnterprises | batch 22 |
| 891 | Schaff Trend Cycle | `schaff-trend-cycle` | Oscillators | own | LazyBear |  |
| 892 | SCOTTGO Advanced MACD | `scottgo-advanced-macd` | Momentum | own | SCOTTGO (indicator title "MACD: Clean Visuals (Fixed Arrows)") | batch 27 |
| 893 | Sell & Buy Rates | `sell-buy-rates` | Volume | own | LonesomeTheBlue |  |
| 894 | Sequential Pattern Strength | `sequential-pattern-strength` | Momentum | own | QuantAlgo | batch 9 |
| 895 | Sessions | `sessions-luxalgo` | Trend | price | LuxAlgo | most liked |
| 896 | Setup 9.1 (Larry Williams) + EMA 50 | `setup-9-1-ema-50` | Moving Averages | price | oDouglasAlex | batch 7 |
| 897 | SExI - Super Exhaustion Indicator | `sexi-super-exhaustion-indicator` | Oscillators | own | Da_Prof | batch 14 |
| 898 | Sharp Modified Moving Average | `sharp-modified-moving-average` | Moving Averages | price | everget | batch 18 |
| 899 | Sharpe Ratio Indicator (180) | `sharpe-ratio-indicator` | Volatility | own | tim_amblard | batch 3 |
| 900 | Sharpe Ratio v4 | `sharpe-ratio-v4` | Oscillators | own | Zettt | batch 32 |
| 901 | Sharpshooter 30 – EMA Distance | `sharpshooter-30-ema-distance` | Moving Averages | price | hrak22 | batch 33 |
| 902 | Shock Percentile Moving Average \| NAL | `shock-percentile-moving-average-nal` | Moving Averages | price | NordicAlphaLab | batch 22 |
| 903 | Sigmoid RSI \| NAL | `sigmoid-rsi-nal` | Oscillators | own | NordicAlphaLab | batch 11 |
| 904 | Signal Moving Average | `signal-ma` | Moving Averages | price | LuxAlgo |  |
| 905 | Simple Moving Averages | `simple-moving-averages` | Moving Averages | price |  |  |
| 906 | Simplified Percentile Clustering | `simplified-percentile-clustering` | Oscillators | own | InvestorUnknown | batch 4 |
| 907 | Sine Weighted Moving Average | `sine-weighted-moving-average` | Moving Averages | price | everget | batch 13 |
| 908 | SL - 4 EMAs, 2 SMAs & Crossover Signals | `sl-4-emas-2-smas-crossover-signals` | Moving Averages | price | MVP202020205 | batch 27 |
| 909 | Slow Heiken Ashi | `slow-heiken-ashi` | Candlestick Patterns | price |  |  |
| 910 | SMA Angle Alerts | `sma-angle-alerts` | Moving Averages | price | readysetfire | batch 21 |
| 911 | SMA DMA Crossing Signal | `sma-dma-crossing-signal` | Moving Averages | price | tradingqueen18 | batch 31 |
| 912 | SMA Squeeze Oscillator | `sma-squeeze-oscillator` | Momentum | own | Uncle_the_shooter | batch 23 |
| 913 | SMA+ADX Filter | `sma-adx-filter` | Trend | price | iping99 | batch 31 |
| 914 | Smart MCDX FINAL PRO | `smart-mcdx-final-pro` | Volume | own | Sachse-1980 | batch 30 |
| 915 | Smart Money Breakout Channels | `smart-money-breakout-channels` | Channels & Bands | price | AlgoAlpha | most liked |
| 916 | Smart Money Concepts (SMC) | `smart-money-concepts-luxalgo` | Trend | price | LuxAlgo | most liked |
| 917 | Smart Money Flow Signals | `smart-money-flow-signals` | Volume | own | QuantAlgo | batch 2 |
| 918 | Smart Trend | `smart-trend` | Trend | price | Zofesu | batch 21 |
| 919 | SMC Statistical Liquidity Walls | `smc-statistical-liquidity-walls` | Channels & Bands | price | PhenLabs | batch 25 |
| 920 | SMIIOL | `smiiol` | Momentum | own | iilter | batch 25 |
| 921 | Smooth RSI | `smooth-rsi` | Momentum | own | MarktQuant | batch 8 |
| 922 | Smoothed Heiken Ashi | `smoothed-heiken-ashi` | Trend | price | jackvmk |  |
| 923 | Smoothed Low-Pass Butterworth Filtered Median | `butterworth-filtered-median` | Moving Averages | price | AlphaNatt | batch 8 |
| 924 | Smoothed Source Weighted EMA | `smoothed-source-weighted-ema` | Moving Averages | price | Clokivez | batch 13 |
| 925 | Source | `ott-bands` | Channels & Bands | price | KivancOzbilgic |  |
| 926 | Source | `otto` | Oscillators | own | KivancOzbilgic |  |
| 927 | Source | `range-filter-dw` | Trend | price |  |  |
| 928 | Source-Aligned Oscillators (for Divergences) | `source-aligned-oscillators` | Oscillators | own | QuantNomad | batch 18 |
| 929 | SP - MACD with Divergence | `sp-macd-with-divergence` | Momentum | own | ca_sidnayak | batch 24 |
| 930 | Spira Alligator | `spira-alligator` | Trend | price | Markedsignaler | batch 26 |
| 931 | SPX500 Quick Drop & Rise Alerts | `spx500-quick-drop-rise-alerts` | Momentum | price | PaperChains | batch 41 |
| 932 | Squeeze Channel | `squeeze-channel` | Channels & Bands | price | B3AR_Trades | batch 16 |
| 933 | Squeeze Momentum | `squeeze-momentum` | Momentum | own | LazyBear |  |
| 934 | Squeeze Momentum V2 | `squeeze-momentum-v2` | Oscillators | own |  |  |
| 935 | SSL Channel | `ssl-channel` | Trend | price |  |  |
| 936 | SSL Hybrid Scalper | `ssl-hybrid-scalper` | Moving Averages | price | nabeel8369 | batch 11 |
| 937 | ST0P | `st0p` | Oscillators | price |  |  |
| 938 | Standardized MACD HA | `standardized-macd-ha` | Momentum | own | EliCobra |  |
| 939 | Start | `lucid-sar` | Trend | price |  |  |
| 940 | Statistical Price Deviation Index (MAD/VWMA) | `statistical-price-deviation-index` | Oscillators | own | exploretranspose | batch 16 |
| 941 | STH Unrealized Profit/Loss Ratio (STH-NUPL) | `sth-unrealized-profit-loss-ratio` | Oscillators | own | DeVrizii | batch 15 |
| 942 | Stoch VX3 | `stoch-vx3` | Oscillators | own |  |  |
| 943 | Stochastic Heat Map | `stochastic-heat-map` | Momentum | own | Violent |  |
| 944 | Stochastic Momentum Index | `stochastic-momentum-index` | Oscillators | own |  |  |
| 945 | Stochastic Momentum Index UCS | `smi-ucs` | Oscillators | own |  |  |
| 946 | Stochastic OTT | `stochastic-ott` | Oscillators | own | KivancOzbilgic |  |
| 947 | Stockbee ComboBull | `stockbee-combobull` | Momentum | own | traderabhi81 | batch 29 |
| 948 | Stockbee Reversal Bullish v2 | `stockbee-reversal-bullish-v2` | Momentum | own | traderabhi81 | batch 29 |
| 949 | Stop/Take Bounds | `stop-take-bounds` | Volatility | price | Y_Goldman | batch 27 |
| 950 | Strong Burst Fader \| ProjectSyndicate | `strong-burst-fader-projectsyndicate` | Volatility | price | ProjectSyndicate | batch 38 |
| 951 | Strong Engulfing Candlestick (With Alerts) | `strong-engulfing-candlestick` | Candlestick Patterns | price | kyjefive | batch 39 |
| 952 | Super Guppy | `super-guppy` | Trend | price | JustUncleL |  |
| 953 | Super OrderBlock / FVG / BoS Tools by makuchaku & eFe | `super-orderblock-fvg-bos` | Trend | price | makuchaku | most liked |
| 954 | Super SMA 5 8 13 + EMA 20/200 Regime Filter (ALIZET) | `super-sma-5-8-13-ema-20-200-regime-filter` | Moving Averages | price | afdzjr69 | batch 19 |
| 955 | Super Smoothed MACD | `super-smoothed-macd` | Momentum | own |  |  |
| 956 | Super SuperTrend | `super-supertrend` | Trend | price |  |  |
| 957 | SuperBands | `superbands` | Trend | price | The_Peaceful_Lizard | batch 7 |
| 958 | SuperSmoother MA Oscillator | `supersmoother-ma-oscillator` | Oscillators | own | BOSWaves | batch 1 |
| 959 | SuperTrend AI Clustering | `supertrend-ai-clustering` | Trend | price |  |  |
| 960 | SuperTrend Channels | `supertrend-channels` | Channels & Bands | price |  |  |
| 961 | Support and Resistance (High Volume Boxes) | `support-resistance-high-volume-boxes` | Volume | price | ChartPrime | most liked |
| 962 | Support and Resistance Levels with Breaks | `sr-levels-breaks` | Channels & Bands | price |  |  |
| 963 | Support and Resistance Power Channel | `support-resistance-power-channel` | Trend | price | ChartPrime | most liked |
| 964 | Support and Resistance Signals MTF | `support-resistance-signals-mtf` | Trend | price | LuxAlgo | most liked |
| 965 | Support Resistance - Dynamic v2 | `support-resistance-dynamic-v2` | Trend | price | LonesomeTheBlue | most liked |
| 966 | Support Resistance Channels | `support-resistance-channels` | Trend | price | LonesomeTheBlue |  |
| 967 | Support/Resistance Channel Breakout | `support-resistance-channel-breakout` | Channels & Bands | price | SuprAlgo | batch 31 |
| 968 | Suppot and resistance & BUY SELL SIGNALS | `suppot-and-resistance-buy-sell-signals` | Channels & Bands | price | doganayy2 | batch 20 |
| 969 | Sweep Candle | `sweep-candle` | Candlestick Patterns | price | odnac | batch 41 |
| 970 | Sweep Engulf 2 Candle | `sweep-engulf-2-candle` | Candlestick Patterns | price | gastrophollic | batch 41 |
| 971 | Sweep Engulf CHoCH | `sweep-engulf-choch` | Candlestick Patterns | price | gastrophollic | batch 38 |
| 972 | Sweep2Trade Pro | `sweep2trade-pro` | Trend | price | chervolino | batch 8 |
| 973 | Swing Highs/Lows & Candle Patterns | `swing-highs-lows-patterns` | Candlestick Patterns | price | LuxAlgo (Pine v5) |  |
| 974 | Swing Points | `swing-points` | Trend | price | CrossTradeTeam | batch 14 |
| 975 | Swing Support and Resistance | `swing-support-and-resistance` | Trend | price | VSB-2024 | batch 25 |
| 976 | Swing Trade Signals | `swing-trade-signals` | Oscillators | price | nicks1008 |  |
| 977 | T1 Wyckoff Aggressive A/D Setup | `t1-wyckoff-aggressive-a-d-setup` | Volume | price | Teyo69 | batch 38 |
| 978 | T3 Length | `t3-psar` | Moving Averages | price |  |  |
| 979 | TA (Miles) Adaptive Trend | `ta-adaptive-trend` | Trend | price | TradingApologist | batch 27 |
| 980 | TASC 2025.02 Autocorrelation Indicator | `tasc-2025-02-autocorrelation` | Oscillators | own | PineCodersTASC | batch 6 |
| 981 | TASC 2025.06 Cybernetic Oscillator | `tasc-2025-06-cybernetic-oscillator` | Oscillators | own | PineCodersTASC | batch 5 |
| 982 | TASC 2025.09 The Continuation Index | `tasc-2025-09-the-continuation-index` | Trend | own | PineCodersTASC | batch 14 |
| 983 | TASC 2026.01 The Reversion Index | `tasc-2026-01-the-reversion-index` | Oscillators | own | PineCodersTASC | batch 26 |
| 984 | TASC 2026.04 A Synthetic Oscillator | `tasc-2026-04-a-synthetic-oscillator` | Oscillators | own | PineCodersTASC | batch 7 |
| 985 | TASC 2026.05 The AutoTune Filter | `tasc-2026-05-the-autotune-filter` | Oscillators | own | PineCodersTASC | batch 8 |
| 986 | TASC 2026.09 Adaptive SuperSmoother | `tasc-2026-09-adaptive-supersmoother` | Moving Averages | own | PineCodersTASC | batch 15 |
| 987 | TDI - Traders Dynamic Index | `tdi-rsi` | Momentum | own |  |  |
| 988 | Tenkan Cloud Signals | `tenkan-cloud-signals` | Trend | price | CodaPro | batch 11 |
| 989 | Terminal Velocity Stop \| Lyro RS | `terminal-velocity-stop-lyro-rs` | Trend | price | LyroRS | batch 13 |
| 990 | TFO + ADX with Histogram & Signal | `tfo-adx-with-histogram-signal` | Oscillators | own | WalrusQuant | batch 26 |
| 991 | The Jewel | `the-jewel` | Oscillators | own | afonso_77 | batch 37 |
| 992 | The Mean Goose v1 | `the-mean-goose-v1` | Channels & Bands | price | FattyGuinness | batch 15 |
| 993 | The Strat | `the-strat` | Candlestick Patterns | price | shayy110 | batch 42 |
| 994 | Theil-Sen Line Filter | `theil-sen-line-filter` | Moving Averages | price | BackQuant | batch 18 |
| 995 | Three Moving Averages | `three-moving-averages` | Moving Averages | price |  |  |
| 996 | Three-Bar Reversal/Continuation | `three-bar-reversal-continuation` | Candlestick Patterns | price | abuzka | batch 42 |
| 997 | Tight Range Display with Background | `tight-range-display-with-background` | Volatility | price | rakeshhelva | batch 42 |
| 998 | Tillson T3 | `tillson-t3` | Trend | price | KivancOzbilgic (fr3762) |  |
| 999 | Time-based Alerts for Trading Windows | `time-based-alerts-for-trading-windows` | Trend | price | xhmxdir | batch 41 |
| 1000 | TMA Overlay | `tma-overlay` | Moving Averages | price | ArtyFXC | most liked |
| 1001 | TMO (True Momentum Oscillator) | `tmo` | Momentum | own | Coulisnosaj | batch 15 |
| 1002 | Tom DeMark MACD | `td-macd` | Momentum | own |  |  |
| 1003 | TonyUX EMA Scalper | `tonyux-ema-scalper` | Oscillators | price |  |  |
| 1004 | Top & Bottom Candle | `top-bottom-candle` | Candlestick Patterns | own |  |  |
| 1005 | Tops/Bottoms | `tops-bottoms` | Oscillators | price |  |  |
| 1006 | TR High/Low meter | `tr-high-low-meter` | Momentum | own | dman103 | batch 10 |
| 1007 | Trade Price - Spread Compensator Overlay | `trade-price-spread-compensator-overlay` | Channels & Bands | price | The_Forex_Steward | batch 40 |
| 1008 | Trade Prime - Fluid Trend Indicator | `trade-prime-fluid-trend-indicator` | Trend | price | tradeprime01 | batch 31 |
| 1009 | Trader XO Macro Trend Scanner | `trader-xo` | Oscillators | price |  |  |
| 1010 | Traders Dynamic Index | `tdi-hlc-trix` | Oscillators | own |  |  |
| 1011 | Trading Activity Index | `trading-activity-index` | Volume | own | Zeiierman | batch 2 |
| 1012 | Trading Gaul | `trading-gaul` | Trend | price | investment20223 | batch 26 |
| 1013 | TradingMoja / SQZMOM ADX | `tradingmoja-sqzmom-adx` | Momentum | own | Trading_Moja | batch 32 |
| 1014 | Transient Zones v1.1 | `transient-zones` | Channels & Bands | price | Jurij (community) |  |
| 1015 | Tremor Tracker | `tremor-tracker` | Volatility | own | TheUltimator5 | batch 19 |
| 1016 | Trend Direction Zone | `trend-direction-zone` | Trend | price | MarketStructureLab | batch 16 |
| 1017 | Trend Double Pullbackv1.0 | `trend-double-pullback-v1-0` | Trend | price | puduxbt | batch 26 |
| 1018 | Trend Filter (2-pole) | `trend-filter` | Trend | price | BigBeluga | batch 1 |
| 1019 | Trend Flow Oscillator (CMF + MFI) + ADX | `trend-flow-oscillator-adx` | Oscillators | own | WalrusQuant | batch 19 |
| 1020 | Trend Following Moving Averages | `trend-following-ma` | Moving Averages | price | LonesomeTheBlue |  |
| 1021 | Trend Heatmap | `trend-heatmap` | Trend | own | autocrp | batch 30 |
| 1022 | Trend Impulse Channels | `trend-impulse-channels` | Trend | price | Zeiierman |  |
| 1023 | Trend Line Auto | `trend-line-auto` | Trend | price | HarryBot |  |
| 1024 | Trend Lines v2 | `trend-lines-v2` | Trend | price | LonesomeTheBlue (Pine v4) |  |
| 1025 | Trend Magic | `trend-magic` | Trend | price |  |  |
| 1026 | Trend Predictor Ribbon Clone - Fixed roj karo moj karo | `trend-predictor-ribbon` | Trend | price | ronitjain18 | batch 6 |
| 1027 | Trend Pulse Oscillator | `trend-pulse-oscillator` | Oscillators | own | ChaosTrader63 | batch 35 |
| 1028 | Trend Regularity Adaptive MA | `trama` | Moving Averages | price | LuxAlgo |  |
| 1029 | Trend Scalper | `trend-scalper` | Moving Averages | price | abedmahmood | batch 35 |
| 1030 | Trend State Signals | `trend-state-signals` | Trend | price | MarketStructureLab | batch 4 |
| 1031 | Trend Strength/Direction | `trend-strength-direction` | Trend | own | ddcakez | batch 32 |
| 1032 | Trend Trader Strategy | `trend-trader` | Trend | price |  |  |
| 1033 | Trend Trigger Factor | `trend-trigger-factor` | Oscillators | own |  |  |
| 1034 | Trend Volatility Index (TVI) | `trend-volatility-index` | Volatility | own | chikaharu | batch 3 |
| 1035 | Trend with ADX/EMA - Buy & Sell Signals | `trend-with-adx-ema-buy-sell-signals` | Trend | price | RMPM | batch 28 |
| 1036 | Trend-Pro | `trend-pro` | Trend | price | andrwxwy | batch 38 |
| 1037 | TrendCylinder (Expo) | `trendcylinder` | Trend | price | Zeiierman | batch 4 |
| 1038 | Trendline Breakouts With Targets | `trendline-breakouts-with-targets` | Trend | price | ChartPrime | most liked |
| 1039 | Trendlines with Breaks [LuxAlgo] | `trendlines-with-breaks` | Trend | price | LuxAlgo |  |
| 1040 | TrendMasterPro_Fekonomi | `trendmasterpro-fekonomi` | Trend | price | fekonomi | batch 20 |
| 1041 | Trendshift | `trendshift` | Trend | price | chervolino | batch 39 |
| 1042 | TrendShift Detector | `trendshift-detector` | Candlestick Patterns | price | GIANESELLI | batch 40 |
| 1043 | TRENDSYNC BUY/SELL BY SIMPLY_DANTE-FX | `trendsync-buy-sell-by-simply-dante-fx` | Trend | price | Simply_Dante-fx | batch 36 |
| 1044 | TrendWave Bands | `trendwave-bands` | Channels & Bands | price | BigBeluga | batch 1 |
| 1045 | Triangular MA Bands | `tma-bands` | Channels & Bands | price |  |  |
| 1046 | Triangular Momentum Oscillator | `triangular-momentum-osc` | Oscillators | own |  |  |
| 1047 | Trimmed Mean ATR Bands | `trimmed-mean-atr-bands` | Channels & Bands | price | CryptoNejc | batch 17 |
| 1048 | Triple Doji Sequence | `triple-doji-sequence` | Candlestick Patterns | price | Marc_Thiart | batch 39 |
| 1049 | Triple Gaussian Smoothed Ribbon | `triple-gaussian-smoothed-ribbon` | Trend | price | BOSWaves | batch 16 |
| 1050 | Triple MA For Loop | `triple-ma-for-loop` | Trend | own | SeerQuant | batch 7 |
| 1051 | Triple MA Forecast | `triple-ma-forecast` | Moving Averages | price | yatrader2 (community) |  |
| 1052 | Triple RSI \| MisinkoMaster | `triple-rsi-misinkomaster` | Momentum | own | MisinkoMaster | batch 19 |
| 1053 | True High/Low RSI for Divergence | `true-high-low-rsi-for-divergence` | Oscillators | own | Lakt_ | batch 29 |
| 1054 | True Range eXpansion | `true-range-expansion` | Volatility | price | Sherlock_MacGyver | batch 22 |
| 1055 | TTM Squeeze Pro | `ttm-squeeze-pro` | Oscillators | own | John Carter |  |
| 1056 | Turtle Trade Channels | `turtle-trade-channels` | Channels & Bands | price | Richard Dennis / William Eckhardt |  |
| 1057 | Tweezers & Kangaroo Tail | `tweezers-kangaroo-tail` | Candlestick Patterns | price | LonesomeTheBlue |  |
| 1058 | Twin Range Filter | `twin-range-filter` | Trend | price | colinmck |  |
| 1059 | Ultimate Buy & Sell | `ultimate-buy-sell` | Trend | price |  |  |
| 1060 | Ultimate Moving Average-Multi-TimeFrame-7 MA Types | `ultimate-moving-average-mtf` | Moving Averages | price | ChrisMoody | most liked |
| 1061 | Ultimate RSI [LuxAlgo] | `ultimate-rsi` | Momentum | own | LuxAlgo |  |
| 1062 | Ultra Clean Support / Resistance Levels | `ultra-clean-support-resistance-levels` | Trend | price | Stocktitian | batch 30 |
| 1063 | Ultra Smart Trail | `ultra-smart-trail` | Trend | price | Rathack | batch 18 |
| 1064 | UM EMA SMA WMA HMA with Directional Color Change | `um-ema-sma-wma-hma-with-directional-color-change` | Moving Averages | price | UnderwearMillionaire | batch 30 |
| 1065 | Unicorn Setup Detector (aziz abid) | `unicorn-setup-detector` | Trend | price | mohammedazizabid | batch 40 |
| 1066 | Universal Large Orders Proxy fabio valentini Chat gpt Recreation | `universal-large-orders-proxy-fabio-valentini-chat-gpt-recreation` | Volume | price | boss11233 | batch 18 |
| 1067 | Uptrick: Dynamic Z-Score Deviation | `uptrick-dynamic-z-score-deviation` | Trend | price | Uptrick | batch 6 |
| 1068 | Uptrick: Liquid Reversal Bands | `liquid-reversal-bands` | Channels & Bands | price | Uptrick | batch 3 |
| 1069 | Uptrick: MultiMA_Volume | `uptrick-multima-volume` | Moving Averages | price | Uptrick | batch 16 |
| 1070 | Uptrick: RSI MA Buying/Selling signals | `uptrick-rsi-ma-buying-selling-signals` | Momentum | own | Uptrick | batch 12 |
| 1071 | Uptrick: Trend Analysis | `uptrick-trend-analysis` | Momentum | own | Uptrick | batch 14 |
| 1072 | Uptrick: Volatility Reversion Bands | `uptrick-volatility-reversion-bands` | Channels & Bands | price | Uptrick | batch 4 |
| 1073 | Uptrick: Zero Lag HMA Trend Suite | `zero-lag-hma-trend-suite` | Moving Averages | price | Uptrick | batch 3 |
| 1074 | User Defined Range Selector and Color Changing EMA Line | `user-defined-range-selector-and-color-changing-ema-line` | Moving Averages | price | Crypto_Moses | batch 23 |
| 1075 | UT Bot | `ut-bot` | Trend | price |  |  |
| 1076 | Ut bot - Trend+volume | `ut-bot-trend-volume` | Trend | price | BhargavMeghnathi | batch 40 |
| 1077 | Vacuum Candles | `vacuum-candles` | Volume | price | XrayAlgo | batch 41 |
| 1078 | Variable Moving Average | `variable-ma` | Moving Averages | price | LazyBear |  |
| 1079 | VARIS Zones | `varis-zones` | Channels & Bands | price | IAmTheLiquidity2 | batch 17 |
| 1080 | VCO Fusion | `vco-fusion` | Oscillators | own | Uncle_the_shooter | batch 20 |
| 1081 | Vdub FX Sniper | `vdub-sniper` | Oscillators | price | Vdubus |  |
| 1082 | vdubus BinaryPro | `vdubus-binarypro` | Oscillators | price |  |  |
| 1083 | VEGA (Velocity of Efficient Gain Adaptation) | `vega` | Momentum | own | B3AR_Trades | batch 20 |
| 1084 | Vervoort HA LT Candlestick Oscillator | `vervoort-ha-oscillator` | Oscillators | own |  |  |
| 1085 | VIM (Volume in Money) | `vim` | Volume | own | tbtb1111 | batch 29 |
| 1086 | Visualisation tendances | `visualisation-tendances` | Trend | price | Benjamin69 | batch 17 |
| 1087 | Volatility & Big Market Moves | `volatility-big-market-moves` | Volatility | own | nilstrades_ | batch 24 |
| 1088 | Volatility Adaptive Filtered Trend | `volatility-adaptive-filtered-trend` | Trend | price | SchizoQuant | batch 6 |
| 1089 | Volatility Band Cloud with Overextension Signals | `volatility-band-cloud-with-overextension-signals` | Channels & Bands | price | Retire_by_50 | batch 35 |
| 1090 | Volatility Bands | `volatility-bands` | Channels & Bands | price | pmk07 | batch 23 |
| 1091 | Volatility Breakout Pulse (VBP FIX) | `volatility-breakout-pulse` | Channels & Bands | price | JohnsonForexTrader | batch 36 |
| 1092 | Volatility Channel Oscillator | `volatility-channel-oscillator` | Oscillators | own | Uncle_the_shooter | batch 3 |
| 1093 | Volatility Halo \| NAL | `volatility-halo-nal` | Volatility | price | NordicAlphaLab | batch 6 |
| 1094 | Volatility Quality | `volatility-quality` | Volatility | own | AlphaExtract | batch 18 |
| 1095 | Volatility-Driven VWAP Structure | `volatility-driven-vwap-structure` | Channels & Bands | price | Zeiierman | batch 3 |
| 1096 | Volatility-Gated Trend Oscillator | `volatility-gated-trend-oscillator` | Oscillators | own | QuantAlgo | batch 9 |
| 1097 | VOLD Ratio Histogram | `vold-ratio-histogram` | Volume | own | Th16rry | batch 23 |
| 1098 | Volumatic S/R Levels | `volumatic-sr-levels` | Trend | price | BigBeluga |  |
| 1099 | Volume + RSI & MA Differential | `volume-rsi-ma-differential` | Volume | own | ozzy_livin | batch 7 |
| 1100 | Volume Accumulation Percentage | `volume-accumulation-pct` | Volume | own |  |  |
| 1101 | Volume Alert | `volume-alert` | Volume | price | oDouglasAlex | batch 42 |
| 1102 | Volume and Volatility Ratio Indicator-WODI | `volume-and-volatility-ratio-indicator-wodi` | Volume | own | W0DI | batch 16 |
| 1103 | Volume Bands | `volume-bands` | Channels & Bands | price | MisinkoMaster | batch 6 |
| 1104 | Volume Bar Breakout | `volume-bar-breakout` | Volume | price | tradeswithashish |  |
| 1105 | Volume bar range | `volume-bar-range` | Volume | price | pandorid | batch 25 |
| 1106 | Volume Bars Color | `volume-bars-color` | Volume | own | Evgenyc111 | batch 20 |
| 1107 | Volume Buy/Sell Split | `volume-buy-sell-split` | Volume | own | LHAMA-Trading | batch 26 |
| 1108 | Volume Candle Coloring v5 (BARCOLOR STABLE) | `volume-candle-coloring-v5` | Volume | price | sugogou | batch 37 |
| 1109 | Volume Candle Highlighter | `volume-candle-highlighter` | Volume | price | Dougie_dee | batch 5 |
| 1110 | Volume Candles | `volume-candles` | Volume | price | alexrainman | batch 39 |
| 1111 | Volume Colored Bars | `volume-colored-bars` | Volume | own |  |  |
| 1112 | Volume Comparison with Buyer/Seller Pressure | `volume-comparison-with-buyer-seller-pressure` | Volume | own | ask2maniish | batch 26 |
| 1113 | Volume Divergence | `volume-divergence` | Volume | own | baymucuk |  |
| 1114 | Volume Flow Indicator | `volume-flow-indicator` | Volume | own |  |  |
| 1115 | Volume Flow v3 | `volume-flow-v3` | Volume | own | DepthHouse / oh92 (community) |  |
| 1116 | Volume Footprint | `volume-footprint` | Volume | price | LuxAlgo |  |
| 1117 | Volume LinReg Trend | `volume-linreg-trend` | Volume | own | LonesomeTheBlue |  |
| 1118 | Volume Positive Negative (VPN) | `volume-positive-negative` | Volume | own | LevelUpTools | batch 2 |
| 1119 | Volume Price Confirmation Indicator | `vpci` | Volume | own |  |  |
| 1120 | Volume Profile / Fixed Range | `volume-profile-fixed-range` | Volume | price | LonesomeTheBlue | most liked |
| 1121 | Volume Profile Free Ultra SLI (100 Levels Value Area VWAP) - RRB | `volume-profile-free-ultra-sli` | Volume | price | RagingRocketBull | most liked |
| 1122 | Volume Profile Heatmap | `volume-profile-heatmap` | Volume | price | KeyAlgos | batch 13 |
| 1123 | Volume Profile, Pivot Anchored by DGT | `volume-profile-pivot-anchored` | Volume | price | dgtrd | most liked |
| 1124 | Volume Spike and Contraction Indicator | `volume-spike-and-contraction-indicator` | Volume | price | epicurusMcPot | batch 41 |
| 1125 | Volume Spike Indicator | `volume-spike-indicator` | Volume | price | rikyu04 | batch 42 |
| 1126 | Volume SuperTrend AI | `volume-supertrend-ai` | Trend | price |  |  |
| 1127 | Volume Surge Detector | `volume-surge-detector` | Volume | own | SpeculationLab | batch 19 |
| 1128 | Volume Variation Index Indicator | `volume-variation-index-indicator` | Volume | own | thequantscience | batch 35 |
| 1129 | Volume Weighted MACD V2 | `vw-macd-v2` | Momentum | own |  |  |
| 1130 | Volume Weighted Median Price (VWMP) | `volume-weighted-median-price` | Moving Averages | price | vsov | batch 14 |
| 1131 | Volume Weighted RSI (VW RSI) | `volume-weighted-rsi` | Momentum | own | CsokosGeza | batch 34 |
| 1132 | Volume Weighted Trend | `volume-weighted-trend` | Trend | price | QuantAlgo | batch 1 |
| 1133 | Volume with Alert | `volume-with-alert` | Volume | own | BullBearSR | batch 30 |
| 1134 | Volume with EMA and Coloring Rules | `volume-with-ema-and-coloring-rules` | Volume | own | itisfilipe | batch 37 |
| 1135 | Volume-Based Moving Average | `volume-based-moving-average` | Moving Averages | price | The_Forex_Steward | batch 36 |
| 1136 | Volume-Based RSI Color Indicator with MAs | `volume-based-rsi-color-indicator-with-mas` | Oscillators | own | Riccardo02 | batch 32 |
| 1137 | Volume-based Support & Resistance Zones | `volume-based-support-resistance-zones` | Volume | price | tommyf1001 | most liked |
| 1138 | Volume-Gated Trend Ribbon | `volume-gated-trend-ribbon` | Trend | price | QuantAlgo | batch 3 |
| 1139 | Volume-Weighted MA Crossover | `volume-weighted-ma-crossover` | Moving Averages | price | AlphaNatt | batch 9 |
| 1140 | Volume-Weighted Money Flow | `volume-weighted-money-flow` | Volume | own | sgbpulse | batch 33 |
| 1141 | Volume-Weighted Pivot Bands | `volume-weighted-pivot-bands` | Channels & Bands | price | LeafAlgo | batch 33 |
| 1142 | Volume-Weighted Price Z-Score | `volume-weighted-price-z-score` | Oscillators | own | QuantAlgo | batch 6 |
| 1143 | Volumetric Compressed MA | `volumetric-compressed-ma` | Moving Averages | price | serkany88 | batch 14 |
| 1144 | Volumetric Entropy Index | `volumetric-entropy-index` | Volume | own | Sherlock_MacGyver | batch 27 |
| 1145 | Volumetric Tensegrity | `volumetric-tensegrity` | Volume | own | TheLeadingIndicator | batch 30 |
| 1146 | VolVol | `volvol` | Volume | price | kunalgolani | batch 26 |
| 1147 | Vortex Pro with Moving average | `vortex-pro-with-moving-average` | Oscillators | own | pointalgo | batch 25 |
| 1148 | Voss Predictive Filter | `voss-predictive-filter` | Oscillators | own | e2e4 | batch 8 |
| 1149 | VPSA-VTD | `vpsa-vtd` | Volume | own | CatTheTrader | batch 11 |
| 1150 | Vulkan Profit | `vulkan-profit` | Trend | price | AlgoCollective | batch 33 |
| 1151 | VuManChu Swing Free | `vumanchu-swing` | Trend | price |  |  |
| 1152 | VWAP & Dual MA Ribbon Tracker Pro | `vwap-dual-ma-ribbon-tracker-pro` | Trend | own | Simon20cent | batch 19 |
| 1153 | VWAP Deviation Oscillator | `vwap-deviation-oscillator` | Oscillators | own | BackQuant | batch 9 |
| 1154 | VWAP Predictive Breakout + RSI + OB + Trend/Chop | `vwap-predictive-breakout-rsi-ob-trend-chop` | Volume | price | Viggy02 | batch 31 |
| 1155 | VWAP/MVWAP/EMA Crossover | `vwap-mvwap-ema-crossover` | Trend | price | DerrickLaFlame |  |
| 1156 | VWMA/SMA Delta Volatility (Statistical Anomaly Detector) | `vwma-sma-delta-volatility` | Volatility | own | tkarolak | batch 14 |
| 1157 | VWMACD & SZO | `vwmacd-szo` | Momentum | own |  |  |
| 1158 | VWMACD-MFI-OBV Composite | `vwmacd-mfi-obv-composite` | Volume | own | munair | batch 27 |
| 1159 | VWRSI Crossovers & Extremes | `vwrsi-crossovers-extremes` | Momentum | own | TheAITradingDesk | batch 35 |
| 1160 | Waddah Attar Explosion | `waddah-attar-explosion` | Momentum | own | LazyBear/ShayanKM |  |
| 1161 | WAE Sniper Scalp XAUUSD M1 Tuned | `wae-sniper-scalp-xauusd-m1-tuned` | Momentum | own | khonthailoei19071983 | batch 19 |
| 1162 | Wave N + KDJ + Volumi + SMC + Ichimoku | `wave-n-kdj-volumi-smc-ichimoku` | Trend | price | Nikus63 | batch 31 |
| 1163 | WaveFunction MACD | `wavefunction-macd` | Momentum | own | TechnoBlooms | batch 27 |
| 1164 | Wavelet Filter with Adaptive Upsampling | `wavelet-filter-with-adaptive-upsampling` | Oscillators | own | BackQuant | batch 29 |
| 1165 | Wavelet Transform Trend | `wavelet-transform-trend` | Trend | price | QuantAlgo | batch 12 |
| 1166 | Wavelet-Trend ML Integration | `wavelet-trend-ml-integration` | Oscillators | own | AlphaExtract | batch 1 |
| 1167 | WaveTrend | `wavetrend` | Oscillators | own | LazyBear |  |
| 1168 | WaveTrend Oscillator | `wavetrend-oscillator` | Momentum | own | LazyBear |  |
| 1169 | Weierstrass Function (Fractal Cycles) | `weierstrass-function` | Oscillators | own | fract | batch 17 |
| 1170 | Weighted percentile nearest rank | `weighted-percentile-nearest-rank` | Moving Averages | price | gorx1 | batch 10 |
| 1171 | Weighted Regression Bands | `weighted-regression-bands` | Channels & Bands | price | Zeiierman | batch 5 |
| 1172 | Weis Wave Candle | `weis-wave-candle` | Trend | own | Uncle_the_shooter | batch 34 |
| 1173 | Weis Wave Volume | `weis-wave-volume` | Volume | own |  |  |
| 1174 | Whale Activity Impact Oscillator | `whale-activity-impact-oscillator` | Volume | own | mdeacey | batch 18 |
| 1175 | Whale Volume Absorption & Aggression @MaxMaserati 3.0 | `whale-volume-absorption-aggression-maxmaserati-3-0` | Volume | own | MaxMaserati | batch 22 |
| 1176 | Wick Volume Alert | `wick-volume-alert` | Candlestick Patterns | price | Shazam77 | batch 41 |
| 1177 | WICK.ED Fractals | `wicked-fractals` | Oscillators | price | Mit Nayi (community) |  |
| 1178 | Williams Alligator + Fractals | `williams-combo` | Trend | price | vlkvr (Pine v3) |  |
| 1179 | Williams BBDiv Signal | `williams-bbdiv-signal` | Oscillators | own | trade_lexx | batch 20 |
| 1180 | Williams Percent Range with Threshold | `williams-percent-range-with-threshold` | Oscillators | own | xdextra | batch 29 |
| 1181 | Williams Vix Fix | `williams-vix-fix` | Volatility | own | ChrisMoody |  |
| 1182 | WLSMA: fast approximation | `wlsma-fast-approximation` | Moving Averages | price | gorx1 | batch 33 |
| 1183 | Wyckoff Effort vs. Result | `wyckoff-effort-vs-result` | Volume | price | TradeTechanalysis | batch 34 |
| 1184 | x5-smooth-ema | `x5-smooth-ema` | Moving Averages | price | traderninezero | batch 19 |
| 1185 | XAUUSD Buy/Sell Alerts with SL & TP | `xauusd-buy-sell-alerts-with-sl-tp` | Moving Averages | price | alexandrossolomou1 | batch 8 |
| 1186 | XAUUSD Family Scalping (5min) | `xauusd-family-scalping` | Oscillators | price | cupra_inc | batch 8 |
| 1187 | Z-Score | `z-score` | Oscillators | own | joecalledher | batch 21 |
| 1188 | Z-Score Oscillator | `z-score-oscillator` | Oscillators | own | B3AR_Trades | batch 12 |
| 1189 | Z-Score STDEMA Bands | `z-score-stdema-bands` | Oscillators | own | TiagoTF | batch 24 |
| 1190 | Z-Score Trend Monitor | `z-score-trend-monitor` | Oscillators | own | EdgeTerminal | batch 31 |
| 1191 | Zero Lag EMA | `zero-lag-ema` | Moving Averages | price |  |  |
| 1192 | Zero Lag LSMA (ZLSMA) | `zlsma` | Moving Averages | price | veryfid |  |
| 1193 | Zero Lag MACD | `zero-lag-macd` | Momentum | own | AC (based on Glaz) |  |
| 1194 | Zero Lag Signals For Loop | `zero-lag-signals-for-loop` | Trend | price | QuantAlgo | batch 1 |
| 1195 | Zero-Lag GARCH Bands \| NAL | `zero-lag-garch-bands-nal` | Volatility | price | NordicAlphaLab | batch 12 |
| 1196 | ZigZag with Fibonacci Levels | `zigzag-fibonacci` | Trend | price | LonesomeTheBlue |  |
| 1197 | ZVOL - Z-Score Volume Heatmap | `zvol-z-score-volume-heatmap` | Volume | own | TheLeadingIndicator | batch 28 |
| 1198 | 🌊 ALMA Bands | `alma-bands` | Moving Averages | price | B3AR_Trades | batch 26 |
