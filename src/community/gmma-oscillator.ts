/**
 * GMMA Oscillator
 *
 * Fast GMMA = average of short-term EMAs, Slow GMMA = average of long-term EMAs.
 * Oscillator = ((fast - slow) / slow) * 100
 * Signal = EMA(oscillator, signalLen)
 * Optional SMA smoothing of oscillator.
 *
 * Reference: TradingView "GMMA Oscillator" community indicator
 */

import { ta, Series, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface GMMAOscillatorInputs {
  gmmaType: string;
  smoothLen: number;
  signalLen: number;
  src: SourceType;
  showZones: boolean;
}

export const defaultInputs: GMMAOscillatorInputs = {
  gmmaType: 'Guppy',
  smoothLen: 1,
  signalLen: 13,
  src: 'close',
  showZones: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'gmmaType', type: 'string', title: 'GMMA Type', defval: 'Guppy', options: ['Guppy', 'SuperGuppy'] },
  { id: 'smoothLen', type: 'int', title: 'Smooth Length', defval: 1, min: 1 },
  { id: 'signalLen', type: 'int', title: 'Signal Length', defval: 13, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'showZones', type: 'bool', title: 'Show Zones', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'GMMA Oscillator', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot2', title: 'Histogram', color: '#26A69A', lineWidth: 4, style: 'histogram' },
];

export const metadata = {
  title: 'GMMA Oscillator',
  shortTitle: 'GMMAOSC',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<GMMAOscillatorInputs> = {}): IndicatorResult {
  const { gmmaType, smoothLen, signalLen, src, showZones } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  // Define EMA periods based on GMMA type
  let fastPeriods: number[];
  let slowPeriods: number[];

  if (gmmaType === 'SuperGuppy') {
    // Fast: 11 EMAs (3,5,7,...,23)
    fastPeriods = [];
    for (let p = 3; p <= 23; p += 2) fastPeriods.push(p);
    // Slow: 16 EMAs (25,28,31,...,70)
    slowPeriods = [];
    for (let p = 25; p <= 70; p += 3) slowPeriods.push(p);
  } else {
    // Guppy: standard periods
    fastPeriods = [3, 5, 8, 10, 12, 15];
    slowPeriods = [30, 35, 40, 45, 50, 60];
  }

  // Compute all EMAs
  const fastEmas = fastPeriods.map(p => ta.ema(source, p).toArray());
  const slowEmas = slowPeriods.map(p => ta.ema(source, p).toArray());

  const maxPeriod = Math.max(...slowPeriods);
  const warmup = maxPeriod;

  // Average of fast group and slow group per bar
  const rawOscArr: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    let fastSum = 0;
    let slowSum = 0;
    let valid = true;

    for (let j = 0; j < fastEmas.length; j++) {
      const v = fastEmas[j][i];
      if (v == null || isNaN(v)) { valid = false; break; }
      fastSum += v;
    }
    if (valid) {
      for (let j = 0; j < slowEmas.length; j++) {
        const v = slowEmas[j][i];
        if (v == null || isNaN(v)) { valid = false; break; }
        slowSum += v;
      }
    }

    if (!valid) {
      rawOscArr.push(NaN);
      continue;
    }

    const fastAvg = fastSum / fastEmas.length;
    const slowAvg = slowSum / slowEmas.length;
    rawOscArr.push(slowAvg !== 0 ? ((fastAvg - slowAvg) / slowAvg) * 100 : 0);
  }

  // Optional smoothing with SMA
  let oscArr: number[];
  if (smoothLen > 1) {
    const rawSeries = new Series(bars, (_, i) => rawOscArr[i]);
    oscArr = ta.sma(rawSeries, smoothLen).toArray().map(v => v ?? NaN);
  } else {
    oscArr = rawOscArr;
  }

  // Signal = EMA of oscillator
  const oscSeries = new Series(bars, (_, i) => oscArr[i]);
  const signalArr = ta.ema(oscSeries, signalLen).toArray();

  // Build plot data
  const oscPlot = oscArr.map((v, i) => {
    if (i < warmup || isNaN(v)) return { time: bars[i].time, value: NaN };
    const sig = signalArr[i] ?? NaN;
    const color = !isNaN(sig) && v > sig ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  const sigPlot = signalArr.map((v, i) => {
    if (i < warmup || v == null || isNaN(v)) return { time: bars[i].time, value: NaN };
    const osc = oscArr[i];
    const color = !isNaN(osc) && osc > v ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  // Histogram = osc - signal
  const histPlot = oscArr.map((v, i) => {
    const sig = signalArr[i] ?? NaN;
    if (i < warmup || isNaN(v) || isNaN(sig)) return { time: bars[i].time, value: NaN };
    const diff = v - sig;
    const color = diff >= 0 ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: diff, color };
  });

  // Background zone colors
  const bgColors: BgColorData[] = [];
  if (showZones) {
    for (let i = warmup; i < bars.length; i++) {
      const v = oscArr[i];
      if (isNaN(v)) continue;
      bgColors.push({
        time: bars[i].time,
        color: v >= 0 ? 'rgba(38,166,154,0.10)' : 'rgba(239,83,80,0.10)',
      });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': oscPlot, 'plot1': sigPlot, 'plot2': histPlot },
    hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, linewidth: 1, title: 'Zero' } }],
    bgColors,
  } as IndicatorResult & { bgColors: BgColorData[] };
}

export const GMMAOscillator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
