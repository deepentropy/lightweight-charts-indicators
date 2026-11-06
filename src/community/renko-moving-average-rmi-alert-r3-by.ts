/**
 * Renko+Moving Average+RMI Alert R3
 *
 * Entry and exit signals from three parts:
 * - a moving average of the source (EMA 6 by default; SMA, WMA, VWMA, SMMA, DEMA, TEMA, Hull, zero-lag EMA, triangular
 *   or Ehlers super smoother), lime while it rose over the last 3 bars, red while it fell (the direction is kept
 *   otherwise)
 * - the open line of the period ("1D" by default, or "1W" / "1M"): the source on the first bar of each period
 *   (purple, not drawn on the first bar of a period)
 * - the Relative Momentum Index: 100 - 100 / (1 + up / down) with up / down the EMA (length 4) of the rise / fall of
 *   the source over "Momentum Length" bars (0 when the down EMA is 0), or the RSI of the source
 * A long starts when the bar is up (and closes above the open line with the filter on), the moving average rises and
 * the RMI is at or above "Overbought" and not falling; it ends when the moving average turns down or the RMI leaves
 * its zone (RMI mode), or on the first down bar after an up bar with "Exit Trade on 1st Opposite Renko Brick".
 * Shorts are the mirror; the short exit on the moving average never happens (the original tests a direction above 1).
 * Outputs: an up arrow (BUY, 'arrow0') and a down arrow (SELL, 'arrow1') on the first bar of a trade (the original's
 * plotarrow, `arrows` of the result), and an "Exit" cross when it ends (markers 'shape0' / 'shape1'). The arrow height
 * of the original (50 to 60 pixels) is not ported.
 *
 * Alerts: the four alertcondition() calls of the original, "Swing BUY Alert" / "Swing SELL Alert" (the arrows) and
 * "Swing BUY Exit Alert" / "Swing SELL Exit Alert" (the exit crosses).
 *
 * Chart values (third argument): the time zone and the session of the symbol give the periods of the open line on
 * the exchange calendar (without them: the UTC calendar and the bars, see src/anchor-period.ts).
 *
 * Reference: "Renko+Moving Average+RMI Alert R3 by JustUncleL" by JustUncleL
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, compare, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ArrowData } from 'oakscriptjs';
import { hasCalendar, securityStarts } from '../anchor-period';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, WindowSma, WindowVwma, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';
import type { ChartContext } from '../chart-context';
import { type AlertConditionDecl, type AlertConditionState } from '../alert-states';

type MaType = 'SMA' | 'EMA' | 'WMA' | 'VWMA' | 'SMMA' | 'DEMA' | 'TEMA' | 'HullMA' | 'ZEMA' | 'TMA' | 'SSMA';
type Source = 'open' | 'high' | 'low' | 'close' | 'hl2' | 'hlc3' | 'ohlc4' | 'volume';

export interface RenkoMovingAverageRmiAlertR3ByInputs {
  maType: MaType;
  maLen: number;
  maSrc: Source;
  /** Exit a trade on the first opposite brick (bar) */
  exitFirst: boolean;
  /** RMI / RSI length */
  rmiLen: number;
  /** Momentum length of the RMI */
  mom: number;
  ob: number;
  os: number;
  /** Use the RSI instead of the RMI */
  uRSI: boolean;
  /** Use the open line filter */
  udOpen: boolean;
  /** Period of the open line */
  dPeriod: '1D' | '1W' | '1M';
}

