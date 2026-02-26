/**
 * TMA Bands - Triangular Moving Average Bands
 *
 * TMA is a double-smoothed SMA: SMA of SMA.
 * Bands are offset by ATR * multiplier.
 *
 * Reference: TradingView "TMA Bands"
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface TMABandsInputs {
  length: number;
  atrMultiplier: number;
  atrLength: number;
}

export const defaultInputs: TMABandsInputs = {
  length: 20,
  atrMultiplier: 2.0,
  atrLength: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'atrMultiplier', type: 'float', title: 'ATR Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TMA', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Upper', color: '#26A69A', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: '#EF5350', lineWidth: 1 },
];

export const metadata = {
  title: 'TMA Bands',
  shortTitle: 'TMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TMABandsInputs> = {}): IndicatorResult {
  const { length, atrMultiplier, atrLength } = { ...defaultInputs, ...inputs };

  const closeSeries = new Series(bars, (b) => b.close);

  const halfLen = Math.ceil(length / 2);
  const secondLen = Math.floor(length / 2) + 1;

  const sma1Arr = ta.sma(closeSeries, halfLen).toArray();
  const sma1Series = new Series(bars, (_b, i) => sma1Arr[i] ?? 0);
  const tmaArr = ta.sma(sma1Series, secondLen).toArray();

  const atrArr = ta.atr(bars, atrLength).toArray();

  const warmup = length + atrLength;

  const plot0 = bars.map((b, i) => {
    const t = tmaArr[i];
    if (i < warmup || t == null || isNaN(t)) return { time: b.time, value: NaN };
    return { time: b.time, value: t };
  });

  const plot1 = bars.map((b, i) => {
    const t = tmaArr[i];
    const a = atrArr[i];
    if (i < warmup || t == null || isNaN(t) || a == null || isNaN(a)) return { time: b.time, value: NaN };
    return { time: b.time, value: t + atrMultiplier * a };
  });

  const plot2 = bars.map((b, i) => {
    const t = tmaArr[i];
    const a = atrArr[i];
    if (i < warmup || t == null || isNaN(t) || a == null || isNaN(a)) return { time: b.time, value: NaN };
    return { time: b.time, value: t - atrMultiplier * a };
  });

  const fillColors = bars.map((_b, i) => (i < warmup ? 'transparent' : '#2962FF20'));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    fills: [{ plot1: 'plot1', plot2: 'plot2', colors: fillColors }],
  };
}

export const TMABands = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
