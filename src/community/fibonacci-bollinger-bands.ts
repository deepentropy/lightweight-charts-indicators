/**
 * Fibonacci Bollinger Bands
 *
 * VWMA basis with 6 Fibonacci stdev bands (upper + lower).
 * Bands at 0.236, 0.382, 0.5, 0.618, 0.764, 1.0 * mult * stdev.
 *
 * Reference: TradingView "Fibonacci Bollinger Bands" by Rashad
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface FibonacciBollingerBandsInputs {
  length: number;
  mult: number;
}

export const defaultInputs: FibonacciBollingerBandsInputs = {
  length: 200,
  mult: 3.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 200, min: 1 },
  { id: 'mult', type: 'float', title: 'Multiplier', defval: 3.0, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Basis', color: '#FF00FF', lineWidth: 2 },
  { id: 'plot1', title: 'Upper 1', color: '#787B86', lineWidth: 1 },
  { id: 'plot2', title: 'Lower 1', color: '#787B86', lineWidth: 1 },
  { id: 'plot3', title: 'Upper 2', color: '#787B86', lineWidth: 1 },
  { id: 'plot4', title: 'Lower 2', color: '#787B86', lineWidth: 1 },
  { id: 'plot5', title: 'Upper 3', color: '#787B86', lineWidth: 1 },
  { id: 'plot6', title: 'Lower 3', color: '#787B86', lineWidth: 1 },
  { id: 'plot7', title: 'Upper 4', color: '#787B86', lineWidth: 1 },
  { id: 'plot8', title: 'Lower 4', color: '#787B86', lineWidth: 1 },
  { id: 'plot9', title: 'Upper 5', color: '#787B86', lineWidth: 1 },
  { id: 'plot10', title: 'Lower 5', color: '#787B86', lineWidth: 1 },
  { id: 'plot11', title: 'Upper 6', color: '#EF5350', lineWidth: 2 },
  { id: 'plot12', title: 'Lower 6', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'Fibonacci Bollinger Bands',
  shortTitle: 'FBB',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<FibonacciBollingerBandsInputs> = {}): IndicatorResult {
  const { length, mult } = { ...defaultInputs, ...inputs };

  const src = getSourceSeries(bars, 'hlc3');
  const vol = new Series(bars, (b) => b.volume ?? 1);

  // VWMA = SMA(src * volume, length) / SMA(volume, length)
  const srcVol = src.mul(vol);
  const smaVol = ta.sma(vol, length);
  const smaSrcVol = ta.sma(srcVol, length);
  const basisArr = smaSrcVol.div(smaVol).toArray();

  const dev = ta.stdev(src, length).toArray();

  const fibs = [0.236, 0.382, 0.5, 0.618, 0.764, 1.0];
  const warmup = length;

  const makePlot = (fn: (b: number, d: number) => number) =>
    bars.map((bar, i) => {
      if (i < warmup || basisArr[i] == null || dev[i] == null) return { time: bar.time, value: NaN };
      return { time: bar.time, value: fn(basisArr[i]!, dev[i]!) };
    });

  const plots: Record<string, Array<{ time: number | string; value: number }>> = {
    'plot0': makePlot((b) => b),
  };

  fibs.forEach((f, idx) => {
    plots[`plot${1 + idx * 2}`] = makePlot((b, d) => b + f * mult * d);
    plots[`plot${2 + idx * 2}`] = makePlot((b, d) => b - f * mult * d);
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots,
  };
}

export const FibonacciBollingerBands = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
