/**
 * Volume SuperTrend AI (Expo)
 *
 * SuperTrend with kNN volume-weighted adaptation.
 * Calculate ATR and VWMA. Use kNN on volume patterns to determine volatility regime.
 * Find k-nearest historical bars with similar volume profile, weight ATR by their outcomes.
 * Apply adapted ATR factor to SuperTrend calculation.
 *
 * Reference: TradingView "Volume SuperTrend AI [Expo]" (TV#837)
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface VolumeSuperTrendAiInputs {
  atrLen: number;
  factor: number;
  k: number;
  volLen: number;
  src: SourceType;
}

export const defaultInputs: VolumeSuperTrendAiInputs = {
  atrLen: 10,
  factor: 3.0,
  k: 5,
  volLen: 10,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 10, min: 1 },
  { id: 'factor', type: 'float', title: 'Factor', defval: 3.0, min: 0.1, step: 0.1 },
  { id: 'k', type: 'int', title: 'K Neighbors', defval: 5, min: 1 },
  { id: 'volLen', type: 'int', title: 'Volume Length', defval: 10, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SuperTrend AI', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'VWMA', color: '#FF9800', lineWidth: 1 },
  { id: 'upTrend', title: 'Up Trend', color: '#26A69A', lineWidth: 2 },
  { id: 'downTrend', title: 'Down Trend', color: '#EF5350', lineWidth: 2 },
  { id: 'middle', title: 'Middle', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'Volume SuperTrend AI',
  shortTitle: 'VSTAI',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<VolumeSuperTrendAiInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { atrLen, factor, k, volLen, src } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const atrArr = ta.atr(bars, atrLen).toArray();
  const source = getSourceSeries(bars, src);
  const volSeries = new Series(bars, (b) => b.volume ?? 0);
  const vwmaArr = ta.vwma(source, volLen, volSeries).toArray();

  // Volume series for kNN
  const volArr: number[] = bars.map(b => b.volume ?? 0);
  const volSma: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    if (i < volLen - 1) { volSma[i] = 0; continue; }
    let sum = 0;
    for (let j = i - volLen + 1; j <= i; j++) sum += volArr[j];
    volSma[i] = sum / volLen;
  }

  const warmup = Math.max(atrLen, volLen);
  const lookback = 50;

  // kNN-adapted ATR factor per bar
  const adaptedFactor: number[] = new Array(n).fill(factor);

  for (let i = warmup; i < n; i++) {
    const curVol = volArr[i];
    const curVolSma = volSma[i];
    if (curVolSma === 0) continue;

    const curVolRatio = curVol / curVolSma;

    const distances: { dist: number; volRatio: number }[] = [];
    const start = Math.max(warmup, i - lookback);

    for (let j = start; j < i; j++) {
      if (volSma[j] === 0) continue;
      const hVolRatio = volArr[j] / volSma[j];
      const dist = Math.abs(curVolRatio - hVolRatio);
      distances.push({ dist, volRatio: hVolRatio });
    }

    distances.sort((a, b) => a.dist - b.dist);
    const kNearest = distances.slice(0, Math.min(k, distances.length));

    if (kNearest.length === 0) continue;

    // Average volume ratio of k-nearest neighbors
    let sumRatio = 0;
    for (const nb of kNearest) sumRatio += nb.volRatio;
    const avgRatio = sumRatio / kNearest.length;

    // Adapt factor: higher volume regime increases sensitivity (lower factor)
    // Lower volume regime decreases sensitivity (higher factor)
    adaptedFactor[i] = factor / Math.max(0.5, Math.min(2.0, avgRatio));
  }

  // SuperTrend with adapted factor
  const st: number[] = new Array(n).fill(NaN);
  const dir: number[] = new Array(n).fill(1);

  for (let i = 0; i < n; i++) {
    const hl2 = (bars[i].high + bars[i].low) / 2;
    const atr = ((atrArr[i] ?? 0) as number) * adaptedFactor[i];
    const up = hl2 - atr;
    const dn = hl2 + atr;

    if (i === 0) {
      st[i] = up;
      dir[i] = 1;
      continue;
    }

    const prevDir = dir[i - 1];
    const prevSt = st[i - 1];
    const close = bars[i].close;
    const prevClose = bars[i - 1].close;

    const trailUp = prevClose > prevSt && prevDir === 1 ? Math.max(up, prevSt) : up;
    const trailDn = prevClose < prevSt && prevDir === -1 ? Math.min(dn, prevSt) : dn;

    if (prevDir === 1) {
      if (close < trailUp) {
        dir[i] = -1;
        st[i] = trailDn;
      } else {
        dir[i] = 1;
        st[i] = trailUp;
      }
    } else {
      if (close > trailDn) {
        dir[i] = 1;
        st[i] = trailUp;
      } else {
        dir[i] = -1;
        st[i] = trailDn;
      }
    }
  }

  // Markers on direction change
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    if (dir[i] === 1 && dir[i - 1] === -1) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
    } else if (dir[i] === -1 && dir[i - 1] === 1) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
    }
  }

  const plot0 = st.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
    color: dir[i] === 1 ? '#26A69A' : '#EF5350',
  }));

  const plot1 = (vwmaArr as (number | null)[]).map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : (v ?? NaN),
  }));

  // upTrend: SuperTrend value when in uptrend (dir === 1, i.e. lower band)
  const upTrend = st.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || dir[i] !== 1) ? NaN : v,
    color: dir[i] === 1 ? '#26A69A' : '#EF5350',
  }));

  // downTrend: SuperTrend value when in downtrend (dir === -1, i.e. upper band)
  const downTrend = st.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || dir[i] !== -1) ? NaN : v,
    color: dir[i] === -1 ? '#EF5350' : '#26A69A',
  }));

  // Middle: (open + close) / 2
  const middle = bars.map((b, i) => ({
    time: b.time,
    value: i < warmup ? NaN : (b.open + b.close) / 2,
  }));

  // Dynamic fill colors per bar (90% transparent version of trend color)
  const upFillColors: string[] = new Array(n);
  const dnFillColors: string[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const col = dir[i] === 1 ? 'rgba(38, 166, 154, 0.1)' : 'rgba(239, 83, 80, 0.1)';
    upFillColors[i] = dir[i] === 1 ? col : 'rgba(0,0,0,0)';
    dnFillColors[i] = dir[i] === -1 ? col : 'rgba(0,0,0,0)';
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'upTrend': upTrend, 'downTrend': downTrend, 'middle': middle },
    markers,
    fills: [
      { plot1: 'middle', plot2: 'upTrend', options: { color: 'rgba(38, 166, 154, 0.1)' }, colors: upFillColors },
      { plot1: 'middle', plot2: 'downTrend', options: { color: 'rgba(239, 83, 80, 0.1)' }, colors: dnFillColors },
    ],
  };
}

export const VolumeSuperTrendAi = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
