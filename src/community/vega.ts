/**
 * VEGA Squeeze Pro (Velocity of Efficient Gain Adaptation)
 *
 * The source is the close mixed with its linear regression (linreg_mix). An adaptive moving average (Kaufman style)
 * follows the source with sc = (er * (fast_sc - slow_sc) + slow_sc)^2, er the efficiency ratio over `length` bars.
 * The velocity is the bar change of this average, normalized by the ATR (* 100) or as a z-score over
 * `zscore_length` bars, with a dead zone near zero (snap to 0 or a soft fade). It is drawn as a histogram coloured by
 * its sign and direction; the same colour paints the candles. Squeeze Pro dots on the zero line show whether the
 * Bollinger Bands are inside the Keltner Channel at three widths (low / mid / high compression).
 * Alerts (alertcondition, `alerts` of the result): velocity crossing above / below zero, squeeze started / fired
 * (any compression begins / ends), high squeeze entered / released.
 *
 * Reference: "VEGA (Velocity of Efficient Gain Adaptation)" by B3AR_Trades
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type Committable, type BarStudy, type IndicatorRun } from '../live-run';

export type DeadZoneType = 'Snap' | 'Soft Fade' | 'None';

export interface VegaInputs {
  /** Efficiency ratio length */
  length: number;
  /** Fast smoothing constant */
  fastLength: number;
  /** Slow smoothing constant */
  slowLength: number;
  /** Mix the close with its linear regression */
  useLinreg: boolean;
  linregLen: number;
  /** 0 = regular close, 1 = full linear regression */
  linregMix: number;
  normType: 'ATR' | 'Z-Score';
  atrLength: number;
  atrDeadzoneType: DeadZoneType;
  atrDeadzone: number;
  zscoreLength: number;
  zscoreDeadzoneType: DeadZoneType;
  zscoreDeadzone: number;
  sqzEnabled: boolean;
  bbLength: number;
  bbMult: number;
  kcLength: number;
  kcMultHigh: number;
  kcMultMid: number;
  kcMultLow: number;
  sqzOffColor: string;
  sqzLowColor: string;
  sqzMidColor: string;
  sqzHighColor: string;
  colorCandles: boolean;
  bullStrong: string;
  bullWeak: string;
  bearStrong: string;
  bearWeak: string;
}

export const defaultInputs: VegaInputs = {
  length: 40,
  fastLength: 3,
  slowLength: 30,
  useLinreg: true,
  linregLen: 7,
  linregMix: 0.5,
  normType: 'Z-Score',
  atrLength: 14,
  atrDeadzoneType: 'Soft Fade',
  atrDeadzone: 5.0,
  zscoreLength: 20,
  zscoreDeadzoneType: 'Soft Fade',
  zscoreDeadzone: 0.5,
  sqzEnabled: true,
  bbLength: 20,
  bbMult: 2.0,
  kcLength: 20,
  kcMultHigh: 1.5,
  kcMultMid: 1.0,
  kcMultLow: 0.5,
  sqzOffColor: '#00FFFF00',
  sqzLowColor: '#00C3FF',
  sqzMidColor: '#E5FF00',
  sqzHighColor: '#FF0000',
  colorCandles: true,
  bullStrong: '#00FFFF',
  bullWeak: '#00FFFF99',
  bearStrong: '#FF0000',
  bearWeak: '#FF000099',
};

