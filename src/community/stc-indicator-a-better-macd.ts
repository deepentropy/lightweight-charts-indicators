/**
 * STC Indicator - A Better MACD (Schaff Trend Cycle)
 *
 * MACD line = EMA(close, FastLength) - EMA(close, SlowLength). A first stochastic of the MACD over `Length` bars
 * (kept when the range is 0) is smoothed by a factor AAA, then a second stochastic of that smoothed line over
 * `Length` bars is smoothed again: the STC line, green when it rises and red otherwise. Two lines at 25 and 75
 * with a fill between them.
 * alert() calls (`alertCalls`, once per bar): "Red" when the line turned down two bars back and is above 75, "Green"
 * when it turned up two bars back and is below 25.
 *
 * Reference: "STC Indicator - A Better MACD [SHK]" by shayankm
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface StcIndicatorABetterMacdInputs {
  /** Stochastic length */
  length: number;
  /** Fast EMA length */
  fastLength: number;
  /** Slow EMA length */
  slowLength: number;
  /** Smoothing factor of the two stochastic steps */
  factor: number;
}

export const defaultInputs: StcIndicatorABetterMacdInputs = {
  length: 12,
  fastLength: 26,
  slowLength: 50,
  factor: 0.5,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 12 },
  { id: 'fastLength', type: 'int', title: 'FastLength', defval: 26 },
  { id: 'slowLength', type: 'int', title: 'SlowLength', defval: 50 },
  { id: 'factor', type: 'float', title: 'AAA', defval: 0.5 },
];

const LEVEL_COLOR = String(color.new('#787B86', 70));
const FILL_COLOR = String(color.new('#787B86', 96));
const UP_COLOR = String(color.new('#4CAF50', 20));
const DOWN_COLOR = String(color.new('#FF5252', 20));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'STC', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Level 25', color: LEVEL_COLOR, lineWidth: 1 },
  { id: 'plot2', title: 'Level 75', color: LEVEL_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: '[SHK] Schaff Trend Cycle (STC)',
  shortTitle: 'STC',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color?: string };
type Result = IndicatorResult & { alertCalls: AlertCall[] };

interface StcVars {
  /** CCCCC[1], DDD[1], and the same of the second stochastic */
  prevK1: number;
  prevD: number;
  prevK2: number;
  prevE: number;
}

interface StcRun extends BarRunState<StcVars> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  ccc: WindowExtreme;
  cHigh: WindowExtreme;
  dLow: WindowExtreme;
  dHigh: WindowExtreme;
  stc: number[];
  plots: Point[][];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<StcIndicatorABetterMacdInputs>): BarStudy<StcRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, fastLength, slowLength, factor } = cfg;
  return {
    init() {
      const s: StcRun = {
        fast: taStep.ema(fastLength), slow: taStep.ema(slowLength),
        ccc: new WindowExtreme(true, length), cHigh: new WindowExtreme(false, length),
        dLow: new WindowExtreme(true, length), dHigh: new WindowExtreme(false, length),
        stc: [], plots: [[], [], []], alertCalls: [],
        vars: { prevK1: NaN, prevD: NaN, prevK2: NaN, prevE: NaN }, steps: [], lists: [], series: [],
      };
      s.steps = [s.fast, s.slow, s.ccc, s.cHigh, s.dLow, s.dHigh];
      s.lists = [s.alertCalls];
      s.series = [s.stc, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const macd = (s.fast.step(b.close) ?? NaN) - (s.slow.step(b.close) ?? NaN);
      const ccc = s.ccc.step(macd);
      const cHigh = s.cHigh.step(macd);

      // First stochastic + smoothing (DDD), then the lowest / highest of DDD
      const range1 = cHigh - ccc;
      // CCCCC := CCCC > 0 ? (BBBBBB - CCC) / CCCC * 100 : nz(CCCCC[1])
      const k1 = gt(range1, 0) ? ((macd - ccc) / range1) * 100 : (isNaN(v.prevK1) ? 0 : v.prevK1);
      // DDD := na(DDD[1]) ? CCCCC : DDD[1] + AAA * (CCCCC - DDD[1])
      const ddd = isNaN(v.prevD) ? k1 : v.prevD + factor * (k1 - v.prevD);
      v.prevK1 = k1;
      v.prevD = ddd;
      const dLow = s.dLow.step(ddd);
      const dHigh = s.dHigh.step(ddd);

      const range = dHigh - dLow;
      const k2 = gt(range, 0) ? ((ddd - dLow) / range) * 100 : (isNaN(v.prevK2) ? 0 : v.prevK2);
      const stc = isNaN(v.prevE) ? k2 : v.prevE + factor * (k2 - v.prevE);
      v.prevK2 = k2;
      v.prevE = stc;
      s.stc[i] = stc;

      // if m[3] <= m[2] and m[2] > m[1] and m > 75: alert("Red", alert.freq_once_per_bar)
      // if m[3] >= m[2] and m[2] < m[1] and m < 25: alert("Green", alert.freq_once_per_bar)
      const m = (j: number) => (j >= 0 ? s.stc[j] : NaN);
      const t = b.time as number;
      if (le(m(i - 3), m(i - 2)) && gt(m(i - 2), m(i - 1)) && gt(m(i), 75)) s.alertCalls.push({ time: t, message: 'Red', freq: 'once_per_bar' });
      if (ge(m(i - 3), m(i - 2)) && lt(m(i - 2), m(i - 1)) && lt(m(i), 25)) s.alertCalls.push({ time: t, message: 'Green', freq: 'once_per_bar' });

      s.plots[0][i] = {
        time: b.time,
        value: Number.isFinite(stc) ? stc : NaN,
        color: i > 0 && gt(stc, s.stc[i - 1]) ? UP_COLOR : DOWN_COLOR,
      };
      s.plots[1][i] = { time: b.time, value: 25 };
      s.plots[2][i] = { time: b.time, value: 75 };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
        fills: [{ plot1: 'plot1', plot2: 'plot2', options: { color: FILL_COLOR } }],
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<StcIndicatorABetterMacdInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<StcIndicatorABetterMacdInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const StcIndicatorABetterMacd = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hasAlertFunction,
};
