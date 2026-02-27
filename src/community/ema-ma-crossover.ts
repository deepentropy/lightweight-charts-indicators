/**
 * EMA & MA Crossover
 *
 * EMA and SMA plotted together for crossover signals.
 *
 * Reference: TradingView "EMA & MA Crossover" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';

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

export function calculate(bars: Bar[], inputs: Partial<EMAMACrossInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
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

  // barcolor: green when EMA < SMA (pos=1), red when EMA > SMA (pos=-1), blue otherwise
  // Pine: pos = iff(xEMA < xMA, 1, iff(xEMA > xMA, -1, nz(pos[1], 0)))
  const barColors: BarColorData[] = [];
  let pos = 0;
  for (let i = warmup; i < bars.length; i++) {
    const e = emaArr[i] ?? 0;
    const s = smaArr[i] ?? 0;
    if (e < s) pos = 1;
    else if (e > s) pos = -1;
    if (pos === 1) barColors.push({ time: bars[i].time, color: '#26A69A' });
    else if (pos === -1) barColors.push({ time: bars[i].time, color: '#EF5350' });
    else barColors.push({ time: bars[i].time, color: '#2196F3' });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    barColors,
  };
}

export const EMAMACross = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
