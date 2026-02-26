/**
 * Stoch VX3
 *
 * Stochastic variant with 3 smoothing levels.
 * K = (close - lowest(low,len)) / (highest(high,len) - lowest(low,len)) * 100.
 * K2 = SMA(K, smooth1). K3 = SMA(K2, smooth2). Signal = SMA(K3, smooth3).
 *
 * Reference: TradingView "Stoch VX3"
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface StochVX3Inputs {
  len: number;
  smooth1: number;
  smooth2: number;
  smooth3: number;
}

export const defaultInputs: StochVX3Inputs = {
  len: 14,
  smooth1: 3,
  smooth2: 3,
  smooth3: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Stoch Length', defval: 14, min: 1 },
  { id: 'smooth1', type: 'int', title: 'Smoothing 1', defval: 3, min: 1 },
  { id: 'smooth2', type: 'int', title: 'Smoothing 2', defval: 3, min: 1 },
  { id: 'smooth3', type: 'int', title: 'Smoothing 3', defval: 3, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'K3', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Stoch VX3',
  shortTitle: 'StochVX3',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<StochVX3Inputs> = {}): IndicatorResult {
  const { len, smooth1, smooth2, smooth3 } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const hh = ta.highest(highSeries, len);
  const ll = ta.lowest(lowSeries, len);
  const hhArr = hh.toArray();
  const llArr = ll.toArray();

  // Raw K = (close - LL) / (HH - LL) * 100
  const rawK: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const h = hhArr[i];
    const l = llArr[i];
    if (h == null || l == null || h === l) {
      rawK[i] = i < len ? 0 : 50;
    } else {
      rawK[i] = (bars[i].close - l) / (h - l) * 100;
    }
  }

  const rawKSeries = Series.fromArray(bars, rawK);
  const k2 = ta.sma(rawKSeries, smooth1);
  const k3 = ta.sma(k2, smooth2);
  const signal = ta.sma(k3, smooth3);

  const k3Arr = k3.toArray();
  const sigArr = signal.toArray();
  const warmup = len + smooth1 + smooth2 + smooth3;

  const plot0 = k3Arr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  const plot1 = sigArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 80, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 20, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
  };
}

export const StochVX3 = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
