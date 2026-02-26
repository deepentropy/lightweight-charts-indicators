/**
 * TDMacd (Tom DeMark MACD)
 *
 * Tom DeMark MACD uses close vs close[3] differencing.
 * TD = EMA(close - close[3], len1) - EMA(close - close[3], len2).
 * Signal = EMA(TD, 5).
 *
 * Reference: TradingView "Tom DeMark MACD" community indicator
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface TDMacdInputs {
  length1: number;
  length2: number;
}

export const defaultInputs: TDMacdInputs = {
  length1: 13,
  length2: 8,
};

export const inputConfig: InputConfig[] = [
  { id: 'length1', type: 'int', title: 'Length 1', defval: 13, min: 1 },
  { id: 'length2', type: 'int', title: 'Length 2', defval: 8, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TD', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 2 },
];

export const metadata = {
  title: 'Tom DeMark MACD',
  shortTitle: 'TDMacd',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<TDMacdInputs> = {}): IndicatorResult {
  const { length1, length2 } = { ...defaultInputs, ...inputs };

  // close - close[3] via manual loop
  const diffArr: number[] = new Array(bars.length);
  for (let i = 0; i < bars.length; i++) {
    if (i < 3) {
      diffArr[i] = NaN;
    } else {
      diffArr[i] = bars[i].close - bars[i - 3].close;
    }
  }

  const diffSeries = new Series(bars, (_b, i) => diffArr[i]);
  const ema1 = ta.ema(diffSeries, length1);
  const ema2 = ta.ema(diffSeries, length2);
  const td = ema1.sub(ema2);
  const signal = ta.ema(td, 5);

  const tdArr = td.toArray();
  const sigArr = signal.toArray();

  const warmup = Math.max(length1, length2) + 3;

  const toPlot = (arr: (number | null)[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: (i < warmup || v == null) ? NaN : v }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(tdArr), 'plot1': toPlot(sigArr) },
    hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dashed', title: 'Zero' } }],
  };
}

export const TDMacd = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
