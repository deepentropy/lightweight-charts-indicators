/**
 * ICT FVG Buy/Sell Signals
 *
 * The dealing range is the last pivot high and pivot low (swing length `lenSwing`); its midpoint (CE) splits premium
 * (close above) from discount (close below), shown by the background. A bullish fair value gap is a bar whose low is
 * above the high of two bars before; a bearish gap a bar whose high is below the low of two bars before. The midpoint
 * (CE) of the last gap of each side is drawn as circles. BUY: the bar trades into the last bullish gap, is in discount
 * (with the filter), is a bullish displacement bar (body >= ATR * multiple) and closes above the gap CE. SELL mirrors it.
 * Alerts (alertcondition, `alerts` of the result): 'ICT Buy' and 'ICT Sell', true on the bars of each signal.
 *
 * Reference: "ICT FVG Buy/Sell Signals" by svmstellarvisionmedia
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © svmstellarvisionmedia
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface IctFvgBuySellSignalsInputs {
  /** Swing length of the dealing range pivots */
  lenSwing: number;
  /** Only buy in discount / sell in premium */
  usePDFilter: boolean;
  /** Minimum body size as ATR multiple (displacement) */
  displATR: number;
  /** ATR length */
  atrLen: number;
}

export const defaultInputs: IctFvgBuySellSignalsInputs = {
  lenSwing: 5,
  usePDFilter: true,
  displATR: 0.6,
  atrLen: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'lenSwing', type: 'int', title: 'Swing length (dealing range pivots)', defval: 5, min: 2 },
  { id: 'usePDFilter', type: 'bool', title: 'Only Buy in Discount / Sell in Premium', defval: true },
  { id: 'displATR', type: 'float', title: 'Min body size as ATR multiple (displacement)', defval: 0.6, min: 0.0, step: 0.1 },
  { id: 'atrLen', type: 'int', title: 'ATR length', defval: 14 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Dealing Range CE', color: color.yellow, lineWidth: 2, style: 'stepline' },
  { id: 'plot1', title: 'Bullish FVG CE', color: color.teal, lineWidth: 1, style: 'circles' },
  { id: 'plot2', title: 'Bearish FVG CE', color: color.red, lineWidth: 1, style: 'circles' },
];

export const metadata = {
  title: 'ICT FVG Buy/Sell Signals',
  shortTitle: 'ICT FVG Buy/Sell Signals',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'ICT Buy', message: 'ICT Buy Signal' },
  { id: 'alert1', title: 'ICT Sell', message: 'ICT Sell Signal' },
];

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface IctVars {
  drHigh: number;
  drLow: number;
  lastBullTop: number;
  lastBullBottom: number;
  lastBullCE: number;
  lastBearTop: number;
  lastBearBottom: number;
  lastBearCE: number;
}

