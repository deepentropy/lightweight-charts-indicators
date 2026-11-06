/**
 * Trend Trader Strategy
 *
 * Andrew Abraham's trend trader (TASC, September 1998): avgTR = WMA(ATR(1), Length); hiLimit = highest high of
 * Length bars one bar back - avgTR one bar back * Multiplier, loLimit = lowest low one bar back + avgTR one bar back *
 * Multiplier. The line takes hiLimit when the close is above both limits, loLimit when it is below both, else keeps
 * its value (the close on the first bar). pos is 1 when the close is above the line, -1 below, else unchanged; the
 * bars are coloured green (1), red (-1) or blue (0).
 * Alerts (alert() calls, `alertCalls` of the result, once per bar close): "Color changed - Buy" when pos turns 1 and
 * "Color changed - Sell" when it turns -1.
 *
 * Reference: "Trend Trader Strategy" by HPotter
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall, BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { WindowExtreme, createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export interface TrendTraderInputs {
  /** Length */
  length: number;
  /** Multiplier */
  multiplier: number;
}

export const defaultInputs: TrendTraderInputs = {
  length: 21,
  multiplier: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 21, min: 1 },
  { id: 'multiplier', type: 'float', title: 'Multiplier', defval: 3, min: 0.000001 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trend Trader Strategy', color: color.blue, lineWidth: 1 },
];

export const metadata = {
  title: 'Trend Trader Strategy',
  shortTitle: 'Trend Trader Strategy',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[]; alertCalls: AlertCall[] };

interface TrendTraderVars {
  /** avgTR, highestC, lowestC of the bar before */
  avgTR1: number;
  highest1: number;
  lowest1: number;
  /** ret[1] and pos[1] (na on bar 0) */
  ret1: number;
  posPrev: number;
}

interface TrendTraderRun extends BarRunState<TrendTraderVars> {
  atr: ReturnType<typeof taStep.atr>;
  wma: ReturnType<typeof taStep.wma>;
  hi: WindowExtreme;
  lo: WindowExtreme;
  plot0: { time: number; value: number; color: string }[];
  barColors: BarColorData[];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<TrendTraderInputs>): BarStudy<TrendTraderRun, Result> {
  const { length, multiplier } = { ...defaultInputs, ...inputs };
  const red = color.red;
  const green = color.green;
  const blue = color.blue;
  return {
    init() {
      // avgTR = ta.wma(ta.atr(1), Length); highestC = ta.highest(Length) (high); lowestC = ta.lowest(Length) (low)
      const atr = taStep.atr(1);
      const wma = taStep.wma();
      const hi = new WindowExtreme(false, length);
      const lo = new WindowExtreme(true, length);
      const s: TrendTraderRun = {
        atr, wma, hi, lo, plot0: [], barColors: [], alertCalls: [],
        steps: [atr, wma, hi, lo],
        vars: { avgTR1: NaN, highest1: NaN, lowest1: NaN, ret1: NaN, posPrev: NaN },
        lists: [], series: [],
      };
      s.lists = [s.barColors, s.alertCalls];
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const close = b.close;
      const avgTR = s.wma.step(s.atr.step(b.high, b.low, b.close), length);
      const highestC = s.hi.step(b.high);
      const lowestC = s.lo.step(b.low);
      const hiLimit = i > 0 ? v.highest1 - v.avgTR1 * multiplier : NaN;
      const loLimit = i > 0 ? v.lowest1 + v.avgTR1 * multiplier : NaN;
      // ret := close > hiLimit and close > loLimit ? hiLimit : close < loLimit and close < hiLimit ? loLimit : nz(ret[1], close)
      const ret1 = v.ret1;
      const ret = gt(close, hiLimit) && gt(close, loLimit) ? hiLimit
        : lt(close, loLimit) && lt(close, hiLimit) ? loLimit
        : isNaN(ret1) ? close : ret1;
      // pos := close > ret ? 1 : close < ret ? -1 : nz(pos[1], 0)
      const posPrev = v.posPrev;
      const pos = gt(close, ret) ? 1 : lt(close, ret) ? -1 : isNaN(posPrev) ? 0 : posPrev;
      const t = b.time as number;
      // if pos != pos[1] and pos == 1: alert("Color changed - Buy", alert.freq_once_per_bar_close) (pos[1] na on bar 0)
      if (!isNaN(posPrev) && pos !== posPrev && pos === 1) s.alertCalls.push({ time: t, message: 'Color changed - Buy', freq: 'once_per_bar_close' });
      if (!isNaN(posPrev) && pos !== posPrev && pos === -1) s.alertCalls.push({ time: t, message: 'Color changed - Sell', freq: 'once_per_bar_close' });
      // barcolor(pos == -1 ? color.red : pos == 1 ? color.green : color.blue)
      s.barColors.push({ time: t, color: pos === -1 ? red : pos === 1 ? green : blue, id: 'barcolor0' });
      // plot(ret, color = color.new(color.blue, 0), title = 'Trend Trader Strategy')
      s.plot0[i] = { time: b.time, value: ret, color: blue };
      v.avgTR1 = avgTR;
      v.highest1 = highestC;
      v.lowest1 = lowestC;
      v.ret1 = ret;
      v.posPrev = pos;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        barColors: s.barColors.slice(),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<TrendTraderInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TrendTraderInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const TrendTrader = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, hasAlertFunction };
