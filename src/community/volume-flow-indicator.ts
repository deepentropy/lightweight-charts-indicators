/**
 * Volume Flow Indicator (VFI)
 *
 * Volume-based oscillator using log price changes and volume cutoff.
 * VFI = SUM(signed_volume, length) / SMA(volume, length)
 *
 * Reference: TradingView "Volume Flow Indicator [LazyBear]"
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VolumeFlowIndicatorInputs {
  length: number;
  coef: number;
  vcoef: number;
  signalLength: number;
  smoothVFI: boolean;
}

export const defaultInputs: VolumeFlowIndicatorInputs = {
  length: 130,
  coef: 0.2,
  vcoef: 2.5,
  signalLength: 5,
  smoothVFI: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'VFI Length', defval: 130, min: 1 },
  { id: 'coef', type: 'float', title: 'Coefficient', defval: 0.2, min: 0.01, step: 0.01 },
  { id: 'vcoef', type: 'float', title: 'Max Vol Cutoff', defval: 2.5, min: 0.1, step: 0.1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 5, min: 1 },
  { id: 'smoothVFI', type: 'bool', title: 'Smooth VFI', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VFI', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Volume Flow Indicator',
  shortTitle: 'VFI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<VolumeFlowIndicatorInputs> = {}): IndicatorResult {
  const { length, coef, vcoef, signalLength, smoothVFI } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const hlc3Arr = bars.map((b) => (b.high + b.low + b.close) / 3);

  // Log inter-bar change and its stdev
  const interArr: number[] = new Array(n);
  interArr[0] = 0;
  for (let i = 1; i < n; i++) {
    interArr[i] = Math.log(hlc3Arr[i]) - Math.log(hlc3Arr[i - 1]);
  }
  const interSeries = new Series(bars, (_b, i) => interArr[i]);
  const vinterArr = ta.stdev(interSeries, 30).toArray();

  // Volume average and cutoff
  const volSeries = new Series(bars, (b) => b.volume ?? 0);
  const vaveArr = ta.sma(volSeries, length).toArray();

  // Compute VCP (volume-confirmed price flow)
  const vcpArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const vinter = vinterArr[i] ?? 0;
    const cutoff = coef * vinter * bars[i].close;
    const vave = i > 0 ? (vaveArr[i - 1] ?? 1) : 1;
    const vmax = vave * vcoef;
    const vol = bars[i].volume ?? 0;
    const vc = vol < vmax ? vol : vmax;
    const mf = i > 0 ? hlc3Arr[i] - hlc3Arr[i - 1] : 0;
    vcpArr[i] = mf > cutoff ? vc : mf < -cutoff ? -vc : 0;
  }

  // Rolling sum of VCP over length, divide by vave, optionally smooth
  const rawVfi: number[] = new Array(n);
  let runningSum = 0;
  for (let i = 0; i < n; i++) {
    runningSum += vcpArr[i];
    if (i >= length) runningSum -= vcpArr[i - length];
    const v = vaveArr[i] ?? 1;
    rawVfi[i] = v !== 0 ? runningSum / v : 0;
  }

  // Optional SMA smoothing
  const vfiArr = smoothVFI
    ? ta.sma(new Series(bars, (_b, i) => rawVfi[i]), 3).toArray().map(v => v ?? 0)
    : rawVfi;

  const vfiSeries = new Series(bars, (_b, i) => vfiArr[i]);
  const signalArr = ta.ema(vfiSeries, signalLength).toArray();

  const warmup = length + 30;
  const vfiPlot = vfiArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));
  const sigPlot = signalArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': vfiPlot, 'plot1': sigPlot },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
    ],
  };
}

export const VolumeFlowIndicator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
