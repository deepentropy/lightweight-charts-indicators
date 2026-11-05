/**
 * AllMA Trend Radar
 *
 * A fast and a slow moving average of the close, each of one of 36 types (DEMA, TEMA, Hull, least squares, ALMA,
 * zero-lag EMA, FRAMA, KAMA, modular filter, Ehlers decycler, McGinley, VIDYA, ...). Buy / Sell triangles mark:
 * the fast MA crossing the slow MA (Up / Down), the fast MA above / below the slow MA (Greater / Less), and the close
 * crossing or being above / below the fast MA and the slow MA. Each signal type has a minimum number of bars between
 * two signals and optional RSI, money flow and stochastic filters. Hidden connector plots give the signals as
 * 1 / -1 / 0.
 *
 * Reference: "AllMA Trend Radar [trade_lexx]" by trade_lexx
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export const FAST_MA_TYPES = [
  'DEMA | Double Exponential MA', 'TEMA | Triple Exponential MA', 'HMA  | Hull MA', 'LSMA | Least Squares MA',
  'JMA  | Jurik MA', 'ALMA | Arnaud Legoux MA', 'ZLEMA | Zero-Lag Exponential MA', 'LMA  | Leo MA',
  'FRAMA | Fractal Adaptive MA', 'KAMA | Kaufman Adaptive MA', 'Modular Filter', 'ESD  | Ehlers Simple Decycler',
  'TMA  | Tillson MA', 'EMA  | Exponential MA', 'SMA  | Simple MA', 'WMA  | Weighted MA', 'TMA  | Triangular MA',
  'VWMA | Volume-Weighted MA', 'SMMA | Smoothed MA', 'Kijun', 'MD   | McGinley Dynamic', 'RMA  | Rolling MA',
  'VAMA | Volatility Adjusted MA', 'VAR  | Vector Autoregression MA', 'AHMA | Ahrens Moving Average',
  'EVWMA | Elastic Volume Weighted MA', 'SWMA | Sine Weighted MA', 'VIDYA | Variable Index Dynamic Average',
  'VMA  | Variable MA', 'GMMA | Geometric Mean MA', 'CMA  | Corrective MA', 'MM   | Moving Median',
  'QMA  | Quick MA', 'EIT  | Ehlers Instantaneous Trendline', 'AMA  | Adaptive MA', 'MMA  | Muller MA',
] as const;

export const SLOW_MA_TYPES = [
  'EMA  | Exponential MA', 'SMA  | Simple MA', 'WMA  | Weighted MA', 'TMA  | Triangular MA',
  'VWMA | Volume-Weighted MA', 'SMMA | Smoothed MA', 'Kijun', 'MD   | McGinley Dynamic', 'RMA  | Rolling MA',
  'VAMA | Volatility Adjusted MA', 'VAR  | Vector Autoregression MA', 'AHMA | Ahrens Moving Average',
  'EVWMA | Elastic Volume Weighted MA', 'SWMA | Sine Weighted MA', 'VIDYA | Variable Index Dynamic Average',
  'VMA  | Variable MA', 'GMMA | Geometric Mean MA', 'CMA  | Corrective MA', 'MM   | Moving Median',
  'QMA  | Quick MA', 'EIT  | Ehlers Instantaneous Trendline', 'AMA  | Adaptive MA', 'MMA  | Muller MA',
  'DEMA | Double Exponential MA', 'TEMA | Triple Exponential MA', 'HMA  | Hull MA', 'LSMA | Least Squares MA',
  'JMA  | Jurik MA', 'ALMA | Arnaud Legoux MA', 'ZLEMA | Zero-Lag Exponential MA', 'LMA  | Leo MA',
  'FRAMA | Fractal Adaptive MA', 'KAMA | Kaufman Adaptive MA', 'Modular Filter', 'ESD  | Ehlers Simple Decycler',
  'TMA  | Tillson MA',
] as const;

export type AllmaMaType = (typeof FAST_MA_TYPES)[number];

export interface AllmaTrendRadarInputs {
  maLengthFast: number;
  maTypeFast: AllmaMaType;
  maLengthSlow: number;
  maTypeSlow: AllmaMaType;
  /** Fast vs slow MA: crossover / crossunder signals */
  showUpDown: boolean;
  minBarsUpDown: number;
  /** Fast vs slow MA: fast above / below slow signals */
  showGreaterLess: boolean;
  minBarsGreaterLess: number;
  /** Close vs fast MA */
  showUpDownFast: boolean;
  minBarsUpDownFast: number;
  showGreaterLessFast: boolean;
  minBarsGreaterLessFast: number;
  /** Close vs slow MA */
  showUpDownSlow: boolean;
  minBarsUpDownSlow: number;
  showGreaterLessSlow: boolean;
  minBarsGreaterLessSlow: number;
  useRsiFilter: boolean;
  rsiLength: number;
  rsiOverboughtLower: number;
  rsiOverboughtUpper: number;
  rsiOversoldLower: number;
  rsiOversoldUpper: number;
  useMfiFilter: boolean;
  mfiLength: number;
  mfiOverboughtLower: number;
  mfiOverboughtUpper: number;
  mfiOversoldLower: number;
  mfiOversoldUpper: number;
  useStochFilter: boolean;
  stochKLength: number;
  stochDLength: number;
  stochSmooth: number;
  stochOverboughtLower: number;
  stochOverboughtUpper: number;
  stochOversoldLower: number;
  stochOversoldUpper: number;
}

