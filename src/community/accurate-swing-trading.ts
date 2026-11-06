/**
 * Accurate Swing Trading System
 *
 * Swing support/resistance with buy/sell signals, as the original: res = highest(high, swing), sup = lowest(low,
 * swing); the direction is 1 when the close is above res[1], -1 below sup[1] (its last non-zero value is kept);
 * TSL = sup in direction 1, else res (width 3), green when the close is at or above it, else red; the same colour
 * on the bars ('Barcolor') and the background ('Bgcolor', transparency 90). BUY / SELL labels (black text) where
 * the close crosses above / below the TSL.
 *
 * Alerts (alertcondition, `alerts` of the result): 'Buy Signal' / 'Sell Signal', on the bars of these labels.
 *
 * Reference: "Accurate Swing Trading System" (community)
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

// color.green / color.red / color.black of a version 4 script
const GREEN = '#4CAF50';
const RED = '#FF5252';
const BLACK = '#363A45';
const GREEN_90 = String(color.new(GREEN, 90));
const RED_90 = String(color.new(RED, 90));

export interface AccurateSwingTradingInputs {
  swingLength: number;
  showBarColor: boolean;
  showBgColor: boolean;
}

export const defaultInputs: AccurateSwingTradingInputs = {
  swingLength: 3,
  showBarColor: true,
  showBgColor: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'swingLength', type: 'int', title: 'Swing Length', defval: 3, min: 1 },
  { id: 'showBarColor', type: 'bool', title: 'Color Bars', defval: true },
  { id: 'showBgColor', type: 'bool', title: 'Background Color', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TSL', color: '#4CAF50', lineWidth: 3 },
];

export const metadata = {
  title: 'Accurate Swing Trading',
  shortTitle: 'AST',
  overlay: true,
};

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[]; bgColors: BgColorData[] }
  & { alerts: AlertConditionState[] };

interface AstVars {
  /** avn = valuewhen(avd != 0, avd, 0) (na before the first) */
  avn: number;
}

interface AstRun extends BarRunState<AstVars> {
  highest: WindowExtreme;
  lowest: WindowExtreme;
  hh: number[];
  ll: number[];
  tsl: number[];
  plot0: Point[];
  markers: MarkerData[];
  barColors: BarColorData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<AccurateSwingTradingInputs>): BarStudy<AstRun, Result> {
  const { swingLength, showBarColor, showBgColor } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: AstRun = {
        highest: new WindowExtreme(false, swingLength), lowest: new WindowExtreme(true, swingLength),
        hh: [], ll: [], tsl: [], plot0: [], markers: [], barColors: [], bgColors: [], flags: [[], []], times: [[], []],
        steps: [], vars: { avn: NaN }, lists: [], series: [],
      };
      s.steps = [s.highest, s.lowest];
      s.lists = [s.markers, s.barColors, s.bgColors, ...s.times];
      s.series = [s.hh, s.ll, s.tsl, s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      // res = highest(high, no), sup = lowest(low, no): na until the window is full
      const hh = s.highest.step(b.high);
      const ll = s.lowest.step(b.low);
      s.hh[i] = hh;
      s.ll[i] = ll;

      // avd = iff(close > res[1], 1, iff(close < sup[1], -1, 0)), avn = valuewhen(avd != 0, avd, 0) (na before the
      // first), tsl = iff(avn == 1, sup, res)
      const c = b.close;
      const res1 = i > 0 ? s.hh[i - 1] : NaN;
      const sup1 = i > 0 ? s.ll[i - 1] : NaN;
      const avd = gt(c, res1) ? 1 : lt(c, sup1) ? -1 : 0;
      if (avd !== 0) v.avn = avd;
      const tsl = v.avn === 1 ? ll : hh;
      s.tsl[i] = tsl;

      // Buy = crossover(close, tsl), Sell = crossunder(close, tsl)
      const pc = i > 0 ? bars[i - 1].close : NaN;
      const pt = i > 0 ? s.tsl[i - 1] : NaN;
      const buy = c > tsl && pc <= pt;
      const sell = c < tsl && pc >= pt;
      const t = b.time as number;
      s.flags[0][i] = buy;
      s.flags[1][i] = sell;
      if (buy) s.times[0].push(t);
      if (sell) s.times[1].push(t);

      // colr = close >= tsl ? color.green : close <= tsl ? color.red : na
      const colr = Number.isNaN(tsl) ? null : !lt(c, tsl) ? GREEN : RED;

      // plotshape(Buy, "BUY", shape.labelup, location.belowbar, color.green, text = "BUY", textcolor = color.black)
      if (buy) s.markers.push({ id: 'shape0', time: t, position: 'belowBar', shape: 'labelUp', color: GREEN, text: 'BUY', textColor: BLACK });
      // plotshape(Sell, "SELL", shape.labeldown, location.abovebar, color.red, text = "SELL", textcolor = color.black)
      if (sell) s.markers.push({ id: 'shape1', time: t, position: 'aboveBar', shape: 'labelDown', color: RED, text: 'SELL', textColor: BLACK });
      if (colr !== null) {
        // barcolor(Barcolor ? colr : na); bgcolor(Bgcolor ? colr : na) (default transparency 90)
        if (showBarColor) s.barColors.push({ id: 'barcolor0', time: t, color: colr });
        if (showBgColor) s.bgColors.push({ id: 'bgcolor0', time: t, color: colr === GREEN ? GREEN_90 : RED_90 });
      }

      // plot(tsl, color = colr, linewidth = 3, title = "TSL")
      s.plot0[i] = { time: b.time, value: tsl, color: colr ?? 'transparent' };
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AccurateSwingTradingInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AccurateSwingTradingInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Buy Signal', message: 'Buy' },
  { id: 'alert1', title: 'Sell Signal', message: 'Sell' },
];

export const AccurateSwingTrading = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