const DZ_OPTIONS = ['Snap', 'Soft Fade', 'None'];
const G_AMA = 'Adaptive MA Settings';
const G_SRC = 'Source Settings';
const G_NORM = 'Normalization';
const G_SQZ = 'Squeeze Pro Settings';
const G_VIS = 'Visual Settings';

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'ER Length', defval: 40, min: 2, group: G_AMA },
  { id: 'fastLength', type: 'int', title: 'Fast Smoothing', defval: 3, min: 1, group: G_AMA },
  { id: 'slowLength', type: 'int', title: 'Slow Smoothing', defval: 30, min: 1, group: G_AMA },
  { id: 'useLinreg', type: 'bool', title: 'Use LinReg Smoothed Candles', defval: true, group: G_SRC },
  { id: 'linregLen', type: 'int', title: 'LinReg Length', defval: 7, min: 2, group: G_SRC },
  { id: 'linregMix', type: 'float', title: 'LinReg Mix', defval: 0.5, min: 0.0, max: 1.0, step: 0.1, group: G_SRC },
  { id: 'normType', type: 'string', title: 'Normalization', defval: 'Z-Score', options: ['ATR', 'Z-Score'], group: G_NORM },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14, min: 1, group: G_NORM },
  { id: 'atrDeadzoneType', type: 'string', title: 'ATR Dead Zone Type', defval: 'Soft Fade', options: DZ_OPTIONS, group: G_NORM },
  { id: 'atrDeadzone', type: 'float', title: 'ATR Dead Zone', defval: 5.0, min: 0.0, max: 50.0, step: 0.5, group: G_NORM },
  { id: 'zscoreLength', type: 'int', title: 'Z-Score Lookback', defval: 20, min: 2, group: G_NORM },
  { id: 'zscoreDeadzoneType', type: 'string', title: 'Z-Score Dead Zone Type', defval: 'Soft Fade', options: DZ_OPTIONS, group: G_NORM },
  { id: 'zscoreDeadzone', type: 'float', title: 'Z-Score Dead Zone', defval: 0.5, min: 0.0, max: 2.0, step: 0.1, group: G_NORM },
  { id: 'sqzEnabled', type: 'bool', title: 'Enable Squeeze Detection', defval: true, group: G_SQZ },
  { id: 'bbLength', type: 'int', title: 'BB Length', defval: 20, min: 1, group: G_SQZ },
  { id: 'bbMult', type: 'float', title: 'BB Multiplier', defval: 2.0, min: 0.1, step: 0.1, group: G_SQZ },
  { id: 'kcLength', type: 'int', title: 'KC Length', defval: 20, min: 1, group: G_SQZ },
  { id: 'kcMultHigh', type: 'float', title: 'KC High Multiplier', defval: 1.5, min: 0.1, step: 0.1, group: G_SQZ },
  { id: 'kcMultMid', type: 'float', title: 'KC Mid Multiplier', defval: 1.0, min: 0.1, step: 0.1, group: G_SQZ },
  { id: 'kcMultLow', type: 'float', title: 'KC Low Multiplier', defval: 0.5, min: 0.1, step: 0.1, group: G_SQZ },
  { id: 'sqzOffColor', type: 'color', title: 'No Squeeze', defval: '#00FFFF00', group: G_SQZ },
  { id: 'sqzLowColor', type: 'color', title: 'Low Squeeze', defval: '#00C3FF', group: G_SQZ },
  { id: 'sqzMidColor', type: 'color', title: 'Mid Squeeze', defval: '#E5FF00', group: G_SQZ },
  { id: 'sqzHighColor', type: 'color', title: 'High Squeeze', defval: '#FF0000', group: G_SQZ },
  { id: 'colorCandles', type: 'bool', title: 'Color Main Chart Candles', defval: true, group: G_VIS },
  { id: 'bullStrong', type: 'color', title: 'Bullish Rising', defval: '#00FFFF', group: G_VIS },
  { id: 'bullWeak', type: 'color', title: 'Bullish Falling', defval: '#00FFFF99', group: G_VIS },
  { id: 'bearStrong', type: 'color', title: 'Bearish Falling', defval: '#FF0000', group: G_VIS },
  { id: 'bearWeak', type: 'color', title: 'Bearish Rising', defval: '#FF000099', group: G_VIS },
];

const BAND_COL = String(color.new(color.red, 70));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Upper Band +2σ', color: BAND_COL, lineWidth: 1, linestyle: 'dashed' },
  { id: 'plot1', title: 'Lower Band -2σ', color: BAND_COL, lineWidth: 1, linestyle: 'dashed' },
  { id: 'plot2', title: 'VEGA', color: '#00FFFF', lineWidth: 4, style: 'histogram' },
  { id: 'plot3', title: 'Squeeze Pro', color: '#00FFFF00', lineWidth: 4, style: 'circles' },
];

