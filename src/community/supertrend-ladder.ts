/**
 * Supertrend - Ladder ATR - 1909Capital [Trendoscope®]
 *
 * A supertrend with two ATRs: the true range of each bullish bar (open < close) goes into a positive list and the true
 * range of the other bars into a negative list (the last `length` values of each); a moving average (sma / ema / rma /
 * wma / hma of the arrayutils library rules) of each list gives the positive and negative ATR. The buy stop is the low
 * minus Multiplier x negative ATR, the sell stop the high plus Multiplier x positive ATR; the stop distance of the
 * running side only shrinks. The direction turns down when the previous low (close with "Wait For Close") is below
 * the previous buy stop and up when the previous high (close) is above the previous sell stop; "Delayed/Sticky" keeps
 * the stop of the new side until the previous target is reached. The stop of the current side is drawn, teal when
 * up and fuchsia when down; the direction is a data-window value.
 * Alerts (alertcondition, `alerts` of the result): 'Supertrend Bullish Alert' / 'Supertrend Bearish Alert' on a
 * direction change up / down; alert() calls (`alertCalls`, once per bar close): "Supertrend Bullish" /
 * "Supertrend Bearish" on the same bars.
 *
 * Library rules (arrayutils v10, a Pine v5 library): its wma weights the list from the oldest value (index 0) with
 * the largest weight; its ema / rma start from the close of the first bar the list is full and read the oldest
 * value of the list; int / int is an integer division (hma half length, ema factor 2 / (length + 1)).
 *
 * Reference: "Supertrend - Ladder ATR - 1909Capital [Trendoscope®]" by Trendoscope
 * Licence: Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0), as the
 * original Pine script (https://creativecommons.org/licenses/by-nc-sa/4.0/). Original notice: © Trendoscope Pty Ltd
 */

import { taStep, array, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { AlertCall } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original makes alert() calls */
export const hasAlertFunction = true;

export type LadderMaType = 'sma' | 'ema' | 'rma' | 'wma' | 'hma';

export interface SupertrendLadderInputs {
  /** Moving Average type */
  matype: LadderMaType;
  /** Moving Average length (number of true ranges kept in each list) */
  malength: number;
  /** ATR Multiplier */
  multiplier: number;
  /** Wait For Close */
  waitForClose: boolean;
  /** Delayed/Sticky */
  delayed: boolean;
}

export const defaultInputs: SupertrendLadderInputs = {
  matype: 'hma',
  malength: 7,
  multiplier: 4,
  waitForClose: false,
  delayed: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'matype', type: 'string', title: 'Moving Average  ', defval: 'hma', options: ['sma', 'ema', 'rma', 'wma', 'hma'],
    group: 'Supertrend', inline: 'ma' },
  { id: 'malength', type: 'int', title: '', defval: 7, group: 'Supertrend', inline: 'ma' },
  { id: 'multiplier', type: 'int', title: 'ATR Multiplier', defval: 4, step: 1, group: 'Supertrend' },
  { id: 'waitForClose', type: 'bool', title: 'Wait For Close', defval: false, group: 'Supertrend' },
  { id: 'delayed', type: 'bool', title: 'Delayed/Sticky', defval: false, group: 'Supertrend' },
];

const UP_COLOR = color.rgb(83, 195, 189);
const DOWN_COLOR = color.fuchsia;

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Supertrend Stop', color: color.blue, lineWidth: 1 },
  // plot(dir, 'Direction', display = display.data_window)
  { id: 'plot1', title: 'Direction', color: color.blue, lineWidth: 1, display: 'data_window' },
];

export const metadata = {
  title: 'Supertrend - Ladder ATR - 1909Capital [Trendoscope®]',
  shortTitle: 'SLA [Trendoscope®]',
  overlay: true,
};

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Supertrend Bullish Alert', message: 'Alert Fired!' },
  { id: 'alert1', title: 'Supertrend Bearish Alert', message: 'Alert Fired!' },
];

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const nz = (v: number, d = 0) => (isNaN(v) ? d : v);
/** math.min / math.max: na when an argument is na */
const min = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.min(a, b));
const max = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
/** Pine v5 int / int (the library is v5): integer division */
const idiv = (a: number, b: number) => (b === 0 ? NaN : Math.trunc(a / b));

/** arrayutils push(arr, val, maxItems): push, then remove the first element when the size exceeds maxItems */
function pushMax(arr: number[], val: number, maxItems: number): void {
  arr.push(val);
  if (arr.length > maxItems) arr.splice(0, 1);
}

