/**
 * TMO (True Momentum Oscillator)
 *
 * For each bar, the close is compared with the open of the current bar and of the `length` previous bars:
 * +1 when the close is higher, -1 when it is lower, 0 otherwise; the sum is smoothed by an EMA (calculation length),
 * a second EMA gives the main line and a third EMA the signal line (smooth length). Both lines and the cloud between
 * them are green when the main line is above the signal line, red otherwise. Lines at 0, at +-round(length * 0.7)
 * and at +-length, with a red cloud between the two upper lines and a green cloud between the two lower lines.
 *
 * Reference: "TMO (True Momentum Oscillator)" by Coulisnosaj
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrueMomentumOscillatorInputs {
  /** Number of previous opens compared with the close */
  length: number;
  /** EMA length of the momentum sum */
  calcLength: number;
  /** EMA length of the main and signal lines */
  smoothLength: number;
}

export const defaultInputs: TrueMomentumOscillatorInputs = {
  length: 14,
  calcLength: 5,
  smoothLength: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14 },
  { id: 'calcLength', type: 'int', title: 'Calculation Length', defval: 5 },
  { id: 'smoothLength', type: 'int', title: 'Smooth Length', defval: 3 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Main', color: color.green, lineWidth: 2 },
  { id: 'plot1', title: 'Signal', color: color.green, lineWidth: 1 },
  { id: 'plot2', title: 'Zero Line', color: color.gray, lineWidth: 1 },
  { id: 'plot3', title: 'Overbought', color: color.gray, lineWidth: 1 },
  { id: 'plot4', title: 'Oversold', color: color.gray, lineWidth: 1 },
  { id: 'plot5', title: 'Overbought Line', color: color.gray, lineWidth: 1 },
  { id: 'plot6', title: 'Oversold Line', color: color.gray, lineWidth: 1 },
];

export const metadata = {
  title: 'TMO (True Momentum Oscillator)',
  shortTitle: 'TMO',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };

interface TmoRun extends BarRunState<Record<string, never>> {
  ema5: ReturnType<typeof taStep.ema>;
  main: ReturnType<typeof taStep.ema>;
  signal: ReturnType<typeof taStep.ema>;
  plots: Point[][];
  cloud: string[];
}

function study(inputs: Partial<TrueMomentumOscillatorInputs>): BarStudy<TmoRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, calcLength, smoothLength } = cfg;
  const step = length >= 0 ? 1 : -1;
  const cloudUp = String(color.new(color.green, 80));
  const cloudDown = String(color.new(color.red, 80));
  // ob = math.round(length * 0.7), os = -ob
  const ob = Math.round(length * 0.7);
  const os = -ob;
  return {
    init() {
      const s: TmoRun = {
        ema5: taStep.ema(calcLength), main: taStep.ema(smoothLength), signal: taStep.ema(smoothLength),
        plots: Array.from({ length: 7 }, () => []), cloud: [], steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.ema5, s.main, s.signal];
      s.series = [...s.plots, s.cloud];
      return s;
    },
    bar(s, b, bars) {
      // data = sum over i = 0 .. length of (close > open[i] ? 1 : close < open[i] ? -1 : 0); open[i] before the first
      // bar is na and adds 0. `for i = 0 to length` counts down when length < 0.
      const c = bars[b].close;
      let sum = 0;
      for (let i = 0; step > 0 ? i <= length : i >= length; i += step) {
        if (i < 0) throw new Error(`Invalid number of bars back: ${i}`);
        const o = b - i >= 0 ? bars[b - i].open : NaN;
        sum += gt(c, o) ? 1 : lt(c, o) ? -1 : 0;
      }
      const ema5 = s.ema5.step(sum);
      const mainVal = s.main.step(ema5);
      const signalVal = s.signal.step(mainVal);
      const up = gt(mainVal, signalVal);
      const lineColor = up ? color.green : color.red;
      const time = bars[b].time;
      s.plots[0][b] = { time, value: mainVal, color: lineColor };
      s.plots[1][b] = { time, value: signalVal, color: lineColor };
      s.plots[2][b] = { time, value: 0, color: color.gray };
      s.plots[3][b] = { time, value: ob, color: color.gray };
      s.plots[4][b] = { time, value: os, color: color.gray };
      s.plots[5][b] = { time, value: length, color: color.gray };
      s.plots[6][b] = { time, value: -length, color: color.gray };
      s.cloud[b] = up ? cloudUp : cloudDown;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: Object.fromEntries(s.plots.map((p, k) => [`plot${k}`, p.slice()])),
        fills: [
          // fill(p_main, p_signal, main_val > signal_val ? color.new(color.green, 80) : color.new(color.red, 80))
          { plot1: 'plot0', plot2: 'plot1', colors: s.cloud.slice() },
          // fill(p_ob, p_obLine, color.new(color.red, 90)); fill(p_osLine, p_os, color.new(color.green, 90))
          { plot1: 'plot3', plot2: 'plot5', options: { color: String(color.new(color.red, 90)) } },
          { plot1: 'plot6', plot2: 'plot4', options: { color: String(color.new(color.green, 90)) } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrueMomentumOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrueMomentumOscillatorInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const TrueMomentumOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
