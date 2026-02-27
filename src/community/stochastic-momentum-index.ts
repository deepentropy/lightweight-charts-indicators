/**
 * Stochastic Momentum Index (SMI)
 *
 * Refined stochastic oscillator by William Blau.
 * SMI = 100 * EMA(EMA(close - midpoint, s1), s2) / (0.5 * EMA(EMA(HH-LL, s1), s2))
 *
 * Reference: TradingView "Stochastic Momentum Index (SMI)"
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface StochasticMomentumIndexInputs {
  length: number;
  smoothLen1: number;
  smoothLen2: number;
  sigLen: number;
}

export const defaultInputs: StochasticMomentumIndexInputs = {
  length: 13,
  smoothLen1: 25,
  smoothLen2: 2,
  sigLen: 13,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Stochastic Length', defval: 13, min: 1 },
  { id: 'smoothLen1', type: 'int', title: '1st Smoothing', defval: 25, min: 1 },
  { id: 'smoothLen2', type: 'int', title: '2nd Smoothing', defval: 2, min: 1 },
  { id: 'sigLen', type: 'int', title: 'Signal Length', defval: 13, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMI', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#EF5350', lineWidth: 1 },
  { id: 'plot2', title: 'Histogram', color: '#26A69A', lineWidth: 4, style: 'histogram' },
  { id: 'plot3', title: 'OB Level', color: 'transparent', lineWidth: 0 },
  { id: 'plot4', title: 'OB SMI Clamped', color: 'transparent', lineWidth: 0 },
  { id: 'plot5', title: 'OS Level', color: 'transparent', lineWidth: 0 },
  { id: 'plot6', title: 'OS SMI Clamped', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'Stochastic Momentum Index',
  shortTitle: 'SMI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<StochasticMomentumIndexInputs> = {}): IndicatorResult {
  const { length, smoothLen1, smoothLen2, sigLen } = { ...defaultInputs, ...inputs };

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const hh = ta.highest(highSeries, length);
  const ll = ta.lowest(lowSeries, length);

  const closeSeries = new Series(bars, (b) => b.close);
  const midpoint = hh.add(ll).div(2);
  const relRange = closeSeries.sub(midpoint);
  const hlRange = hh.sub(ll);

  const numerator = ta.ema(ta.ema(relRange, smoothLen1), smoothLen2);
  const denominator = ta.ema(ta.ema(hlRange, smoothLen1), smoothLen2).mul(0.5);

  const numArr = numerator.toArray();
  const denArr = denominator.toArray();

  const smiArr: number[] = new Array(bars.length);
  for (let i = 0; i < bars.length; i++) {
    const n = numArr[i];
    const d = denArr[i];
    smiArr[i] = (d != null && d !== 0 && n != null) ? 100 * n / d : 0;
  }

  const smiSeries = new Series(bars, (_b, i) => smiArr[i]);
  const signal = ta.ema(smiSeries, sigLen);
  const sigArr = signal.toArray();

  const warmup = length + smoothLen1;
  const toPlot = (arr: number[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));

  const histArr = smiArr.map((v, i) => v - (sigArr[i] ?? 0));
  const histPlot = histArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const color = v >= 0 ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  // OB/OS fill: clamp SMI for fill region above OB (40) and below OS (-40)
  const ob = 40;
  const os = -40;
  const plot3 = bars.map((b, i) => ({ time: b.time, value: i < warmup ? NaN : ob }));
  const plot4 = bars.map((b, i) => ({ time: b.time, value: i < warmup ? NaN : (smiArr[i] > ob ? smiArr[i] : ob) }));
  const plot5 = bars.map((b, i) => ({ time: b.time, value: i < warmup ? NaN : os }));
  const plot6 = bars.map((b, i) => ({ time: b.time, value: i < warmup ? NaN : (smiArr[i] < os ? smiArr[i] : os) }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': toPlot(smiArr),
      'plot1': sigArr.map((v, i) => ({ time: bars[i].time, value: (i < warmup || v == null) ? NaN : v })),
      'plot2': histPlot,
      'plot3': plot3,
      'plot4': plot4,
      'plot5': plot5,
      'plot6': plot6,
    },
    fills: [
      { plot1: 'plot3', plot2: 'plot4', options: { color: 'rgba(255,0,0,0.4)' } },
      { plot1: 'plot5', plot2: 'plot6', options: { color: 'rgba(0,128,0,0.4)' } },
    ],
    hlines: [
      { value: 40, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 0, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Zero' } },
      { value: -40, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
  };
}

export const StochasticMomentumIndex = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
