/**
 * Stochastic Momentum Index UCSgears Variant
 *
 * SMI variant with double EMA smoothing.
 * rel = close - (highest(high, kLen) + lowest(low, kLen)) / 2.
 * SMI = 100 * EMA(EMA(rel, dLen), smoothLen) / (EMA(EMA(range, dLen), smoothLen) / 2).
 * signal = EMA(smi, smoothLen).
 *
 * Reference: TradingView "Stochastic Momentum Index (SMI) UCSgears"
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface SMIUCSInputs {
  kLen: number;
  dLen: number;
  smoothLen: number;
}

export const defaultInputs: SMIUCSInputs = {
  kLen: 13,
  dLen: 25,
  smoothLen: 2,
};

export const inputConfig: InputConfig[] = [
  { id: 'kLen', type: 'int', title: 'K Length', defval: 13, min: 1 },
  { id: 'dLen', type: 'int', title: 'D Length', defval: 25, min: 1 },
  { id: 'smoothLen', type: 'int', title: 'Smooth Length', defval: 2, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMI', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Stochastic Momentum Index UCS',
  shortTitle: 'SMIUCS',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<SMIUCSInputs> = {}): IndicatorResult {
  const { kLen, dLen, smoothLen } = { ...defaultInputs, ...inputs };

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const closeSeries = new Series(bars, (b) => b.close);

  const hh = ta.highest(highSeries, kLen);
  const ll = ta.lowest(lowSeries, kLen);

  // rel = close - midpoint
  const midpoint = hh.add(ll).div(2);
  const rel = closeSeries.sub(midpoint);
  const hlRange = hh.sub(ll);

  // Double smooth
  const numerator = ta.ema(ta.ema(rel, dLen), smoothLen);
  const denominator = ta.ema(ta.ema(hlRange, dLen), smoothLen).mul(0.5);

  const numArr = numerator.toArray();
  const denArr = denominator.toArray();

  const smiArr: number[] = new Array(bars.length);
  for (let i = 0; i < bars.length; i++) {
    const n = numArr[i];
    const d = denArr[i];
    smiArr[i] = (d != null && d !== 0 && n != null) ? 100 * n / d : 0;
  }

  const smiSeries = new Series(bars, (_b, i) => smiArr[i]);
  const signal = ta.ema(smiSeries, smoothLen);
  const sigArr = signal.toArray();

  const warmup = kLen + dLen;

  const plot0 = smiArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  const plot1 = sigArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    hlines: [
      { value: 40, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 0, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Zero' } },
      { value: -40, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
  };
}

export const SMIUCS = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