/** arrayutils wma(source, length): sum of source[i] * (length - i) for i = 0 .. length - 1, over length * (length + 1) / 2 */
function libWma(source: number[], length: number): number {
  if (length <= 0) return NaN; // lenSum = 0: division by zero
  let masum = 0.0;
  for (let i = 0; i <= length - 1; i++) masum = masum + (source[i] ?? NaN) * (length - i);
  const lenSum = idiv(length * (length + 1), 2);
  return masum / lenSum;
}

/** One pa.ma(source, matype, length) call site, with the state of its var variables */
class LibMa {
  /** var float ma = ta.tr (na on the first bar) */
  private ma = NaN;
  /** var ma = close of ema() / rma(): set on the first call */
  private emaMa: number | null = null;
  private rmaMa: number | null = null;
  /** var hmaRange of hma() */
  private hmaRange: number[] = [];

  constructor(private readonly matype: LadderMaType, private readonly length: number) {}

  /** A copy of the call site state (live runs) */
  clone(): LibMa {
    const c = new LibMa(this.matype, this.length);
    c.ma = this.ma;
    c.emaMa = this.emaMa;
    c.rmaMa = this.rmaMa;
    c.hmaRange = this.hmaRange.slice();
    return c;
  }

  next(source: number[], close: number): number {
    const length = this.length;
    if (source.length === length) {
      if (this.matype === 'sma') this.ma = array.avg(source) as number;
      if (this.matype === 'ema') {
        if (this.emaMa === null) this.emaMa = close;
        const last = nz(source[0]);
        const k = idiv(2, length + 1);
        this.emaMa = last * k + (1 - k) * this.emaMa;
        this.ma = this.emaMa;
      }
      if (this.matype === 'rma') {
        if (this.rmaMa === null) this.rmaMa = close;
        const last = nz(source[0]);
        this.rmaMa = (this.rmaMa * (length - 1) + last) / length;
        this.ma = this.rmaMa;
      }
      if (this.matype === 'wma') this.ma = libWma(source, length);
      if (this.matype === 'hma') {
        const wma1 = libWma(source, idiv(length, 2));
        const wma2 = libWma(source, length);
        pushMax(this.hmaRange, 2 * wma1 - wma2, length);
        let hma = NaN;
        if (this.hmaRange.length === length) hma = libWma(this.hmaRange, Math.round(Math.sqrt(length)));
        this.ma = hma;
      }
    }
    return this.ma;
  }
}

type Result = IndicatorResult & { alerts: AlertConditionState[]; alertCalls: AlertCall[] };

interface LadderVars {
  positiveTrArray: number[];
  negativeTrArray: number[];
  posMa: LibMa;
  negMa: LibMa;
  // supertrend_atr state
  dir: number;
  buyStop: number;
  sellStop: number;
  buyStopDiffPrev: number;
  sellStopDiffPrev: number;
  highConfPrev: number;
  lowConfPrev: number;
}

interface LadderRun extends BarRunState<LadderVars> {
  tr: ReturnType<typeof taStep.tr>;
  dirArr: number[];
  plot0: Array<{ time: number; value: number; color: string }>;
  plot1: Array<{ time: number; value: number }>;
  flags: boolean[][];
  times: number[][];
  alertCalls: AlertCall[];
}

