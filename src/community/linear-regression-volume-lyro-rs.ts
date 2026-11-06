/**
 * Linear Regression Volume | Lyro RS
 *
 * A volume-weighted average price, ma(close * volume, len) / ma(volume, len) with the chosen average (SMA, RMA, HMA
 * or ALMA with offset 0 and sigma 0), smoothed by a linear regression of `len` bars: the fair value line. Three
 * band pairs at 1, 2 and 3 times mult * stdev(close, len) around it are filled. The line and the fills are green
 * when the fair value rises, pink when it falls, gray otherwise.
 * Alerts (alertcondition, `alerts` of the result): the fair value rising (Long) / falling (Short).
 *
 * Reference: "Linear Regression Volume | Lyro RS" by LyroRS
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Lyro RS
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface LinearRegressionVolumeLyroRsInputs {
  /** Length of the volume-weighted average, the linear regression and the standard deviation */
  len: number;
  /** Deviation multiplier of the bands */
  mult: number;
  /** Average of the volume-weighted price */
  typeMA: 'SMA' | 'RMA' | 'HMA' | 'ALMA';
}

export const defaultInputs: LinearRegressionVolumeLyroRsInputs = {
  len: 35,
  mult: 1.0,
  typeMA: 'SMA',
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Regression Length', defval: 35 },
  { id: 'mult', type: 'float', title: 'Deviation Multiplier', defval: 1.0 },
  { id: 'typeMA', type: 'string', title: 'Type', defval: 'SMA', options: ['SMA', 'RMA', 'HMA', 'ALMA'],
    tooltip: 'Change to what suits your style' },
];

const UPPER_COL = '#ff026f';
const LOWER_COL = '#40ed49';
const UPPER_T = String(color.new(UPPER_COL, 100));
const LOWER_T = String(color.new(LOWER_COL, 100));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fair Value', color: LOWER_COL, lineWidth: 2 },
  { id: 'plot1', title: 'Upper Band 1', color: UPPER_T, lineWidth: 1 },
  { id: 'plot2', title: 'Lower Band 1', color: UPPER_T, lineWidth: 1 },
  { id: 'plot3', title: 'Upper Band 2', color: UPPER_T, lineWidth: 1 },
  { id: 'plot4', title: 'Lower Band 2', color: LOWER_T, lineWidth: 1 },
  { id: 'plot5', title: 'Upper Band 3', color: UPPER_T, lineWidth: 1 },
  { id: 'plot6', title: 'Lower Band 3', color: LOWER_T, lineWidth: 1 },
];

