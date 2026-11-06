/**
 * UCS_Stochastic Momentum Index
 *
 * Stochastic Momentum Index with nested EMAs: over the highest high / lowest low of a (Percent K Length) bars,
 * rdiff = close - (hh + ll) / 2 and diff = hh - ll; SMI = EMA(EMA(rdiff, b), b) / (EMA(EMA(diff, b), b) / 2) * 100
 * (0 when the smoothed range is 0 or na), signal = EMA(SMI, b) (b: Percent D Length). Lines at 40 (Over Bought),
 * -40 (Over Sold) and 0 (Zero Line) are plots.
 *
 * Reference: "UCS_Stochastic Momentum Index" by UCSgears
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SMIUCSInputs {
  /** a: Percent K Length */
  kLen: number;
  /** b: Percent D Length */
  dLen: number;
}

export const defaultInputs: SMIUCSInputs = {
  kLen: 5,
  dLen: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'kLen', type: 'int', title: 'Percent K Length', defval: 5 },
  { id: 'dLen', type: 'int', title: 'Percent D Length', defval: 3 },
];

/** Pine default plot colour (the SMI plot has no colour argument) */
const PINE_BLUE = '#2962FF';
/** Pine v1 colour constants */
const RED = '#FF0000';
const GREEN = '#008000';
const BLUE = '#0000FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Stochastic Momentum Index', color: PINE_BLUE, lineWidth: 1 },
  { id: 'plot1', title: 'SMI Signal Line', color: RED, lineWidth: 1 },
  { id: 'plot2', title: 'Over Bought', color: RED, lineWidth: 1 },
  { id: 'plot3', title: 'Over Sold', color: GREEN, lineWidth: 1 },
  { id: 'plot4', title: 'Zero Line', color: BLUE, lineWidth: 1 },
];

export const metadata = {
  title: 'UCS_Stochastic Momentum Index',
  shortTitle: 'UCS_SMI',
  overlay: false,
};

/** Pine `x != 0`: false when x is na, true when |x| > 1e-10 */
const EPS = 1e-10;
const ne0 = (a: number) => !isNaN(a) && Math.abs(a) > EPS;

type Point = { time: number; value: number };

interface SmiRun extends BarRunState<Record<string, never>> {
  ll: WindowExtreme;
  hh: WindowExtreme;
  rel1: ReturnType<typeof taStep.ema>;
  rel2: ReturnType<typeof taStep.ema>;
  diff1: ReturnType<typeof taStep.ema>;
  diff2: ReturnType<typeof taStep.ema>;
  sig: ReturnType<typeof taStep.ema>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
  plot4: Point[];
}

function study(inputs: Partial<SMIUCSInputs>): BarStudy<SmiRun, IndicatorResult> {
  const { kLen: a, dLen: b } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ll = new WindowExtreme(true, a);
      const hh = new WindowExtreme(false, a);
      const rel1 = taStep.ema(b);
      const rel2 = taStep.ema(b);
      const diff1 = taStep.ema(b);
      const diff2 = taStep.ema(b);
      const sig = taStep.ema(b);
      const s: SmiRun = {
        ll, hh, rel1, rel2, diff1, diff2, sig, plot0: [], plot1: [], plot2: [], plot3: [], plot4: [],
        steps: [ll, hh, rel1, rel2, diff1, diff2, sig], vars: {}, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1, s.plot2, s.plot3, s.plot4];
      return s;
    },
    bar(s, i, bars) {
      const x = bars[i];
      const time = x.time as number;
      // ll = lowest(low, a); hh = highest(high, a); diff = hh - ll; rdiff = close - (hh + ll) / 2
      const ll = s.ll.step(x.low);
      const hh = s.hh.step(x.high);
      const diff = hh - ll;
      const rdiff = x.close - (hh + ll) / 2;
      // avgrel = ema(ema(rdiff, b), b); avgdiff = ema(ema(diff, b), b)
      const avgrel = s.rel2.step(s.rel1.step(rdiff));
      const avgdiff = s.diff2.step(s.diff1.step(diff));
      // SMI = avgdiff != 0 ? (avgrel / (avgdiff / 2) * 100) : 0
      const smi = ne0(avgdiff) ? avgrel / (avgdiff / 2) * 100 : 0;
      // SMIsignal = ema(SMI, b)
      const signal = s.sig.step(smi);
      s.plot0[i] = { time, value: smi };
      s.plot1[i] = { time, value: signal };
      s.plot2[i] = { time, value: 40 };
      s.plot3[i] = { time, value: -40 };
      s.plot4[i] = { time, value: 0 };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice(), plot4: s.plot4.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SMIUCSInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SMIUCSInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const SMIUCS = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
