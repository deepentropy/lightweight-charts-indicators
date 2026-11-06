/**
 * Minervini Trend Template Screener (self-contained momentum screener)
 *
 * A BUY bar passes every enabled filter:
 * - Trend Template: close above SMA 150 and SMA 200, SMA 150 above SMA 200, SMA 200 above its value slopeLookback
 *   bars ago, SMA 50 above SMA 150 and SMA 200, close above SMA 50, close at least minAboveLowPct % above the 52-week
 *   low and at most maxOffHighPct % below the 52-week high (highest high / lowest low of lookback52w bars);
 * - mid-term momentum: the return over midLen bars (close / nz(close[midLen], close) - 1) >= midMinPct %;
 * - short-term momentum: the same over shortLen bars >= shortMinPct %;
 * - volume spike (off by default): volume >= SMA(volume, volLen) * volMult;
 * - VCP ATR contraction: SMA(ATR % of close, atrShort) < SMA(ATR % of close, atrLong) * atrRatio.
 * A BUY bar gets a BUY label below the bar and a green background.
 * Alerts (alertcondition, `alerts` of the result): 'BUY', true on the BUY bars.
 *
 * Reference: "Minervini Trend Template Screener (v5)" by hibinomasakazu1991
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BgColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'BUY', message: 'BUY: conditions met' },
];

export interface MinerviniTrendTemplateScreenerInputs {
  /** Use Trend Template */
  useTT: boolean;
  /** SMA 50 */
  len50: number;
  /** SMA 150 */
  len150: number;
  /** SMA 200 */
  len200: number;
  /** Lookback 52w days */
  lookback52w: number;
  /** Min pct above 52w low */
  minAboveLowPct: number;
  /** Max pct off 52w high */
  maxOffHighPct: number;
  /** SMA200 slope lookback */
  slopeLookback: number;
  /** Use mid term momentum */
  useMidMomentum: boolean;
  /** Mid lookback days */
  midLen: number;
  /** Min mid return pct */
  midMinPct: number;
  /** Use short term momentum */
  useShortMomentum: boolean;
  /** Short lookback days */
  shortLen: number;
  /** Min short return pct */
  shortMinPct: number;
  /** Use volume spike */
  useVolumeSpike: boolean;
  /** Volume MA length */
  volLen: number;
  /** Volume spike mult */
  volMult: number;
  /** Use VCP ATR contraction */
  useVCP: boolean;
  /** ATR length */
  atrLen: number;
  /** ATRpct short MA */
  atrShort: number;
  /** ATRpct long MA */
  atrLong: number;
  /** Contraction ratio */
  atrRatio: number;
}

export const defaultInputs: MinerviniTrendTemplateScreenerInputs = {
  useTT: true,
  len50: 50,
  len150: 150,
  len200: 200,
  lookback52w: 252,
  minAboveLowPct: 30.0,
  maxOffHighPct: 25.0,
  slopeLookback: 20,
  useMidMomentum: true,
  midLen: 126,
  midMinPct: 20.0,
  useShortMomentum: true,
  shortLen: 21,
  shortMinPct: 5.0,
  useVolumeSpike: false,
  volLen: 50,
  volMult: 1.5,
  useVCP: true,
  atrLen: 14,
  atrShort: 10,
  atrLong: 50,
  atrRatio: 0.9,
};