export const metadata = {
  title: 'Linear Regression Volume | Lyro RS',
  shortTitle: 'LR Volume | 𝓛𝔂𝓻𝓸 𝓡𝓢',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { alerts: AlertConditionState[] };
type Ma = { step(v: number, i: number, values: number[]): number; commit(): void };

interface LrvRun extends BarRunState<Record<string, never>> {
  numMa: Ma;
  denMa: Ma;
  dev: WindowStdev;
  pv: number[];
  vol: number[];
  vwPrice: number[];
  baseline: number[];
  plots: Point[][];
  fills: string[][];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<LinearRegressionVolumeLyroRsInputs>): BarStudy<LrvRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { len, mult } = cfg;
  // ta.alma(x, len, 0, 0): the weights of the oakscriptjs array function, the window sum in the same order
  let almaWeights: number[] = [];
  if (cfg.typeMA === 'ALMA') {
    const m = 0 * (len - 1);
    const sd = len / 0;
    let weightSum = 0;
    for (let i = 0; i < len; i++) {
      const weight = Math.exp(-1 * Math.pow(i - m, 2) / (2 * Math.pow(sd, 2)));
      almaWeights.push(weight);
      weightSum += weight;
    }
    almaWeights = almaWeights.map((w) => w / weightSum);
  }
  // ta.linreg(vwPrice, len, 0) on bar i: the loops of the oakscriptjs array function (the same doubles)
  const L = Math.floor(len);
  const linreg = (src: number[], i: number): number => {
    if (i < L - 1) return NaN;
    for (let j = 0; j < L; j++) if (isNaN(src[i - j])) return NaN;
    let sumX = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2 = 0;
    for (let j = 0; j < L; j++) {
      const x = j + 1;
      const y = src[i - (L - 1 - j)];
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumX2 += x * x;
    }
    const slope = (L * sumXY - sumX * sumY) / (L * sumX2 - sumX * sumX);
    const intercept = sumY / L - (slope * sumX) / L + slope;
    return intercept + slope * (L - 1 - 0);
  };
  const maStep = (): Ma => {
    switch (cfg.typeMA) {
      case 'SMA': { const m = new WindowSma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'RMA': { const m = taStep.rma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'HMA': { const m = taStep.hma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
      case 'ALMA': return {
        step: (_v, i, values) => {
          if (i < len - 1) return NaN;
          let almaValue = 0;
          for (let j = 0; j < len; j++) almaValue += values[i - len + 1 + j] * almaWeights[j];
          return almaValue;
        },
        commit: () => {},
      };
      default: return { step: () => NaN, commit: () => {} };
    }
  };
  return {
    init() {
      const s: LrvRun = {
        numMa: maStep(), denMa: maStep(), dev: new WindowStdev(len), pv: [], vol: [], vwPrice: [],
        baseline: [], plots: Array.from({ length: 7 }, () => []), fills: [[], [], []], flags: [[], []], times: [[], []],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.numMa, s.denMa, s.dev];
      s.lists = [...s.times];
      s.series = [s.pv, s.vol, s.vwPrice, s.baseline, ...s.plots, ...s.fills, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      // vw_linregCho(close, len, typeMA): ma(close * volume, len) / ma(volume, len) (x / 0 is +-infinity, 0 / 0 na)
      const volume = b.volume ?? NaN;
      s.pv[i] = b.close * volume;
      s.vol[i] = volume;
      const num = s.numMa.step(s.pv[i], i, s.pv);
      const den = s.denMa.step(volume, i, s.vol);
      // ta.linreg skips na like the averages: give it NaN for +-infinity
      const vw = num / den;
      const vwPrice = Number.isFinite(vw) ? vw : NaN;
      s.vwPrice[i] = vwPrice;
      const baseline = linreg(s.vwPrice, i);
      s.baseline[i] = baseline;
      const dev = mult * s.dev.step(b.close);

      // bandColor = slope > 0 ? #40ed49 : slope < 0 ? #ff026f : color.gray
      const slope = i > 0 ? baseline - s.baseline[i - 1] : NaN;
      const bandColor = gt(slope, 0) ? LOWER_COL : lt(slope, 0) ? UPPER_COL : color.gray;
      const p = s.plots;
      p[0][i] = { time: t, value: baseline, color: bandColor };
      p[1][i] = { time: t, value: baseline + 1 * dev, color: UPPER_T };
      p[2][i] = { time: t, value: baseline + -1 * dev, color: UPPER_T };
      p[3][i] = { time: t, value: baseline + 2 * dev, color: UPPER_T };
      p[4][i] = { time: t, value: baseline + -2 * dev, color: LOWER_T };
      p[5][i] = { time: t, value: baseline + 3 * dev, color: UPPER_T };
      p[6][i] = { time: t, value: baseline + -3 * dev, color: LOWER_T };
      // fill(upper1Plot, lower1Plot, color = color.new(bandColor, 85)) (and 92, 96 for bands 2 and 3)
      s.fills[0][i] = String(color.new(bandColor, 85));
      s.fills[1][i] = String(color.new(bandColor, 92));
      s.fills[2][i] = String(color.new(bandColor, 96));
      // alertcondition(slope > 0, ...) / alertcondition(slope < 0, ...)
      const up = gt(slope, 0);
      const down = lt(slope, 0);
      s.flags[0][i] = up;
      s.flags[1][i] = down;
      if (up) s.times[0].push(t as number);
      if (down) s.times[1].push(t as number);
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(), plot6: p[6].slice(),
        },
        fills: [
          { plot1: 'plot1', plot2: 'plot2', colors: s.fills[0].slice() },
          { plot1: 'plot3', plot2: 'plot4', colors: s.fills[1].slice() },
          { plot1: 'plot5', plot2: 'plot6', colors: s.fills[2].slice() },
        ],
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<LinearRegressionVolumeLyroRsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<LinearRegressionVolumeLyroRsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Linear Regression Volume - Long', message: 'Linear Regression Volume is Long {{exchange}}:{{ticker}}' },
  { id: 'alert1', title: 'Linear Regression Volume - Short', message: 'Linear Regression Volume is Short {{exchange}}:{{ticker}}' },
];

export const LinearRegressionVolumeLyroRs = {
  calculate,
  createRun,
  metadata,

  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
