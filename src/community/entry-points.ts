/**
 * Entry Points
 *
 * Buy/sell entry signals based on RSI extremes combined with EMA trend filter.
 * Buy: RSI < 30 and close > EMA. Sell: RSI > 70 and close < EMA.
 *
 * Reference: TradingView "Entry Points" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface EntryPointsInputs {
  rsiLen: number;
  emaLen: number;
  src: SourceType;
}

export const defaultInputs: EntryPointsInputs = {
  rsiLen: 14,
  emaLen: 20,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'emaLen', type: 'int', title: 'EMA Length', defval: 20, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'Entry Points',
  shortTitle: 'EntryPts',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<EntryPointsInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { rsiLen, emaLen, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  const rsiArr = ta.rsi(source, rsiLen).toArray();
  const emaArr = ta.ema(source, emaLen).toArray();

  const warmup = Math.max(rsiLen, emaLen);
  const markers: MarkerData[] = [];

  const plot0 = emaArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || v == null || isNaN(v) ? NaN : v,
  }));

  for (let i = warmup; i < bars.length; i++) {
    const rsi = rsiArr[i];
    const ema = emaArr[i];
    if (isNaN(rsi) || ema == null || isNaN(ema)) continue;

    if (rsi < 30 && bars[i].close > ema) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#26A69A', text: 'Buy' });
    }
    if (rsi > 70 && bars[i].close < ema) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'Sell' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    markers,
  };
}

export const EntryPoints = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
