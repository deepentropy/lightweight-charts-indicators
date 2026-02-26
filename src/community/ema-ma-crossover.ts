/**
 * EMA & MA Crossover
 *
 * EMA and SMA plotted together for crossover signals.
 *
 * Reference: TradingView "EMA & MA Crossover" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface EMAMACrossInputs {
  emaLen: number;
  smaLen: number;
  src: SourceType;
}

export const defaultInputs: EMAMACrossInputs = {
  emaLen: 12,
  smaLen: 26,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLen', type: 'int', title: 'EMA Length', defval: 12, min: 1 },
  { id: 'smaLen', type: 'int', title: 'SMA Length', defval: 26, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: '#00E676', lineWidth: 1 },
  { id: 'plot1', title: 'SMA', color: '#FF5252', lineWidth: 1 },
];

export const metadata = {
  title: 'EMA & MA Crossover',
  shortTitle: 'EMAC',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<EMAMACrossInputs> = {}): IndicatorResult {
  const { emaLen, smaLen, src } = { ...defaultInputs, ...inputs };
  const srcSeries = getSourceSeries(bars, src);

  const emaArr = ta.ema(srcSeries, emaLen).toArray();
  const smaArr = ta.sma(srcSeries, smaLen).toArray();
  const warmup = Math.max(emaLen, smaLen);

  const plot0 = emaArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  const plot1 = smaArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
  };
}

export const EMAMACross = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
