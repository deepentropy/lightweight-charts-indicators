/**
 * Adaptive ALMA 2.0
 *
 * An ALMA whose window, offset and sigma follow the efficiency ratio of the source (net change over `maxLen` bars
 * divided by the volume-weighted sum of the absolute changes): short window, high offset and low sigma in efficient
 * trends; long window and more smoothing in noise. The candles can be replaced by Heikin-Ashi values (unless the
 * chart candles are already Heikin-Ashi). The source is chosen among price mixes (default (o + 2h + 2l + 2c) / 7).
 * A Garman-Klass volatility engine (ALMAs of the GK volatility of lengths 2..10 interpolated by the efficiency, over
 * a slow ALMA of 160 bars) and a tanh scale of its z-score set a threshold: the trend turns up when the ALMA rises
 * by more than the threshold with the close above it, down when it falls by more than the threshold with the close
 * below it (triangle signals on the turns, shifted by `sigOffset` bars). Medium and long ALMAs, a noise band around
 * the adaptive ALMA (filled aqua while the close is inside) and ALMA Bollinger Bands with circle signals on the
 * crosses of the source with the bands.
 *
 * Reference: "Adaptive ALMA" by Zomzi
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import { barInterval, barTime } from '../bar-time';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export type AdaptiveAlmaSourceType = 'Close' | 'HL2' | 'HLC3' | 'OHLC4' | 'OCC3' | 'HLCC4' | 'Custom';

export interface AdaptiveAlma20Inputs {
  /** Source mix of the (Heikin-Ashi) candle */
  srcType: AdaptiveAlmaSourceType;
  /** Use Heikin-Ashi values (when the chart candles are not Heikin-Ashi) */
  useHa: boolean;
  /** Minimum ALMA window */
  minLen: number;
  /** Maximum ALMA window (also the efficiency ratio length) */
  maxLen: number;
  /** Show the medium and long ALMAs */
  showExtra: boolean;
  medLen: number;
  medOff: number;
  medSig: number;
  longLen: number;
  longOff: number;
  longSig: number;
  minOff: number;
  maxOff: number;
  minSig: number;
  maxSig: number;
  /** Length of the slow GK volatility (VWMA) */
  atrSlowLen: number;
  /** Threshold sensitivity */
  atrMasterMult: number;
  /** Bar shift of the signal shapes */
  sigOffset: number;
  showBb: boolean;
  bbLen: number;
  bbOffset: number;
  bbSigma: number;
  bbMult: number;
}

export const defaultInputs: AdaptiveAlma20Inputs = {
  srcType: 'Custom',
  useHa: true,
  minLen: 3,
  maxLen: 21,
  showExtra: true,
  medLen: 32,
  medOff: 0.8,
  medSig: 5.0,
  longLen: 128,
  longOff: 0.8,
  longSig: 5.0,
  minOff: 0.81,
  maxOff: 1.0,
  minSig: 2.6,
  maxSig: 6.9,
  atrSlowLen: 160,
  atrMasterMult: 0.645,
  sigOffset: -1,
  showBb: true,
  bbLen: 20,
  bbOffset: 0.8,
  bbSigma: 1.0,
  bbMult: 2.0,
};

const G_SRC = 'Source Settings';
const G_ALMA = 'ALMA Adaptation';
const G_EXTRA = 'Additional ALMA Averages';
const G_OPT = 'Sigma/Offset Dynamics';
const G_EV = 'Global Evasion Engine (Autonomic Gaussian)';
const G_SHIFT = 'Signal Shift';
const G_BB = 'BB-ALMA Settings';

