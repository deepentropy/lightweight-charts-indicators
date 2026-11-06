/**
 * Gaussian Channel [DW]
 *
 * Gaussian-weighted moving average approximated via linear regression,
 * with upper and lower bands at configurable standard deviation multiples.
 *
 * Reference: "Gaussian Channel [DW]"
 */

import { taCore, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface GaussianChannelInputs {
  length: number;
  mult: number;
  src: SourceType;
}

export const defaultInputs: GaussianChannelInputs = {
  length: 20,
  mult: 2.0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'mult', type: 'float', title: 'Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Center', color: '#FF6D00', lineWidth: 2 },
  { id: 'plot1', title: 'Upper', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Gaussian Channel',
  shortTitle: 'GC',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };
type Point = { time: number; value: number; color: string };

interface GcRun extends BarRunState<Record<string, never>> {
  dev: WindowStdev;
  centerArr: number[];
  sourceArr: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  fillColors: string[];
  barColors: BarColorData[];
}

/**
 * `ta.linreg(source, length, offset)` on bar `i` from the source values of the bars up to `i` (the loops of the
 * oakscriptjs array function: the same doubles)
 */
function linregAt(source: number[], i: number, length: number, offset: number): number {
  const len = Math.floor(length);
  if (i < len - 1) return NaN;
  // Check for NaN values in window
  for (let j = 0; j < len; j++) if (isNaN(source[i - j]!)) return NaN;
  // Least squares as PineScript: x = 1 (oldest) .. len (newest), summed from the oldest value; the intercept is the
  // fitted value at x = 1
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let j = 0; j < len; j++) {
    const x = j + 1;
    const y = source[i - (len - 1 - j)]!;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }
  const slope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX);
  const intercept = sumY / len - (slope * sumX) / len + slope;
  return intercept + slope * (len - 1 - offset);
}

function study(inputs: Partial<GaussianChannelInputs>): BarStudy<GcRun, Result> {
  const { length, mult, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = length;
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      // the length check of ta.linreg (the same runtime error)
      taCore.linreg([], length, 0);
      const dev = new WindowStdev(length);
      const s: GcRun = {
        dev, centerArr: [], sourceArr: [], plot0: [], plot1: [], plot2: [], fillColors: [], barColors: [],
        steps: [dev], vars: {}, lists: [], series: [],
      };
      s.lists = [s.barColors];
      s.series = [s.centerArr, s.sourceArr, s.plot0, s.plot1, s.plot2, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const sv = value(b);
      s.sourceArr[i] = sv;
      const v = linregAt(s.sourceArr, i, length, 0);
      const d0 = s.dev.step(sv);
      s.centerArr[i] = v;
      const centerArr = s.centerArr;

      // Pine: fcolor = filt > filt[1] ? #0aff68 : filt < filt[1] ? #ff0a5a : #cccccc
      let fc: string;
      if (i < warmup) fc = '#cccccc';
      else {
        const curr = centerArr[i] ?? 0;
        const prev = i > 0 ? (centerArr[i - 1] ?? 0) : 0;
        fc = curr > prev ? '#0aff68' : curr < prev ? '#ff0a5a' : '#cccccc';
      }

      const c = v ?? NaN;
      const d = d0 ?? NaN;
      s.plot0[i] = { time: b.time, value: i < warmup ? NaN : (v ?? NaN), color: fc };
      s.plot1[i] = { time: b.time, value: i < warmup ? NaN : c + mult * d, color: fc };
      s.plot2[i] = { time: b.time, value: i < warmup ? NaN : c - mult * d, color: fc };

      // barcolor: 6-level coloring based on src direction vs filter/band position
      // Pine: (src>src[1]) and (src>filt) and (src<hband) -> #0aff68
      //        (src>src[1]) and (src>=hband) -> #0aff1b
      //        (src<=src[1]) and (src>filt) -> #00752d
      //        (src<src[1]) and (src<filt) and (src>lband) -> #ff0a5a
      //        (src<src[1]) and (src<=lband) -> #ff0a11
      //        (src>=src[1]) and (src<filt) -> #990032
      //        else #cccccc
      if (i >= warmup) {
        const sc = s.sourceArr[i] ?? 0;
        const sPrev = s.sourceArr[i - 1] ?? 0;
        const f = centerArr[i] ?? 0;
        const dd = d0 ?? 0;
        const hb = f + mult * dd;
        const lb = f - mult * dd;
        let color: string;
        if (sc > sPrev && sc > f && sc < hb) color = '#0aff68';
        else if (sc > sPrev && sc >= hb) color = '#0aff1b';
        else if (sc <= sPrev && sc > f) color = '#00752d';
        else if (sc < sPrev && sc < f && sc > lb) color = '#ff0a5a';
        else if (sc < sPrev && sc <= lb) color = '#ff0a11';
        else if (sc >= sPrev && sc < f) color = '#990032';
        else color = '#cccccc';
        s.barColors.push({ time: b.time, color });
      }

      // Pine: fill(hbandplot, lbandplot, color=fcolor, transp=80) -- dynamic fill matching filter direction
      s.fillColors[i] = fc === '#0aff68' ? 'rgba(10, 255, 104, 0.2)' // green, 80% transparent
        : fc === '#ff0a5a' ? 'rgba(255, 10, 90, 0.2)' // red, 80% transparent
        : 'rgba(204, 204, 204, 0.2)'; // gray
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice(), 'plot2': s.plot2.slice() },
        fills: [{ plot1: 'plot1', plot2: 'plot2', options: { color: '#cccccc33' }, colors: s.fillColors.slice() }],
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GaussianChannelInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<GaussianChannelInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const GaussianChannel = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
