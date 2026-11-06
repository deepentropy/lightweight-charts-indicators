/**
 * Super trend V
 *
 * A volume-weighted price: spreadvol = (close - open) * 100 * volume / ((high - low) * 100), v = spreadvol + its
 * running sum; the distance of v from its 14-bar SMA, divided by its 28-bar standard deviation and multiplied by the
 * 28-bar standard deviation of the range, is added to the high (when positive) or the low. Its EMA and the EMA of the
 * open (length 7 on daily and higher bars, tf / chart multiplier * 7 on intraday bars) are plotted with a cloud
 * (lime while the first is above the second, orange otherwise). A SuperTrend on the volume-weighted EMA (ATR bands)
 * is plotted one bar late as crosses; Buy / Sell labels mark crosses of the close over / under the SuperTrend line on
 * the side of the open EMA. TP labels mark crosses of the close over the lower / under the upper band of a 150-bar
 * linear regression end value +/- 2 standard deviations.
 * Alerts (alertcondition, `alerts` of the result): buy, sell, sell tp, buy tp.
 *
 * Reference: "Super trend V" by RafaelZioni
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  taStep, color, timeframe,
  type Bar, type FillConfig, type FillData, type IndicatorResult, type InputConfig, type PlotConfig, type ShapeConfig,
} from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { chartTimeframe } from '../anchor-period';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import { createBarRun, fullResult, liveAlertStates, WindowSma, WindowStdev, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SuperTrendVInputs {
  /** tf: minutes of the EMA window on intraday bars (length = tf / chart multiplier * 7) */
  tf: number;
  /** SuperTrend Multiplier */
  stMult: number;
  /** SuperTrend Period (ATR length) */
  stPeriod: number;
  /** TP: standard deviation multiplier of the regression bands */
  multiplier: number;
  /** TP length: regression / standard deviation length */
  len5: number;
}

export const defaultInputs: SuperTrendVInputs = {
  tf: 720,
  stMult: 1,
  stPeriod: 10,
  multiplier: 2,
  len5: 150,
};

export const inputConfig: InputConfig[] = [
  { id: 'tf', type: 'int', title: 'tf', defval: 720 },
  { id: 'stMult', type: 'float', title: 'SuperTrend Multiplier', defval: 1, min: 0, max: 100, step: 0.01 },
  { id: 'stPeriod', type: 'int', title: 'SuperTrend Period', defval: 10, min: 1 },
  { id: 'multiplier', type: 'float', title: 'TP', defval: 2, min: 1 },
  { id: 'len5', type: 'int', title: 'TP length', defval: 150, min: 1 },
];

/** Pine v4 colours */
const RED = '#FF5252';
const BLUE = '#2196F3';
const LIME = '#00E676';
const ORANGE = '#FF9800';
const GREEN = '#4CAF50';
const WHITE = '#FFFFFF';
const C_LIME_60 = String(color.new(LIME, 60));
const C_ORANGE_60 = String(color.new(ORANGE, 60));
const C_LIME_80 = String(color.new(LIME, 80));
const C_ORANGE_80 = String(color.new(ORANGE, 80));
const F_LIME = String(color.new(LIME, 70));
const F_ORANGE = String(color.new(ORANGE, 70));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Weighted EMA', color: RED, lineWidth: 1 },
  { id: 'plot1', title: 'Open EMA', color: BLUE, lineWidth: 1 },
  { id: 'plot2', title: 'Weighted EMA Cloud', color: C_LIME_60, lineWidth: 1 },
  { id: 'plot3', title: 'Open EMA Cloud', color: C_LIME_80, lineWidth: 2 },
  { id: 'plot4', title: 'SuperTrend', color: GREEN, lineWidth: 2, style: 'cross' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot2', plot2: 'plot3', title: 'Plots Background', palette: [F_LIME, F_ORANGE] },
];

export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'buy', style: 'labelup', location: 'belowbar', color: GREEN, text: 'Buy', textcolor: WHITE, size: 'small' },
  { id: 'shape1', kind: 'shape', title: 'sell', style: 'labeldown', location: 'abovebar', color: RED, text: 'Sell', textcolor: WHITE, size: 'small' },
  { id: 'shape2', kind: 'shape', title: 'low', style: 'labelup', location: 'belowbar', color: RED, text: 'TP', textcolor: WHITE, size: 'small' },
  { id: 'shape3', kind: 'shape', title: 'high', style: 'labeldown', location: 'abovebar', color: GREEN, text: 'TP', textcolor: WHITE, size: 'small' },
];

