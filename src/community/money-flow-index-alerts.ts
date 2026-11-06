/**
 * Money Flow Index + Alerts
 *
 * Money Flow Index from simple averages: the money flow of a bar is its typical price (hlc3) times its volume; it is
 * positive when the typical price rises and negative when it falls. Index = 100 - 100 / (1 + sma(positive flow,
 * length) / sma(negative flow, length)). A circle marks the bar where the index crosses below the oversold level
 * (green) or above the overbought level (red). Bands at 80 / 60 / 40 / 20 with three zones: uptrend (60 to 80),
 * transition (40 to 60) and downtrend (20 to 40).
 *
 * Other timeframe ("Use Current Chart Resolution?" off): the bars of that timeframe are built from the chart bars, so
 * its averages start at the first chart bar. A chart bar shows the value of the latest completed bar of the
 * timeframe. A timeframe below the chart timeframe needs data that the bars do not carry: the port throws an Error.
 *
 * Periods and the chart context (optional third argument of calculate): with the exchange time zone and the session
 * of the symbol (`timezone`, `session`) the periods are those of the exchange calendar, see src/anchor-period.ts;
 * without them the port uses the UTC calendar and the bars. `timeframe`, when given, is the chart timeframe; without
 * it the chart timeframe is read from the bar spacing.
 *
 * Reference: "Money Flow Index + Alerts" by DreamsDefined
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, Series, color, timeframe,
  type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar,
} from 'oakscriptjs';
import { chartTimeframe, higherTimeframeBars } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MoneyFlowIndexAlertsInputs {
  length: number;
  /** Oversold level */
  os: number;
  /** Overbought level */
  ob: number;
  /** Use the chart timeframe (the timeframe input is ignored) */
  currentRes: boolean;
  /** Timeframe used when `currentRes` is false ("240", "D", "W", ...) */
  customRes: string;
}

export const defaultInputs: MoneyFlowIndexAlertsInputs = {
  length: 14,
  os: 20,
  ob: 80,
  currentRes: true,
  customRes: '240',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14 },
  { id: 'os', type: 'int', title: 'Oversold', defval: 20 },
  { id: 'ob', type: 'int', title: 'Overbought', defval: 80 },
  { id: 'currentRes', type: 'bool', title: 'Use Current Chart Resolution?', defval: true },
  { id: 'customRes', type: 'string', title: 'Custom Timeframe? Uncheck Box Above (E.g. 1M, 5D, 240 = 4Hours)', defval: '240' },
];

