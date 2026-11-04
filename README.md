# lightweight-charts-indicators

**[Live Demo](https://deepentropy.github.io/lightweight-charts-indicators/)**

1805 technical analysis indicators for the lightweight-charts library — 117 standard indicators, 1643 community indicators, and 45 candlestick patterns. PineScript v6 compatible with full drawing primitive support (lines, boxes, labels, tables).

## Installation

```bash
npm install lightweight-charts-indicators oakscriptjs lightweight-charts
```

`oakscriptjs` is a peer dependency: version 0.11.2 or later, below 0.12. `lightweight-charts` 5 is only needed for
the renderer.

## Quick Start

```typescript
import { SMA, RSI, MACD, BollingerBands } from 'lightweight-charts-indicators';
import type { Bar } from 'oakscriptjs';

const bars: Bar[] = [
  { time: 1, open: 100, high: 105, low: 95, close: 102, volume: 1000 },
  // ... more bars
];

// Simple Moving Average
const smaResult = SMA.calculate(bars, { len: 14 });

// RSI
const rsiResult = RSI.calculate(bars, { length: 14 });

// MACD
const macdResult = MACD.calculate(bars, { fastLength: 12, slowLength: 26, signalLength: 9 });

// Bollinger Bands
const bbResult = BollingerBands.calculate(bars, { length: 20, mult: 2 });
```

## Chart Context

Some indicators read values of the chart and its symbol: the price tick, the exchange time zone, the symbol name and
type, the chart colours, the current time, or whether the last bar is still open. Give them in the optional third
argument of `calculate`:

```typescript
import { indicatorRegistry, type ChartContext } from 'lightweight-charts-indicators';

const chart: ChartContext = {
  timeframe: '15',                 // chart timeframe
  timezone: 'America/New_York',    // exchange time zone
  session: '0930-1600',            // session hours of the symbol
  tickerid: 'NASDAQ:AAPL',
  mintick: 0.01,                   // price tick
  symbolType: 'stock',
  currency: 'USD',
  lastBarConfirmed: false,         // the last bar is still open
};

const entry = indicatorRegistry.find((e) => e.id === 'ict-killzones-pivots-tfo')!;
const result = entry.calculate(bars, {}, chart);
```

Every value is optional. Without a value an indicator uses a fallback: tick 0.01, UTC, no symbol name, "USD", the
dark theme colours, the computer clock, and all bars closed. The type is the oakscriptjs `ChartContext` with
`symbolType`, `currency`, `foregroundColor`, `backgroundColor` and `now` added (see `src/chart-context.ts`).

A few indicators draw from the bars visible on the chart. Give the time (in ms) of the first and last visible bar in
`leftVisibleBarTime` and `rightVisibleBarTime` (fallback: all the bars); their registry entry has
`usesVisibleRange: true`, so calculate them again when the user scrolls or zooms the chart.

**Other symbols.** Some indicators read the bars of another symbol, e.g. an index to compare with. The app gives
them with `bars(symbol, timeframe)` in the context, from its own cache, in the time unit of the chart bars. When bars
are missing, `calculate` throws a `MissingSymbolDataError`. Its `requests` list every symbol and timeframe needed.
Load them, then calculate again. The registry entry of such an indicator has `requiredSymbols(inputs)`: call it to
preload the bars.

```typescript
import { indicatorRegistry, MissingSymbolDataError, type ChartContext } from 'lightweight-charts-indicators';

const cache = new Map<string, Bar[]>(); // bars loaded by the app, by "symbol|timeframe"
const load = async (symbol: string, timeframe: string) => {
  cache.set(`${symbol}|${timeframe}`, await fetchBars(symbol, timeframe)); // the app's own data feed
};
const chart: ChartContext = { timeframe: '1D', bars: (symbol, timeframe) => cache.get(`${symbol}|${timeframe}`) };

async function run(entry: (typeof indicatorRegistry)[number], inputs: Record<string, unknown>) {
  for (const r of entry.requiredSymbols?.(inputs, chart) ?? []) await load(r.symbol, r.timeframe);
  try {
    return entry.calculate(bars, inputs, chart);
  } catch (err) {
    if (!(err instanceof MissingSymbolDataError)) throw err;
    await Promise.all(err.requests.map((r) => load(r.symbol, r.timeframe)));
    return entry.calculate(bars, inputs, chart);
  }
}
```

Give the exchange time zone and session of the other symbols with `symbolInfo(symbol)` in the context: the bars of a
stock requested on a crypto chart close and change trading day by its exchange hours. `MissingSymbolDataError`, the
context fields (`bars`, `symbolInfo`, `basecurrency`, `root`) and the merge come from oakscriptjs, so the same error
class is thrown by the ports and by `executeScript`. Ports align the other bars on the chart bars with
`securityOther(chartBars, otherBars, timeframe, otherSymbolChart(chartBars, chart), { other: chart.symbolInfo?.(symbol) })`
(`securityLowerTf` for `request.security_lower_tf`; spread symbols "A * B": `spreadBars`, see `src/other-symbol.ts`).

## Drawing Results with the Renderer

`lightweight-charts-indicators/render` draws a complete indicator result (plots, fills, hlines, markers, arrows, bar
and background colours, plotcandle / plotbar, labels, lines, boxes, linefills, polylines, tables) on a chart you
own. It needs `lightweight-charts` 5 (optional peer dependency) and is published as an ES module.

```typescript
import { createChart, CandlestickSeries } from 'lightweight-charts';
import { indicatorRegistry } from 'lightweight-charts-indicators';
import { IndicatorRenderer } from 'lightweight-charts-indicators/render';

const chart = createChart(document.getElementById('chart')!);
const candles = chart.addSeries(CandlestickSeries);
candles.setData(bars);

const rsi = indicatorRegistry.find((e) => e.id === 'rsi')!;
const renderer = new IndicatorRenderer(chart, { paneIndex: 1, mainSeries: candles });
renderer.render(rsi, rsi.calculate(bars, { length: 14 }), bars, { inputs: { length: 14 } });

renderer.series(); // the series it created, plot series first
renderer.clear();  // removes everything it drew
```

One instance draws one indicator; use one instance per indicator. Each `render()` replaces what the instance drew
before, and the indicator pane keeps its height across a redraw.

- **Panes**: an overlay indicator draws in pane 0, the others in `paneIndex`; `force_overlay` output goes to pane 0.
- **Bar colours** (`barcolor`) repaint the bars of `mainSeries` (candlestick or bar series, Heikin Ashi included)
  without changing its data. Without `mainSeries`, bar colours are not drawn.
- **Bars after the last bar**: drawings on future bars are placed without adding time-scale slots; pass
  `extendTimeScale: true` to add them.
- **`preserveEmptyPane: true`** keeps the pane when `clear()` empties it.
- **Render options**: `inputs` (plots whose visibility follows an input), `plots` (per-plot `visible`, `color`,
  `lineWidth`, `style`, `palette`), `lastValueVisible`, `titleVisible`, `priceLineVisible`, `precision`, and
  `autoscale: false` to leave the indicator out of the price-pane autoscale.
- **Live updates**: `reuseSeries: true` keeps the series of the previous render (same indicator, bars changed at
  the end). Series of the same type, pane and creation order are kept; when only their newest points changed
  (or a bar was added) those points are updated instead of the whole data being set again.

The demo page (`example/`) uses the same renderer.

## Source Code of the Built-in Indicators

`lightweight-charts-indicators/sources` gives the source code of every standard (built-in) indicator by registry id:
a plain JavaScript module in the library's indicator shape (`metadata`, `inputConfig`, `plotConfig`, `defaultInputs`,
`calculate`), with the registry's names in `metadata`. It imports only `oakscriptjs` and
`lightweight-charts-indicators/helpers` (chart context accessors, higher-timeframe periods, other-symbol requests,
lower-timeframe volume, bar times), so a host can show it, or run a copy of it as a user script by providing those two
modules. The table is about 500 kB: load it on demand.

