/**
 * Moving Average Shaded Fill Area Crossover
 *
 * Two EMAs with fill between them. Fast line colored green when above slow, red when below.
 *
 * Reference: TradingView "Moving Average Shaded Fill Area Crossover" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MAShadedFillInputs {
  fastLen: number;
  slowLen: number;
  src: SourceType;
}

export const defaultInputs: MAShadedFillInputs = {
  fastLen: 9,
  slowLen: 21,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLen', type: 'int', title: 'Fast Length', defval: 9, min: 1 },
  { id: 'slowLen', type: 'int', title: 'Slow Length', defval: 21, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA', color: '#00E676', lineWidth: 1 },
  { id: 'plot1', title: 'Slow EMA', color: '#FF5252', lineWidth: 1 },
];

export const metadata = {
  title: 'MA Shaded Fill Crossover',
  shortTitle: 'MASF',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<MAShadedFillInputs> = {}): IndicatorResult {
  const { fastLen, slowLen, src } = { ...defaultInputs, ...inputs };
  const srcSeries = getSourceSeries(bars, src);

  const fastArr = ta.ema(srcSeries, fastLen).toArray();
  const slowArr = ta.ema(srcSeries, slowLen).toArray();
  const warmup = Math.max(fastLen, slowLen);

  const plot0 = fastArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const fv = v ?? 0;
    const sv = slowArr[i] ?? 0;
    return { time: bars[i].time, value: fv, color: fv > sv ? '#00E676' : '#FF5252' };
  });

  const plot1 = slowArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  const fillColors = bars.map((_b, i) => {
    if (i < warmup) return 'transparent';
    const fv = fastArr[i] ?? 0;
    const sv = slowArr[i] ?? 0;
    return fv > sv ? '#00E67640' : '#FF525240';
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    fills: [{ plot1: 'plot0', plot2: 'plot1', colors: fillColors }],
  };
}

export const MAShadedFill = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