export const defaultInputs: RenkoMovingAverageRmiAlertR3ByInputs = {
  maType: 'EMA',
  maLen: 6,
  maSrc: 'close',
  exitFirst: false,
  rmiLen: 4,
  mom: 5,
  ob: 70,
  os: 30,
  uRSI: false,
  udOpen: true,
  dPeriod: '1D',
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type: ', defval: 'EMA', options: ['SMA', 'EMA', 'WMA', 'VWMA', 'SMMA', 'DEMA', 'TEMA', 'HullMA', 'ZEMA', 'TMA', 'SSMA'] },
  { id: 'maLen', type: 'int', title: 'MA - Length', defval: 6, min: 1 },
  { id: 'maSrc', type: 'source', title: 'MA - Source', defval: 'close', options: ['open', 'high', 'low', 'close', 'hl2', 'hlc3', 'ohlc4', 'volume'] },
  { id: 'exitFirst', type: 'bool', title: 'Exit Trade on 1st Opposite Renko Brick', defval: false },
  { id: 'rmiLen', type: 'int', title: 'RMI/RSI MA Length', defval: 4 },
  { id: 'mom', type: 'int', title: 'Momentum Length', defval: 5, min: 0 },
  { id: 'ob', type: 'int', title: 'Overbought', defval: 70 },
  { id: 'os', type: 'int', title: 'Oversold', defval: 30 },
  { id: 'uRSI', type: 'bool', title: 'Use RSI instead of RMI', defval: false },
  { id: 'udOpen', type: 'bool', title: 'Use Daily Open Line Filter', defval: true },
  { id: 'dPeriod', type: 'string', title: 'Period for Daily Open Line', defval: '1D', options: ['1D', '1W', '1M'] },
];

const LIME = '#00FF00';
const RED = '#FF0000';
const PURPLE = '#800080';
const GRAY = '#808080';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA Plot', color: String(color.new(LIME, 10)), lineWidth: 2 },
  { id: 'plot1', title: 'Daily Open', color: String(color.new(PURPLE, 40)), lineWidth: 2 },
];