```typescript
const { builtinSource } = await import('lightweight-charts-indicators/sources');
const rsiSource = builtinSource('rsi'); // string | undefined
```

## Lightweight-Charts Integration Example

Here's a complete example showing how to integrate indicators with lightweight-charts without the renderer:

```typescript
import { createChart, ColorType, LineSeries, CandlestickSeries } from 'lightweight-charts';
import { SMA, RSI, BollingerBands } from 'lightweight-charts-indicators';
import type { Bar } from 'oakscriptjs';

// Sample OHLCV data
const bars: Bar[] = [
  { time: 1609459200, open: 100, high: 105, low: 98, close: 103, volume: 1000 },
  { time: 1609545600, open: 103, high: 108, low: 101, close: 107, volume: 1200 },
  { time: 1609632000, open: 107, high: 110, low: 104, close: 105, volume: 900 },
  // ... more bars
];

// Create the main chart
const chartContainer = document.getElementById('chart')!;
const chart = createChart(chartContainer, {
  layout: {
    background: { type: ColorType.Solid, color: '#1e1e1e' },
    textColor: '#d1d4dc',
  },
  width: 800,
  height: 400,
});

// Add candlestick series
const candlestickSeries = chart.addSeries(CandlestickSeries);
candlestickSeries.setData(bars.map(bar => ({
  time: bar.time as number,
  open: bar.open,
  high: bar.high,
  low: bar.low,
  close: bar.close,
})));

// Calculate and add SMA overlay
const smaResult = SMA.calculate(bars, { len: 20, src: 'close' });
const smaSeries = chart.addSeries(LineSeries, { color: '#2962FF', lineWidth: 2 });
smaSeries.setData(smaResult.plots.plot0);

// Calculate and add Bollinger Bands
const bbResult = BollingerBands.calculate(bars, { length: 20, mult: 2 });
const bbUpperSeries = chart.addSeries(LineSeries, { color: '#787B86', lineWidth: 1 });
const bbMiddleSeries = chart.addSeries(LineSeries, { color: '#FF6D00', lineWidth: 1 });
const bbLowerSeries = chart.addSeries(LineSeries, { color: '#787B86', lineWidth: 1 });
bbUpperSeries.setData(bbResult.plots.plot0);  // Upper band
bbMiddleSeries.setData(bbResult.plots.plot1); // Basis (middle)
bbLowerSeries.setData(bbResult.plots.plot2);  // Lower band

// Create a separate pane for RSI (oscillator)
const rsiContainer = document.getElementById('rsi-chart')!;
const rsiChart = createChart(rsiContainer, {
  layout: {
    background: { type: ColorType.Solid, color: '#1e1e1e' },
    textColor: '#d1d4dc',
  },
  width: 800,
  height: 150,
});

const rsiResult = RSI.calculate(bars, { length: 14, src: 'close' });
const rsiSeries = rsiChart.addSeries(LineSeries, { color: '#7E57C2', lineWidth: 2 });
rsiSeries.setData(rsiResult.plots.plot0);

// Sync the time scales
chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
  if (range) rsiChart.timeScale().setVisibleLogicalRange(range);
});
```

