/**
 * Twin Range Filter
 *
 * Dual-range smoothing filter combining fast and slow ATR-based ranges.
 * Filter line adapts to price movement within the combined range.
 * Uptrend when filter rises, downtrend when filter falls.
 *
 * Reference: TradingView "Twin Range Filter" by colinmck
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface TwinRangeFilterInputs {
  fastPeriod: number;
  fastRange: number;
  slowPeriod: number;
  slowRange: number;
  src: SourceType;
}

export const defaultInputs: TwinRangeFilterInputs = {
  fastPeriod: 5,
  fastRange: 1.6,
  slowPeriod: 27,
  slowRange: 1.0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastPeriod', type: 'int', title: 'Fast Period', defval: 5, min: 1 },
  { id: 'fastRange', type: 'float', title: 'Fast Range', defval: 1.6, min: 0.1, step: 0.1 },
  { id: 'slowPeriod', type: 'int', title: 'Slow Period', defval: 27, min: 1 },
  { id: 'slowRange', type: 'float', title: 'Slow Range', defval: 1.0, min: 0.1, step: 0.1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Filter', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'Twin Range Filter',
  shortTitle: 'TRF',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TwinRangeFilterInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
  const { fastPeriod, fastRange, slowPeriod, slowRange, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const srcSeries = getSourceSeries(bars, src);
  const srcArr = srcSeries.toArray();

  // True range computed manually
  const trArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const high = bars[i].high;
    const low = bars[i].low;
    if (i === 0) {
      trArr[i] = high - low;
    } else {
      const prevClose = bars[i - 1].close;
      trArr[i] = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    }
  }

  // Smooth ranges: EMA of (TR * rangeMultiplier)
  const trFastSeries = new Series(bars, (_b, i) => trArr[i] * fastRange);
  const trSlowSeries = new Series(bars, (_b, i) => trArr[i] * slowRange);

  const smoothRngFast = ta.ema(trFastSeries, fastPeriod).toArray();
  const smoothRngSlow = ta.ema(trSlowSeries, slowPeriod).toArray();

  // Combined filter range
  const filtRng: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const fast = isNaN(smoothRngFast[i]) ? 0 : smoothRngFast[i];
    const slow = isNaN(smoothRngSlow[i]) ? 0 : smoothRngSlow[i];
    filtRng[i] = (fast + slow) / 2;
  }

  // Filter line with state
  const filt: number[] = new Array(n);
  const upTrend: boolean[] = new Array(n);
  filt[0] = srcArr[0] ?? 0;
  upTrend[0] = true;

  for (let i = 1; i < n; i++) {
    const s = srcArr[i] ?? 0;
    const prevFilt = filt[i - 1];
    const rng = filtRng[i];

    if (s > prevFilt - rng) {
      filt[i] = Math.max(prevFilt, s - rng);
    } else if (s < prevFilt + rng) {
      filt[i] = Math.min(prevFilt, s + rng);
    } else {
      filt[i] = prevFilt;
    }

    upTrend[i] = filt[i] > filt[i - 1];
  }

  const warmup = slowPeriod;

  const plot0 = filt.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
    color: upTrend[i] ? '#26A69A' : '#EF5350',
  }));

  const barColors: BarColorData[] = [];
  for (let i = warmup; i < n; i++) {
    barColors.push({
      time: bars[i].time,
      color: upTrend[i] ? '#26A69A' : '#EF5350',
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    barColors,
  };
}

export const TwinRangeFilter = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
