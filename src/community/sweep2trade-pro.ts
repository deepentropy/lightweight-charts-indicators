/**
 * Sweep2Trade Pro [CHE]
 *
 * A T3 line (six nested EMAs of hlc3 with the volume factor) is the trend line, green when it is below hlc3, red
 * otherwise. A bullish sweep is a low under the lowest low of the previous `swingLook` bars with a close back above
 * it (bearish: mirror with the highest high). Each side runs a sequence: the sweep starts phase 1 with a timeout of
 * `dipWindow` bars; a rising (falling) T3 moves it to phase 2 (sweep signal, optional timeout restart); in phase 2 a
 * confirmation bar gives the BUY (SELL) signal and resets the sequence. Confirmation: a break of the highest high
 * (lowest low) of the previous `bosLb` bars (wick or close cross), a close in the top (bottom) quarter of the bar, a
 * close above (below) the T3, and with the regime filter a T3 rising (falling) over 3 bars with the close on the
 * right side and R² of close against bar_index over `r2Len` bars above the minimum.
 * Alerts (alertcondition, `alerts` of the result): BUY / SELL sequence complete and SWEEP Long / Short cleared, true on
 * the bars of the matching markers.
 *
 * Reference: "Sweep2Trade Pro [CHE]" by chervolino
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © chervolino
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type Committable, type BarStudy, type IndicatorRun } from '../live-run';

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  {
    id: 'alert0',
    title: 'S2T Pro [CHE] BUY: Sequence complete',
    message: 'S2T Pro [CHE] – BUY: Bullish sweep → T3↑ → confirmation (trend filter possibly active).',
  },
  { id: 'alert1', title: 'S2T Pro [CHE] SWEEP Long (bullish)', message: 'S2T Pro [CHE] – SWEEP LONG (bullish) cleared (T3 rising).' },
  {
    id: 'alert2',
    title: 'S2T Pro [CHE] SELL: Sequence complete',
    message: 'S2T Pro [CHE] – SELL: Bearish sweep → T3↓ → confirmation (trend filter possibly active).',
  },
  { id: 'alert3', title: 'S2T Pro [CHE] SWEEP Short (bearish)', message: 'S2T Pro [CHE] – SWEEP SHORT (bearish) cleared (T3 falling).' },
];

export interface Sweep2TradeProInputs {
  /** T3 length */
  t3Length: number;
  /** T3 volume factor */
  t3VolumeFactor: number;
  /** R² lookback */
  r2Len: number;
  /** R² minimum threshold */
  r2Min: number;
  /** Regime filter active */
  useTrendFilter: boolean;
  /** Max bars for the sequence (timeout) */
  dipWindow: number;
  /** Restart the timeout after the T3 direction */
  extendTimeoutOnPhase2: boolean;
  /** Swing lookback for the sweep (high / low) */
  swingLook: number;
  /** BOS lookback (micro pivot) */
  bosLb: number;
  /** BOS: the wick is sufficient (else a close cross) */
  useWickBOS: boolean;
  /** Require the BOS */
  requireBOS: boolean;
  /** Require a close above / below the T3 */
  needT3Close: boolean;
}

export const defaultInputs: Sweep2TradeProInputs = {
  t3Length: 4,
  t3VolumeFactor: 0.7,
  r2Len: 100,
  r2Min: 0.2,
  useTrendFilter: true,
  dipWindow: 8,
  extendTimeoutOnPhase2: true,
  swingLook: 20,
  bosLb: 5,
  useWickBOS: true,
  requireBOS: true,
  needT3Close: true,
};

export const inputConfig: InputConfig[] = [
  { id: 't3Length', type: 'int', title: 'T3 Length', defval: 4, min: 1, step: 1 },
  { id: 't3VolumeFactor', type: 'float', title: 'T3 Volume Factor', defval: 0.7, min: 0, max: 1, step: 0.1 },
  { id: 'r2Len', type: 'int', title: 'R² Lookback', defval: 100, min: 20 },
  { id: 'r2Min', type: 'float', title: 'R² Minimum Threshold', defval: 0.2, min: 0.0, max: 1.0, step: 0.01 },
  { id: 'useTrendFilter', type: 'bool', title: 'Regime Filter active', defval: true },
  { id: 'dipWindow', type: 'int', title: 'Max bars for sequence (timeout)', defval: 8, min: 1, max: 50 },
  { id: 'extendTimeoutOnPhase2', type: 'bool', title: 'Restart timeout after T3 direction', defval: true },
  { id: 'swingLook', type: 'int', title: 'Swing lookback for sweep (High/Low)', defval: 20, min: 5 },
  { id: 'bosLb', type: 'int', title: 'BOS lookback (micro pivot)', defval: 5, min: 2 },
  { id: 'useWickBOS', type: 'bool', title: 'BOS: Wick is sufficient', defval: true },
  { id: 'requireBOS', type: 'bool', title: 'Require BOS', defval: true },
  { id: 'needT3Close', type: 'bool', title: 'Require close above/below T3', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'S2T T3', color: color.green, lineWidth: 2 },
];