## Available Indicators (1,805)

### Moving Averages

| Indicator | Export | Description |
|-----------|--------|-------------|
| Simple Moving Average | `SMA` | Arithmetic mean over a specified period |
| Exponential Moving Average | `EMA` | Weighted average giving more weight to recent prices |
| Weighted Moving Average | `WMA` | Linearly increasing weights |
| Double EMA | `DEMA` | Reduces lag by applying EMA twice |
| Triple EMA | `TEMA` | Further reduces lag with triple exponential smoothing |
| Hull Moving Average | `HMA` | Reduces lag while maintaining smoothness |
| Least Squares Moving Average | `LSMA` | Uses linear regression to fit a line |
| Arnaud Legoux Moving Average | `ALMA` | Gaussian distribution to reduce lag |
| Volume Weighted Moving Average | `VWMA` | Moving average weighted by volume |
| Smoothed Moving Average | `SMMA` | Wilder smoothing moving average |
| McGinley Dynamic | `McGinleyDynamic` | Adaptive moving average that adjusts to market speed |
| MA Cross | `MACross` | Two moving averages for crossover signals |
| Moving Average Ribbon | `MARibbon` | Multiple MAs showing trend direction and momentum |
| Zero Lag LSMA | `ZLSMA` | Double linreg to cancel LSMA lag |
| Kaufman's Adaptive Moving Average | `KaufmansAdaptiveMovingAverage` | Moving average whose speed follows the efficiency ratio of the price |
| Visible Average Price | `VisibleAveragePrice` | Average price of the bars visible on the chart |