/** The original's alertconditions (title only: the default message) */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'buy', message: 'Alert Fired!' },
  { id: 'alert1', title: 'sell', message: 'Alert Fired!' },
  { id: 'alert2', title: 'sell tp', message: 'Alert Fired!' },
  { id: 'alert3', title: 'buy tp', message: 'Alert Fired!' },
];

export const metadata = {
  title: 'Super trend V',
  shortTitle: 'Super trend V',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;
const lt = (a: number, b: number) => b - a > 1e-10;
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; alerts: AlertConditionState[] };

interface StvVars {
  /** upTrend / downTrend / trend of the previous bar */
  up1: number;
  dn1: number;
  trend: number;
}

interface StvRun extends BarRunState<StvVars> {
  cum: ReturnType<typeof taStep.cum>;
  priceSpread: WindowStdev;
  smooth: WindowSma;
  vSpread: WindowStdev;
  c: ReturnType<typeof taStep.ema>;
  o: ReturnType<typeof taStep.ema>;
  atr: ReturnType<typeof taStep.atr>;
  crossUp: ReturnType<typeof taStep.crossover>;
  crossDn: ReturnType<typeof taStep.crossunder>;
  sdev: WindowStdev;
  low1: ReturnType<typeof taStep.crossover>;
  high1: ReturnType<typeof taStep.crossunder>;
  stLine: number[];
  plots: Point[][];
  fillColors: string[];
  flags: boolean[][];
  times: number[][];
  markers: MarkerData[];
}