export const inputConfig: InputConfig[] = [
  { id: 'useTT', type: 'bool', title: 'Use Trend Template', defval: true },
  { id: 'len50', type: 'int', title: 'SMA 50', defval: 50, min: 1 },
  { id: 'len150', type: 'int', title: 'SMA 150', defval: 150, min: 1 },
  { id: 'len200', type: 'int', title: 'SMA 200', defval: 200, min: 1 },
  { id: 'lookback52w', type: 'int', title: 'Lookback 52w days', defval: 252, min: 50 },
  { id: 'minAboveLowPct', type: 'float', title: 'Min pct above 52w low', defval: 30.0, step: 0.5 },
  { id: 'maxOffHighPct', type: 'float', title: 'Max pct off 52w high', defval: 25.0, step: 0.5 },
  { id: 'slopeLookback', type: 'int', title: 'SMA200 slope lookback', defval: 20, min: 1 },
  { id: 'useMidMomentum', type: 'bool', title: 'Use mid term momentum', defval: true },
  { id: 'midLen', type: 'int', title: 'Mid lookback days', defval: 126, min: 1 },
  { id: 'midMinPct', type: 'float', title: 'Min mid return pct', defval: 20.0, step: 0.5 },
  { id: 'useShortMomentum', type: 'bool', title: 'Use short term momentum', defval: true },
  { id: 'shortLen', type: 'int', title: 'Short lookback days', defval: 21, min: 1 },
  { id: 'shortMinPct', type: 'float', title: 'Min short return pct', defval: 5.0, step: 0.5 },
  { id: 'useVolumeSpike', type: 'bool', title: 'Use volume spike', defval: false },
  { id: 'volLen', type: 'int', title: 'Volume MA length', defval: 50, min: 1 },
  { id: 'volMult', type: 'float', title: 'Volume spike mult', defval: 1.5, min: 1.0, step: 0.1 },
  { id: 'useVCP', type: 'bool', title: 'Use VCP ATR contraction', defval: true },
  { id: 'atrLen', type: 'int', title: 'ATR length', defval: 14, min: 1 },
  { id: 'atrShort', type: 'int', title: 'ATRpct short MA', defval: 10, min: 1 },
  { id: 'atrLong', type: 'int', title: 'ATRpct long MA', defval: 50, min: 1 },
  { id: 'atrRatio', type: 'float', title: 'Contraction ratio', defval: 0.9, min: 0.5, max: 1.0, step: 0.01 },
];

// No plot(): the outputs are a plotshape label and a background colour
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'SelfContained Momentum Screener (TT+Momentum+Vol+VCP) w/BUY',
  shortTitle: 'SelfContained Momentum Screener (TT+Momentum+Vol+VCP) w/BUY',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] };

/** Non-overlapping partials of an exact sum (Shewchuk), in a typed array with a count */
class Partials {
  p = new Float64Array(32);
  n = 0;

  copyFrom(o: Partials): void {
    if (this.p.length < o.p.length) this.p = new Float64Array(o.p.length);
    this.p.set(o.p.subarray(0, o.n));
    this.n = o.n;
  }

  add(x: number): void {
    const p = this.p;
    const n = this.n;
    let i = 0;
    for (let j = 0; j < n; j++) {
      let y = p[j]!;
      if (Math.abs(x) < Math.abs(y)) {
        const t = x;
        x = y;
        y = t;
      }
      const hi = x + y;
      const lo = y - (hi - x);
      if (lo !== 0) p[i++] = lo;
      x = hi;
    }
    if (i === p.length) {
      const grown = new Float64Array(p.length * 2);
      grown.set(p);
      this.p = grown;
    }
    this.p[i] = x;
    this.n = i + 1;
  }

  /** The exact sum rounded once (round half to even) */
  round(): number {
    const p = this.p;
    let n = this.n;
    if (n === 0) return 0;
    let hi = p[--n]!;
    while (n > 0) {
      const x = hi;
      const y = p[--n]!;
      hi = x + y;
      const lo = y - (hi - x);
      if (lo !== 0) {
        if (n > 0 && ((lo < 0 && p[n - 1]! < 0) || (lo > 0 && p[n - 1]! > 0))) {
          const y2 = lo * 2;
          const x2 = hi + y2;
          if (y2 === x2 - hi) hi = x2;
        }
        break;
      }
    }
    return hi;
  }
}

/**
 * `math.sum(x, length)` with a constant length, one bar at a time: the correctly rounded sum of the last `length`
 * finite values, NaN while fewer exist; a bar with an na value keeps the previous result (the doubles of the `taStep`
 * sums, without a copy of the state per bar).
 */
class WindowSum implements Committable {
  private values: number[] = [];
  private kept = new Partials();
  private next = new Partials();
  private last = NaN;
  private pendingX = NaN;
  private pendingSum = NaN;
  private stepped = false;

  constructor(private readonly length: number) {}