### Oscillators

| Indicator | Export | Description |
|-----------|--------|-------------|
| Relative Strength Index | `RSI` | Momentum oscillator (0-100) measuring price changes |
| Stochastic | `Stochastic` | Compares closing price to price range |
| Stochastic RSI | `StochRSI` | Stochastic applied to RSI values |
| Commodity Channel Index | `CCI` | Measures variation from statistical mean |
| Williams %R | `WilliamsPercentRange` | Momentum showing overbought/oversold levels |
| Awesome Oscillator | `AwesomeOscillator` | Market momentum using SMA difference |
| Chande Momentum Oscillator | `ChandeMO` | Momentum on a scale of -100 to +100 |
| Detrended Price Oscillator | `DPO` | Removes trend to identify cycles |
| Relative Vigor Index | `RVI` | Measures conviction of price action |
| SMI Ergodic Indicator | `SMIErgodic` | TSI-based momentum with signal line |
| SMI Ergodic Oscillator | `SMIErgodicOscillator` | SMI minus signal as histogram |
| True Strength Index | `TSI` | Double-smoothed momentum oscillator |
| Woodies CCI | `WoodiesCCI` | CCI with turbo for faster signals |
| Bollinger Bands %B | `BBPercentB` | Price position relative to BB (0=lower, 1=upper) |
| Fisher Transform | `FisherTransform` | Gaussian distribution for clearer turning points |
| Ultimate Oscillator | `UltimateOscillator` | Multi-timeframe weighted momentum |
| Rank Correlation Index | `RCI` | Correlation between price rank and time rank |
| RCI Ribbon | `RCIRibbon` | Multiple RCI lines for trend visualization |
| Relative Volatility Index | `RelativeVolatilityIndex` | Volatility-based oscillator |
| Chop Zone | `ChopZone` | Colored zone indicator for market choppiness |
| CCT Bollinger Band Oscillator | `CCTBBO` | Normalized BB position (0-100) with signal line |
| KDJ | `KDJ` | Extended Stochastic with J line (3K - 2D) |
| WaveTrend | `WaveTrend` | Channel index oscillator with cross signals |
| Forecast Oscillator | `ForecastOscillator` | Percentage deviation from linear regression |
| Schaff Trend Cycle | `SchaffTrendCycle` | Double stochastic smoothing of MACD |
| Correlation Coefficient | `CorrelationCoefficient` | Correlation between the chart symbol and another symbol |
| RSI Divergence Indicator | `RsiDivergenceIndicator` | RSI with regular and hidden divergence lines and labels |
| Stochastic Momentum Index | `StochasticMomentumIndexStandard` | Close relative to the midpoint of the high-low range, double smoothed |
| Technical Ratings | `TechnicalRatingsStandard` | Buy and sell rating from moving averages and oscillators |

### Momentum

| Indicator | Export | Description |
|-----------|--------|-------------|
| MACD | `MACD` | Relationship between two moving averages (EMA or SMA) |
| Momentum | `Momentum` | Rate of change of price |
| Rate of Change | `ROC` | Percentage change over a period |
| Balance of Power | `BOP` | Strength of buyers vs sellers |
| Bull Bear Power | `BullBearPower` | Buying/selling pressure relative to EMA |
| Elder Force Index | `ElderForceIndex` | Combines price and volume |
| Price Oscillator (PPO) | `PriceOscillator` | MACD as percentage for comparison |
| Coppock Curve | `CoppockCurve` | Long-term momentum using ROC and WMA |
| TRIX | `TRIX` | Triple EMA rate of change, filters noise |
| Connors RSI | `ConnorsRSI` | Composite of RSI, streak, and percentile rank |
| KST | `KST` | Know Sure Thing - weighted ROC sum |
| MACD 4C | `MACD4C` | MACD histogram with 4-color coding |
| Squeeze Momentum | `SqueezeMomentum` | BB/KC squeeze with momentum oscillator |
| Impulse MACD | `ImpulseMACD` | ZLEMA vs SMMA channel impulse |
| Advance/Decline Ratio (Bars) | `AdvanceDeclineRatioBars` | Ratio of up bars to down bars over a lookback period |
| Performance | `Performance` | Table of price changes over several periods for a list of symbols |
| Price Momentum Oscillator | `PriceMomentumOscillatorStandard` | Double-smoothed rate of change with a signal line |
| Seasonality | `Seasonality` | Monthly price changes per year in a heatmap table, with averages |

### Trend

| Indicator | Export | Description |
|-----------|--------|-------------|
| Average Directional Index | `ADX` | Measures trend strength regardless of direction |
| Directional Movement Index | `DMI` | +DI, -DI, and ADX for trend direction/strength |
| Ichimoku Cloud | `IchimokuCloud` | Comprehensive trend system with support/resistance |
| Parabolic SAR | `ParabolicSAR` | Trend-following with entry/exit points |
| Supertrend | `Supertrend` | ATR-based dynamic support/resistance |
| Aroon | `Aroon` | Trend strength by time since high/low |
| BBTrend | `BBTrend` | Measures trend using Bollinger Bands |
| Choppiness Index | `Choppiness` | Market choppiness vs trending |
| Mass Index | `MassIndex` | Identifies reversals via high-low range |
| Vortex Indicator | `VortexIndicator` | Identifies trend start and direction |
| Williams Alligator | `WilliamsAlligator` | Three smoothed MAs for trend detection |
| Zig Zag | `ZigZag` | Connects pivot highs and lows |
| Trend Strength Index | `TrendStrengthIndex` | Trend strength based on directional movement |
| Chande Kroll Stop | `ChandeKrollStop` | ATR-based trailing stop system |
| Williams Fractals | `WilliamsFractals` | Identifies reversal points in price |
| Moon Phases | `MoonPhases` | New and full moon markers |
| TWAP | `TWAP` | Time-weighted average price |
| Coral Trend | `CoralTrend` | Cascaded EMA filter for smooth trend detection |
| Chandelier Exit | `ChandelierExit` | ATR-based trailing stop system |
| Donchian Trend Ribbon | `DonchianTrendRibbon` | Multi-layer Donchian breakout composite score |
| Auto Fib Extension | `AutoFibExtension` | Fibonacci extension levels drawn from the last three pivots |
| Auto Fib Retracement | `AutoFibRetracement` | Fibonacci retracement levels drawn on the last zigzag leg |
| Auto Pitchfork | `AutoPitchfork` | Andrews pitchfork drawn from the last three zigzag pivots |
| Chandelier Exit | `ChandelierExitStandard` | ATR trailing stops from the highest high and lowest low |
| Multi-Time Period Charts | `MultiTimePeriodCharts` | Higher-timeframe candles drawn as boxes on the chart |
| Pivot Points High Low | `PivotPointsHighLow` | Labels on pivot highs and pivot lows |
| Rob Booker - Ziv Ghost Pivots | `RobBookerZivGhostPivots` | Typical prices of the current 4-hour, day, week and month periods |

### Volatility

| Indicator | Export | Description |
|-----------|--------|-------------|
| Average True Range | `ATR` | Average range between high and low |
| Average Day Range | `ADR` | Average daily price range |
| Standard Deviation | `StandardDeviation` | Measures price volatility |
| Historical Volatility | `HistoricalVolatility` | Annualized standard deviation of log returns |
| Bollinger BandWidth | `BBBandWidth` | Width of Bollinger Bands as percentage |
| Bollinger Bars | `BollingerBars` | Colored candles based on BB position |
| Gaps | `Gaps` | Boxes on price gaps until they are closed |
| Trading Sessions | `TradingSessions` | Ranges and averages of the Asian, London and New York sessions |

