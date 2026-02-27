/**
 * Bjorgum Triple EMA Strategy
 *
 * Three EMAs (fast, medium, slow) for trend detection and crossover signals.
 * Trend is bullish when all three are aligned (fast > med > slow).
 * Buy signal: fast crosses above med while above slow.
 * Sell signal: fast crosses below med while below slow.
 *
 * Reference: TradingView "Bjorgum Triple EMA" (TV#84)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface BjorgumTripleEmaInputs {
  fastLen: number;
  medLen: number;
  slowLen: number;
  src: SourceType;
}

export const defaultInputs: BjorgumTripleEmaInputs = {
  fastLen: 8,
  medLen: 21,
  slowLen: 55,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLen', type: 'int', title: 'Fast Length', defval: 8, min: 1 },
  { id: 'medLen', type: 'int', title: 'Medium Length', defval: 21, min: 1 },
  { id: 'slowLen', type: 'int', title: 'Slow Length', defval: 55, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Medium EMA', color: '#FF9800', lineWidth: 2 },
  { id: 'plot2', title: 'Slow EMA', color: '#EF5350', lineWidth: 2 },
];

export const metadata = {
  title: 'Bjorgum Triple EMA',
  shortTitle: 'BTEMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<BjorgumTripleEmaInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const { fastLen, medLen, slowLen, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const n = bars.length;

  const fastArr = ta.ema(source, fastLen).toArray();
  const medArr = ta.ema(source, medLen).toArray();
  const slowArr = ta.ema(source, slowLen).toArray();

  const warmup = slowLen;
  const markers: MarkerData[] = [];

  for (let i = warmup + 1; i < n; i++) {
    const f = fastArr[i] ?? NaN;
    const m = medArr[i] ?? NaN;
    const s = slowArr[i] ?? NaN;
    const pf = fastArr[i - 1] ?? NaN;
    const pm = medArr[i - 1] ?? NaN;

    // Buy: fast crosses above med while both above slow
    if (pf <= pm && f > m && f > s) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
    }
    // Sell: fast crosses below med while both below slow
    if (pf >= pm && f < m && f < s) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
    }
  }

  const plot0 = fastArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  const plot1 = medArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  const plot2 = slowArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  // barcolor: Pine barColor = uc ? #64b5f6 : dc ? #e91e63 : #b2b5be
  // uc = close > fast AND close > med; dc = close < fast AND close < med
  const barColors: BarColorData[] = [];
  for (let i = warmup; i < n; i++) {
    const f = fastArr[i] ?? NaN;
    const m = medArr[i] ?? NaN;
    if (isNaN(f) || isNaN(m)) continue;
    const c = bars[i].close;
    const color = (c > f && c > m) ? '#64B5F6' : (c < f && c < m) ? '#E91E63' : '#B2B5BE';
    barColors.push({ time: bars[i].time, color });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(100, 181, 246, 0.15)' } },
      { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(100, 181, 246, 0.2)' } },
    ],
    markers,
    barColors,
  };
}

export const BjorgumTripleEma = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