export const metadata = {
  title: 'Renko+Moving Average+RMI Alert R3 by JustUncleL',
  shortTitle: 'RENKO_MA_RMI',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;
const nz = (x: number, y = 0) => (isNaN(x) ? y : x);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; arrows: ArrowData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

const DAY = 86400000;
/** The open line periods computed bar by bar (UTC calendar of `periodStarts`) */
const UTC_PERIODS = new Set(['1D', '1W', '1M']);

/** Start (UNIX ms, UTC) of the 1D / 1W / 1M period that contains the day `day` (00:00 UTC, ms), as periodStarts */
function utcPeriodStart(day: number, tf: string): number {
  const d = new Date(day);
  if (tf === '1D') return day;
  if (tf === '1W') return day - ((d.getUTCDay() + 6) % 7) * DAY;
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

/** The bar times are in ms (from the first bar) */
const msTimes = (bars: Bar[]) => bars.length > 0 && bars[0]!.time >= 1e12;

/** periodStarts: a bar on a Saturday or Sunday makes the periods start on the calendar dates, else on their first bar */
function everyDay(bars: Bar[], ms: boolean): boolean {
  for (const b of bars) {
    const day = Math.floor((ms ? b.time : b.time * 1000) / DAY);
    const wd = (((day % 7) + 7) + 4) % 7;
    if (wd === 0 || wd === 6) return true;
  }
  return false;
}

/** One `variant(type, src, len)` value per bar */
interface MaStep {
  step(s: RenkoRun, i: number, v: number, volume: number): number;
  steps: Committable[];
}

/** ta.rising / ta.falling(ma, 3): a counter of strict rises (falls) from the previous bar, na steps leave it as is */
interface RenkoVars {
  rises: number;
  falls: number;
  direction: number;
  dopen: number;
  olong: number;
  oshort: number;
  /** periodStarts state: the period key of the last bar and its start */
  prevKey: number;
  start: number;
}

interface RenkoRun extends BarRunState<RenkoVars> {
  up: ReturnType<typeof taStep.ema>;
  dn: ReturnType<typeof taStep.ema>;
  rsi: ReturnType<typeof taStep.rsi> | null;
  src: number[];
  ma: number[];
  rmi: number[];
  starts: number[];
  maPlot: Point[];
  openPlot: Point[];
  markers: MarkerData[];
  arrows: ArrowData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<RenkoMovingAverageRmiAlertR3ByInputs>): BarStudy<RenkoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = Math.trunc(cfg.maLen);
  const rmiLen = Math.trunc(cfg.rmiLen);
  const mom = Math.trunc(cfg.mom);
  const srcOf = barSource(cfg.maSrc);
  /** The open line periods of the whole set (exchange calendar or another period): computed in init */
  const fullStarts = (c: ChartContext) => hasCalendar(c) || !UTC_PERIODS.has(cfg.dPeriod);
  let ms = false;
  let allDays = false;
  let precomputed: number[] | null = null;

  // variant(type, src, len)
  const variant = (): MaStep => {
    const ema = () => taStep.ema(len);
    switch (cfg.maType) {
      case 'EMA': { const m = ema(); return { step: (_s, _i, v) => m.step(v), steps: [m] }; }
      case 'WMA': { const m = taStep.wma(); return { step: (_s, _i, v) => m.step(v, len), steps: [m] }; }
      case 'VWMA': { const m = new WindowVwma(len); return { step: (_s, _i, v, vol) => m.step(v, vol), steps: [m] }; }
      case 'SMMA': {
        // v5 := na(v5[1]) ? sma(src, len) : (v5[1] * (len - 1) + src) / len
        const sma = new WindowSma(len);
        return {
          step: (s, i, v) => {
            const m = sma.step(v);
            const prev = i > 0 ? s.ma[i - 1]! : NaN;
            return isNaN(prev) ? m : (prev * (len - 1) + v) / len;
          },
          steps: [sma],
        };
      }
      case 'DEMA': {
        const e1 = ema();
        const e2 = ema();
        return { step: (_s, _i, v) => { const v2 = e1.step(v); return 2 * v2 - e2.step(v2); }, steps: [e1, e2] };
      }
      case 'TEMA': {
        const e1 = ema();
        const e2 = ema();
        const e3 = ema();
        return {
          step: (_s, _i, v) => {
            const v2 = e1.step(v);
            const x2 = e2.step(v2);
            return 3 * (v2 - x2) + e3.step(x2);
          },
          steps: [e1, e2, e3],
        };
      }
      case 'HullMA': {
        const half = taStep.wma();
        const full = taStep.wma();
        const outer = taStep.wma();
        const sq = Math.round(Math.sqrt(len));
        return {
          step: (_s, _i, v) => {
            const h = half.step(v, len / 2);
            return outer.step(2 * h - full.step(v, len), sq);
          },
          steps: [half, full, outer],
        };
      }
      case 'SSMA': {
        // Ehlers super smoother
        const a1 = Math.exp((-1.414 * 3.14159) / len);
        const b1 = 2 * a1 * Math.cos((1.414 * 3.14159) / len);
        const c2 = b1;
        const c3 = -a1 * a1;
        const c1 = 1 - c2 - c3;
        return {
          step: (s, i, v) => {
            const p1 = i > 0 ? s.src[i - 1]! : NaN;
            const v1 = i > 0 ? s.ma[i - 1]! : NaN;
            const v2 = i > 1 ? s.ma[i - 2]! : NaN;
            return (c1 * (v + nz(p1))) / 2 + c2 * nz(v1) + c3 * nz(v2);
          },
          steps: [],
        };
      }
      case 'ZEMA': {
        const e1 = ema();
        const e2 = ema();
        return { step: (_s, _i, v) => { const x = e1.step(v); return x + (x - e2.step(x)); }, steps: [e1, e2] };
      }
      case 'TMA': {
        const a = new WindowSma(len);
        const b = new WindowSma(len);
        return { step: (_s, _i, v) => b.step(a.step(v)), steps: [a, b] };
      }
      default: { const m = new WindowSma(len); return { step: (_s, _i, v) => m.step(v), steps: [m] }; }
    }
  };
  let ma: MaStep;

  const lime = String(color.new(LIME, 10));
  const red = String(color.new(RED, 10));
  const purple = String(color.new(PURPLE, 40));
  const arrowUp = String(color.new(LIME, 20));
  const arrowDown = String(color.new(RED, 20));

  return {
    fullRunReason: (c) => (!isBarSource(cfg.maSrc) ? 'source of another study'
      : fullStarts(c) ? 'open line periods of the exchange calendar' : null),
    // the UTC periods read the time unit of the first bar and whether a bar is on a weekend
    key: (bars, c) => (fullStarts(c) ? '' : `${msTimes(bars)}|${everyDay(bars, msTimes(bars))}`),
    init(bars, c) {
      ms = msTimes(bars);
      // Open line: security(ticker, dperiod, time, gaps_off, lookahead_on), newDay = change(start)
      if (fullStarts(c)) precomputed = securityStarts(bars, cfg.dPeriod, c);
      else {
        precomputed = null;
        allDays = everyDay(bars, ms);
      }
      ma = variant();
      const s: RenkoRun = {
        // RMI
        up: taStep.ema(rmiLen), dn: taStep.ema(rmiLen), rsi: cfg.uRSI ? taStep.rsi(rmiLen) : null, src: [], ma: [], rmi: [], starts: [],
        maPlot: [], openPlot: [], markers: [], arrows: [],
        // alertcondition flags: olong==1, oshort==1, olong[1]>0 and olong==0, oshort[1]>0 and oshort==0
        flags: [[], [], [], []], times: [[], [], [], []],
        steps: [], lists: [], series: [],
        vars: { rises: 0, falls: 0, direction: 0, dopen: NaN, olong: NaN, oshort: NaN, prevKey: NaN, start: NaN },
      };
      s.steps = [...ma.steps, s.up, s.dn, ...(s.rsi ? [s.rsi] : [])];
      s.lists = [s.markers, s.arrows, ...s.times];
      s.series = [s.src, s.ma, s.rmi, s.starts, s.maPlot, s.openPlot, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const t = b.time;
      const v = s.vars;
      const src = srcOf(b);
      s.src[i] = src;
      const m = ma.step(s, i, src, b.volume ?? NaN);
      s.ma[i] = m;
      const prevMa = i > 0 ? s.ma[i - 1]! : NaN;
      if (Number.isFinite(m) && Number.isFinite(prevMa)) {
        v.rises = compare.gt(m, prevMa) ? v.rises + 1 : 0;
        v.falls = compare.lt(m, prevMa) ? v.falls + 1 : 0;
      }
      const rising = v.rises >= 3;
      const falling = v.falls >= 3;

      // the period start of the bar (periodStarts on the UTC calendar)
      let start: number;
      if (precomputed) start = precomputed[i]!;
      else {
        const tm = ms ? t : t * 1000;
        const day = Math.floor(tm / DAY) * DAY;
        const k = utcPeriodStart(day, cfg.dPeriod);
        if (k !== v.prevKey) v.start = allDays ? k : tm;
        v.prevKey = k;
        start = ms ? v.start : Math.floor(v.start / 1000);
      }
      s.starts[i] = start;

      const pastSrc = i >= mom ? s.src[i - mom]! : NaN;
      const u = s.up.step(i >= mom ? Math.max(src - pastSrc, 0) : NaN);
      const d = s.dn.step(i >= mom ? Math.max(pastSrc - src, 0) : NaN);
      const r = s.rsi ? s.rsi.step(src) : eq(d, 0) ? 0 : 100 - 100 / (1 + u / d);
      s.rmi[i] = r;

      // direction := rising(ma, 3) ? 1 : falling(ma, 3) ? -1 : nz(direction[1])
      v.direction = rising ? 1 : falling ? -1 : v.direction;
      const direction = v.direction;
      s.maPlot[i] = { time: t, value: m, color: direction > 0 ? lime : direction < 0 ? red : 'transparent' };

      // change(start): na on the first bar; valuewhen(start[1] <= time, src, 0)
      const newDay = i > 0 && start !== s.starts[i - 1];
      const dopenNow = i > 0 && s.starts[i - 1]! <= t ? src : NaN;
      v.dopen = newDay ? dopenNow : nz(v.dopen, dopenNow);
      const dopen = v.dopen;
      s.openPlot[i] = { time: t, value: dopen, color: newDay ? 'transparent' : purple };

      const pa = gt(b.close, b.open) && (!cfg.udOpen || gt(b.close, dopen)) ? 1
        : lt(b.close, b.open) && (!cfg.udOpen || lt(b.close, dopen)) ? -1 : 0;
      const has = direction;
      const prevRmi = i > 0 ? s.rmi[i - 1]! : NaN;
      const rmiSig = ge(r, prevRmi) && ge(r, cfg.ob) ? 1 : le(r, prevRmi) && le(r, cfg.os) ? -1 : 0;
      const long = pa === 1 && has === 1 && rmiSig === 1;
      const short = pa === -1 && has === -1 && rmiSig === -1;
      const prev = i > 0 ? bars[i - 1]! : null;
      const downBrick = lt(b.close, b.open) && prev !== null && gt(prev.close, prev.open);
      const upBrick = gt(b.close, b.open) && prev !== null && lt(prev.close, prev.open);

      const pl = v.olong;
      v.olong = gt(pl, 0) && (has < 0 || (!cfg.uRSI && rmiSig <= 0) || (cfg.exitFirst && downBrick)) ? 0
        : nz(pl) === 0 && long ? 1
        : gt(pl, 0) && has === 1 ? pl + 1 : 0;
      const ps = v.oshort;
      v.oshort = gt(ps, 0) && (has > 1 || (!cfg.uRSI && rmiSig >= 0) || (cfg.exitFirst && upBrick)) ? 0
        : nz(ps) === 0 && short ? 1
        : gt(ps, 0) && has === -1 ? ps + 1 : 0;
      const olong = v.olong;
      const oshort = v.oshort;

      // plotarrow(olong==1?1:na, "BUY Arrow", colorup=lime) / plotarrow(oshort==1?-1:na, "SELL Arrow", colordown=red)
      if (eq(olong, 1)) s.arrows.push({ time: t, id: 'arrow0', value: 1, color: arrowUp });
      if (eq(oshort, 1)) s.arrows.push({ time: t, id: 'arrow1', value: -1, color: arrowDown });
      if (gt(pl, 0) && olong === 0) {
        s.markers.push({ id: 'shape0', time: t, position: 'belowBar', shape: 'xcross', color: GRAY, text: 'Exit\nBuy', textColor: '#2962FF' });
      }
      if (gt(ps, 0) && oshort === 0) {
        s.markers.push({ id: 'shape1', time: t, position: 'aboveBar', shape: 'xcross', color: GRAY, text: 'Exit\nSell', textColor: '#2962FF' });
      }
      const flags = [eq(olong, 1), eq(oshort, 1), gt(pl, 0) && olong === 0, gt(ps, 0) && oshort === 0];
      for (let k = 0; k < 4; k++) {
        s.flags[k]![i] = flags[k]!;
        if (flags[k]) s.times[k]!.push(t as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.maPlot.slice(), plot1: s.openPlot.slice() },
        markers: s.markers.slice(),
        arrows: s.arrows.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1]!)),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RenkoMovingAverageRmiAlertR3ByInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<RenkoMovingAverageRmiAlertR3ByInputs> = {},
  chart?: ChartContext,
): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Swing BUY Alert', message: 'BUY' },
  { id: 'alert1', title: 'Swing SELL Alert', message: 'SELL' },
  { id: 'alert2', title: 'Swing BUY Exit Alert', message: 'BUY Exit' },
  { id: 'alert3', title: 'Swing SELL Exit Alert', message: 'SELL Exit' },
];

export const RenkoMovingAverageRmiAlertR3By = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