### Channels & Bands

| Indicator | Export | Description |
|-----------|--------|-------------|
| Bollinger Bands | `BollingerBands` | Volatility bands using standard deviation |
| Keltner Channels | `KeltnerChannels` | Volatility envelope using EMA and ATR |
| Donchian Channels | `DonchianChannels` | Highest high and lowest low over period |
| Envelope | `Envelope` | Moving average with fixed percentage bands |
| Median | `Median` | Median price with ATR bands |
| Linear Regression Channel | `LinearRegressionChannelStandard` | Linear regression line with deviation bands on the last bars |
| Pivot Points Standard | `PivotPointsStandard` | Pivot levels of higher-timeframe periods (Traditional, Fibonacci, Woodie, Classic, DM, Camarilla) |

### Volume

| Indicator | Export | Description |
|-----------|--------|-------------|
| On Balance Volume | `OBV` | Cumulative volume based on price direction |
| Money Flow Index | `MFI` | Volume-weighted RSI |
| Price Volume Trend | `PVT` | Cumulative volume weighted by price changes |
| Volume Oscillator | `VolumeOscillator` | Percentage difference between volume EMAs |
| Chaikin Money Flow | `ChaikinMF` | Buying/selling pressure using price and volume |
| Chaikin Oscillator | `ChaikinOscillator` | Momentum of Accumulation/Distribution line |
| Ease of Movement | `EaseOfMovement` | Price change relative to volume |
| Klinger Oscillator | `KlingerOscillator` | Volume-based long-term money flow |
| Net Volume | `NetVolume` | Difference between up and down volume |
| Volume Delta | `VolumeDelta` | Difference between buying and selling volume |
| Cumulative Volume Delta | `CumulativeVolumeDelta` | Running total of volume delta |
| Relative Volume at Time | `RelativeVolumeAtTime` | Current volume vs historical average |
| Colored Volume Bars | `ColoredVolume` | Volume colored by price/volume trend |
| OBV MACD | `OBVMACD` | MACD applied to On Balance Volume |
| 24-hour Volume | `TwentyFourHourVolume` | Sum of the traded value of the last 24 hours, from lower-timeframe bars |
| Accumulation/Distribution | `AccumulationDistribution` | Cumulative volume weighted by the close location inside the bar range |

### Community Indicators (1,551)

1643 community indicators ported from PineScript sources, covering trend systems, divergence detectors, multi-MA strategies, volume analysis, market structure, and more. Full list in [docs/INDICATOR_INVENTORY_COMMUNITY.md](docs/INDICATOR_INVENTORY_COMMUNITY.md).

Categories include: Hyper Trend, AlphaTrend, HalfTrend, QQE MOD, Hull Suite, SuperTrend variants, Market Structure Trailing Stop, Liquidity Levels, Order Blocks, ZigZag Fibonacci, Trendlines with Breaks, and many more.

Drawing primitive support: Lines (`LineDrawingData`), Boxes (`BoxData`), Labels (`LabelData`), Linefills (`LinefillData`), Polylines (`PolylineData`), Tables (`tables: TableData[]`), Markers, Bar Colors, Background Colors, Plot Candles and Plot Bars. These are the oakscriptjs `IndicatorResult` types, shared with scripts run with `executeScript`: a property that is not set is omitted (the PineScript default applies) and an na colour is `'transparent'`.

### Candlestick Patterns (45)

All 44 patterns from the standard candlestick pattern set, rendered as chart markers, and the combined "*All Candlestick Patterns*" indicator (`AllPatterns`, id `all-patterns`) with its per-pattern toggles and Pattern Type filter.