  step(x: number): number {
    this.stepped = true;
    this.pendingX = x;
    if (!Number.isFinite(x)) return (this.pendingSum = this.last);
    const q = this.next;
    q.copyFrom(this.kept);
    const count = this.values.length;
    if (count >= this.length) q.add(-this.values[count - this.length]!);
    q.add(x);
    return (this.pendingSum = count + 1 >= this.length ? q.round() : NaN);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.last = this.pendingSum;
    if (!Number.isFinite(this.pendingX)) return;
    const k = this.kept;
    this.kept = this.next;
    this.next = k;
    this.values.push(this.pendingX);
    if (this.values.length > this.length + 4096) this.values = this.values.slice(-this.length);
  }
}

/**
 * `ta.highest(x, length)` / `ta.lowest(x, length)` with a constant length, one bar at a time (the doubles of the
 * `taStep` machines): the extreme of the last `length` finite values, na before bar `length - 1`; a monotonic queue
 * instead of a scan of the window (+0 wins over -0 for the highest, -0 for the lowest, as Math.max / Math.min).
 */
class WindowExtreme implements Committable {
  private vals: number[] = [];
  private idx: number[] = [];
  private head = 0;
  /** Finite values committed */
  private count = 0;
  /** Bars committed */
  private bars = 0;
  private pending = NaN;
  private stepped = false;

  constructor(private readonly length: number, private readonly lowest: boolean) {}

  /** `a` beats or replaces `b` at the back of the queue */
  private beats(a: number, b: number): boolean {
    if (this.lowest) return a < b || (a === b && !(Object.is(b, -0) && Object.is(a, 0)));
    return a > b || (a === b && !(Object.is(b, 0) && Object.is(a, -0)));
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const own = Number.isFinite(value);
    if (this.bars < this.length - 1) return NaN;
    // the window: committed values from index `first`
    const first = this.count + (own ? 1 : 0) - this.length;
    let k = this.head;
    while (k < this.idx.length && this.idx[k]! < first) k++;
    const kept = k < this.idx.length ? this.vals[k]! : NaN;
    if (!own) return kept;
    if (Number.isNaN(kept)) return value;
    return this.lowest ? Math.min(kept, value) : Math.max(kept, value);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.bars++;
    const v = this.pending;
    if (!Number.isFinite(v)) return;
    while (this.idx.length > this.head && this.beats(v, this.vals[this.vals.length - 1]!)) {
      this.vals.pop();
      this.idx.pop();
    }
    this.vals.push(v);
    this.idx.push(this.count);
    this.count++;
    while (this.idx[this.head]! < this.count - this.length) this.head++;
    if (this.head > 1024) {
      this.vals = this.vals.slice(this.head);
      this.idx = this.idx.slice(this.head);
      this.head = 0;
    }
  }
}

