# lightweight-charts-indicators

Optimized technical indicators built with OakScriptJS for use with lightweight-charts.

## Overview

This package contains hand-optimized indicators that leverage the `oakscriptjs` library for PineScript v6 compatible calculations. Designed to work seamlessly with TradingView's lightweight-charts library.

## Installation

```bash
npm install lightweight-charts-indicators oakscriptjs
```

## Usage

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

## Available Indicators

| Indicator | Type | Description |
|-----------|------|-------------|
| SMA | Overlay | Simple Moving Average |
| EMA | Overlay | Exponential Moving Average |
| WMA | Overlay | Weighted Moving Average |
| RMA | Overlay | Smoothed Moving Average (Wilder's) |
| DEMA | Overlay | Double Exponential Moving Average |
| TEMA | Overlay | Triple Exponential Moving Average |
| HMA | Overlay | Hull Moving Average |
| LSMA | Overlay | Least Squares Moving Average |
| ALMA | Overlay | Arnaud Legoux Moving Average |
| VWMA | Overlay | Volume Weighted Moving Average |
| BB | Overlay | Bollinger Bands |
| RSI | Oscillator | Relative Strength Index |
| MACD | Oscillator | Moving Average Convergence Divergence |
| Stochastic | Oscillator | Stochastic Oscillator |
| ATR | Oscillator | Average True Range |
| ADR | Oscillator | Average Day Range |
| ROC | Oscillator | Rate of Change |
| Momentum | Oscillator | Momentum |
| BOP | Oscillator | Balance of Power |
| OBV | Oscillator | On Balance Volume |
| Mass Index | Oscillator | Mass Index |
| McGinley Dynamic | Overlay | McGinley Dynamic |

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