export const inputConfig: InputConfig[] = [
  { id: 'srcType', type: 'string', title: 'Source Type', defval: 'Custom', options: ['Close', 'HL2', 'HLC3', 'OHLC4', 'OCC3', 'HLCC4', 'Custom'], group: G_SRC },
  { id: 'useHa', type: 'bool', title: 'Force Heikin-Ashi Calculations', defval: true, group: G_SRC,
    tooltip: 'When ON, the Heikin-Ashi values are computed and used also on regular candles. When OFF, each candle type uses its own values.' },
  { id: 'minLen', type: 'int', title: 'Min. Length', defval: 3, min: 1, group: G_ALMA,
    tooltip: 'Minimum window size for ALMA. Used during high-efficiency trend phases to reduce lag.' },
  { id: 'maxLen', type: 'int', title: 'Max. Length', defval: 21, max: 100, group: G_ALMA,
    tooltip: 'Maximum window size for ALMA. Used during low-efficiency or noisy phases to increase smoothing.' },
  { id: 'showExtra', type: 'bool', title: 'Show Medium & Long ALMAs', defval: true, group: G_EXTRA },
  { id: 'medLen', type: 'int', title: 'Medium Length', defval: 32, min: 1, group: G_EXTRA },
  { id: 'medOff', type: 'float', title: 'Medium Offset', defval: 0.8, step: 0.025, group: G_EXTRA },
  { id: 'medSig', type: 'float', title: 'Medium Sigma', defval: 5.0, step: 0.25, group: G_EXTRA },
  { id: 'longLen', type: 'int', title: 'Long Length', defval: 128, min: 1, group: G_EXTRA },
  { id: 'longOff', type: 'float', title: 'Long Offset', defval: 0.8, step: 0.025, group: G_EXTRA },
  { id: 'longSig', type: 'float', title: 'Long Sigma', defval: 5.0, step: 0.25, group: G_EXTRA },
  { id: 'minOff', type: 'float', title: 'Min. Offset', defval: 0.81, min: 0.0, max: 1.0, step: 0.005, group: G_OPT },
  { id: 'maxOff', type: 'float', title: 'Max. Offset', defval: 1.0, min: 0.0, max: 1.0, step: 0.005, group: G_OPT },
  { id: 'minSig', type: 'float', title: 'Min. Sigma', defval: 2.6, min: 0.25, step: 0.05, group: G_OPT },
  { id: 'maxSig', type: 'float', title: 'Max. Sigma', defval: 6.9, min: 0.5, step: 0.05, group: G_OPT },
  { id: 'atrSlowLen', type: 'int', title: 'Slow GK Volatility (Background)', defval: 160, min: 10, group: G_EV },
  { id: 'atrMasterMult', type: 'float', title: 'Sensitivity', defval: 0.645, min: 0.1, step: 0.005, group: G_EV },
  { id: 'sigOffset', type: 'int', title: 'Arrows Offset (Shift)', defval: -1, min: -10, max: 10, group: G_SHIFT },
  { id: 'showBb', type: 'bool', title: 'Show Bollinger Bands', defval: true, group: G_BB },
  { id: 'bbLen', type: 'int', title: 'BB Length', defval: 20, min: 1, group: G_BB },
  { id: 'bbOffset', type: 'float', title: 'BB ALMA Offset', defval: 0.8, min: 0, max: 1, step: 0.01, group: G_BB },
  { id: 'bbSigma', type: 'float', title: 'BB ALMA Sigma', defval: 1.0, min: 0, group: G_BB },
  { id: 'bbMult', type: 'float', title: 'BB Multiplier', defval: 2.0, min: 0.1, step: 0.1, group: G_BB },
];

