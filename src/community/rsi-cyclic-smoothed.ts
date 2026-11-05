/**
 * RSI Cyclic Smoothed
 *
 * Standard RSI with an additional Ehlers-style 2-pole Butterworth smoothing filter.
 * Reduces noise and highlights dominant cycle trends in RSI.
 *
 * Reference: "RSI Cyclic Smoothed"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RSICyclicSmoothedInputs {
  rsiLen: number;
  smoothLen: number;
  src: SourceType;
}

export const defaultInputs: RSICyclicSmoothedInputs = {
  rsiLen: 14,
  smoothLen: 5,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'smoothLen', type: 'int', title: 'Smooth Length', defval: 5, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CRSI', color: '#FF00FF', lineWidth: 2 },
  { id: 'plot1', title: 'LowBand', color: '#00FFFF', lineWidth: 1 },
  { id: 'plot2', title: 'HighBand', color: '#00FFFF', lineWidth: 1 },
];

export const metadata = {
  title: 'RSI Cyclic Smoothed',
  shortTitle: 'RSICS',
  overlay: false,
};

type Point = { time: number; value: number };

interface CrsiRun extends BarRunState<Record<string, never>> {
  rsi: ReturnType<typeof taStep.rsi>;
  smoothArr: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
}

function study(inputs: Partial<RSICyclicSmoothedInputs>): BarStudy<CrsiRun, IndicatorResult> {
  const { rsiLen, smoothLen, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);

  // 2-pole Butterworth low-pass filter
  const a = Math.exp(-Math.SQRT2 * Math.PI / smoothLen);
  const a2 = a * a;
  const coeff = 2 * a * Math.cos(Math.SQRT2 * Math.PI / smoothLen);
  // Transfer: y[i] = c0 * x[i] + c1 * y[i-1] + c2 * y[i-2]
  // c0 = (1 - coeff + a2), c1 = coeff, c2 = -a2 ... normalized
  // Actually: b = 1 - coeff + a2; y = b*x + coeff*y1 - a2*y2
  // But standard 2-pole Butterworth: y[i] = b0*x + b1*y[i-1] + b2*y[i-2]
  const b0 = 1 - coeff + a2;
  const b1 = coeff;
  const b2 = -a2;
  const warmup = rsiLen + smoothLen;

  // Dynamic bands: cyclic percentile-based upper/lower bounds (Pine: db/ub)
  const cyclicMemory = rsiLen * 4; // domcycle*2 where domcycle ~ rsiLen*2
  const leveling = 0.10; // 10/100

  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const rsi = taStep.rsi(rsiLen);
      const s: CrsiRun = { rsi, smoothArr: [], plot0: [], plot1: [], plot2: [], steps: [rsi], vars: {}, lists: [], series: [] };
      s.series = [s.smoothArr, s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const smoothArr = s.smoothArr;
      const x = s.rsi.step(value(bars[i]));
      if (x == null || i < rsiLen) {
        smoothArr[i] = NaN;
      } else {
        const y1 = i > 0 && !isNaN(smoothArr[i - 1]) ? smoothArr[i - 1] : x;
        const y2 = i > 1 && !isNaN(smoothArr[i - 2]) ? smoothArr[i - 2] : y1;
        smoothArr[i] = b0 * x + b1 * y1 + b2 * y2;
      }
      const v = smoothArr[i];
      s.plot0[i] = { time, value: (i < warmup || isNaN(v)) ? NaN : v };

      if (i < warmup || isNaN(smoothArr[i])) {
        s.plot1[i] = { time, value: NaN };
        s.plot2[i] = { time, value: NaN };
        return;
      }
      // Find min/max of crsi over cyclicMemory lookback
      let lmax = -999999;
      let lmin = 999999;
      const lookStart = Math.max(0, i - cyclicMemory + 1);
      for (let j = lookStart; j <= i; j++) {
        if (!isNaN(smoothArr[j])) {
          if (smoothArr[j] > lmax) lmax = smoothArr[j];
          if (smoothArr[j] < lmin) lmin = smoothArr[j];
        }
      }
      const mstep = (lmax - lmin) / 100;
      // Lower band (db): find value where leveling% of bars are below
      let db = lmin;
      for (let st = 0; st <= 100; st++) {
        const testvalue = lmin + mstep * st;
        let below = 0;
        for (let m = lookStart; m <= i; m++) {
          if (!isNaN(smoothArr[m]) && smoothArr[m] < testvalue) below++;
        }
        if (below / (i - lookStart + 1) >= leveling) { db = testvalue; break; }
      }
      // Upper band (ub): find value where leveling% of bars are above
      let ub = lmax;
      for (let st = 0; st <= 100; st++) {
        const testvalue = lmax - mstep * st;
        let above = 0;
        for (let m = lookStart; m <= i; m++) {
          if (!isNaN(smoothArr[m]) && smoothArr[m] >= testvalue) above++;
        }
        if (above / (i - lookStart + 1) >= leveling) { ub = testvalue; break; }
      }
      s.plot1[i] = { time, value: isNaN(db) ? NaN : db };
      s.plot2[i] = { time, value: isNaN(ub) ? NaN : ub };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice() },
        hlines: [
          { value: 70, options: { color: '#C0C0C0', linestyle: 'dashed' as const, title: 'Overbought' } },
          { value: 30, options: { color: '#C0C0C0', linestyle: 'dashed' as const, title: 'Oversold' } },
        ],
        fills: [
          { plot1: 'hline_Overbought', plot2: 'hline_Oversold', options: { color: 'rgba(192, 192, 192, 0.1)' } },
          { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(128, 128, 128, 0.1)' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RSICyclicSmoothedInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RSICyclicSmoothedInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RSICyclicSmoothed = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
