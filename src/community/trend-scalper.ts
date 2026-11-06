/**
 * Trend Scalper
 *
 * Three EMAs of the close (9, 21, 89). A bullish stack is EMA1 > EMA2 > EMA3, a bearish stack EMA1 < EMA2 < EMA3.
 * A long signal is a bullish stack with the low between EMA2 and EMA1; a short signal is a bearish stack with the
 * high between EMA1 and EMA2. With "First signals only?" a long signal also needs a bearish stack within the
 * lookback bars and no long signal as the last signal (a short signal the same way).
 *
 * Alerts (alertcondition, `alerts` of the result): "Long Alert" / "Short Alert" on the bars of the long / short
 * triangles.
 *
 * Reference: "Trend Scalper" by abedmahmood
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface TrendScalperInputs {
  ema1Length: number;
  ema2Length: number;
  ema3Length: number;
  emaColor1: string;
  emaColor2: string;
  emaColor3: string;
  longColor: string;
  shortColor: string;
  showEMA1: boolean;
  showEMA2: boolean;
  showEMA3: boolean;
  /** Only the first signal after a stack change */
  onlyFirstTriangle: boolean;
  /** Lookback bars of the opposite stack (first signals mode) */
  lookbackBars: number;
}

export const defaultInputs: TrendScalperInputs = {
  ema1Length: 9,
  ema2Length: 21,
  ema3Length: 89,
  emaColor1: color.gray,
  emaColor2: color.gray,
  emaColor3: color.gray,
  longColor: color.green,
  shortColor: color.red,
  showEMA1: true,
  showEMA2: true,
  showEMA3: true,
  onlyFirstTriangle: false,
  lookbackBars: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'ema1Length', type: 'int', title: 'EMA 1 Length', defval: 9, min: 1 },
  { id: 'ema2Length', type: 'int', title: 'EMA 2 Length', defval: 21, min: 1 },
  { id: 'ema3Length', type: 'int', title: 'EMA 3 Length', defval: 89, min: 1 },
  { id: 'emaColor1', type: 'color', title: 'EMA 1 Color', defval: color.gray },
  { id: 'emaColor2', type: 'color', title: 'EMA 2 Color', defval: color.gray },
  { id: 'emaColor3', type: 'color', title: 'EMA 3 Color', defval: color.gray },
  { id: 'longColor', type: 'color', title: 'Long Signal Color', defval: color.green },
  { id: 'shortColor', type: 'color', title: 'Short Signal Color', defval: color.red },
  { id: 'showEMA1', type: 'bool', title: 'Show EMA 1', defval: true },
  { id: 'showEMA2', type: 'bool', title: 'Show EMA 2', defval: true },
  { id: 'showEMA3', type: 'bool', title: 'Show EMA 3', defval: true },
  { id: 'onlyFirstTriangle', type: 'bool', title: 'First signals only?', defval: false },
  { id: 'lookbackBars', type: 'int', title: 'Lookback Bars for Trend Validation', defval: 50, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 1', color: color.gray, lineWidth: 1 },
  { id: 'plot1', title: 'EMA 2', color: color.gray, lineWidth: 1 },
  { id: 'plot2', title: 'EMA 3', color: color.gray, lineWidth: 1 },
];

export const metadata = {
  title: 'Trend Scalper',
  shortTitle: 'Trend Scalper',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alerts: AlertConditionState[] };

interface TrendScalperVars {
  /** var int lastSignal = 0 */
  lastSignal: number;
}

interface TrendScalperRun extends BarRunState<TrendScalperVars> {
  ema1: ReturnType<typeof taStep.ema>;
  ema2: ReturnType<typeof taStep.ema>;
  ema3: ReturnType<typeof taStep.ema>;
  sinceBull: ReturnType<typeof taStep.barssince>;
  sinceBear: ReturnType<typeof taStep.barssince>;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<TrendScalperInputs>): BarStudy<TrendScalperRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ema1 = taStep.ema(cfg.ema1Length);
      const ema2 = taStep.ema(cfg.ema2Length);
      const ema3 = taStep.ema(cfg.ema3Length);
      const sinceBull = taStep.barssince();
      const sinceBear = taStep.barssince();
      const s: TrendScalperRun = {
        ema1, ema2, ema3, sinceBull, sinceBear, plot0: [], plot1: [], plot2: [], markers: [],
        flags: [[], []], times: [[], []],
        steps: [ema1, ema2, ema3, sinceBull, sinceBear], vars: { lastSignal: 0 }, lists: [], series: [],
      };
      s.lists = [s.markers, ...s.times];
      s.series = [s.plot0, s.plot1, s.plot2, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const { low, high, close, time } = bars[i];
      const e1 = s.ema1.step(close);
      const e2 = s.ema2.step(close);
      const e3 = s.ema3.step(close);
      const bullish = gt(e1, e2) && gt(e2, e3);
      const bearish = lt(e1, e2) && lt(e2, e3);
      // ta.barssince(x) <= lookbackBars: na (never true yet) compares false
      const recentBull = le(s.sinceBull.step(bullish ? 1 : 0), cfg.lookbackBars);
      const recentBear = le(s.sinceBear.step(bearish ? 1 : 0), cfg.lookbackBars);
      const longCond = bullish && le(low, e1) && ge(low, e2);
      const shortCond = bearish && ge(high, e1) && le(high, e2);
      const rawBuy = le(low, e1) && ge(low, e2) && bullish && recentBear;
      const rawSell = ge(high, e1) && le(high, e2) && bearish && recentBull;
      const buySignal = rawBuy && v.lastSignal !== 1;
      const sellSignal = rawSell && v.lastSignal !== -1;
      if (buySignal) v.lastSignal = 1;
      if (sellSignal) v.lastSignal = -1;
      const plotLong = cfg.onlyFirstTriangle ? buySignal : longCond;
      const plotShort = cfg.onlyFirstTriangle ? sellSignal : shortCond;
      if (!cfg.onlyFirstTriangle && !(longCond || shortCond)) v.lastSignal = 0;

      // plotshape(plotLongSignal, "Long Signal", shape.triangleup, location.belowbar, longColor, size.small)
      if (plotLong) s.markers.push({ time, position: 'belowBar', shape: 'triangleUp', color: cfg.longColor, size: 'small' });
      // plotshape(plotShortSignal, "Short Signal", shape.triangledown, location.abovebar, shortColor, size.small)
      if (plotShort) s.markers.push({ time, position: 'aboveBar', shape: 'triangleDown', color: cfg.shortColor, size: 'small' });

      s.plot0[i] = { time, value: cfg.showEMA1 ? e1 : NaN, color: cfg.emaColor1 };
      s.plot1[i] = { time, value: cfg.showEMA2 ? e2 : NaN, color: cfg.emaColor2 };
      s.plot2[i] = { time, value: cfg.showEMA3 ? e3 : NaN, color: cfg.emaColor3 };
      // alertcondition(plotLongSignal) / (plotShortSignal)
      s.flags[0][i] = plotLong;
      s.flags[1][i] = plotShort;
      if (plotLong) s.times[0].push(time as number);
      if (plotShort) s.times[1].push(time as number);
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendScalperInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<TrendScalperInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Long Alert', message: 'Trend Scalper Long Signal' },
  { id: 'alert1', title: 'Short Alert', message: 'Trend Scalper Short Signal' },
];

export const TrendScalper = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
