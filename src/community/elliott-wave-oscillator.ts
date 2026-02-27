/**
 * Elliott Wave Oscillator (EWO)
 *
 * Difference between fast and slow EMA. Color-coded histogram.
 * EWO = EMA(close, 5) - EMA(close, 35)
 *
 * Reference: TradingView "Elliot Wave Oscillator [LazyBear]"
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface ElliottWaveOscInputs {
  fastLength: number;
  slowLength: number;
  signalDelay: number;
  strengthThreshold: number;
}

export const defaultInputs: ElliottWaveOscInputs = {
  fastLength: 5,
  slowLength: 35,
  signalDelay: 5,
  strengthThreshold: 13,
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast EMA Length', defval: 5, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow EMA Length', defval: 35, min: 1 },
  { id: 'signalDelay', type: 'int', title: 'Signal Delay', defval: 5, min: 2 },
  { id: 'strengthThreshold', type: 'int', title: 'Strength Threshold', defval: 13, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EWO', color: '#26A69A', lineWidth: 2, style: 'histogram' },
  { id: 'plot1', title: 'Signal', color: '#FF9800', lineWidth: 1 },
];

export const metadata = {
  title: 'Elliott Wave Oscillator',
  shortTitle: 'EWO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ElliottWaveOscInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { fastLength, slowLength, signalDelay, strengthThreshold } = { ...defaultInputs, ...inputs };

  const src = getSourceSeries(bars, 'close');
  const fastEma = ta.ema(src, fastLength);
  const slowEma = ta.ema(src, slowLength);
  const ewo = fastEma.sub(slowEma);
  const ewoArr = ewo.toArray();

  // Signal line = EMA of EWO
  const ewoSeries = new Series(bars, (_b, i) => ewoArr[i] ?? 0);
  const ewoSignalArr = ta.ema(ewoSeries, signalDelay).toArray();

  const warmup = slowLength;

  // Histogram color: 4 shades based on direction and sign
  const plot = ewoArr.map((v, i) => {
    if (i < warmup || v == null) return { time: bars[i].time, value: NaN };
    const prev = i > 0 ? ewoArr[i - 1] : null;
    let color: string;
    if (v >= 0) {
      color = (prev != null && v < prev) ? '#00E676' : '#006400'; // green shades
    } else {
      color = (prev != null && v > prev) ? '#FF5252' : '#910000'; // red shades
    }
    return { time: bars[i].time, value: v, color };
  });

  const plot1 = ewoSignalArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null) ? NaN : v,
  }));

  // Markers: crossover/crossunder signals from Pine
  const markers: MarkerData[] = [];
  const t = strengthThreshold;
  for (let i = warmup + 1; i < bars.length; i++) {
    const cur = ewoArr[i];
    const prev = ewoArr[i - 1];
    const curSig = ewoSignalArr[i];
    const prevSig = ewoSignalArr[i - 1];
    if (cur == null || prev == null || curSig == null || prevSig == null) continue;

    const crossOver = prev <= prevSig && cur > curSig;
    const crossUnder = prev >= prevSig && cur < curSig;

    if (crossOver && cur < -t) {
      // Strong Long
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#006400', text: 'SL' });
    } else if (crossOver) {
      // Long
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#00E676', text: 'L' });
    }

    if (crossUnder && cur > t) {
      // Strong Short
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#910000', text: 'SS' });
    } else if (crossUnder) {
      // Short
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#FF5252', text: 'S' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot, 'plot1': plot1 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Zero' } },
    ],
    markers,
  };
}

export const ElliottWaveOscillator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
