/**
 * GMMA Oscillator
 *
 * Fast GMMA = average of short-term EMAs, Slow GMMA = average of long-term EMAs.
 * Oscillator = ((fast - slow) / slow) * 100
 * Signal = EMA(oscillator, signalLen)
 * Optional SMA smoothing of oscillator.
 *
 * Reference: "GMMA Oscillator" community indicator
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

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

type Point = { time: number; value: number; color?: string };

interface GmmaRun extends BarRunState<Record<string, never>> {
  fastEmas: ReturnType<typeof taStep.ema>[];
  slowEmas: ReturnType<typeof taStep.ema>[];
  smooth: WindowSma | null;
  signal: ReturnType<typeof taStep.ema>;
  oscPlot: Point[];
  sigPlot: Point[];
  histPlot: Point[];
  bgColors: BgColorData[];
}

function study(inputs: Partial<GMMAOscillatorInputs>): BarStudy<GmmaRun, IndicatorResult> {
  const { gmmaType, smoothLen, signalLen, src, showZones } = { ...defaultInputs, ...inputs };
  const value = barSource(src);

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

  const maxPeriod = Math.max(...slowPeriods);
  const warmup = maxPeriod;

  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      // Compute all EMAs
      const fastEmas = fastPeriods.map((p) => taStep.ema(p));
      const slowEmas = slowPeriods.map((p) => taStep.ema(p));
      // Optional smoothing with SMA
      const smooth = smoothLen > 1 ? new WindowSma(smoothLen) : null;
      // Signal = EMA of oscillator
      const signal = taStep.ema(signalLen);
      const s: GmmaRun = {
        fastEmas, slowEmas, smooth, signal, oscPlot: [], sigPlot: [], histPlot: [], bgColors: [],
        steps: [...fastEmas, ...slowEmas, ...(smooth ? [smooth] : []), signal], vars: {}, lists: [], series: [],
      };
      s.lists = [s.bgColors];
      s.series = [s.oscPlot, s.sigPlot, s.histPlot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const x = value(b);
      // Average of fast group and slow group per bar (every EMA is stepped on every bar)
      let fastSum = 0;
      let slowSum = 0;
      let valid = true;
      for (let j = 0; j < s.fastEmas.length; j++) {
        const v = s.fastEmas[j].step(x);
        if (!valid) continue;
        if (v == null || isNaN(v)) { valid = false; continue; }
        fastSum += v;
      }
      for (let j = 0; j < s.slowEmas.length; j++) {
        const v = s.slowEmas[j].step(x);
        if (!valid) continue;
        if (v == null || isNaN(v)) { valid = false; continue; }
        slowSum += v;
      }
      let rawOsc: number;
      if (!valid) {
        rawOsc = NaN;
      } else {
        const fastAvg = fastSum / s.fastEmas.length;
        const slowAvg = slowSum / s.slowEmas.length;
        rawOsc = slowAvg !== 0 ? ((fastAvg - slowAvg) / slowAvg) * 100 : 0;
      }

      const osc = s.smooth ? s.smooth.step(rawOsc) ?? NaN : rawOsc;
      const signal = s.signal.step(osc);

      // Build plot data
      if (i < warmup || isNaN(osc)) {
        s.oscPlot[i] = { time, value: NaN };
      } else {
        const sig = signal ?? NaN;
        const color = !isNaN(sig) && osc > sig ? '#26A69A' : '#EF5350';
        s.oscPlot[i] = { time, value: osc, color };
      }

      if (i < warmup || signal == null || isNaN(signal)) {
        s.sigPlot[i] = { time, value: NaN };
      } else {
        const color = !isNaN(osc) && osc > signal ? '#26A69A' : '#EF5350';
        s.sigPlot[i] = { time, value: signal, color };
      }

      // Histogram = osc - signal
      const sig = signal ?? NaN;
      if (i < warmup || isNaN(osc) || isNaN(sig)) {
        s.histPlot[i] = { time, value: NaN };
      } else {
        const diff = osc - sig;
        const color = diff >= 0 ? '#26A69A' : '#EF5350';
        s.histPlot[i] = { time, value: diff, color };
      }

      // Background zone colors
      if (showZones && i >= warmup && !isNaN(osc)) {
        s.bgColors.push({
          time,
          color: osc >= 0 ? 'rgba(38,166,154,0.10)' : 'rgba(239,83,80,0.10)',
        });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.oscPlot.slice(), 'plot1': s.sigPlot.slice(), 'plot2': s.histPlot.slice() },
        hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'dashed' as const, linewidth: 1, title: 'Zero' } }],
        bgColors: s.bgColors.slice(),
      } as Omit<IndicatorResult, 'markers'> & { bgColors: BgColorData[] };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GMMAOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<GMMAOscillatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const GMMAOscillator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
