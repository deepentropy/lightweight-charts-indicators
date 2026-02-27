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
import type { BarColorData, MarkerData } from '../types';

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
  { id: 'plot1', title: 'OHLC4', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'Twin Range Filter',
  shortTitle: 'TRF',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TwinRangeFilterInputs> = {}): IndicatorResult & { barColors: BarColorData[]; markers: MarkerData[] } {
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

  // OHLC4 plot (hidden, used as fill reference) per Pine Visualized version
  const plot1 = bars.map((b, i) => ({
    time: b.time,
    value: i < warmup ? NaN : (b.open + b.high + b.low + b.close) / 4,
  }));

  // Fill colors: green when close > filter (uptrend), red when close < filter (downtrend)
  const fillUpColors = bars.map((b, i) => {
    if (i < warmup) return 'transparent';
    return b.close > filt[i] ? 'rgba(76,175,80,0.10)' : 'transparent';
  });
  const fillDnColors = bars.map((b, i) => {
    if (i < warmup) return 'transparent';
    return b.close < filt[i] ? 'rgba(255,82,82,0.10)' : 'transparent';
  });

  const barColors: BarColorData[] = [];
  for (let i = warmup; i < n; i++) {
    barColors.push({
      time: bars[i].time,
      color: upTrend[i] ? '#26A69A' : '#EF5350',
    });
  }

  // Markers: Long/Short signals on first direction change
  const markers: MarkerData[] = [];
  // Track upward/downward counters and CondIni state per Pine logic
  const upwardCount: number[] = new Array(n);
  const downwardCount: number[] = new Array(n);
  upwardCount[0] = 0;
  downwardCount[0] = 0;
  for (let i = 1; i < n; i++) {
    upwardCount[i] = filt[i] > filt[i - 1] ? (upwardCount[i - 1] + 1) : filt[i] < filt[i - 1] ? 0 : upwardCount[i - 1];
    downwardCount[i] = filt[i] < filt[i - 1] ? (downwardCount[i - 1] + 1) : filt[i] > filt[i - 1] ? 0 : downwardCount[i - 1];
  }

  let condIni = 0;
  for (let i = warmup; i < n; i++) {
    const s = srcArr[i] ?? 0;
    const longCond = s > filt[i] && upwardCount[i] > 0;
    const shortCond = s < filt[i] && downwardCount[i] > 0;

    if (longCond && condIni === -1) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#00E676', text: 'Long' });
    }
    if (shortCond && condIni === 1) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Short' });
    }

    if (longCond) condIni = 1;
    else if (shortCond) condIni = -1;
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    fills: [
      { plot1: 'plot1', plot2: 'plot0', colors: fillUpColors },
      { plot1: 'plot1', plot2: 'plot0', colors: fillDnColors },
    ],
    barColors,
    markers,
  };
}

export const TwinRangeFilter = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