interface IctRun extends BarRunState<IctVars> {
  atr: ReturnType<typeof taStep.atr>;
  ph: PivotStep;
  pl: PivotStep;
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  bgColors: BgColorData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<IctFvgBuySellSignalsInputs>): BarStudy<IctRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const premiumBg = String(color.new(color.red, 92));
  const discountBg = String(color.new(color.teal, 92));
  return {
    init() {
      const s: IctRun = {
        atr: taStep.atr(cfg.atrLen), ph: new PivotStep(cfg.lenSwing, cfg.lenSwing, true),
        pl: new PivotStep(cfg.lenSwing, cfg.lenSwing, false), plot0: [], plot1: [], plot2: [], bgColors: [], markers: [],
        flags: [[], []], times: [[], []], steps: [],
        vars: {
          drHigh: NaN, // var float drHigh = na
          drLow: NaN, // var float drLow = na
          // ta.valuewhen(cond, x, 0): x on the last bar where cond was true
          lastBullTop: NaN, lastBullBottom: NaN, lastBullCE: NaN, lastBearTop: NaN, lastBearBottom: NaN, lastBearCE: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [s.atr, s.ph, s.pl];
      s.lists = [s.bgColors, s.markers, ...s.times];
      s.series = [s.plot0, s.plot1, s.plot2, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const atr = s.atr.step(b.high, b.low, b.close);
      const ph = s.ph.step(i, b.high);
      const pl = s.pl.step(i, b.low);
      const body = Math.abs(b.close - b.open);
      // body / atr: atr is 0 only when every true range is 0, then body is 0 too and Pine 0 / 0 is NaN
      const ratio = atr === 0 ? NaN : body / atr;
      const isBullDisp = ge(ratio, cfg.displATR) && gt(b.close, b.open);
      const isBearDisp = ge(ratio, cfg.displATR) && lt(b.close, b.open);

      if (!isNaN(ph)) v.drHigh = ph;
      if (!isNaN(pl)) v.drLow = pl;
      const rangeReady = !isNaN(v.drHigh) && !isNaN(v.drLow);
      const eq = rangeReady ? (v.drHigh + v.drLow) / 2.0 : NaN;
      const inPremium = rangeReady && gt(b.close, eq);
      const inDiscount = rangeReady && lt(b.close, eq);
      if (rangeReady) s.bgColors.push({ time: b.time, color: inPremium ? premiumBg : discountBg });

      // 3-bar fair value gaps
      const high2 = i >= 2 ? bars[i - 2].high : NaN;
      const low2 = i >= 2 ? bars[i - 2].low : NaN;
      const bullFVG = gt(b.low, high2);
      const bearFVG = lt(b.high, low2);
      if (bullFVG) {
        v.lastBullTop = b.low;
        v.lastBullBottom = high2;
        v.lastBullCE = (v.lastBullTop + v.lastBullBottom) / 2.0;
      }
      if (bearFVG) {
        v.lastBearTop = low2;
        v.lastBearBottom = b.high;
        v.lastBearCE = (v.lastBearTop + v.lastBearBottom) / 2.0;
      }
      s.plot0[i] = { time: b.time as number, value: eq, color: color.yellow };
      s.plot1[i] = { time: b.time as number, value: v.lastBullCE, color: color.teal };
      s.plot2[i] = { time: b.time as number, value: v.lastBearCE, color: color.red };

      const inBullZone = !isNaN(v.lastBullTop) && !isNaN(v.lastBullBottom) && le(b.low, v.lastBullTop) && ge(b.high, v.lastBullBottom);
      const inBearZone = !isNaN(v.lastBearTop) && !isNaN(v.lastBearBottom) && ge(b.high, v.lastBearBottom) && le(b.low, v.lastBearTop);
      const longOkPD = !cfg.usePDFilter || inDiscount;
      const shortOkPD = !cfg.usePDFilter || inPremium;
      // close > nz(lastBullCE, close)
      const longSignal = inBullZone && longOkPD && isBullDisp && gt(b.close, isNaN(v.lastBullCE) ? b.close : v.lastBullCE);
      const shortSignal = inBearZone && shortOkPD && isBearDisp && lt(b.close, isNaN(v.lastBearCE) ? b.close : v.lastBearCE);
      // alertcondition(longSignal, "ICT Buy") / alertcondition(shortSignal, "ICT Sell")
      s.flags[0][i] = longSignal;
      s.flags[1][i] = shortSignal;
      if (longSignal) s.times[0].push(b.time as number);
      if (shortSignal) s.times[1].push(b.time as number);
      if (longSignal) {
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.green, text: 'BUY',
          textColor: color.white, size: 'small' });
      }
      if (shortSignal) {
        s.markers.push({ time: b.time, position: 'aboveBar', shape: 'labelDown', color: color.red, text: 'SELL',
          textColor: color.white, size: 'small' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<IctFvgBuySellSignalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<IctFvgBuySellSignalsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const IctFvgBuySellSignals = {
  calculate,
  createRun,

  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
