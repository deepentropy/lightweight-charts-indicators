/**
 * Auto-Support
 *
 * Three support levels based on lowest lows at different lookback periods.
 *
 * Reference: TradingView "Auto-Support" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AutoSupportInputs {
  len1: number;
  len2: number;
  len3: number;
}

export const defaultInputs: AutoSupportInputs = {
  len1: 10,
  len2: 20,
  len3: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'len1', type: 'int', title: 'Length 1', defval: 10, min: 1 },
  { id: 'len2', type: 'int', title: 'Length 2', defval: 20, min: 1 },
  { id: 'len3', type: 'int', title: 'Length 3', defval: 50, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'S1', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'S2', color: '#2962FF', lineWidth: 2 },
  { id: 'plot2', title: 'S3', color: '#E91E63', lineWidth: 2 },
];

export const metadata = {
  title: 'Auto-Support',
  shortTitle: 'AutoSup',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<AutoSupportInputs> = {}): IndicatorResult {
  const { len1, len2, len3 } = { ...defaultInputs, ...inputs };

  const lowSeries = new Series(bars, (b) => b.low);

  const s1Arr = ta.lowest(lowSeries, len1).toArray();
  const s2Arr = ta.lowest(lowSeries, len2).toArray();
  const s3Arr = ta.lowest(lowSeries, len3).toArray();

  const warmup = Math.max(len1, len2, len3);

  const toPlot = (arr: number[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: i < warmup || isNaN(v) ? NaN : v }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(s1Arr), 'plot1': toPlot(s2Arr), 'plot2': toPlot(s3Arr) },
  };
}

export const AutoSupport = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