const SRC_COL = String(color.new(color.white, 70));
const NOISE_COL = String(color.new(color.gray, 85));
const BASIS_COL = String(color.new(color.gray, 50));
const BAND_COL = String(color.new(color.teal, 50));
const UP_COL = '#3AFF17';
const DOWN_COL = '#FD1707';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Source Line', color: SRC_COL, lineWidth: 1 },
  { id: 'plot1', title: 'Adaptive ALMA', color: color.gray, lineWidth: 3 },
  { id: 'plot2', title: 'Medium ALMA', color: '#00ff08', lineWidth: 2 },
  { id: 'plot3', title: 'Long ALMA', color: '#2196F3', lineWidth: 2 },
  { id: 'plot4', title: 'Noise Upper Band', color: NOISE_COL, lineWidth: 1 },
  { id: 'plot5', title: 'Noise Lower Band', color: NOISE_COL, lineWidth: 1 },
  { id: 'plot6', title: 'BB Basis', color: BASIS_COL, lineWidth: 1 },
  { id: 'plot7', title: 'BB Upper Band', color: BAND_COL, lineWidth: 1 },
  { id: 'plot8', title: 'BB Lower Band', color: BAND_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'Adaptive ALMA',
  shortTitle: 'Adaptive ALMA',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const nz = (x: number, y = 0) => (Number.isFinite(x) ? x : y);
/** Pine math.max / math.min: na when an argument is na */
const max = (a: number, b: number) => Math.max(a, b);
const min = (a: number, b: number) => Math.min(a, b);
/** Non-finite values are na for the averages and the plots */
const fin = (x: number) => (Number.isFinite(x) ? x : NaN);

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

/** `ta.stdev(source, length)` (biased) with a constant length from two {@link ExactSum} (the operations of taStep.stdev) */
class ExactStdev implements Committable {
  private readonly len: number;
  private readonly sums: ExactSum;
  private readonly squares: ExactSum;

  constructor(length: number) {
    this.len = Math.floor(length);
    this.sums = new ExactSum(length);
    this.squares = new ExactSum(length);
  }

  step(value: number): number {
    const len = this.len;
    const sum = this.sums.step(value);
    const sq = this.squares.step(value === undefined || value === null || !Number.isFinite(value) ? NaN : value * value);
    if (len <= 0) return NaN;
    const mean = sum / len;
    const v = sq / len - mean * mean;
    return Number.isNaN(v) ? NaN : v > 0 ? Math.sqrt(v) : 0;
  }

  commit(): void {
    this.sums.commit();
    this.squares.commit();
  }
}

/** `ta.alma(source, length, offset, sigma)` weights (normalised), computed as the oakscriptjs function does */
function almaWeights(length: number, offset: number, sigma: number): number[] {
  const m = offset * (length - 1);
  const s = length / sigma;
  const weights: number[] = [];
  let weightSum = 0;
  for (let i = 0; i < length; i++) {
    const weight = Math.exp(-1 * Math.pow(i - m, 2) / (2 * Math.pow(s, 2)));
    weights.push(weight);
    weightSum += weight;
  }
  for (let i = 0; i < length; i++) weights[i] /= weightSum;
  return weights;
}

/** `ta.alma` on bar `i` of the per-bar values `a` (the same operations, in the same order, as the array function) */
function almaAt(a: readonly number[], i: number, weights: readonly number[]): number {
  const length = weights.length;
  if (i < length - 1) return NaN;
  let almaValue = 0;
  for (let j = 0; j < length; j++) almaValue += a[i - length + 1 + j] * weights[j];
  return almaValue;
}

/** `ta.vwma(source, length)`: sma(source * volume) / sma(volume) with {@link ExactSum} (the operations of taStep.vwma) */
class ExactVwma implements Committable {
  private readonly len: number;
  private readonly numerator: ExactSum;
  private readonly denominator: ExactSum;

  constructor(length: number) {
    this.len = Math.floor(length);
    this.numerator = new ExactSum(length);
    this.denominator = new ExactSum(length);
  }

  step(value: number, volume: number): number {
    const num = this.numerator.step(value * volume) / this.len;
    const den = this.denominator.step(volume) / this.len;
    return den === 0 || Number.isNaN(den) ? NaN : num / den;
  }

  commit(): void {
    this.numerator.commit();
    this.denominator.commit();
  }
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface AlmaVars {
  /** var bool is_native_ha = true */
  isNativeHa: boolean;
  /** var float ha_open = na */
  haOpen: number;
  prevHaClose: number;
  /** var int trend_state = 0 */
  trendState: number;
  /** histories of the ta.change calls that do not run on every bar (lazy `or` / `and`, `else if` condition) */
  prevCloseAtCall: number;
  prevVolumeAtCall: number;
  prevAlmaAtElse: number;
  /** the last bar where both values of each ta.crossover / ta.crossunder were not na */
  pS1: number;
  pL: number;
  pS2: number;
  pU: number;
}

interface AlmaRun extends BarRunState<AlmaVars> {
  vwChange: ExactVwma;
  baseAtrEv: ExactVwma;
  vrSd: ExactStdev;
  bbSd: ExactStdev;
  src: number[];
  cGk: number[];
  hl: number[];
  volRatio: number[];
  currentAlma: number[];
  almaMedium: number[];
  almaLong: number[];
  plots: Point[][];
  noisyColors: string[];
  /** The shapes: bar index * 4 + kind (buy, sell, BB crossover, BB crossunder), in the order of the original */
  events: number[];
}

function study(inputs: Partial<AdaptiveAlma20Inputs>): BarStudy<AlmaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { minLen, maxLen } = cfg;
  const wMed = almaWeights(cfg.medLen, cfg.medOff, cfg.medSig);
  const wLong = almaWeights(cfg.longLen, cfg.longOff, cfg.longSig);
  const wGk: number[][] = [];
  for (let len = 2; len <= 10; len++) wGk[len] = almaWeights(len, 0.8, 5);
  const w160 = almaWeights(160, 0.8, 5);
  const w5 = almaWeights(5, 0.8, 5);
  const wBb = almaWeights(cfg.bbLen, cfg.bbOffset, cfg.bbSigma);
  const gk: number[] = [];
  const noisyCol = String(color.new(color.aqua, 92));
  const quietCol = String(color.new(color.gray, 97));
  const bbFillCol = String(color.new(color.teal, cfg.showBb ? 95 : 100));

  return {
    init() {
      // the length checks of ta.vwma / ta.alma / ta.stdev
      for (const [name, len] of [['vwma->sma', maxLen], ['alma', cfg.medLen], ['alma', cfg.longLen], ['alma', cfg.bbLen], ['vwma->sma', cfg.atrSlowLen]] as const) {
        if (Math.trunc(len) <= 0) throw new Error(`Invalid value of the 'length' argument (${Math.trunc(len)}) in the '${name}' function`);
      }
      const s: AlmaRun = {
        vwChange: new ExactVwma(maxLen), baseAtrEv: new ExactVwma(cfg.atrSlowLen), vrSd: new ExactStdev(160),
        bbSd: new ExactStdev(cfg.bbLen),
        src: [], cGk: [], hl: [], volRatio: [], currentAlma: [], almaMedium: [], almaLong: [],
        plots: Array.from({ length: 9 }, () => []), noisyColors: [], events: [],
        steps: [],
        vars: {
          isNativeHa: true, haOpen: NaN, prevHaClose: NaN, trendState: 0, prevCloseAtCall: NaN, prevVolumeAtCall: NaN,
          prevAlmaAtElse: NaN, pS1: NaN, pL: NaN, pS2: NaN, pU: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [s.vwChange, s.baseAtrEv, s.vrSd, s.bbSd];
      s.lists = [s.events];
      s.series = [s.src, s.cGk, s.hl, s.volRatio, s.currentAlma, s.almaMedium, s.almaLong, ...s.plots, s.noisyColors];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const volume = b.volume ?? NaN;
      // Candles: Heikin-Ashi values unless the chart candles already follow the Heikin-Ashi open
      if (i > 0) {
        const p = bars[i - 1];
        if (gt(Math.abs(b.open - (p.open + p.close) / 2), 0.0001)) v.isNativeHa = false;
      }
      const applyHa = cfg.useHa && !v.isNativeHa;
      const haClose = (b.open + b.high + b.low + b.close) / 4;
      v.haOpen = isNaN(v.haOpen) ? (b.open + b.close) / 2 : (nz(v.haOpen) + nz(v.prevHaClose)) / 2;
      v.prevHaClose = haClose;
      const haOpen = v.haOpen;
      const haHigh = Math.max(b.high, Math.max(haOpen, haClose));
      const haLow = Math.min(b.low, Math.min(haOpen, haClose));
      const o = applyHa ? haOpen : b.open;
      const h = applyHa ? haHigh : b.high;
      const l = applyHa ? haLow : b.low;
      const c = applyHa ? haClose : b.close;
      let x: number;
      switch (cfg.srcType) {
        case 'Close': x = c; break;
        case 'HL2': x = (h + l) / 2; break;
        case 'HLC3': x = (h + l + c) / 3; break;
        case 'OHLC4': x = (o + h + l + c) / 4; break;
        case 'HLCC4': x = (h + l + 2 * c) / 4; break;
        case 'OCC3': x = (o + 2 * c) / 3; break;
        default: x = (o + 2 * h + 2 * l + 2 * c) / 7;
      }
      const src = s.src;
      src[i] = x;

      // Efficiency ratio and the adaptive ALMA
      const absChange = i > 0 ? Math.abs(x - src[i - 1]) : NaN;
      const vwChange = s.vwChange.step(absChange, volume);
      const changeNet = Math.abs(x - nz(i - maxLen >= 0 ? src[i - maxLen] : NaN, x));
      const sumVol = max(vwChange * maxLen, 1e-6);
      const e = max(0.0, min(1.0, changeNet / sumVol));
      const currLen = Math.trunc(Math.round(max(minLen, min(maxLen, maxLen - e * (maxLen - minLen)))));
      const currOff = max(cfg.minOff, min(cfg.maxOff, cfg.minOff + e * (cfg.maxOff - cfg.minOff)));
      const currSig = max(cfg.minSig, min(cfg.maxSig, cfg.maxSig - e * (cfg.maxSig - cfg.minSig)));
      // f_alma_dynamic: an na window length runs no loop iteration (0 / 1e-10 = 0)
      const len = max(2, currLen);
      const m = (1.0 - currOff) * (len - 1);
      const sg = len / currSig;
      const s2 = 2 * (sg * sg);
      let av = 0.0;
      let aw = 0.0;
      for (let k = 0; k <= len - 1; k++) {
        const diff = k - m;
        const weight = Math.exp(-(diff * diff) / s2);
        av += nz(i - k >= 0 ? src[i - k] : NaN) * weight;
        aw += weight;
      }
      const ca = av / Math.max(aw, 1e-10);
      s.currentAlma[i] = ca;

      const almaMedium = almaAt(src, i, wMed);
      const almaLong = almaAt(src, i, wLong);
      s.almaMedium[i] = almaMedium;
      s.almaLong[i] = almaLong;

      // Garman-Klass volatility engine
      const logHl = Math.log(Math.max(h, 1e-10) / Math.max(l, 1e-10));
      const logCc = Math.log(Math.max(c, 1e-10) / Math.max(o, 1e-10));
      const gkVariance = 0.5 * Math.pow(logHl, 2) - (2 * Math.log(2) - 1) * Math.pow(logCc, 2);
      s.cGk[i] = Math.sqrt(Math.max(0.0, gkVariance)) * c;
      for (let gl = 2; gl <= 10; gl++) gk[gl] = almaAt(s.cGk, i, wGk[gl]);
      const gkSlow = almaAt(s.cGk, i, w160);

      const idx = 10.0 - e * 8.0;
      const intIdx = Math.trunc(Math.floor(max(2.0, min(9.0, idx))));
      const weight = max(0.0, min(1.0, idx - intIdx));
      // na int_idx: no case matches, the last branch (gk9 / gk10) is taken
      const lowIdx = intIdx >= 2 && intIdx <= 8 ? intIdx : 9;
      const vLow = gk[lowIdx];
      const vHigh = gk[lowIdx + 1];
      const atrFast = nz(vLow + weight * (vHigh - vLow), gk[2]);
      const vr = nz(atrFast / max(gkSlow, 1e-10), 1.0);
      s.volRatio[i] = vr;
      const vrMean = almaAt(s.volRatio, i, w160);
      const sd = s.vrSd.step(vr);
      s.hl[i] = h - l;
      const almaHl = almaAt(s.hl, i, w5);
      const base = s.baseAtrEv.step(s.cGk[i], volume);

      const z = eq(sd, 0) ? 0.0 : (vr - vrMean) / sd;
      const ax = Math.abs(z) / 2.0;
      const ex = Math.exp(ax);
      const enx = Math.exp(-ax);
      const vrGaussScaled = max(0.0, min(1.0, (ex - enx) / max(ex + enx, 1e-10)));

      // is_frozen = ta.alma(c_high - c_low, 5, 0.8, 5) == 0 or (ta.change(c_close) == 0 and ta.change(volume) == 0)
      let isFrozen = eq(almaHl, 0);
      if (!isFrozen) {
        const chClose = c - v.prevCloseAtCall;
        v.prevCloseAtCall = c;
        if (eq(chClose, 0)) {
          const chVolume = volume - v.prevVolumeAtCall;
          v.prevVolumeAtCall = volume;
          isFrozen = eq(chVolume, 0);
        }
      }
      const finalGaussScale = isFrozen ? 0.0 : vrGaussScaled;

      const visualNoiseTh = base * (0.3 + 20.0 * vr * 0.008);
      const fSample = max(10.0, min(50.0, 20.0 * vr));
      const autoAtrM = 0.015 + Math.pow(fSample, 0.95) * 0.0018;
      const noiseLimit = base * (0.3 + fSample * 0.008);
      const distToMean = Math.abs(c - ca);
      const adaptAlpha = lt(distToMean, noiseLimit)
        ? max(0.015, 0.2 - fSample * 0.003) * (1.0 - distToMean / noiseLimit) : 0.0;
      const baseThreshold = (autoAtrM + adaptAlpha) * (1.0 + finalGaussScale);
      const dAtr = nz(base * baseThreshold * cfg.atrMasterMult);
      const isNoisyVis = lt(Math.abs(c - ca), visualNoiseTh);

      const prevTrend = v.trendState;
      const ch1 = i > 0 ? ca - s.currentAlma[i - 1] : NaN;
      if (gt(ch1, dAtr) && gt(c, ca)) {
        v.trendState = 1;
      } else {
        const ch2 = ca - v.prevAlmaAtElse;
        v.prevAlmaAtElse = ca;
        if (lt(ch2, -dAtr) && lt(c, ca)) v.trendState = -1;
      }
      const trend = v.trendState;
      const buy = trend === 1 && prevTrend !== 1;
      const sell = trend === -1 && prevTrend !== -1;

      // ALMA Bollinger Bands
      const bbBasis = almaAt(src, i, wBb);
      const bbSd = s.bbSd.step(x);
      const bbUpper = bbBasis + cfg.bbMult * bbSd;
      const bbLower = bbBasis - cfg.bbMult * bbSd;
      // ta.crossover / ta.crossunder: compared with the last bar where both values were not na; a tie there counts.
      // The comparisons are exact (no 1e-10 tolerance).
      const crossover = x > bbLower && v.pS1 <= v.pL;
      const crossunder = x < bbUpper && v.pS2 >= v.pU;
      if (!isNaN(x) && !isNaN(bbLower)) {
        v.pS1 = x;
        v.pL = bbLower;
      }
      if (!isNaN(x) && !isNaN(bbUpper)) {
        v.pS2 = x;
        v.pU = bbUpper;
      }

      const t = b.time;
      const p = s.plots;
      const medUp = i > 0 && gt(almaMedium, s.almaMedium[i - 1]);
      const longUp = i > 0 && gt(almaLong, s.almaLong[i - 1]);
      p[0][i] = { time: t, value: fin(x) };
      p[1][i] = { time: t, value: fin(ca), color: trend === 1 ? UP_COL : trend === -1 ? DOWN_COL : color.gray };
      p[2][i] = { time: t, value: cfg.showExtra ? fin(almaMedium) : NaN, color: medUp ? '#00ff08' : '#ff0055' };
      p[3][i] = { time: t, value: cfg.showExtra ? fin(almaLong) : NaN, color: longUp ? '#2196F3' : '#9C27B0' };
      p[4][i] = { time: t, value: fin(ca + visualNoiseTh) };
      p[5][i] = { time: t, value: fin(ca - visualNoiseTh) };
      p[6][i] = { time: t, value: cfg.showBb ? fin(bbBasis) : NaN };
      p[7][i] = { time: t, value: cfg.showBb ? fin(bbUpper) : NaN };
      p[8][i] = { time: t, value: cfg.showBb ? fin(bbLower) : NaN };
      // fill(p1, p2, isNoisy_vis ? color.new(color.aqua, 92) : color.new(color.gray, 97))
      s.noisyColors[i] = isNoisyVis ? noisyCol : quietCol;

      // plotshape(..., offset = sig_offset): the shape of bar i is drawn on bar i + sig_offset (times in result)
      if (i + cfg.sigOffset >= 0) {
        if (buy) s.events.push(i * 4);
        if (sell) s.events.push(i * 4 + 1);
        if (cfg.showBb && crossover) s.events.push(i * 4 + 2);
        if (cfg.showBb && crossunder) s.events.push(i * 4 + 3);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      // a shape shifted after the last bar: the time of a future bar (the bar interval of the whole set)
      let interval: number | undefined;
      const at = (i: number) => {
        const k = i + cfg.sigOffset;
        if (k >= n && interval === undefined) interval = barInterval(bars);
        return barTime(bars, k, interval);
      };
      const markers: MarkerData[] = [];
      for (const ev of s.events) {
        const i = Math.floor(ev / 4);
        switch (ev - i * 4) {
          case 0: markers.push({ time: at(i), position: 'belowBar', shape: 'triangleUp', color: color.lime, size: 'small' }); break;
          case 1: markers.push({ time: at(i), position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'small' }); break;
          case 2: markers.push({ time: at(i), position: 'belowBar', shape: 'circle', color: String(color.new(color.lime, 0)), size: 'tiny' }); break;
          default: markers.push({ time: at(i), position: 'aboveBar', shape: 'circle', color: String(color.new(color.red, 0)), size: 'tiny' });
        }
      }
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice(), plot4: p[4].slice(),
          plot5: p[5].slice(), plot6: p[6].slice(), plot7: p[7].slice(), plot8: p[8].slice(),
        },
        fills: [
          { plot1: 'plot4', plot2: 'plot5', colors: s.noisyColors.slice() },
          { plot1: 'plot7', plot2: 'plot8', colors: new Array<string>(n).fill(bbFillCol) },
        ],
        markers,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AdaptiveAlma20Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AdaptiveAlma20Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const AdaptiveAlma20 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
