/**
 * Volume Flow v3
 *
 * Volume flow indicator using log price changes, stdev cutoff, and
 * directional volume force. Smoothed with SMA.
 *
 * Reference: TradingView "Volume Flow v3" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VolumeFlowV3Inputs {
  length: number;
  smoothLen: number;
}

export const defaultInputs: VolumeFlowV3Inputs = {
  length: 20,
  smoothLen: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'smoothLen', type: 'int', title: 'Smooth Length', defval: 3, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VFlow', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Volume Flow v3',
  shortTitle: 'VFv3',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<VolumeFlowV3Inputs> = {}): IndicatorResult {
  const { length, smoothLen } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const hlc3Arr = bars.map((b) => (b.high + b.low + b.close) / 3);

  // Log inter-bar change
  const interArr: number[] = new Array(n);
  interArr[0] = 0;
  for (let i = 1; i < n; i++) {
    interArr[i] = Math.log(hlc3Arr[i]) - Math.log(hlc3Arr[i - 1]);
  }

  const interSeries = new Series(bars, (_b, i) => interArr[i]);
  const vInterArr = ta.stdev(interSeries, 30).toArray();

  // Volume average and max
  const volSeries = new Series(bars, (b) => b.volume ?? 0);
  const vaveArr = ta.sma(volSeries, length).toArray();

  // Direction and volume force
  const dirForceArr: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const vInter = vInterArr[i] ?? 0;
    const cutOff = 0.2 * vInter * bars[i].close;
    const vave = vaveArr[i] ?? 1;
    const vmax = vave * 2;
    const vol = bars[i].volume ?? 0;
    const vForce = vol > vmax ? vmax : vol;

    let direction = 0;
    if (i > 0) {
      if (bars[i].close > bars[i - 1].close + cutOff) direction = 1;
      else if (bars[i].close < bars[i - 1].close - cutOff) direction = -1;
    }

    dirForceArr[i] = direction * vForce;
  }

  // SMA of direction * force
  const dirForceSeries = new Series(bars, (_b, i) => dirForceArr[i]);
  const vFlowArr = ta.sma(dirForceSeries, length).toArray();

  // Optional additional smoothing
  let finalArr: (number | null)[];
  if (smoothLen > 1) {
    const vFlowSeries = new Series(bars, (_b, i) => vFlowArr[i] ?? 0);
    finalArr = ta.sma(vFlowSeries, smoothLen).toArray();
  } else {
    finalArr = vFlowArr;
  }

  const warmup = Math.max(length, 30) + smoothLen;

  const plot0 = finalArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || v == null ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Zero' } },
    ],
  };
}

export const VolumeFlowV3 = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