interface MinerviniRun extends BarRunState<Record<string, never>> {
  sum50: WindowSum;
  sum150: WindowSum;
  sum200: WindowSum;
  hi52: WindowExtreme;
  lo52: WindowExtreme;
  sumVol: WindowSum;
  atr: ReturnType<typeof taStep.atr>;
  sumAtrShort: WindowSum;
  sumAtrLong: WindowSum;
  sma200: number[];
  markers: MarkerData[];
  bgColors: BgColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MinerviniTrendTemplateScreenerInputs>): BarStudy<MinerviniRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const bg = String(color.new(color.green, 85));
  const sma = (sum: WindowSum, x: number, len: number) => sum.step(x) / Math.floor(len);
  return {
    init() {
      const sum50 = new WindowSum(Math.floor(cfg.len50));
      const sum150 = new WindowSum(Math.floor(cfg.len150));
      const sum200 = new WindowSum(Math.floor(cfg.len200));
      const hi52 = new WindowExtreme(Math.trunc(cfg.lookback52w), false);
      const lo52 = new WindowExtreme(Math.trunc(cfg.lookback52w), true);
      const sumVol = new WindowSum(Math.floor(cfg.volLen));
      const atr = taStep.atr(cfg.atrLen);
      const sumAtrShort = new WindowSum(Math.floor(cfg.atrShort));
      const sumAtrLong = new WindowSum(Math.floor(cfg.atrLong));
      const s: MinerviniRun = {
        sum50, sum150, sum200, hi52, lo52, sumVol, atr, sumAtrShort, sumAtrLong,
        sma200: [], markers: [], bgColors: [], flags: [[]], times: [[]],
        steps: [sum50, sum150, sum200, hi52, lo52, sumVol, atr, sumAtrShort, sumAtrLong], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers, s.bgColors, ...s.times];
      s.series = [s.sma200, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const c = b.close;
      // ===== Trend Template =====
      const sma50 = sma(s.sum50, c, cfg.len50);
      const sma150 = sma(s.sum150, c, cfg.len150);
      const sma200 = sma(s.sum200, c, cfg.len200);
      s.sma200[i] = sma200;
      const hi52 = s.hi52.step(b.high);
      const lo52 = s.lo52.step(b.low);

      // ===== Volume spike =====
      const volume = b.volume ?? NaN;
      const volMA = sma(s.sumVol, volume, cfg.volLen);

      // ===== VCP (ATR contraction) =====
      const atr = s.atr.step(b.high, b.low, b.close);
      const atrPct = (atr / b.close) * 100;
      const atrShortMA = sma(s.sumAtrShort, atrPct, cfg.atrShort);
      const atrLongMA = sma(s.sumAtrLong, atrPct, cfg.atrLong);

      const sma200Back = i - cfg.slopeLookback >= 0 ? s.sma200[i - cfg.slopeLookback] : NaN;

      const tt1 = gt(c, sma150) && gt(c, sma200);
      const tt2 = gt(sma150, sma200);
      const tt3 = gt(sma200, sma200Back);
      const tt4 = gt(sma50, sma150) && gt(sma50, sma200);
      const tt5 = gt(c, sma50);
      const tt6 = ge(c, lo52 * (1 + cfg.minAboveLowPct / 100));
      const tt7 = ge(c, hi52 * (1 - cfg.maxOffHighPct / 100));
      const ttPass = tt1 && tt2 && tt3 && tt4 && tt5 && tt6 && tt7;

      // ===== Mid-term momentum: nz(close[midLen], close) =====
      const midBack = i - cfg.midLen >= 0 ? bars[i - cfg.midLen].close : NaN;
      const midClose = isNaN(midBack) ? c : midBack;
      const midMomentumPct = (c / midClose - 1) * 100;
      const midPass = ge(midMomentumPct, cfg.midMinPct);

      // ===== Short-term momentum =====
      const shortBack = i - cfg.shortLen >= 0 ? bars[i - cfg.shortLen].close : NaN;
      const shortClose = isNaN(shortBack) ? c : shortBack;
      const shortMomentumPct = (c / shortClose - 1) * 100;
      const shortPass = ge(shortMomentumPct, cfg.shortMinPct);

      const volSpike = ge(volume, volMA * cfg.volMult);
      const vcpPass = lt(atrShortMA, atrLongMA * cfg.atrRatio);

      // ===== Final pass =====
      const p1 = !cfg.useTT || ttPass;
      const p2 = !cfg.useMidMomentum || midPass;
      const p3 = !cfg.useShortMomentum || shortPass;
      const p4 = !cfg.useVolumeSpike || volSpike;
      const p5 = !cfg.useVCP || vcpPass;
      const buy = p1 && p2 && p3 && p4 && p5;
      s.flags[0][i] = buy;

      if (buy) {
        s.times[0].push(b.time as number);
        // plotshape(buy, "BUY label", shape.labelup, text = "BUY", location.belowbar, size.tiny): Pine default colour
        // and text colour (color.blue)
        s.markers.push({ time: b.time, position: 'belowBar', shape: 'labelUp', color: color.blue, text: 'BUY',
          textColor: color.blue, size: 'tiny' });
        // bgcolor(buy ? color.new(color.green, 85) : na)
        s.bgColors.push({ time: b.time, color: bg });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
        bgColors: s.bgColors.slice(),
        // alertcondition(buy, title = "BUY")
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MinerviniTrendTemplateScreenerInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MinerviniTrendTemplateScreenerInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; bgColors: BgColorData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const MinerviniTrendTemplateScreener = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, alertConditions };