export const defaultInputs: AllmaTrendRadarInputs = {
  maLengthFast: 14,
  maTypeFast: 'DEMA | Double Exponential MA',
  maLengthSlow: 14,
  maTypeSlow: 'SMA  | Simple MA',
  showUpDown: true,
  minBarsUpDown: 3,
  showGreaterLess: false,
  minBarsGreaterLess: 5,
  showUpDownFast: false,
  minBarsUpDownFast: 3,
  showGreaterLessFast: false,
  minBarsGreaterLessFast: 5,
  showUpDownSlow: false,
  minBarsUpDownSlow: 3,
  showGreaterLessSlow: false,
  minBarsGreaterLessSlow: 5,
  useRsiFilter: false,
  rsiLength: 14,
  rsiOverboughtLower: 70,
  rsiOverboughtUpper: 100,
  rsiOversoldLower: 1,
  rsiOversoldUpper: 30,
  useMfiFilter: false,
  mfiLength: 14,
  mfiOverboughtLower: 75,
  mfiOverboughtUpper: 100,
  mfiOversoldLower: 1,
  mfiOversoldUpper: 25,
  useStochFilter: false,
  stochKLength: 14,
  stochDLength: 3,
  stochSmooth: 3,
  stochOverboughtLower: 80,
  stochOverboughtUpper: 100,
  stochOversoldLower: 1,
  stochOversoldUpper: 20,
};

const level = (id: keyof AllmaTrendRadarInputs, title: string, defval: number): InputConfig =>
  ({ id, type: 'int', title, defval, min: 0, max: 100 });

export const inputConfig: InputConfig[] = [
  { id: 'maLengthFast', type: 'int', title: 'Fast MA Length', defval: 14, min: 2 },
  { id: 'maTypeFast', type: 'string', title: 'Type', defval: 'DEMA | Double Exponential MA', options: [...FAST_MA_TYPES] },
  { id: 'maLengthSlow', type: 'int', title: 'Slow MA Length', defval: 14, min: 2 },
  { id: 'maTypeSlow', type: 'string', title: 'Type', defval: 'SMA  | Simple MA', options: [...SLOW_MA_TYPES] },
  { id: 'showUpDown', type: 'bool', title: 'Up/Down Signal ⮕', defval: true },
  { id: 'minBarsUpDown', type: 'int', title: 'Min Bars', defval: 3, min: 0 },
  { id: 'showGreaterLess', type: 'bool', title: 'Greater/Less Signal ⮕', defval: false },
  { id: 'minBarsGreaterLess', type: 'int', title: 'Min Bars', defval: 5, min: 0 },
  { id: 'showUpDownFast', type: 'bool', title: 'Up/Down Signal ⮕', defval: false },
  { id: 'minBarsUpDownFast', type: 'int', title: 'Min Bars', defval: 3, min: 0 },
  { id: 'showGreaterLessFast', type: 'bool', title: 'Greater/Less Signal ⮕', defval: false },
  { id: 'minBarsGreaterLessFast', type: 'int', title: 'Min Bars', defval: 5, min: 0 },
  { id: 'showUpDownSlow', type: 'bool', title: 'Up/Down Signal ⮕', defval: false },
  { id: 'minBarsUpDownSlow', type: 'int', title: 'Min Bars', defval: 3, min: 0 },
  { id: 'showGreaterLessSlow', type: 'bool', title: 'Greater/Less Signal ⮕', defval: false },
  { id: 'minBarsGreaterLessSlow', type: 'int', title: 'Min Bars', defval: 5, min: 0 },
  { id: 'useRsiFilter', type: 'bool', title: 'RSI ⮕', defval: false },
  { id: 'rsiLength', type: 'int', title: 'Length', defval: 14, min: 1 },
  level('rsiOverboughtLower', '🪫 Sell ⮕ Above⬆', 70),
  level('rsiOverboughtUpper', 'Below⬇', 100),
  level('rsiOversoldLower', '🔋 Buy ⮕ Above⬆', 1),
  level('rsiOversoldUpper', 'Below⬇', 30),
  { id: 'useMfiFilter', type: 'bool', title: 'MFI ⮕', defval: false },
  { id: 'mfiLength', type: 'int', title: 'Length', defval: 14, min: 1 },
  level('mfiOverboughtLower', '🪫 Sell ⮕ Above⬆', 75),
  level('mfiOverboughtUpper', 'Below⬇', 100),
  level('mfiOversoldLower', '🔋 Buy ⮕ Above⬆', 1),
  level('mfiOversoldUpper', 'Below⬇', 25),
  { id: 'useStochFilter', type: 'bool', title: 'Stochastic ⮕', defval: false },
  { id: 'stochKLength', type: 'int', title: 'K Length', defval: 14, min: 1 },
  { id: 'stochDLength', type: 'int', title: 'D Length', defval: 3, min: 1 },
  { id: 'stochSmooth', type: 'int', title: 'Smooth', defval: 3, min: 1 },
  level('stochOverboughtLower', '🪫 Sell ⮕ Above⬆', 80),
  level('stochOverboughtUpper', 'Below⬇', 100),
  level('stochOversoldLower', '🔋 Buy ⮕ Above⬆', 1),
  level('stochOversoldUpper', 'Below⬇', 20),
];