function study(inputs: Partial<SupertrendLadderInputs>): BarStudy<LadderRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { malength, multiplier, waitForClose, delayed } = cfg;
  return {
    init() {
      const s: LadderRun = {
        // ta.tr (handle_na false: na on the first bar)
        tr: taStep.tr(false), dirArr: [], plot0: [], plot1: [], flags: [[], []], times: [[], []], alertCalls: [],
        steps: [],
        vars: {
          positiveTrArray: [], negativeTrArray: [], posMa: new LibMa(cfg.matype, malength), negMa: new LibMa(cfg.matype, malength),
          dir: 1, // var dir = 1
          buyStop: NaN, // var buyStop / sellStop (set on the first bar)
          sellStop: NaN,
          buyStopDiffPrev: NaN, // buyStopDiff[1] / sellStopDiff[1]
          sellStopDiffPrev: NaN,
          highConfPrev: NaN, // highConfirmation[1] / lowConfirmation[1]
          lowConfPrev: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [s.tr];
      s.lists = [...s.times, s.alertCalls];
      s.series = [s.dirArr, s.plot0, s.plot1, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const tr = s.tr.step(b.high, b.low, b.close);
      // if open < close: pa.push(positiveTrArray, ta.tr, malength) else pa.push(negativeTrArray, ta.tr, malength)
      if (lt(b.open, b.close)) pushMax(v.positiveTrArray, tr, malength);
      else pushMax(v.negativeTrArray, tr, malength);
      const positiveAtr = v.posMa.next(v.positiveTrArray, b.close);
      const negativeAtr = v.negMa.next(v.negativeTrArray, b.close);

      const dirPrev = v.dir;
      let buyStopDiff = negativeAtr * multiplier;
      let sellStopDiff = positiveAtr * multiplier;
      buyStopDiff = v.dir === 1 ? min(buyStopDiff, isNaN(v.buyStopDiffPrev) ? buyStopDiff : v.buyStopDiffPrev) : buyStopDiff;
      sellStopDiff = v.dir === -1 ? min(sellStopDiff, isNaN(v.sellStopDiffPrev) ? sellStopDiff : v.sellStopDiffPrev) : sellStopDiff;
      if (i === 0) {
        v.buyStop = b.low - buyStopDiff;
        v.sellStop = b.high + sellStopDiff;
      }
      const buyStopCurrent = b.low - buyStopDiff;
      const sellStopCurrent = b.high + sellStopDiff;
      const buyStopInverse = b.low - buyStopDiff / 2;
      const sellStopInverse = b.high + sellStopDiff / 2;
      const highConfirmation = waitForClose ? b.close : b.high;
      const lowConfirmation = waitForClose ? b.close : b.low;
      // buyStop / sellStop hold the values of the bar before (buyStop[1] / sellStop[1]) on bars after the first
      const buyStop1 = i > 0 ? v.buyStop : NaN;
      const sellStop1 = i > 0 ? v.sellStop : NaN;
      const dir = v.dir === 1 && lt(v.lowConfPrev, buyStop1) ? -1 : v.dir === -1 && gt(v.highConfPrev, sellStop1) ? 1 : v.dir;
      v.dir = dir;
      const targetReached = (dir === 1 && ge(nz(v.highConfPrev), nz(sellStop1)))
        || (dir === -1 && le(nz(v.lowConfPrev), nz(buyStop1)))
        || !delayed;
      v.buyStop = dir === 1
        ? (targetReached ? max(nz(v.buyStop, buyStopCurrent), buyStopCurrent) : v.buyStop)
        : (targetReached ? buyStopCurrent : max(nz(v.buyStop, buyStopInverse), buyStopInverse));
      v.sellStop = dir === -1
        ? (targetReached ? min(nz(v.sellStop, sellStopCurrent), sellStopCurrent) : v.sellStop)
        : (targetReached ? sellStopCurrent : min(nz(v.sellStop, sellStopInverse), sellStopInverse));

      s.dirArr[i] = dir;
      const st = dir > 0 ? v.buyStop : v.sellStop;
      v.buyStopDiffPrev = buyStopDiff;
      v.sellStopDiffPrev = sellStopDiff;
      v.highConfPrev = highConfirmation;
      v.lowConfPrev = lowConfirmation;

      // plot(supertrend, color = dir > 0 ? color.rgb(83, 195, 189) : color.fuchsia, title = 'Supertrend Stop')
      s.plot0[i] = { time: b.time as number, value: st, color: dir > 0 ? UP_COLOR : DOWN_COLOR };
      s.plot1[i] = { time: b.time as number, value: dir };

      // directionChange = ta.change(dir); if directionChange != 0: alert(alertMessage, alert.freq_once_per_bar_close)
      const change = i > 0 ? dir - dirPrev : NaN;
      const bull = change > 0;
      const bear = change < 0;
      s.flags[0][i] = bull;
      s.flags[1][i] = bear;
      if (bull) s.times[0].push(b.time as number);
      if (bear) s.times[1].push(b.time as number);
      if (i > 0 && change !== 0) {
        s.alertCalls.push({ time: b.time as number, message: change > 0 ? 'Supertrend Bullish' : 'Supertrend Bearish', freq: 'once_per_bar_close' });
      }
    },
    copyVars: (v) => ({
      ...v, positiveTrArray: v.positiveTrArray.slice(), negativeTrArray: v.negativeTrArray.slice(),
      posMa: v.posMa.clone(), negMa: v.negMa.clone(),
    }),
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        // alertcondition(ta.change(dir) > 0, ...) / alertcondition(ta.change(dir) < 0, ...)
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
        alertCalls: s.alertCalls.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SupertrendLadderInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SupertrendLadderInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const SupertrendLadder = { calculate, createRun,
 metadata, defaultInputs, inputConfig, plotConfig, alertConditions, hasAlertFunction };
