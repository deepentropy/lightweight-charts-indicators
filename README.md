# lightweight-charts-indicators

**[Live Demo](https://deepentropy.github.io/lightweight-charts-indicators/)**

70+ technical analysis indicators for TradingView's lightweight-charts library. PineScript v6 compatible and validated against TradingView's built-in indicators.

## Installation

```bash
npm install lightweight-charts-indicators oakscriptjs lightweight-charts
```

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

## Lightweight-Charts Integration Example

Here's a complete example showing how to integrate indicators with TradingView's lightweight-charts:

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

## Available Indicators (70+)

### Moving Averages

| Indicator | Export | Description |
|-----------|--------|-------------|
| Simple Moving Average | `SMA` | Arithmetic mean over a specified period |
| Exponential Moving Average | `EMA` | Weighted average giving more weight to recent prices |
| Weighted Moving Average | `WMA` | Linearly increasing weights |
| Smoothed Moving Average (RMA) | `RMA` | Wilder smoothing (alpha = 1/length) |
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

### Momentum

| Indicator | Export | Description |
|-----------|--------|-------------|
| MACD | `MACD` | Relationship between two EMAs |
| Momentum | `Momentum` | Rate of change of price |
| Rate of Change | `ROC` | Percentage change over a period |
| Balance of Power | `BOP` | Strength of buyers vs sellers |
| Bull Bear Power | `BullBearPower` | Buying/selling pressure relative to EMA |
| Elder Force Index | `ElderForceIndex` | Combines price and volume |
| Price Oscillator (PPO) | `PriceOscillator` | MACD as percentage for comparison |
| Coppock Curve | `CoppockCurve` | Long-term momentum using ROC and WMA |
| TRIX | `TRIX` | Triple EMA rate of change, filters noise |

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

### Volatility

| Indicator | Export | Description |
|-----------|--------|-------------|
| Average True Range | `ATR` | Average range between high and low |
| Average Day Range | `ADR` | Average daily price range |
| Standard Deviation | `StandardDeviation` | Measures price volatility |
| Historical Volatility | `HistoricalVolatility` | Annualized standard deviation of log returns |
| Bollinger BandWidth | `BBBandWidth` | Width of Bollinger Bands as percentage |

### Channels & Bands

| Indicator | Export | Description |
|-----------|--------|-------------|
| Bollinger Bands | `BollingerBands` | Volatility bands using standard deviation |
| Keltner Channels | `KeltnerChannels` | Volatility envelope using EMA and ATR |
| Donchian Channels | `DonchianChannels` | Highest high and lowest low over period |
| Envelope | `Envelope` | Moving average with fixed percentage bands |
| Median | `Median` | Median price with ATR bands |

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