export const metadata = {
  title: 'VEGA Squeeze Pro',
  shortTitle: 'VEGA Pro',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
/** Pine `x != 0`: false when x is na */
const ne0 = (x: number) => !isNaN(x) && Math.abs(x) > EPS;
const nz = (x: number) => (isNaN(x) ? 0 : x);

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

type Result = IndicatorResult & { barColors: BarColorData[] } & { alerts: AlertConditionState[] };

interface VegaRun extends BarRunState<Record<string, never>> {
  linreg: ReturnType<typeof taStep.linreg>;
  volatility: WindowSum;
  atr: ReturnType<typeof taStep.atr>;
  velMean: WindowSma;
  velStdev: WindowStdev;
  bbBasis: WindowSma;
  bbStdev: WindowStdev;
  kcBasis: WindowSma;
  kcRange: ReturnType<typeof taStep.atr>;
  src: number[];
  ama: number[];
  velocity: number[];
  sqzState: number[];
  plots: Array<Array<{ time: number; value: number; color?: string }>>;
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<VegaInputs>): BarStudy<VegaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const fastSc = 2.0 / (cfg.fastLength + 1);
  const slowSc = 2.0 / (cfg.slowLength + 1);
  const zscore = cfg.normType === 'Z-Score';
  const zone = cfg.normType === 'ATR' ? cfg.atrDeadzone : cfg.zscoreDeadzone;
  const dzType = cfg.normType === 'ATR' ? cfg.atrDeadzoneType : cfg.zscoreDeadzoneType;
  return {
    init() {
      const s: VegaRun = {
        linreg: taStep.linreg(cfg.linregLen, 0), volatility: new WindowSum(cfg.length), atr: taStep.atr(cfg.atrLength),
        velMean: new WindowSma(cfg.zscoreLength), velStdev: new WindowStdev(cfg.zscoreLength),
        bbBasis: new WindowSma(cfg.bbLength), bbStdev: new WindowStdev(cfg.bbLength), kcBasis: new WindowSma(cfg.kcLength), kcRange: taStep.atr(cfg.kcLength),
        src: [], ama: [], velocity: [], sqzState: [], plots: [[], [], [], []], barColors: [],
        flags: [0, 1, 2, 3, 4, 5].map(() => []), times: [0, 1, 2, 3, 4, 5].map(() => []),
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.linreg, s.volatility, s.atr, s.velMean, s.velStdev, s.bbBasis, s.bbStdev, s.kcBasis, s.kcRange];
      s.lists = [s.barColors, ...s.times];
      s.series = [s.src, s.ama, s.velocity, s.sqzState, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const t = bar.time as number;
      const c = bar.close;
      const { src, ama } = s;
      // src = use_linreg ? close * (1 - linreg_mix) + ta.linreg(close, linreg_len, 0) * linreg_mix : close
      const linregClose = s.linreg.step(c);
      const sv = cfg.useLinreg ? c * (1 - cfg.linregMix) + linregClose * cfg.linregMix : c;
      src[i] = sv;

      // Efficiency ratio: abs(src - src[length]) / math.sum(abs(src - src[1]), length)
      const volatility = s.volatility.step(i > 0 ? Math.abs(sv - src[i - 1]) : NaN);
      const changeAbs = i >= cfg.length ? Math.abs(sv - src[i - cfg.length]) : NaN;
      // er = volatility != 0 ? change_abs / volatility : 0 (na != 0 is false)
      const er = ne0(volatility) ? changeAbs / volatility : 0;
      const sc = Math.pow(er * (fastSc - slowSc) + slowSc, 2);
      const prev = i > 0 ? ama[i - 1] : NaN;
      // adaptive_ma := na(adaptive_ma[1]) ? src : sc * src + (1 - sc) * adaptive_ma[1]
      const a = isNaN(prev) ? sv : sc * sv + (1 - sc) * prev;
      ama[i] = a;

      // velocity_raw = adaptive_ma - nz(adaptive_ma[1])
      const velocityRaw = a - nz(prev);
      const atrVal = s.atr.step(bar.high, bar.low, c);
      const velocityMean = s.velMean.step(velocityRaw);
      const velocityStdev = s.velStdev.step(velocityRaw);
      let norm: number;
      if (cfg.normType === 'ATR') norm = ne0(atrVal) ? (velocityRaw / atrVal) * 100 : velocityRaw;
      else norm = ne0(velocityStdev) ? (velocityRaw - velocityMean) / velocityStdev : 0;
      // Dead zone
      let velocity = norm;
      if (dzType === 'Snap') {
        velocity = lt(Math.abs(norm), zone) ? 0.0 : norm;
      } else if (dzType === 'Soft Fade') {
        if (lt(Math.abs(norm), zone)) velocity = norm * (Math.abs(norm) / zone);
      }
      s.velocity[i] = velocity;

      // Squeeze Pro: Bollinger Bands inside the Keltner Channel at three widths
      const bbBasis = s.bbBasis.step(c);
      const bbStdev = s.bbStdev.step(c);
      const kcBasis = s.kcBasis.step(c);
      const kcRange = s.kcRange.step(bar.high, bar.low, c);
      const bbDev = cfg.bbMult * bbStdev;
      const bbUpper = bbBasis + bbDev;
      const bbLower = bbBasis - bbDev;
      const inKc = (mult: number) => gt(bbLower, kcBasis - mult * kcRange) && lt(bbUpper, kcBasis + mult * kcRange);
      const state = inKc(cfg.kcMultLow) ? 3 : inKc(cfg.kcMultMid) ? 2 : inKc(cfg.kcMultHigh) ? 1 : 0;
      s.sqzState[i] = state;
      const sqzColor = state === 3 ? cfg.sqzHighColor : state === 2 ? cfg.sqzMidColor : state === 1 ? cfg.sqzLowColor : cfg.sqzOffColor;

      // velocity_rising = velocity > nz(velocity[1])
      const prevVel = i > 0 ? s.velocity[i - 1] : NaN;
      const rising = gt(velocity, nz(prevVel));
      const histColor = ge(velocity, 0)
        ? (rising ? cfg.bullStrong : cfg.bullWeak)
        : (rising ? cfg.bearWeak : cfg.bearStrong);
      const p = s.plots;
      p[0][i] = { time: t, value: zscore ? 2.0 : NaN };
      p[1][i] = { time: t, value: zscore ? -2.0 : NaN };
      p[2][i] = { time: t, value: Number.isFinite(velocity) ? velocity : NaN, color: histColor };
      p[3][i] = { time: t, value: cfg.sqzEnabled ? 0.0 : NaN, color: sqzColor };
      // barcolor(color_candles ? hist_color : na, title = "Candle Colors")
      if (cfg.colorCandles) s.barColors.push({ time: t, color: histColor });

      // alertcondition(ta.crossover(velocity, 0)) / (ta.crossunder(velocity, 0)) and the squeeze state changes
      // (sqz_state[1] on the first bar is na: its comparisons are false)
      const ps = i > 0 ? s.sqzState[i - 1] : NaN;
      const f = s.flags;
      f[0][i] = velocity > 0 && prevVel <= 0;
      f[1][i] = velocity < 0 && prevVel >= 0;
      f[2][i] = i > 0 && ps === 0 && state > 0;
      f[3][i] = i > 0 && ps > 0 && state === 0;
      f[4][i] = i > 0 && state === 3 && ps !== 3;
      f[5][i] = i > 0 && ps === 3 && state < 3;
      for (let k = 0; k < 6; k++) if (f[k][i]) s.times[k].push(t);
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice() },
        hlines: [{ value: 0, options: { title: 'Zero', color: String(color.new(color.gray, 50)), linestyle: 'dotted' } }],
        barColors: s.barColors.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VegaInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VegaInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bullish Zero Cross', message: 'VEGA crossed above zero' },
  { id: 'alert1', title: 'Bearish Zero Cross', message: 'VEGA crossed below zero' },
  { id: 'alert2', title: 'Squeeze Started', message: 'VEGA squeeze started' },
  { id: 'alert3', title: 'Squeeze Fired', message: 'VEGA squeeze fired (volatility expanding)' },
  { id: 'alert4', title: 'High Squeeze', message: 'VEGA entered high compression squeeze' },
  { id: 'alert5', title: 'High Squeeze Released', message: 'VEGA high compression squeeze releasing' },
];

export const Vega = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