function study(inputs: Partial<SuperTrendVInputs>): BarStudy<StvRun, Result> {
  const { tf, stMult, stPeriod, multiplier, len5 } = { ...defaultInputs, ...inputs };
  return {
    // the EMA length follows the chart timeframe (from the bar gaps without a chart timeframe)
    key: (bars, chart) => chartTimeframe(bars, chart),
    init(bars, chart) {
      // len = isintraday and multiplier >= 1 ? tf / multiplier * 7 : ... : 7
      const tfInfo = timeframe.info(chartTimeframe(bars, chart) || '1D');
      const len = tfInfo.isintraday && tfInfo.multiplier >= 1 ? Math.trunc(tf / tfInfo.multiplier * 7) : 7;
      const s: StvRun = {
        cum: taStep.cum(), priceSpread: new WindowStdev(28), smooth: new WindowSma(14), vSpread: new WindowStdev(28),
        c: taStep.ema(len), o: taStep.ema(len), atr: taStep.atr(stPeriod), crossUp: taStep.crossover(),
        crossDn: taStep.crossunder(), sdev: new WindowStdev(len5), low1: taStep.crossover(), high1: taStep.crossunder(),
        stLine: [], plots: [[], [], [], [], []], fillColors: [], flags: [[], [], [], []], times: [[], [], [], []], markers: [],
        steps: [], vars: { up1: NaN, dn1: NaN, trend: 1 }, lists: [], series: [],
      };
      s.steps = [s.cum, s.priceSpread, s.smooth, s.vSpread, s.c, s.o, s.atr, s.crossUp, s.crossDn, s.sdev, s.low1, s.high1];
      s.lists = [...s.times, s.markers];
      s.series = [s.stLine, ...s.plots, s.fillColors, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const vs = s.vars;
      // Volume-weighted price
      const spreadvol = (b.close - b.open) * 100 * ((b.volume ?? NaN) / ((b.high - b.low) * 100));
      const v = spreadvol + s.cum.step(spreadvol);
      const priceSpread = s.priceSpread.step(b.high - b.low);
      const dv = v - s.smooth.step(v);
      const vSpread = s.vSpread.step(dv);
      const shadow = dv / vSpread * priceSpread;
      const out = gt(shadow, 0) ? b.high + shadow : b.low + shadow;
      const c = s.c.step(out);
      const o = s.o.step(b.open);

      // SuperTrend on vpt = ema(out, len) = c
      const atr = s.atr.step(b.high, b.low, b.close);
      const upLev = c - stMult * atr;
      const dnLev = c + stMult * atr;
      const close1 = i > 0 ? bars[i - 1].close : NaN;
      const up1 = i > 0 ? vs.up1 : NaN;
      const dn1 = i > 0 ? vs.dn1 : NaN;
      const upTrend = gt(close1, up1) ? Math.max(upLev, up1) : upLev;
      const downTrend = lt(close1, dn1) ? Math.min(dnLev, dn1) : dnLev;
      const close = b.close;
      const trend = gt(close, dn1) ? 1 : lt(close, up1) ? -1 : (i > 0 ? vs.trend : 1);
      const stLine = trend === 1 ? upTrend : downTrend;
      vs.up1 = upTrend;
      vs.dn1 = downTrend;
      vs.trend = trend;
      s.stLine[i] = stLine;
      const crossUp = s.crossUp.step(close, stLine);
      const crossDn = s.crossDn.step(close, stLine);

      // calcSlope(close, len5): least squares over the last len5 closes, x = 2 .. len5 + 1
      let sumX = 0, sumY = 0, sumXSqr = 0, sumXY = 0;
      for (let k = 1; k <= len5; k++) {
        const j = i - (len5 - k);
        const val = j >= 0 ? bars[j].close : NaN;
        const per = k + 1.0;
        sumX = sumX + per;
        sumY = sumY + val;
        sumXSqr = sumXSqr + per * per;
        sumXY = sumXY + val * per;
      }
      const slope = (len5 * sumXY - sumX * sumY) / (len5 * sumXSqr - sumX * sumX);
      const average = sumY / len5;
      const intercept = average - slope * sumX / len5 + slope;
      const vwap1 = fin(intercept + slope * (len5 - 0));
      const sdev = s.sdev.step(close);
      const z1 = vwap1 + multiplier * sdev;
      const x1 = vwap1 - multiplier * sdev;
      const low1 = s.low1.step(close, x1);
      const high1 = s.high1.step(close, z1);

      const up = gt(c, o);
      const p = s.plots;
      p[0][i] = { time, value: fin(c) };
      p[1][i] = { time, value: fin(o) };
      p[2][i] = { time, value: fin(c), color: up ? C_LIME_60 : C_ORANGE_60 };
      p[3][i] = { time, value: fin(o), color: up ? C_LIME_80 : C_ORANGE_80 };
      s.fillColors[i] = up ? F_LIME : F_ORANGE;
      // plot(st_line[1], color = trend == 1 ? green : red)
      p[4][i] = { time, value: i > 0 ? fin(s.stLine[i - 1]) : NaN, color: trend === 1 ? GREEN : RED };

      const buy = !!crossUp && gt(close, o);
      const sell = !!crossDn && lt(close, o);
      const tpLow = !!low1;
      const tpHigh = !!high1;
      const f = s.flags;
      f[0][i] = buy;
      f[1][i] = sell;
      f[2][i] = tpLow;
      f[3][i] = tpHigh;
      for (let k = 0; k < 4; k++) if (f[k][i]) s.times[k].push(time as number);
      if (buy) s.markers.push({ id: 'shape0', time, position: 'belowBar', shape: 'labelUp', color: GREEN, text: 'Buy', textColor: WHITE, size: 'small' });
      if (sell) s.markers.push({ id: 'shape1', time, position: 'aboveBar', shape: 'labelDown', color: RED, text: 'Sell', textColor: WHITE, size: 'small' });
      if (tpLow) s.markers.push({ id: 'shape2', time, position: 'belowBar', shape: 'labelUp', color: RED, text: 'TP', textColor: WHITE, size: 'small' });
      if (tpHigh) s.markers.push({ id: 'shape3', time, position: 'aboveBar', shape: 'labelDown', color: GREEN, text: 'TP', textColor: WHITE, size: 'small' });
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      const fills: FillData[] = [
        { id: 'fill0', plot1: 'plot2', plot2: 'plot3', options: { title: 'Plots Background' }, colors: s.fillColors.slice() },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice() },
        fills,
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SuperTrendVInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SuperTrendVInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const SuperTrendV = {
  calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, fillConfig, shapeConfig, alertConditions,
};
