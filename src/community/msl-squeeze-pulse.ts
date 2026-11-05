/**
 * MSL Squeeze Pulse
 *
 * Compression ratio = standard deviation of the source / SMA of the bar range (true range or high - low), ranked
 * against its own history with a percent rank: coiled at or below the state percentile, expanded at or above
 * 100 minus it, neutral between. The state is drawn as dots on the zero line, coiled bars tint the background and
 * the bar where the coiled state ends gets a diamond. The pulse is the linear regression of the source minus the
 * middle of the highest high / lowest low channel, in ATR units, drawn as candles from 0: filled while the pulse
 * extends, hollow while it fades.
 *
 * Alerts (alertcondition, `alerts` of the result): 'Coil On' / 'Coil Released' (the coiled state starts / ends) and
 * 'Pulse Flip Up' / 'Pulse Flip Down' (the pulse turns positive / negative).
 *
 * Reference: "MSL Squeeze Pulse" by MarketStructureLab
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: MSL Squeeze Pulse — developed by MarketStructureLab.
 */

import { taStep, color, compare, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BgColorData, MarkerData, PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface MslSqueezePulseInputs {
  priceSrc: SourceType;
  /** Standard deviation length */
  bandLen: number;
  /** Range SMA, channel, linear regression and ATR length */
  chanLen: number;
  useTR: boolean;
  /** Percent rank lookback of the compression ratio */
  rankLen: number;
  statePct: number;
  showPulse: boolean;
  showState: boolean;
  showBgTint: boolean;
  showRelease: boolean;
  bullColor: string;
  bearColor: string;
  coiledColor: string;
  expandedColor: string;
  neutralColor: string;
}

export const defaultInputs: MslSqueezePulseInputs = {
  priceSrc: 'close',
  bandLen: 20,
  chanLen: 20,
  useTR: true,
  rankLen: 252,
  statePct: 25.0,
  showPulse: true,
  showState: true,
  showBgTint: true,
  showRelease: true,
  bullColor: 'rgb(34, 197, 94)',
  bearColor: 'rgb(239, 68, 68)',
  coiledColor: 'rgb(245, 158, 11)',
  expandedColor: 'rgb(203, 213, 225)',
  neutralColor: 'rgb(71, 85, 105)',
};

export const inputConfig: InputConfig[] = [
  { id: 'priceSrc', type: 'source', title: 'Source', defval: 'close', group: 'Calculation' },
  { id: 'bandLen', type: 'int', title: 'Volatility Length', defval: 20, min: 2, max: 500, group: 'Calculation' },
  { id: 'chanLen', type: 'int', title: 'Channel Length', defval: 20, min: 2, max: 500, group: 'Calculation' },
  { id: 'useTR', type: 'bool', title: 'Use True Range', defval: true, group: 'Calculation' },
  { id: 'rankLen', type: 'int', title: 'Compression Lookback', defval: 252, min: 50, max: 500, group: 'Calculation' },
  { id: 'statePct', type: 'float', title: 'State Percentile', defval: 25.0, min: 1.0, max: 49.0, step: 1.0, group: 'Calculation' },
  { id: 'showPulse', type: 'bool', title: 'Show Pulse Histogram', defval: true, group: 'Visuals' },
  { id: 'showState', type: 'bool', title: 'Show State Markers', defval: true, group: 'Visuals' },
  { id: 'showBgTint', type: 'bool', title: 'Highlight Coil Zones', defval: true, group: 'Visuals' },
  { id: 'showRelease', type: 'bool', title: 'Mark Coil Release', defval: true, group: 'Visuals' },
  { id: 'bullColor', type: 'color', title: 'Bull', defval: 'rgb(34, 197, 94)', group: 'Visuals' },
  { id: 'bearColor', type: 'color', title: 'Bear', defval: 'rgb(239, 68, 68)', group: 'Visuals' },
  { id: 'coiledColor', type: 'color', title: 'Coiled', defval: 'rgb(245, 158, 11)', group: 'Visuals' },
  { id: 'expandedColor', type: 'color', title: 'Expanded', defval: 'rgb(203, 213, 225)', group: 'Visuals' },
  { id: 'neutralColor', type: 'color', title: 'Neutral', defval: 'rgb(71, 85, 105)', group: 'Visuals' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Coil State', color: 'rgb(71, 85, 105)', lineWidth: 3, style: 'circles' },
];

export const metadata = {
  title: 'MSL Squeeze Pulse',
  shortTitle: 'MSL Sqz',
  overlay: false,
  precision: 2,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;
/** safeDiv(a, b) => b == 0 or na(b) ? 0.0 : a / b (na() is true for +-infinity) */
const safeDiv = (a: number, b: number) => (eq(b, 0) || !Number.isFinite(b) ? 0.0 : a / b);

/**
 * `ta.highest(source, length)` / `ta.lowest` with a constant length, one bar at a time, in constant time per bar (a
 * queue of the values that can still be the extreme): the extreme of the last `length` non-na values, na before bar
 * `length - 1`; +0 wins over -0 for the highest, -0 for the lowest (the doubles of taStep.highest / lowest).
 */
class WindowExtreme implements Committable {
  private vals: number[] = [];
  private ids: number[] = [];
  private head = 0;
  /** Non-na values committed */
  private kept = 0;
  private bars = 0;
  private pending = NaN;
  private stepped = false;
  private readonly len: number;

  constructor(private readonly lowest: boolean, length: number) {
    this.len = Math.trunc(length);
  }

  /** `b` (newer) replaces `a` in the queue: it is as extreme (the preferred zero is kept) */
  private replaces(a: number, b: number): boolean {
    if (this.lowest) return a > b || (a === b && !(Object.is(a, -0) && Object.is(b, 0)));
    return a < b || (a === b && !(Object.is(a, 0) && Object.is(b, -0)));
  }

  step(value: number): number {
    this.stepped = true;
    this.pending = value;
    const own = Number.isFinite(value);
    const total = this.kept + (own ? 1 : 0);
    if (this.bars < this.len - 1 || total === 0) return NaN;
    const from = total - this.len;
    let h = this.head;
    while (h < this.ids.length && this.ids[h]! < from) h++;
    if (h >= this.ids.length) return value;
    const q = this.vals[h]!;
    if (!own) return q;
    return this.lowest ? Math.min(q, value) : Math.max(q, value);
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.bars++;
    const v = this.pending;
    if (!Number.isFinite(v)) return;
    const id = this.kept++;
    while (this.vals.length > this.head && this.replaces(this.vals[this.vals.length - 1]!, v)) {
      this.vals.pop();
      this.ids.pop();
    }
    this.vals.push(v);
    this.ids.push(id);
    // the values out of the window of the next bars
    while (this.ids[this.head]! < this.kept - this.len) this.head++;
    if (this.head > 1024 && this.head * 2 > this.ids.length) {
      this.vals = this.vals.slice(this.head);
      this.ids = this.ids.slice(this.head);
      this.head = 0;
    }
  }
}

/**
 * `math.sum(source, length)` with a constant length, one bar at a time: the correctly rounded sum of the last `length`
 * non-na values (exact partials, as the oakscriptjs window sums: the same doubles), the previous result on a bar with
 * an na value. The kept partials are copied into a second buffer on a step (no allocation per bar).
 */
class WindowSum implements Committable {
  private values: number[] = [];
  private p = new Float64Array(16);
  private n = 0;
  private q = new Float64Array(16);
  private qn = 0;
  private last = NaN;
  private next = NaN;
  private pending = NaN;
  private stepped = false;
  private readonly len: number;

  constructor(length: number) {
    this.len = Math.floor(length);
  }

  /** Adds `x` to the partials of `q` exactly (Shewchuk) */
  private add(x: number): void {
    let q = this.q;
    const n = this.qn;
    let i = 0;
    for (let j = 0; j < n; j++) {
      let y = q[j]!;
      if (Math.abs(x) < Math.abs(y)) {
        const t = x;
        x = y;
        y = t;
      }
      const hi = x + y;
      const lo = y - (hi - x);
      if (lo !== 0) q[i++] = lo;
      x = hi;
    }
    if (i === q.length) {
      const grown = new Float64Array(q.length * 2);
      grown.set(q);
      this.q = q = grown;
    }
    q[i] = x;
    this.qn = i + 1;
  }

  /** The exact sum of the partials of `q` rounded once (round half to even) */
  private round(): number {
    const p = this.q;
    let n = this.qn;
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

  step(value: number): number {
    this.stepped = true;
    if (!(this.len >= 1)) { this.pending = NaN; this.next = NaN; return NaN; }
    if (value === undefined || value === null || !Number.isFinite(value)) {
      this.pending = NaN;
      this.next = this.last;
      return this.last;
    }
    if (this.q.length < this.p.length) this.q = new Float64Array(this.p.length);
    this.q.set(this.p.subarray(0, this.n));
    this.qn = this.n;
    const count = this.values.length;
    if (count >= this.len) this.add(-this.values[count - this.len]!);
    this.add(value);
    this.pending = value;
    this.next = count + 1 >= this.len ? this.round() : NaN;
    return this.next;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.last = this.next;
    if (Number.isNaN(this.pending)) return;
    const p = this.p;
    this.p = this.q;
    this.n = this.qn;
    this.q = p;
    this.values.push(this.pending);
    if (this.values.length > this.len * 2 + 1024) this.values = this.values.slice(-this.len);
  }
}

/** `ta.sma(source, length)` with a constant length: {@link WindowSum} divided by the length */
class WindowSma extends WindowSum {
  private readonly div: number;

  constructor(length: number) {
    super(length);
    this.div = Math.floor(length);
  }

  override step(value: number): number {
    return super.step(value) / this.div;
  }
}

/** `ta.stdev(source, length)` (biased) with a constant length, from {@link WindowSum}s of the values and squares */
class WindowStdev implements Committable {
  private readonly sums: WindowSum;
  private readonly squares: WindowSum;
  private readonly len: number;

  constructor(length: number) {
    this.len = Math.floor(length);
    this.sums = new WindowSum(length);
    this.squares = new WindowSum(length);
  }

  /** The biased variance */
  variance(value: number): number {
    const sum = this.sums.step(value);
    const sq = this.squares.step(value === undefined || value === null || !Number.isFinite(value) ? NaN : value * value);
    if (this.len <= 0) return NaN;
    const mean = sum / this.len;
    return sq / this.len - mean * mean;
  }

  step(value: number): number {
    const v = this.variance(value);
    return Number.isNaN(v) ? NaN : v > 0 ? Math.sqrt(v) : 0;
  }

  commit(): void {
    this.sums.commit();
    this.squares.commit();
  }
}

type Result = Omit<IndicatorResult, 'markers'> & {
  markers: MarkerData[]; bgColors: BgColorData[]; plotCandles: Record<string, PlotCandleData[]>;
} & { alerts: AlertConditionState[] };

/** ta.percentrank(source, length) of bar i from the values of every bar (the array rules of oakscriptjs) */
function percentrankAt(source: number[], i: number, length: number): number {
  if (i < length) return NaN;
  const currentValue = source[i];
  // le() is false for an na value in the window, and for all of them when the current value is na (0)
  let countLessOrEqual = 0;
  for (let j = 1; j <= length; j++) if (compare.le(source[i - j], currentValue)) countLessOrEqual++;
  return (countLessOrEqual * 100) / length;
}

/** ta.linreg(source, length, 0) of bar i from the values of every bar (the array rules of oakscriptjs) */
function linregAt(source: number[], i: number, length: number): number {
  const len = Math.floor(length);
  if (i < len - 1) return NaN;
  for (let j = 0; j < len; j++) if (isNaN(source[i - j])) return NaN;
  // Least squares as PineScript: x = 1 (oldest) .. len (newest), summed from the oldest value; the intercept is the
  // fitted value at x = 1
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;
  for (let j = 0; j < len; j++) {
    const x = j + 1;
    const y = source[i - (len - 1 - j)];
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  }
  const slope = (len * sumXY - sumX * sumY) / (len * sumX2 - sumX * sumX);
  const intercept = sumY / len - (slope * sumX) / len + slope;
  return intercept + slope * (len - 1 - 0);
}

interface MslVars {
  /** coiled[1] and nz(pulseVal[1]) */
  prevCoiled: boolean;
  prevPulse: number;
}

interface MslRun extends BarRunState<MslVars> {
  dispersion: WindowStdev;
  tr: ReturnType<typeof taStep.tr>;
  travel: WindowSma;
  sqRatio: number[];
  hh: WindowExtreme;
  ll: WindowExtreme;
  atr: ReturnType<typeof taStep.atr>;
  diff: number[];
  candles: PlotCandleData[];
  statePoints: { time: number; value: number; color: string }[];
  bgColors: BgColorData[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<MslSqueezePulseInputs>): BarStudy<MslRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.priceSrc);
  const nz = (v: number) => (Number.isFinite(v) ? v : 0);
  const releaseColor = String(color.new(cfg.coiledColor, 0));
  const bgTint = String(color.new(cfg.coiledColor, 88));
  return {
    fullRunReason: () => (isBarSource(cfg.priceSrc) ? null : 'source of another study'),
    init() {
      const s: MslRun = {
        dispersion: new WindowStdev(cfg.bandLen), tr: taStep.tr(true), travel: new WindowSma(cfg.chanLen),
        sqRatio: [], hh: new WindowExtreme(false, cfg.chanLen), ll: new WindowExtreme(true, cfg.chanLen),
        atr: taStep.atr(cfg.chanLen), diff: [],
        candles: [], statePoints: [], bgColors: [], markers: [],
        flags: [[], [], [], []], times: [[], [], [], []],
        steps: [], vars: { prevCoiled: false, prevPulse: 0 }, lists: [], series: [],
      };
      s.steps = [s.dispersion, s.tr, s.travel, s.hh, s.ll, s.atr];
      s.lists = [s.bgColors, s.markers, ...s.times];
      s.series = [s.sqRatio, s.diff, s.candles, s.statePoints, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const v = s.vars;
      const src = value(b);
      const dispersion = s.dispersion.step(src);
      const barRng = cfg.useTR ? s.tr.step(b.high, b.low, b.close) : b.high - b.low;
      const travel = s.travel.step(barRng);
      const sqRatio = safeDiv(dispersion, travel);
      s.sqRatio[i] = sqRatio;
      const sqRank = percentrankAt(s.sqRatio, i, cfg.rankLen);
      const coiled = !isNaN(sqRank) && le(sqRank, cfg.statePct);
      const expanded = !isNaN(sqRank) && ge(sqRank, 100.0 - cfg.statePct);

      const hh = s.hh.step(b.high);
      const ll = s.ll.step(b.low);
      const atrRef = s.atr.step(b.high, b.low, b.close);
      const diff = src - (hh + ll) / 2;
      s.diff[i] = diff;
      const pv = safeDiv(linregAt(s.diff, i, cfg.chanLen), atrRef);

      const prev = i > 0 ? v.prevPulse : 0;
      const prevCoiled = i > 0 && v.prevCoiled;
      v.prevPulse = nz(pv);
      v.prevCoiled = coiled;
      const isUpPulse = gt(pv, 0);
      const accelPulse = isUpPulse ? gt(pv, prev) : lt(pv, prev);
      const baseColor = isUpPulse ? cfg.bullColor : cfg.bearColor;
      const border = cfg.showPulse ? baseColor : 'transparent';
      const body = cfg.showPulse ? (accelPulse ? baseColor : String(color.new(baseColor, 100))) : 'transparent';
      // plotcandle(0.0, math.max(0.0, pulseVal), math.min(0.0, pulseVal), pulseVal): while pulseVal is na the open is
      // 0 and the high / low / close are na (no candle drawn)
      s.candles[i] = { time: t, open: 0.0, high: Math.max(0.0, pv), low: Math.min(0.0, pv), close: pv, color: body, borderColor: border, wickColor: border };

      const stateColor = coiled ? cfg.coiledColor : expanded ? cfg.expandedColor : cfg.neutralColor;
      s.statePoints[i] = { time: t, value: cfg.showState ? 0.0 : NaN, color: stateColor };

      if (cfg.showBgTint && coiled) s.bgColors.push({ time: t, color: bgTint });

      // coilReleased = (not coiled) and coiled[1]
      const coilReleased = !coiled && prevCoiled;
      // coilOn = coiled and not coiled[1]; pulseFlipUp = pulseVal > 0 and nz(pulseVal[1]) <= 0 (and Down likewise)
      const flags = [coiled && !prevCoiled, coilReleased, gt(pv, 0) && le(prev, 0), lt(pv, 0) && ge(prev, 0)];
      for (let k = 0; k < 4; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(t as number);
      }
      if (cfg.showRelease && coilReleased) {
        s.markers.push({ time: t, position: 'atPriceMiddle', price: 0.0, shape: 'diamond', color: releaseColor, size: 'small' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: metadata.precision },
        plots: { plot0: s.statePoints.slice() },
        hlines: [
          { value: 0, options: { title: 'Zero', color: String(color.new(color.gray, 75)), linestyle: 'dashed' } },
          { value: 1, options: { title: 'Plus one ATR', color: String(color.new(color.gray, 85)), linestyle: 'dashed' } },
          { value: -1, options: { title: 'Minus one ATR', color: String(color.new(color.gray, 85)), linestyle: 'dashed' } },
        ],
        bgColors: s.bgColors.slice(),
        markers: s.markers.slice(),
        plotCandles: { pulse: s.candles.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MslSqueezePulseInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<MslSqueezePulseInputs> = {},
): Omit<IndicatorResult, 'markers'> & {
  markers: MarkerData[]; bgColors: BgColorData[]; plotCandles: Record<string, PlotCandleData[]>;
} & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Coil On', message: '{{ticker}} compression ratio entered its coiled percentile on {{interval}}' },
  { id: 'alert1', title: 'Coil Released', message: '{{ticker}} compression ratio left its coiled percentile on {{interval}}' },
  { id: 'alert2', title: 'Pulse Flip Up', message: '{{ticker}} pulse flipped positive on {{interval}}' },
  { id: 'alert3', title: 'Pulse Flip Down', message: '{{ticker}} pulse flipped negative on {{interval}}' },
];

export const MslSqueezePulse = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