const HIDDEN = String(color.new(color.white, 100));
const connector = (id: string, title: string): PlotConfig =>
  ({ id, title, color: HIDDEN, lineWidth: 1, display: 'none' });

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast MA', color: color.blue, lineWidth: 1 },
  { id: 'plot1', title: 'Slow MA', color: color.red, lineWidth: 1 },
  connector('plot2', '🔌Fast vs Slow Up/Down MA Signal🔌'),
  connector('plot3', '🔌Fast vs Slow Greater/Less MA Signal🔌'),
  connector('plot4', '🔌Slow Up/Down MA Signal🔌'),
  connector('plot5', '🔌Slow Greater/Less MA Signal🔌'),
  connector('plot6', '🔌Fast Up/Down MA Signal🔌'),
  connector('plot7', '🔌Fast Greater/Less MA Signal🔌'),
  connector('plot8', '🔌Combined Up/Down MA Signal🔌'),
  connector('plot9', '🔌Combined Greater/Less MA Signal🔌'),
  connector('plot10', '🔌Combined All MA Signals🔌'),
];

export const metadata = {
  title: 'AllMA Trend Radar [trade_lexx]',
  shortTitle: 'AllMA [trade_lexx]',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
/** nz(): na and +-infinity give the replacement */
const nz = (x: number, y = 0) => (Number.isFinite(x) ? x : y);
const isNa = (x: number) => !Number.isFinite(x);
/**
 * `ta.percentile_nearest_rank(source, length, percentage)` one bar at a time, with the sorted window of the library
 * function (the new value inserted before the first value `>=` it, then the value of the bar leaving the window
 * removed): the same doubles. `step` reads the window with the new value without changing it.
 */
class PercentileNearestRank implements Committable {
  private readonly values: number[] = [];
  private readonly bars: number[] = [];
  private count = 0;
  private pending = NaN;
  private pendingK = 0;
  private stepped = false;
  private readonly rank: number;

  constructor(private readonly length: number, percentage: number) {
    this.rank = Math.min(length, Math.max(1, Math.ceil((percentage / 100) * length)));
  }

  step(v: number): number {
    this.stepped = true;
    this.pending = v;
    const { values, bars, length } = this;
    const i = this.count;
    let k = 0;
    while (k < values.length && !(values[k] >= v)) k++;
    this.pendingK = k;
    if (i < length - 1) return NaN;
    // index in the window after the insertion of the bar that leaves it (-1: none)
    let old = -1;
    if (i >= length) {
      const r = bars.indexOf(i - length);
      old = r < k ? r : r + 1;
    }
    const j = old < 0 || this.rank - 1 < old ? this.rank - 1 : this.rank;
    return j < k ? values[j] : j === k ? v : values[j - 1];
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    const { values, bars, length } = this;
    const i = this.count++;
    const k = this.pendingK;
    values.splice(k, 0, this.pending);
    bars.splice(k, 0, i);
    if (i >= length) {
      const old = bars.indexOf(i - length);
      values.splice(old, 1);
      bars.splice(old, 1);
    }
  }
}

/** One moving average of get_ma_out: its machines and its value on bar i (per-bar arrays for its own history) */
interface MaStep {
  steps: Committable[];
  at(i: number, bars: Bar[]): number;
}

// Fixed settings of the Pine script
const almaOffset = 0.85;
const almaSigma = 6;
const kamaFastLength = 2;
const kamaSlowLength = 30;
const vamaVolLen = 51;
const mfBeta = 0.8;
const mfZ = 0.5;
const mfFeedback = false;
const eitAlpha = 0.07;

/** close `k` bars back (na before the first bar) */
const src = (bars: Bar[], i: number, k: number) => (i - k >= 0 ? bars[i - k].close : NaN);
const hist = (a: number[], i: number, k: number) => (i - k >= 0 ? a[i - k] : NaN);

// get_ma_out(type, close, len, ...): the type is fixed, so the taken branch runs on every bar
function maStep(type: string, len: number): MaStep {
  const out: number[] = [];
  switch (type) {
    case 'SMA  | Simple MA': {
      const m = taStep.sma();
      return { steps: [m], at: (i, bars) => m.step(bars[i].close, len) };
    }
    case 'EMA  | Exponential MA': {
      const m = taStep.ema(len);
      return { steps: [m], at: (i, bars) => m.step(bars[i].close) };
    }
    case 'DEMA | Double Exponential MA':
    case 'JMA  | Jurik MA': {
      const e1 = taStep.ema(len);
      const e2 = taStep.ema(len);
      return {
        steps: [e1, e2],
        at: (i, bars) => {
          const e = e1.step(bars[i].close);
          return 2 * e - e2.step(e);
        },
      };
    }
    case 'TEMA | Triple Exponential MA': {
      const e1 = taStep.ema(len);
      const e2 = taStep.ema(len);
      const e3 = taStep.ema(len);
      return {
        steps: [e1, e2, e3],
        at: (i, bars) => {
          const e = e1.step(bars[i].close);
          const ee = e2.step(e);
          return 3 * (e - ee) + e3.step(ee);
        },
      };
    }
    case 'TMA  | Triangular MA': {
      const s1 = taStep.sma();
      const s2 = taStep.sma();
      return { steps: [s1, s2], at: (i, bars) => s2.step(s1.step(bars[i].close, Math.ceil(len / 2)), Math.floor(len / 2) + 1) };
    }
    case 'WMA  | Weighted MA': {
      const m = taStep.wma();
      return { steps: [m], at: (i, bars) => m.step(bars[i].close, len) };
    }
    case 'VWMA | Volume-Weighted MA': {
      const m = taStep.vwma(len);
      return { steps: [m], at: (i, bars) => m.step(bars[i].close, bars[i].volume ?? NaN) };
    }
    case 'SMMA | Smoothed MA': {
      const w = taStep.wma();
      const s = taStep.sma();
      const wv: number[] = [];
      return {
        steps: [w, s],
        at: (i, bars) => {
          const v = bars[i].close;
          wv[i] = w.step(v, len);
          const sv = s.step(v, len);
          return isNa(hist(wv, i, 1)) ? sv : (wv[i - 1] * (len - 1) + v) / len;
        },
      };
    }
    case 'RMA  | Rolling MA': {
      const m = taStep.rma(len);
      return { steps: [m], at: (i, bars) => m.step(bars[i].close) };
    }
    case 'HMA  | Hull MA': {
      const half = taStep.wma();
      const full = taStep.wma();
      const outer = taStep.wma();
      return {
        steps: [half, full, outer],
        at: (i, bars) => {
          const v = bars[i].close;
          return outer.step(2 * half.step(v, len / 2) - full.step(v, len), Math.round(Math.sqrt(len)));
        },
      };
    }
    case 'LSMA | Least Squares MA': {
      const m = taStep.linreg(len, 0);
      return { steps: [m], at: (i, bars) => m.step(bars[i].close) };
    }
    case 'Kijun': {
      const lo = taStep.lowest();
      const hi = taStep.highest();
      return { steps: [lo, hi], at: (i, bars) => (lo.step(bars[i].low, len) + hi.step(bars[i].high, len)) / 2 };
    }
    case 'MD   | McGinley Dynamic': {
      const e = taStep.ema(len);
      return {
        steps: [e],
        at: (i, bars) => {
          const v = bars[i].close;
          const ev = e.step(v);
          const prev = hist(out, i, 1);
          out[i] = isNa(prev) ? ev : prev + (v - prev) / (len * Math.pow(v / prev, 4));
          return out[i];
        },
      };
    }
    case 'ALMA | Arnaud Legoux MA': {
      // ta.alma(close, len, 0.85, 6): the normalised gaussian weights of the window
      const m = almaOffset * (len - 1);
      const sg = len / almaSigma;
      const weights: number[] = [];
      let weightSum = 0;
      for (let j = 0; j < len; j++) {
        const weight = Math.exp(-1 * Math.pow(j - m, 2) / (2 * Math.pow(sg, 2)));
        weights.push(weight);
        weightSum += weight;
      }
      for (let j = 0; j < len; j++) weights[j] /= weightSum;
      return {
        steps: [],
        at: (i, bars) => {
          if (i < len - 1) return NaN;
          let almaValue = 0;
          for (let j = 0; j < len; j++) almaValue += bars[i - len + 1 + j].close * weights[j];
          return almaValue;
        },
      };
    }
    case 'VAR  | Vector Autoregression MA': {
      const valpha = 2 / (len + 1);
      const up = taStep.sum();
      const dn = taStep.sum();
      return {
        steps: [up, dn],
        at: (i, bars) => {
          const v = bars[i].close;
          const p = src(bars, i, 1);
          const vUD = up.step(gt(v, p) ? v - p : 0, 9);
          const vDD = dn.step(lt(v, p) ? p - v : 0, 9);
          const vCMO = nz((vUD - vDD) / (vUD + vDD));
          out[i] = nz(valpha * Math.abs(vCMO) * v) + (1 - valpha * Math.abs(vCMO)) * nz(hist(out, i, 1));
          return out[i];
        },
      };
    }
    case 'ZLEMA | Zero-Lag Exponential MA': {
      // xLag = len / 2 (fractional for an odd length): the history index is truncated
      const xLag = Math.trunc(len / 2);
      const e = taStep.ema(len);
      return {
        steps: [e],
        at: (i, bars) => {
          const v = bars[i].close;
          return e.step(v + (v - src(bars, i, xLag)));
        },
      };
    }
    case 'AHMA | Ahrens Moving Average':
      return {
        steps: [],
        at: (i, bars) => {
          const p = nz(hist(out, i, 1));
          out[i] = p + (bars[i].close - (p + nz(hist(out, i, len))) / 2) / len;
          return out[i];
        },
      };
    case 'EVWMA | Elastic Volume Weighted MA': {
      const sum = taStep.sum();
      return {
        steps: [sum],
        at: (i, bars) => {
          const volume = bars[i].volume ?? NaN;
          const vs = sum.step(volume, len);
          out[i] = ((vs - volume) * nz(hist(out, i, 1)) + volume * bars[i].close) / vs;
          return out[i];
        },
      };
    }
    case 'SWMA | Sine Weighted MA':
      return {
        steps: [],
        at: (i, bars) => {
          let s = 0.0;
          let weightSum = 0.0;
          for (let j = 0; j <= len - 1; j++) {
            const weight = Math.sin((j * Math.PI) / (len + 1));
            s = s + nz(src(bars, i, j)) * weight;
            weightSum = weightSum + weight;
          }
          return s / weightSum;
        },
      };
    case 'LMA  | Leo MA': {
      const w = taStep.wma();
      const s = taStep.sma();
      return {
        steps: [w, s],
        at: (i, bars) => {
          const v = bars[i].close;
          return 2 * w.step(v, len) - s.step(v, len);
        },
      };
    }
    case 'VIDYA | Variable Index Dynamic Average': {
      const ch = taStep.change();
      const up = taStep.sum();
      const dn = taStep.sum();
      const alpha = 2 / (len + 1);
      return {
        steps: [ch, up, dn],
        at: (i, bars) => {
          const v = bars[i].close;
          const mom = ch.step(v);
          const upSum = up.step(Math.max(mom, 0), len);
          const downSum = dn.step(-Math.min(mom, 0), len);
          const cmo = Math.abs((upSum - downSum) / (upSum + downSum));
          out[i] = v * alpha * cmo + nz(hist(out, i, 1)) * (1 - alpha * cmo);
          return out[i];
        },
      };
    }
    case 'FRAMA | Fractal Adaptive MA': {
      const length2 = Math.floor(len / 2);
      const hh2m = taStep.highest();
      const ll2m = taStep.lowest();
      const hhm = taStep.highest();
      const llm = taStep.lowest();
      const hh2: number[] = [];
      const ll2: number[] = [];
      return {
        steps: [hh2m, ll2m, hhm, llm],
        at: (i, bars) => {
          const b = bars[i];
          hh2[i] = hh2m.step(b.high, length2);
          ll2[i] = ll2m.step(b.low, length2);
          const hh = hhm.step(b.high, len);
          const ll = llm.step(b.low, len);
          const N1 = (hh2[i] - ll2[i]) / length2;
          const N2 = (hist(hh2, i, length2) - hist(ll2, i, length2)) / length2;
          const N3 = (hh - ll) / len;
          const D = (Math.log(N1 + N2) - Math.log(N3)) / Math.log(2);
          const factor = Math.exp(-4.6 * (D - 1));
          out[i] = factor * b.close + (1 - factor) * nz(hist(out, i, 1));
          return out[i];
        },
      };
    }
    case 'VMA  | Variable MA': {
      const k = 1.0 / len;
      const pdmS: number[] = [];
      const mdmS: number[] = [];
      const pdiS: number[] = [];
      const mdiS: number[] = [];
      const iS: number[] = [];
      const hhm = taStep.highest();
      const llm = taStep.lowest();
      return {
        steps: [hhm, llm],
        at: (i, bars) => {
          const v = bars[i].close;
          const p = src(bars, i, 1);
          const pdm = Math.max(v - p, 0);
          const mdm = Math.max(p - v, 0);
          pdmS[i] = (1 - k) * nz(hist(pdmS, i, 1)) + k * pdm;
          mdmS[i] = (1 - k) * nz(hist(mdmS, i, 1)) + k * mdm;
          const s = pdmS[i] + mdmS[i];
          const pdi = pdmS[i] / s;
          const mdi = mdmS[i] / s;
          pdiS[i] = (1 - k) * nz(hist(pdiS, i, 1)) + k * pdi;
          mdiS[i] = (1 - k) * nz(hist(mdiS, i, 1)) + k * mdi;
          const d = Math.abs(pdiS[i] - mdiS[i]);
          const s1 = pdiS[i] + mdiS[i];
          iS[i] = (1 - k) * nz(hist(iS, i, 1)) + (k * d) / s1;
          const hhv = hhm.step(iS[i], len);
          const llv = llm.step(iS[i], len);
          const vI = (iS[i] - llv) / (hhv - llv);
          out[i] = (1 - k * vI) * nz(hist(out, i, 1)) + k * vI * v;
          return out[i];
        },
      };
    }
    case 'GMMA | Geometric Mean MA': {
      const sum = taStep.sum();
      return { steps: [sum], at: (i, bars) => Math.exp(sum.step(Math.log(bars[i].close), len) / len) };
    }
    case 'CMA  | Corrective MA': {
      const sm = taStep.sma();
      const vm = taStep.variance();
      const tolerance = Math.pow(10, -5);
      return {
        steps: [sm, vm],
        at: (i, bars) => {
          const v = bars[i].close;
          const s = sm.step(v, len);
          const v1 = vm.step(v, len);
          const prev = hist(out, i, 1);
          const v2 = Math.pow(nz(prev, s) - s, 2);
          const v3 = eq(v1, 0) || eq(v2, 0) ? 1 : v2 / (v1 + v2);
          let err = 1;
          let kPrev = 1;
          let k = 1;
          for (let j = 0; j <= 5000; j++) {
            if (gt(err, tolerance)) {
              k = v3 * kPrev * (2 - kPrev);
              err = kPrev - k;
              kPrev = k;
            }
          }
          out[i] = nz(prev, v) + k * (s - nz(prev, v));
          return out[i];
        },
      };
    }
    case 'MM   | Moving Median': {
      const m = new PercentileNearestRank(len, 50);
      return { steps: [m], at: (i, bars) => m.step(bars[i].close) };
    }
    case 'QMA  | Quick MA': {
      const peak = len / 3;
      return {
        steps: [],
        at: (i, bars) => {
          let num = 0.0;
          let denom = 0.0;
          for (let j = 1; j <= len + 1; j++) {
            const mult = le(j, peak) ? j / peak : (len + 1 - j) / (len + 1 - peak);
            num = num + src(bars, i, j - 1) * mult;
            denom = denom + mult;
          }
          return !eq(denom, 0.0) ? num / denom : bars[i].close;
        },
      };
    }
    case 'KAMA | Kaufman Adaptive MA': {
      const chLen = taStep.change(len);
      const ch1 = taStep.change();
      const sum = taStep.sum();
      const fastAlpha = 2 / (kamaFastLength + 1);
      const slowAlpha = 2 / (kamaSlowLength + 1);
      return {
        steps: [chLen, ch1, sum],
        at: (i, bars) => {
          const v = bars[i].close;
          const mom = Math.abs(chLen.step(v));
          const volatility = sum.step(Math.abs(ch1.step(v)), len);
          // volatility != 0 is false when volatility is na
          const er = !isNaN(volatility) && !eq(volatility, 0) ? mom / volatility : 0;
          const alpha = Math.pow(er * (fastAlpha - slowAlpha) + slowAlpha, 2);
          out[i] = alpha * v + (1 - alpha) * nz(hist(out, i, 1), v);
          return out[i];
        },
      };
    }
    case 'VAMA | Volatility Adjusted MA': {
      const e = taStep.ema(len);
      const up = taStep.highest();
      const dn = taStep.lowest();
      return {
        steps: [e, up, dn],
        at: (i, bars) => {
          const v = bars[i].close;
          const mid = e.step(v);
          const dev = v - mid;
          return mid + (up.step(dev, vamaVolLen) + dn.step(dev, vamaVolLen)) / 2;
        },
      };
    }
    case 'Modular Filter': {
      const alpha = 2 / (len + 1);
      const b: number[] = [];
      const c: number[] = [];
      const os: number[] = [];
      return {
        steps: [],
        at: (i, bars) => {
          const v = bars[i].close;
          const a = mfFeedback ? mfZ * v + (1 - mfZ) * nz(hist(out, i, 1), v) : v;
          const tb = alpha * a + (1 - alpha) * nz(hist(b, i, 1), a);
          b[i] = gt(a, tb) ? a : tb;
          const tc = alpha * a + (1 - alpha) * nz(hist(c, i, 1), a);
          c[i] = lt(a, tc) ? a : tc;
          os[i] = eq(a, b[i]) ? 1 : eq(a, c[i]) ? 0 : hist(os, i, 1);
          const upper = mfBeta * b[i] + (1 - mfBeta) * c[i];
          const lower = mfBeta * c[i] + (1 - mfBeta) * b[i];
          out[i] = os[i] * upper + (1 - os[i]) * lower;
          return out[i];
        },
      };
    }
    case 'EIT  | Ehlers Instantaneous Trendline':
      return {
        steps: [],
        at: (i, bars) => {
          const v = bars[i].close;
          const s1 = nz(src(bars, i, 1));
          const s2 = nz(src(bars, i, 2));
          // bar_index < 7: the bar index of the first bars of the data
          out[i] = i < 7
            ? (v + 2 * s1 + s2) / 4
            : (eitAlpha - Math.pow(eitAlpha, 2) / 4) * v + 0.5 * Math.pow(eitAlpha, 2) * s1
              - (eitAlpha - 0.75 * Math.pow(eitAlpha, 2)) * s2 + 2 * (1 - eitAlpha) * nz(hist(out, i, 1))
              - Math.pow(1 - eitAlpha, 2) * nz(hist(out, i, 2));
          return out[i];
        },
      };
    case 'ESD  | Ehlers Simple Decycler': {
      const alphaArg = (2 * Math.PI) / (len * Math.sqrt(2));
      // alpha := cos != 0 ? ... : nz(alpha): the same value on every bar (0 when the cosine is 0)
      const alpha = !eq(Math.cos(alphaArg), 0)
        ? (Math.cos(alphaArg) + Math.sin(alphaArg) - 1) / Math.cos(alphaArg)
        : 0;
      const hp: number[] = [];
      return {
        steps: [],
        at: (i, bars) => {
          const v = bars[i].close;
          hp[i] = Math.pow(1 - alpha / 2, 2) * (v - 2 * nz(src(bars, i, 1)) + nz(src(bars, i, 2)))
            + 2 * (1 - alpha) * nz(hist(hp, i, 1)) - Math.pow(1 - alpha, 2) * nz(hist(hp, i, 2));
          return v - hp[i];
        },
      };
    }
    case 'AMA  | Adaptive MA': {
      const fastSc = 2 / (len / 2 + 1);
      const slowSc = 2 / (len * 2 + 1);
      const ch = taStep.change();
      return {
        steps: [ch],
        at: (i, bars) => {
          const v = bars[i].close;
          const k = Math.pow(ch.step(v), 2);
          const alpha = fastSc * k + slowSc * (1 - k);
          out[i] = alpha * v + (1 - alpha) * nz(hist(out, i, 1), v);
          return out[i];
        },
      };
    }
    case 'TMA  | Tillson MA': {
      const c = 0.7;
      return {
        steps: [],
        at: (i, bars) => {
          const v = bars[i].close;
          out[i] = c * v + (1 - c) * nz(hist(out, i, 1), v);
          return out[i];
        },
      };
    }
    case 'MMA  | Muller MA': {
      const alpha = 2 / (len + 1);
      return {
        steps: [],
        at: (i, bars) => {
          const v = bars[i].close;
          out[i] = alpha * v + (1 - alpha) * nz(hist(out, i, 1), v);
          return out[i];
        },
      };
    }
    default:
      return { steps: [], at: () => 0.0 };
  }
}

type Point = { time: number; value: number };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface AllmaVars {
  /** The bar of the last signal of each side of the six signal pairs (lastA, lastB of pair p at 2p, 2p + 1) */
  last: number[];
}

interface AllmaRun extends BarRunState<AllmaVars> {
  fast: MaStep;
  slow: MaStep;
  rsi: ReturnType<typeof taStep.rsi>;
  posFlow: ReturnType<typeof taStep.sum>;
  negFlow: ReturnType<typeof taStep.sum>;
  stoch: ReturnType<typeof taStep.stoch>;
  stochSma: ReturnType<typeof taStep.sma>;
  crosses: { step(a: number, b: number): boolean; commit(): void }[];
  markers: MarkerData[];
  plots: Point[][];
}

const sig = (a: boolean, b: boolean) => (a ? 1 : b ? -1 : 0);
const fin = (v: number) => (Number.isFinite(v) ? v : NaN);

function study(inputs: Partial<AllmaTrendRadarInputs>): BarStudy<AllmaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const inRange = (x: number, lo: number, hi: number) => ge(x, lo) && le(x, hi);
  return {
    init() {
      const s: AllmaRun = {
        fast: maStep(cfg.maTypeFast, cfg.maLengthFast), slow: maStep(cfg.maTypeSlow, cfg.maLengthSlow),
        rsi: taStep.rsi(cfg.rsiLength), posFlow: taStep.sum(), negFlow: taStep.sum(),
        stoch: taStep.stoch(cfg.stochKLength), stochSma: taStep.sma(),
        crosses: [
          taStep.crossover(), taStep.crossunder(), taStep.crossover(), taStep.crossunder(), taStep.crossover(),
          taStep.crossunder(),
        ],
        markers: [], plots: Array.from({ length: 11 }, () => []),
        steps: [], vars: { last: new Array(12).fill(NaN) }, lists: [], series: [],
      };
      s.steps = [...s.fast.steps, ...s.slow.steps, s.rsi, s.posFlow, s.negFlow, s.stoch, s.stochSma, ...s.crosses];
      s.lists = [s.markers];
      s.series = s.plots;
      return s;
    },
    copyVars: (v) => ({ last: v.last.slice() }),
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const close = b.close;
      const maFast = s.fast.at(i, bars);
      const maSlow = s.slow.at(i, bars);

      // Filters
      const rsi = s.rsi.step(close);
      const volume = b.volume ?? NaN;
      const typical = (b.high + b.low + b.close) / 3;
      const pb = i > 0 ? bars[i - 1] : null;
      const prevTypical = pb ? (pb.high + pb.low + pb.close) / 3 : NaN;
      const posFlow = s.posFlow.step(volume * typical * (gt(typical, prevTypical) ? 1 : 0), cfg.mfiLength);
      const negFlow = s.negFlow.step(volume * typical * (lt(typical, prevTypical) ? 1 : 0), cfg.mfiLength);
      const mfi = 100 - 100 / (1 + posFlow / Math.max(negFlow, 0.000001));
      const stochK = s.stochSma.step(s.stoch.step(close, b.high, b.low), cfg.stochSmooth);
      const buyFilter = (signal: boolean) => signal
        && (!cfg.useRsiFilter || inRange(rsi, cfg.rsiOversoldLower, cfg.rsiOversoldUpper))
        && (!cfg.useMfiFilter || inRange(mfi, cfg.mfiOversoldLower, cfg.mfiOversoldUpper))
        && (!cfg.useStochFilter || inRange(stochK, cfg.stochOversoldLower, cfg.stochOversoldUpper));
      const sellFilter = (signal: boolean) => signal
        && (!cfg.useRsiFilter || inRange(rsi, cfg.rsiOverboughtLower, cfg.rsiOverboughtUpper))
        && (!cfg.useMfiFilter || inRange(mfi, cfg.mfiOverboughtLower, cfg.mfiOverboughtUpper))
        && (!cfg.useStochFilter || inRange(stochK, cfg.stochOverboughtLower, cfg.stochOverboughtUpper));

      // ta.crossover / ta.crossunder compare exactly, with the last bar where both values were not na
      const x = s.crosses;
      const crossUp = x[0].step(maFast, maSlow);
      const crossDown = x[1].step(maFast, maSlow);
      const crossUpFast = x[2].step(close, maFast);
      const crossDownFast = x[3].step(close, maFast);
      const crossUpSlow = x[4].step(close, maSlow);
      const crossDownSlow = x[5].step(close, maSlow);

      // A pair of signals with a minimum number of bars since the last signal of either side
      const last = s.vars.last;
      const pair = (p: number, condA: boolean, condB: boolean, minBars: number): [boolean, boolean] => {
        const lastA = last[2 * p];
        const lastB = last[2 * p + 1];
        const okA = isNaN(lastA) || i - lastA >= minBars;
        const okB = isNaN(lastB) || i - lastB >= minBars;
        const sigA = buyFilter(condA && okA && okB);
        const sigB = sellFilter(condB && okB && okA);
        if (sigA) last[2 * p] = i;
        if (sigB) last[2 * p + 1] = i;
        return [sigA, sigB];
      };

      // id: the plotshape of the original (shape0 .. shape11 in declaration order)
      const buy = (id: string) => s.markers.push({ id, time, position: 'belowBar', shape: 'triangleUp',
        color: color.green, text: 'Buy', textColor: color.blue });
      const sell = (id: string) => s.markers.push({ id, time, position: 'aboveBar', shape: 'triangleDown',
        color: color.red, text: 'Sell', textColor: color.blue });

      const [greater, less] = pair(0, gt(maFast, maSlow), lt(maFast, maSlow), cfg.minBarsGreaterLess);
      if (cfg.showGreaterLess && greater) buy('shape0');
      if (cfg.showGreaterLess && less) sell('shape1');
      const [up, down] = pair(1, crossUp, crossDown, cfg.minBarsUpDown);
      if (cfg.showUpDown && up) buy('shape2');
      if (cfg.showUpDown && down) sell('shape3');
      const [greaterFast, lessFast] = pair(2, gt(close, maFast), lt(close, maFast), cfg.minBarsGreaterLessFast);
      if (cfg.showGreaterLessFast && greaterFast) buy('shape4');
      if (cfg.showGreaterLessFast && lessFast) sell('shape5');
      const [upFast, downFast] = pair(3, crossUpFast, crossDownFast, cfg.minBarsUpDownFast);
      if (cfg.showUpDownFast && upFast) buy('shape6');
      if (cfg.showUpDownFast && downFast) sell('shape7');
      const [greaterSlow, lessSlow] = pair(4, gt(close, maSlow), lt(close, maSlow), cfg.minBarsGreaterLessSlow);
      if (cfg.showGreaterLessSlow && greaterSlow) buy('shape8');
      if (cfg.showGreaterLessSlow && lessSlow) sell('shape9');
      const [upSlow, downSlow] = pair(5, crossUpSlow, crossDownSlow, cfg.minBarsUpDownSlow);
      if (cfg.showUpDownSlow && upSlow) buy('shape10');
      if (cfg.showUpDownSlow && downSlow) sell('shape11');

      const u = cfg.showUpDown && up;
      const d = cfg.showUpDown && down;
      const g = cfg.showGreaterLess && greater;
      const l = cfg.showGreaterLess && less;
      const us = cfg.showUpDownSlow && upSlow;
      const ds = cfg.showUpDownSlow && downSlow;
      const gs = cfg.showGreaterLessSlow && greaterSlow;
      const ls = cfg.showGreaterLessSlow && lessSlow;
      const uf = cfg.showUpDownFast && upFast;
      const df = cfg.showUpDownFast && downFast;
      const gf = cfg.showGreaterLessFast && greaterFast;
      const lf = cfg.showGreaterLessFast && lessFast;
      const p = s.plots;
      p[0][i] = { time, value: fin(maFast) };
      p[1][i] = { time, value: fin(maSlow) };
      p[2][i] = { time, value: sig(u, d) };
      p[3][i] = { time, value: sig(g, l) };
      p[4][i] = { time, value: sig(us, ds) };
      p[5][i] = { time, value: sig(gs, ls) };
      p[6][i] = { time, value: sig(uf, df) };
      p[7][i] = { time, value: sig(gf, lf) };
      p[8][i] = { time, value: sig(u || uf || us, d || df || ds) };
      p[9][i] = { time, value: sig(g || gf || gs, l || lf || ls) };
      p[10][i] = { time, value: sig(u || uf || us || g || gf || gs, d || df || ds || l || lf || ls) };
    },
    result(s) {
      const plots: IndicatorResult['plots'] = {};
      s.plots.forEach((p, k) => {
        plots[`plot${k}`] = p.slice();
      });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AllmaTrendRadarInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AllmaTrendRadarInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const AllmaTrendRadar = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
