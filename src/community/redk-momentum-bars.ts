/**
 * RedK Momentum Bars (Mo_Bars v3.0)
 *
 * Trading system of 2 short MAs and a long filter MA.
 * Displays momentum as plotcandle bars relative to filter.
 * Custom LazyLine (triple WMA) smoothing function.
 *
 * Reference: TradingView "[dev]RedK Momentum Bars" by RedKTrader
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface RedKMomentumBarsInputs {
  fastLength: number;
  fastType: string;
  slowLength: number;
  slowType: string;
  slowDelay: number;
  filterLength: number;
  filterType: string;
}

export const defaultInputs: RedKMomentumBarsInputs = {
  fastLength: 10,
  fastType: 'SMA',
  slowLength: 20,
  slowType: 'SMA',
  slowDelay: 3,
  filterLength: 50,
  filterType: 'SMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast MA Length', defval: 10, min: 1 },
  { id: 'fastType', type: 'string', title: 'Fast MA Type', defval: 'SMA', options: ['RSS_WMA', 'WMA', 'EMA', 'SMA', 'HMA'] },
  { id: 'slowLength', type: 'int', title: 'Slow MA Length', defval: 20, min: 1 },
  { id: 'slowType', type: 'string', title: 'Slow MA Type', defval: 'SMA', options: ['RSS_WMA', 'WMA', 'EMA', 'SMA', 'HMA'] },
  { id: 'slowDelay', type: 'int', title: 'Delay (1 = None)', defval: 3, min: 1 },
  { id: 'filterLength', type: 'int', title: 'Filter MA Length', defval: 50, min: 1 },
  { id: 'filterType', type: 'string', title: 'Filter MA Type', defval: 'SMA', options: ['RSS_WMA', 'WMA', 'EMA', 'SMA', 'HMA'] },
];

export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'mobars', title: 'MoBars' },
];

export const metadata = {
  title: 'RedK Momentum Bars',
  shortTitle: 'MoBars',
  overlay: false,
};

function lazyLine(data: Series, length: number): Series {
  if (length <= 2) return data;
  const w2 = Math.round(length / 3);
  const w1 = Math.round((length - w2) / 2);
  const w3 = Math.floor((length - w2) / 2);
  const L1 = ta.wma(data, Math.max(1, w1));
  const L2 = ta.wma(L1, Math.max(1, w2));
  return ta.wma(L2, Math.max(1, w3));
}

function getMA(source: Series, length: number, type: string): Series {
  switch (type) {
    case 'SMA': return ta.sma(source, length);
    case 'EMA': return ta.ema(source, length);
    case 'WMA': return ta.wma(source, length);
    case 'HMA': return ta.hma(source, length);
    default: return lazyLine(source, length); // RSS_WMA
  }
}

export function calculate(bars: Bar[], inputs: Partial<RedKMomentumBarsInputs> = {}): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  const { fastLength, fastType, slowLength, slowType, slowDelay, filterLength, filterType } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = new Series(bars, (b) => b.close);

  // Calculate MAs
  const fast = getMA(closeSeries, fastLength, fastType);
  const slow = getMA(closeSeries, slowLength, slowType);
  const filter = getMA(closeSeries, filterLength, filterType);

  const fastArr = fast.toArray();
  const slowArr = slow.toArray();
  const filterArr = filter.toArray();

  // Momentum relative to filter
  const fastM: number[] = new Array(n);
  const slowM: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    fastM[i] = (fastArr[i] ?? NaN) - (filterArr[i] ?? NaN);
    slowM[i] = (slowArr[i] ?? NaN) - (filterArr[i] ?? NaN);
  }

  // Relative momentum = WMA of slowM with slowDelay
  const slowMSeries = Series.fromArray(bars, slowM);
  const relMArr = ta.wma(slowMSeries, slowDelay).toArray();

  // Prep momentum bars
  const warmup = filterLength;
  const candles: PlotCandleData[] = [];

  for (let i = 0; i < n; i++) {
    if (i < warmup || relMArr[i] == null || isNaN(relMArr[i]!) || isNaN(fastM[i])) {
      candles.push({ time: bars[i].time as number, open: NaN, high: NaN, low: NaN, close: NaN });
      continue;
    }

    const o = relMArr[i]!;
    const c = fastM[i];
    const h = Math.max(o, c);
    const l = Math.min(o, c);

    const prevC = i > 0 ? fastM[i - 1] : c;
    const rising = c - prevC > 0;

    let barColor: string;
    let borderColor: string;
    if (c > o && rising) {
      barColor = '#11ff20'; borderColor = '#1b5e20';
    } else if (c < o && !rising) {
      barColor = '#ff1111'; borderColor = '#981919';
    } else {
      barColor = '#ffffff'; borderColor = '#9598a1';
    }

    candles.push({
      time: bars[i].time as number,
      open: o, high: h, low: l, close: c,
      color: barColor, borderColor, wickColor: barColor,
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    plotCandles: { mobars: candles },
    hlines: [
      { value: 0, options: { color: '#2962FF', linestyle: 'solid', title: 'Zero Line' } },
    ],
  };
}

export const RedKMomentumBars = { calculate, metadata, defaultInputs, inputConfig, plotConfig, plotCandleConfig };
