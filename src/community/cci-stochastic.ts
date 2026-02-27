/**
 * CCI Stochastic
 *
 * CCI = (close - SMA(close, len)) / (0.015 * meanDev(close, len))
 * Then apply Stochastic to CCI: K = stoch(CCI, CCI, CCI, stochLen), smoothed.
 *
 * Reference: TradingView "CCI Stochastic" (TV#117)
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface CCIStochasticInputs {
  cciLen: number;
  stochLen: number;
  smoothK: number;
  smoothD: number;
}

export const defaultInputs: CCIStochasticInputs = {
  cciLen: 14,
  stochLen: 14,
  smoothK: 3,
  smoothD: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'cciLen', type: 'int', title: 'CCI Length', defval: 14, min: 1 },
  { id: 'stochLen', type: 'int', title: 'Stoch Length', defval: 14, min: 1 },
  { id: 'smoothK', type: 'int', title: 'Smooth K', defval: 3, min: 1 },
  { id: 'smoothD', type: 'int', title: 'Smooth D', defval: 3, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'K', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'D', color: '#EF5350', lineWidth: 1 },
];

export const metadata = {
  title: 'CCI Stochastic',
  shortTitle: 'CCIStoch',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<CCIStochasticInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { cciLen, stochLen, smoothK, smoothD } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const close = getSourceSeries(bars, 'close');
  const smaClose = ta.sma(close, cciLen).toArray();
  const closeArr = close.toArray();

  // CCI = (close - SMA) / (0.015 * meanDeviation)
  const cciArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    if (i < cciLen - 1 || smaClose[i] == null) {
      cciArr[i] = NaN;
      continue;
    }
    // Mean deviation over cciLen
    const mean = smaClose[i]!;
    let sumDev = 0;
    for (let j = 0; j < cciLen; j++) {
      sumDev += Math.abs((closeArr[i - j] ?? 0) - mean);
    }
    const meanDev = sumDev / cciLen;
    cciArr[i] = meanDev === 0 ? 0 : (closeArr[i]! - mean) / (0.015 * meanDev);
  }

  // Stochastic of CCI: use CCI as close/high/low
  const cciSeries = Series.fromArray(bars, cciArr);
  const rawK = ta.stoch(cciSeries, cciSeries, cciSeries, stochLen);
  const k = ta.sma(rawK, smoothK);
  const d = ta.sma(k, smoothD);

  const kArr = k.toArray();
  const dArr = d.toArray();

  const warmup = cciLen + stochLen + smoothK + smoothD;

  const plot0 = kArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  const plot1 = dArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  // Pine markers:
  // trend_enter: crossunder(ma, OS) => buy arrow at 0; crossover(ma, OB) => sell arrow at 100
  // trend_exit: crossunder(ma, OB) => sell arrow at 100; crossover(ma, OS) => buy arrow at 0
  const markers: MarkerData[] = [];
  // Use D line (plot1) as the "ma" per Pine default d_or_k="D"
  for (let i = warmup + 1; i < bars.length; i++) {
    const cur = dArr[i];
    const prev = dArr[i - 1];
    if (cur == null || prev == null) continue;

    // Enter zone: crossunder(ma, OS=20) -> buy; crossover(ma, OB=80) -> sell
    if (prev >= 20 && cur < 20) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#26A69A', text: 'Enter Buy' });
    }
    if (prev <= 80 && cur > 80) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#EF5350', text: 'Enter Sell' });
    }
    // Exit zone: crossunder(ma, OB=80) -> sell exit; crossover(ma, OS=20) -> buy exit
    if (prev >= 80 && cur < 80) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#880E4F', text: 'Exit Sell' });
    }
    if (prev <= 20 && cur > 20) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#FF9800', text: 'Exit Buy' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 80, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 20, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
    fills: [
      { plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(41, 98, 255, 0.1)' } },
    ],
    markers,
  };
}

export const CCIStochastic = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