| Pattern | Signal | Candles |
|---------|--------|---------|
| Abandoned Baby | Bullish / Bearish | 3 |
| Dark Cloud Cover | Bearish | 2 |
| Doji | Neutral | 1 |
| Doji Star | Bullish / Bearish | 2 |
| Downside Tasuki Gap | Bearish | 3 |
| Dragonfly Doji | Bullish | 1 |
| Engulfing | Bullish / Bearish | 2 |
| Evening Doji Star | Bearish | 3 |
| Evening Star | Bearish | 3 |
| Falling Three Methods | Bearish | 5 |
| Falling Window | Bearish | 2 |
| Gravestone Doji | Bearish | 1 |
| Hammer | Bullish | 1 |
| Hanging Man | Bearish | 1 |
| Harami | Bullish / Bearish | 2 |
| Harami Cross | Bullish / Bearish | 2 |
| Inverted Hammer | Bullish | 1 |
| Kicking | Bullish / Bearish | 2 |
| Long Lower Shadow | Bullish | 1 |
| Long Upper Shadow | Bearish | 1 |
| Marubozu Black | Bearish | 1 |
| Marubozu White | Bullish | 1 |
| Morning Doji Star | Bullish | 3 |
| Morning Star | Bullish | 3 |
| On Neck | Bearish | 2 |
| Piercing | Bullish | 2 |
| Rising Three Methods | Bullish | 5 |
| Rising Window | Bullish | 2 |
| Shooting Star | Bearish | 1 |
| Spinning Top Black | Neutral | 1 |
| Spinning Top White | Neutral | 1 |
| Three Black Crows | Bearish | 3 |
| Three White Soldiers | Bullish | 3 |
| Tri-Star | Bullish / Bearish | 3 |
| Tweezer Bottom | Bullish | 2 |
| Tweezer Top | Bearish | 2 |
| Upside Tasuki Gap | Bullish | 3 |

## Output Format

All indicators return an `IndicatorResult` object:

```typescript
interface IndicatorResult {
  metadata: {
    title: string;
    shortTitle: string;
    overlay: boolean;  // true = display on price chart, false = separate pane
  };
  plots: {
    plot0: Array<{ time: number; value: number }>;
    plot1?: Array<{ time: number; value: number }>;
    // ... additional plots as needed
  };
}
```

## Indicator Registry

For dynamic indicator selection (e.g., building a UI), use the `indicatorRegistry`:

```typescript
import { indicatorRegistry } from 'lightweight-charts-indicators';

// List all indicators
indicatorRegistry.forEach(indicator => {
  console.log(`${indicator.name} (${indicator.category})`);
});

// Get indicator by ID
const sma = indicatorRegistry.find(i => i.id === 'sma');
const result = sma?.calculate(bars, sma.defaultInputs);

// Filter by category
const oscillators = indicatorRegistry.filter(i => i.category === 'Oscillators');
```

### Settings dialog

Each registry entry gives its inputs in `inputConfig`, in the order, with the titles, limits and layout of the
original indicator. A settings dialog can be built from these fields:

| Field | Meaning |
|---|---|
| `title`, `type`, `defval`, `options`, `min`, `max`, `step` | Label, control and limits (an empty title has no label) |
| `group` | Section header: consecutive inputs with the same group are shown under it |
| `inline` | Inputs with the same `inline` id are shown on one row |
| `tooltip` | Info text of the input |
| `display` | Where the value is shown outside the dialog (`'all'`, `'none'`, ...) |
| `active` | The input is greyed out unless the condition on other inputs holds |

```typescript
import { isInputActive } from 'oakscriptjs';
import { indicatorRegistry } from 'lightweight-charts-indicators';

const { inputConfig } = indicatorRegistry.find(i => i.id === 'ma-ribbon')!;
const inputs = { showMa2: false };

for (const input of inputConfig) {
  const enabled = isInputActive(input, inputs, inputConfig); // ma2Type, ma2Source, ma2Length, ma2Color: false
}
```

An inactive input still gives its value to `calculate`.

## Building

```bash
npm run build
```

## Testing

```bash
npm test
```

## License

MIT