// Colour constants of this version of the language, with its default plot transparency (35)
const PLOT = (hex: string) => String(color.new(hex, 35));
const BLACK = PLOT('#000000');
const GREEN = PLOT('#008000');
const RED = PLOT('#FF0000');
// Default fill transparency (90)
const FILL = (hex: string) => String(color.new(hex, 90));
const HLINE = '#787B86';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: BLACK, lineWidth: 2 },
  { id: 'plot1', title: 'Oversold/Overbought Cross', color: RED, lineWidth: 6, style: 'circles' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_0', price: 80, title: 'Overbought', color: HLINE, linestyle: 'dashed' },
  { id: 'hline_1', price: 20, title: 'Oversold', color: HLINE, linestyle: 'dashed' },
  { id: 'hline_2', price: 40, title: 'Bears', color: HLINE, linestyle: 'dashed' },
  { id: 'hline_3', price: 60, title: 'Bulls', color: HLINE, linestyle: 'dashed' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_0', plot1: 'hline_3', plot2: 'hline_0', color: FILL('#008000'), title: 'Uptrend' },
  { id: 'fill_1', plot1: 'hline_2', plot2: 'hline_1', color: FILL('#FF0000'), title: 'Downtrend' },
  { id: 'fill_2', plot1: 'hline_2', plot2: 'hline_3', color: FILL('#808080'), title: 'Transition Zone' },
];

export const metadata = {
  title: 'Money Flow Index MTF + Alerts',
  shortTitle: 'Money Flow Index MTF + Alerts',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

interface TimeframeBars {
  /** Bars of the timeframe built from the chart bars (the chart bars themselves for the chart timeframe) */
  htf: Bar[];
  /** For each chart bar, the index of the latest completed bar of the timeframe (-1: none yet) */
  latest: number[];
}

/**
 * security(tickerid, tf, ...) without lookahead: the bars of timeframe `tf` built from the chart bars, and for each
 * chart bar the index of the latest completed bar of that timeframe.
 */
function timeframeBars(bars: Bar[], tf: string, context?: ChartContext): TimeframeBars {
  const chart = chartTimeframe(bars, context);
  if (tf.trim() === '' || chart === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chart)) {
    return { htf: bars, latest: bars.map((_b, i) => i) };
  }
  if (timeframe.in_seconds(tf) < timeframe.in_seconds(chart)) {
    throw new Error(`Money Flow Index + Alerts: the timeframe "${tf}" is lower than the chart timeframe "${chart}": the chart bars do not have that data`);
  }
  // The periods and the bars that complete them: the exchange calendar of the chart context (time zone and
  // session), else the UTC calendar rule; grouped and completed by the library (see anchor-period.ts)
  return higherTimeframeBars(bars, tf, context);
}

type Point = { time: number; value: number };
type CrossPoint = { time: number; value: number; color: string };

interface MfiRun extends BarRunState<Record<string, never>> {
  /** Another timeframe: the index of each chart bar, calculated on the whole bar set (null: chart timeframe) */
  pre: number[] | null;
  pos: WindowSma | null;
  neg: WindowSma | null;
  hlc3: number[];
  mfi: number[];
  plot0: Point[];
  plot1: CrossPoint[];
}

/** The index of every chart bar on another timeframe (the bars of that timeframe built from the chart bars) */
function otherTimeframeIndex(bars: Bar[], cfg: MoneyFlowIndexAlertsInputs, chart?: ChartContext): number[] {
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const { htf, latest } = timeframeBars(bars, cfg.customRes, chart);
  const hlc3 = htf.map((b) => (b.high + b.low + b.close) / 3);
  // rawMoneyFlow = hlc3 * volume, kept on bars where hlc3 rises (positive) or falls (negative), else 0
  const positive = hlc3.map((v, i) => (i > 0 && gt(v, hlc3[i - 1]) ? v * (htf[i].volume ?? NaN) : 0));
  const negative = hlc3.map((v, i) => (i > 0 && lt(v, hlc3[i - 1]) ? v * (htf[i].volume ?? NaN) : 0));
  const posAvg = A(ta.sma(Series.fromArray(htf, positive), cfg.length));
  const negAvg = A(ta.sma(Series.fromArray(htf, negative), cfg.length));
  // a non-zero value / 0 is infinite (index 100), 0 / 0 is na
  const index = posAvg.map((p, i) => 100 - 100 / (1 + p / negAvg[i]));
  return latest.map((g) => (g >= 0 ? index[g] : NaN));
}

function study(inputs: Partial<MoneyFlowIndexAlertsInputs>): BarStudy<MfiRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  /** Another timeframe than the chart's on the bars of the last update (set by key) */
  let other = false;
  return {
    key(bars, chart) {
      if (cfg.currentRes) {
        other = false;
        return '';
      }
      const tf = cfg.customRes;
      const chartTf = chartTimeframe(bars, chart);
      other = !(tf.trim() === '' || chartTf === '' || timeframe.in_seconds(tf) === timeframe.in_seconds(chartTf));
      return chartTf;
    },
    fullRunReason: () => (other ? 'another timeframe, calculated on the whole bar set' : null),
    init(bars, chart) {
      // res = CurrentRes ? period : CustomRes
      const pre = other ? otherTimeframeIndex(bars, cfg, chart) : null;
      const pos = pre ? null : new WindowSma(cfg.length);
      const neg = pre ? null : new WindowSma(cfg.length);
      const s: MfiRun = {
        pre, pos, neg, hlc3: [], mfi: [], plot0: [], plot1: [],
        steps: pos && neg ? [pos, neg] : [], vars: {}, lists: [], series: [],
      };
      s.series = [s.hlc3, s.mfi, s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      let m: number;
      if (s.pre) {
        m = s.pre[i];
      } else {
        const v = (b.high + b.low + b.close) / 3;
        s.hlc3[i] = v;
        const p = i > 0 ? s.hlc3[i - 1] : NaN;
        // rawMoneyFlow = hlc3 * volume, kept on bars where hlc3 rises (positive) or falls (negative), else 0
        const positive = i > 0 && gt(v, p) ? v * (b.volume ?? NaN) : 0;
        const negative = i > 0 && lt(v, p) ? v * (b.volume ?? NaN) : 0;
        const posAvg = s.pos!.step(positive);
        const negAvg = s.neg!.step(negative);
        // a non-zero value / 0 is infinite (index 100), 0 / 0 is na
        m = 100 - 100 / (1 + posAvg / negAvg);
      }
      s.mfi[i] = m;
      const v = Number.isFinite(m) ? m : NaN;
      const prev = i > 0 && Number.isFinite(s.mfi[i - 1]) ? s.mfi[i - 1] : NaN;
      // oversold = moneyFlowIndex[1] > os[1] and moneyFlowIndex < os
      const oversold = gt(prev, cfg.os) && lt(v, cfg.os);
      const overbought = lt(prev, cfg.ob) && gt(v, cfg.ob);
      s.plot0[i] = { time: b.time, value: v };
      s.plot1[i] = { time: b.time, value: oversold || overbought ? v : NaN, color: oversold ? GREEN : RED };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        hlines: [
          { value: 80, options: { title: 'Overbought', color: HLINE, linestyle: 'dashed' } },
          { value: 20, options: { title: 'Oversold', color: HLINE, linestyle: 'dashed' } },
          { value: 40, options: { title: 'Bears', color: HLINE, linestyle: 'dashed' } },
          { value: 60, options: { title: 'Bulls', color: HLINE, linestyle: 'dashed' } },
        ],
        fills: [
          { plot1: 'hline_3', plot2: 'hline_0', options: { title: 'Uptrend', color: FILL('#008000') } },
          { plot1: 'hline_2', plot2: 'hline_1', options: { title: 'Downtrend', color: FILL('#FF0000') } },
          { plot1: 'hline_2', plot2: 'hline_3', options: { title: 'Transition Zone', color: FILL('#808080') } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MoneyFlowIndexAlertsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MoneyFlowIndexAlertsInputs> = {}, chart?: ChartContext): IndicatorResult {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const MoneyFlowIndexAlerts = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig };
