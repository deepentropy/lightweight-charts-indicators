/**
 * Guppy Oscillator
 *
 * Difference between the average of the short-term Guppy EMAs (3, 5, 8, 10, 12) and the average of the long-term
 * Guppy EMAs (30, 35, 40, 45, 50) of the close, with an EMA signal line. The histogram is green above zero and red
 * below; it is full colour when it moves away from the signal and half transparent otherwise.
 *
 * Reference: "Guppy Oscillator-REvans993" by REvans993
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface GuppyOscillatorREvans993Inputs {
  /** EMA length of the signal line */
  signalLength: number;
}

export const defaultInputs: GuppyOscillatorREvans993Inputs = {
  signalLength: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 5 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Histogram', color: color.green, lineWidth: 3, style: 'histogram' },
  { id: 'plot1', title: 'Signal', color: color.orange, lineWidth: 2 },
];

export const metadata = {
  title: 'Guppy Oscillator',
  shortTitle: 'GMMA Osc',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };

interface GuppyRun extends BarRunState<Record<string, never>> {
  shortE: ReturnType<typeof taStep.ema>[];
  longE: ReturnType<typeof taStep.ema>[];
  sig: ReturnType<typeof taStep.ema>;
  hist: Point[];
  signal: Point[];
}

function study(inputs: Partial<GuppyOscillatorREvans993Inputs>): BarStudy<GuppyRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const green = String(color.new(color.green, 0));
  const greenHalf = String(color.new(color.green, 50));
  const red = String(color.new(color.red, 0));
  const redHalf = String(color.new(color.red, 50));
  return {
    init() {
      const s: GuppyRun = {
        shortE: [3, 5, 8, 10, 12].map((l) => taStep.ema(l)),
        longE: [30, 35, 40, 45, 50].map((l) => taStep.ema(l)),
        sig: taStep.ema(cfg.signalLength),
        hist: [], signal: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [...s.shortE, ...s.longE, s.sig];
      s.series = [s.hist, s.signal];
      return s;
    },
    bar(s, i, bars) {
      const { time, close } = bars[i];
      // short_avg = math.avg(ema 3, 5, 8, 10, 12); long_avg = math.avg(ema 30, 35, 40, 45, 50)
      let shortSum = 0;
      for (const e of s.shortE) shortSum += e.step(close);
      let longSum = 0;
      for (const e of s.longE) longSum += e.step(close);
      const diff = shortSum / s.shortE.length - longSum / s.longE.length;
      const signal = s.sig.step(diff);
      // hist_color = diff > 0 ? (diff > signal ? green : green 50) : (diff < signal ? red : red 50)
      const histColor = gt(diff, 0) ? (gt(diff, signal) ? green : greenHalf) : (lt(diff, signal) ? red : redHalf);
      s.hist[i] = { time, value: diff, color: histColor };
      s.signal[i] = { time, value: signal, color: color.orange };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.hist.slice(), plot1: s.signal.slice() },
        hlines: [
          { value: 0, options: { title: 'Zero Line', color: color.gray, linestyle: 'dashed' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GuppyOscillatorREvans993Inputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<GuppyOscillatorREvans993Inputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const GuppyOscillatorREvans993 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