export const metadata = {
  title: 'Sweep2Trade Pro [CHE]',
  shortTitle: 'S2T Pro',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
/** Pine plotshape default text colour */
const PINE_TEXT = '#2962FF';

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Point = { time: number; value: number; color: string };

interface S2tVars {
  phaseL: number;
  phaseS: number;
  timeoutBarL: number;
  timeoutBarS: number;
  prevBull: boolean;
  prevBear: boolean;
}

interface S2tRun extends BarRunState<S2tVars> {
  xe: ReturnType<typeof taStep.ema>[];
  corr: ExactCorrelation;
  lowestStep: ReturnType<typeof taStep.lowest>;
  highestStep: ReturnType<typeof taStep.highest>;
  bosHighStep: ReturnType<typeof taStep.highest>;
  bosLowStep: ReturnType<typeof taStep.lowest>;
  t3: number[];
  lowest: number[];
  highest: number[];
  bosHigh: number[];
  bosLow: number[];
  plot0: Point[];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

/**
 * `math.sum(source, length)` with a constant length, one bar at a time: the exact sum of the window (non-overlapping
 * partials, the value that leaves then the one that enters, rounded once), the operations of the oakscriptjs running
 * sum (same doubles as taStep.sum), the partials kept in typed arrays (no copy of an array per bar).
 */
class ExactSum implements Committable {
  private readonly len: number;
  private readonly values: number[] = [];
  private p = new Float64Array(64);
  private pn = 0;
  private q = new Float64Array(64);
  private qn = 0;
  private last = NaN;
  private next = NaN;
  private pending = NaN;
  private stepped = false;

  constructor(length: number) {
    this.len = Math.floor(length);
  }

  private add(x: number): void {
    const q = this.q;
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
      this.q = grown;
    }
    this.q[i] = x;
    this.qn = i + 1;
  }

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

  /** The sum with `x` on this bar (an na value keeps the previous sum) */
  step(x: number): number {
    const len = this.len;
    this.stepped = len >= 1;
    if (!this.stepped) return NaN;
    if (x === undefined || x === null || !Number.isFinite(x)) {
      this.pending = NaN;
      this.next = this.last;
      return this.last;
    }
    if (this.q.length < this.p.length) this.q = new Float64Array(this.p.length);
    const p = this.p;
    const q = this.q;
    for (let k = 0; k < this.pn; k++) q[k] = p[k]!;
    this.qn = this.pn;
    const count = this.values.length;
    if (count >= len) this.add(-this.values[count - len]!);
    this.add(x);
    this.pending = x;
    this.next = count + 1 >= len ? this.round() : NaN;
    return this.next;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.last = this.next;
    if (Number.isNaN(this.pending)) return;
    this.values.push(this.pending);
    const p = this.p;
    this.p = this.q;
    this.pn = this.qn;
    this.q = p;
  }
}

/**
 * `ta.correlation(a, b, length)` with a constant length from {@link ExactSum}s: the operations of taStep.correlation
 * (covariance sma(a * b) - sma(a) * sma(b) over the square root of the two biased variances; 0 within 1e-10).
 */
class ExactCorrelation implements Committable {
  private readonly len: number;
  private readonly sums: ExactSum[];

  constructor(length: number) {
    // the length checks of ta.correlation (the same errors)
    taStep.correlation(length).step(NaN, NaN);
    this.len = Math.floor(length);
    this.sums = Array.from({ length: 5 }, () => new ExactSum(length));
  }

  step(a: number, b: number): number {
    const [xy, x, y, xx, yy] = this.sums;
    const len = this.len;
    const fin = (v: number) => v !== undefined && v !== null && Number.isFinite(v);
    const sumX = x.step(a);
    const sumY = y.step(b);
    const mxy = xy.step(a * b) / len;
    const cov = mxy - (sumX / len) * (sumY / len);
    const meanX = sumX / len;
    const meanY = sumY / len;
    const vx = xx.step(fin(a) ? a * a : NaN) / len - meanX * meanX;
    const vy = yy.step(fin(b) ? b * b : NaN) / len - meanY * meanY;
    if (Number.isNaN(cov)) return NaN;
    if (Math.abs(cov) <= 1e-10) return 0;
    const denominator = Math.sqrt(vx * vy);
    return denominator === 0 ? NaN : cov / denominator;
  }

  commit(): void {
    for (const s of this.sums) s.commit();
  }
}

function study(inputs: Partial<Sweep2TradeProInputs>): BarStudy<S2tRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.t3Length;
  const c1 = cfg.t3VolumeFactor;
  const c2 = c1 * 3;
  const c3 = c1 * 3;
  const c4 = c1;
  const prev = (a: number[], i: number, k = 1) => (i - k >= 0 ? a[i - k] : NaN);
  return {
    init() {
      const s: S2tRun = {
        xe: Array.from({ length: 6 }, () => taStep.ema(len)), corr: new ExactCorrelation(cfg.r2Len),
        lowestStep: taStep.lowest(), highestStep: taStep.highest(), bosHighStep: taStep.highest(), bosLowStep: taStep.lowest(),
        t3: [], lowest: [], highest: [], bosHigh: [], bosLow: [], plot0: [], markers: [],
        flags: [[], [], [], []], times: [[], [], [], []],
        steps: [], vars: { phaseL: 0, phaseS: 0, timeoutBarL: NaN, timeoutBarS: NaN, prevBull: false, prevBear: false },
        lists: [], series: [],
      };
      s.steps = [...s.xe, s.corr, s.lowestStep, s.highestStep, s.bosHighStep, s.bosLowStep];
      s.lists = [s.markers, ...s.times];
      s.series = [s.t3, s.lowest, s.highest, s.bosHigh, s.bosLow, s.plot0, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      // T3 of hlc3
      const hlc3 = (b.high + b.low + b.close) / 3;
      const xe1 = s.xe[0].step(hlc3);
      const xe2 = s.xe[1].step(xe1);
      const xe3 = s.xe[2].step(xe2);
      const xe4 = s.xe[3].step(xe3);
      const xe5 = s.xe[4].step(xe4);
      const xe6 = s.xe[5].step(xe5);
      const t3 = s.t3;
      t3[i] = xe6 * c4 + xe5 * -c3 + xe4 * c2 + xe3 * -c1 + xe2;
      // r = ta.correlation(close, bar_index, r2Len); the bar_index origin does not change the correlation
      const r = s.corr.step(b.close, i);
      s.lowest[i] = s.lowestStep.step(b.low, cfg.swingLook);
      s.highest[i] = s.highestStep.step(b.high, cfg.swingLook);
      s.bosHigh[i] = s.bosHighStep.step(b.high, cfg.bosLb);
      s.bosLow[i] = s.bosLowStep.step(b.low, cfg.bosLb);
      s.plot0[i] = { time: b.time, value: t3[i], color: lt(t3[i], hlc3) ? color.green : color.red };

      const r2 = Math.pow(r, 2);
      const upChain = gt(t3[i], prev(t3, i)) && gt(prev(t3, i), prev(t3, i, 2)) && gt(prev(t3, i, 2), prev(t3, i, 3));
      const downChain = lt(t3[i], prev(t3, i)) && lt(prev(t3, i), prev(t3, i, 2)) && lt(prev(t3, i, 2), prev(t3, i, 3));
      const trendUp = gt(b.close, t3[i]) && upChain && gt(r2, cfg.r2Min);
      const trendDown = lt(b.close, t3[i]) && downChain && gt(r2, cfg.r2Min);

      // Sweeps
      const priorLowest = prev(s.lowest, i);
      const bullishSweep = lt(b.low, priorLowest) && gt(b.close, priorLowest);
      const newBullish = bullishSweep && !v.prevBull;
      const priorHighest = prev(s.highest, i);
      const bearishSweep = gt(b.high, priorHighest) && lt(b.close, priorHighest);
      const newBearish = bearishSweep && !v.prevBear;
      v.prevBull = bullishSweep;
      v.prevBear = bearishSweep;

      // Confirmation; ta.crossover(close, level): close > level and close[1] <= level[1]; ta.crossunder(close, level):
      // close < level and close[1] >= level[1]; both compare exactly (no 1e-10 tolerance; na compares false). The wick
      // tests are Pine operators (1e-10 tolerance).
      const lvlH = prev(s.bosHigh, i);
      const lvlH1 = prev(s.bosHigh, i, 2);
      const lvlL = prev(s.bosLow, i);
      const lvlL1 = prev(s.bosLow, i, 2);
      const close1 = i > 0 ? bars[i - 1].close : NaN;
      const bosLong = cfg.useWickBOS ? gt(b.high, lvlH) : b.close > lvlH && close1 <= lvlH1;
      const bosShort = cfg.useWickBOS ? lt(b.low, lvlL) : b.close < lvlL && close1 >= lvlL1;
      const bullClose = ge(b.close, b.high - (b.high - b.low) * 0.25);
      const bearClose = le(b.close, b.low + (b.high - b.low) * 0.25);
      const aboveT3 = isNaN(t3[i]) ? true : gt(b.close, t3[i]);
      const belowT3 = isNaN(t3[i]) ? true : lt(b.close, t3[i]);
      const confirmLong = (cfg.requireBOS ? bosLong : true) && bullClose && (cfg.needT3Close ? aboveT3 : true);
      const confirmShort = (cfg.requireBOS ? bosShort : true) && bearClose && (cfg.needT3Close ? belowT3 : true);

      // Event 1: sweep -> phase 1 + timeout (bar_index origin cancels out)
      if (newBullish) {
        v.phaseL = 1;
        v.timeoutBarL = i + cfg.dipWindow;
      }
      if (newBearish) {
        v.phaseS = 1;
        v.timeoutBarS = i + cfg.dipWindow;
      }
      // Timeout
      if (v.phaseL > 0 && !isNaN(v.timeoutBarL) && i > v.timeoutBarL) {
        v.phaseL = 0;
        v.timeoutBarL = NaN;
      }
      if (v.phaseS > 0 && !isNaN(v.timeoutBarS) && i > v.timeoutBarS) {
        v.phaseS = 0;
        v.timeoutBarS = NaN;
      }
      // Event 2 / 3: T3 direction -> phase 2
      const t3Up = gt(t3[i], prev(t3, i));
      const t3Down = lt(t3[i], prev(t3, i));
      const sweepSignalLong = v.phaseL === 1 && t3Up;
      const sweepSignalShort = v.phaseS === 1 && t3Down;
      if (sweepSignalLong) {
        v.phaseL = 2;
        if (cfg.extendTimeoutOnPhase2) v.timeoutBarL = i + cfg.dipWindow;
      }
      if (sweepSignalShort) {
        v.phaseS = 2;
        if (cfg.extendTimeoutOnPhase2) v.timeoutBarS = i + cfg.dipWindow;
      }
      // Event 4: trades
      const buySignal = v.phaseL === 2 && confirmLong && (cfg.useTrendFilter ? trendUp : true);
      const sellSignal = v.phaseS === 2 && confirmShort && (cfg.useTrendFilter ? trendDown : true);
      if (buySignal) {
        v.phaseL = 0;
        v.timeoutBarL = NaN;
      }
      if (sellSignal) {
        v.phaseS = 0;
        v.timeoutBarS = NaN;
      }

      // alertcondition(buySignal) / (sweepSignalLong) / (sellSignal) / (sweepSignalShort)
      const t = b.time;
      s.flags[0][i] = buySignal;
      s.flags[1][i] = sweepSignalLong;
      s.flags[2][i] = sellSignal;
      s.flags[3][i] = sweepSignalShort;
      if (buySignal) s.times[0].push(t as number);
      if (sweepSignalLong) s.times[1].push(t as number);
      if (sellSignal) s.times[2].push(t as number);
      if (sweepSignalShort) s.times[3].push(t as number);

      if (sweepSignalLong) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'xcross', color: color.aqua, text: 'SWEEP L OK',
          textColor: PINE_TEXT, size: 'tiny' });
      }
      if (buySignal) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.lime, text: 'BUY',
          textColor: PINE_TEXT, size: 'small' });
      }
      if (sweepSignalShort) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'xcross', color: color.fuchsia, text: 'SWEEP S OK',
          textColor: PINE_TEXT, size: 'tiny' });
      }
      if (sellSignal) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: color.red, text: 'SELL',
          textColor: PINE_TEXT, size: 'small' });
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<Sweep2TradeProInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<Sweep2TradeProInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const Sweep2TradePro = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
