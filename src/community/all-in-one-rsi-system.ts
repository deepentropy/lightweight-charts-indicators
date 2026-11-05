/**
 * ALL-IN-ONE RSI System (Cloud Divergence Stoch RSI CM WVF)
 *
 * RSI of the source with an EMA base line. A cloud between RSI and base is coloured by the RSI zone: purple at or
 * below the extreme oversold level, red at or below the oversold start, blue at or above the extreme overbought
 * level, green at or above the overbought start. Stochastic RSI %K (SMA of the RSI position in its range) and %D
 * (SMA of %K). BUY labels on RSI crosses over the oversold start or the extreme oversold level, SELL labels on RSI
 * crosses under the overbought start or the extreme overbought level (optionally confirmed by a Stoch RSI cross).
 * Regular and hidden RSI divergences on RSI pivots (drawn on the pivot bars). The CM Williams Vix Fix
 * ((highest close - low) / highest close * 100) is drawn as a histogram shifted down by the vertical shift, green
 * when it reaches its upper Bollinger band or the percentile high of its range, with optional range and band lines.
 *
 * Reference: "ALL-IN-ONE RSI System (Cloud Divergence Stoch RSI CM WVF)" by ethem11
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, PivotStep, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export interface AllInOneRsiSystemInputs {
  rsiLen: number;
  src: SourceType;
  /** RSI base EMA length */
  baseLen: number;
  /** Oversold start (red cloud at or below) */
  osStart: number;
  /** Extreme oversold (purple cloud at or below) */
  osExtreme: number;
  /** Overbought start (green cloud at or above) */
  obStart: number;
  /** Extreme overbought (blue cloud at or above) */
  obExtreme: number;
  showCloud: boolean;
  /** Cloud transparency (0 = strong) */
  cloudOp: number;
  showBuySell: boolean;
  /** BUY / SELL need a Stoch RSI cross (%K over %D below 20 / under %D above 80) */
  buySellUseStoch: boolean;
  buyOnExtremeOS: boolean;
  sellOnExtremeOB: boolean;
  buyOnPurpleExit: boolean;
  sellOnBlueExit: boolean;
  showStoch: boolean;
  stochLen: number;
  kLen: number;
  dLen: number;
  rsiColor: string;
  baseColor: string;
  cloudBullColor: string;
  cloudBearColor: string;
  cloudExtremeOS: string;
  cloudExtremeOB: string;
  bgBandColor: string;
  bgBandOpacity: number;
  stochKColor: string;
  stochDColor: string;
  stochLineOpacity: number;
  buyColor: string;
  sellColor: string;
  labelTextColor: string;
  bullDivColor: string;
  bearDivColor: string;
  hiddenBullDivColor: string;
  hiddenBearDivColor: string;
  wvfSpikeColor: string;
  wvfNormalColor: string;
  wvfRangeColor: string;
  wvfBandColor: string;
  /** Pivot lookback right */
  lbR: number;
  /** Pivot lookback left */
  lbL: number;
  /** Max of lookback range */
  rangeUpper: number;
  /** Min of lookback range */
  rangeLower: number;
  plotBull: boolean;
  plotHiddenBull: boolean;
  plotBear: boolean;
  plotHiddenBear: boolean;
  showWVF: boolean;
  /** WVF lookback of the highest close */
  pd: number;
  /** WVF Bollinger band length */
  bbl: number;
  /** WVF Bollinger band standard deviations */
  mult: number;
  /** WVF lookback of the percentile range */
  lb: number;
  /** WVF highest percentile */
  ph: number;
  /** WVF lowest percentile */
  pl: number;
  /** Show the WVF range lines */
  hp: boolean;
  /** Show the WVF band lines */
  sd: boolean;
  /** WVF vertical shift (histogram base) */
  wvfBase: number;
}

const RSI_COL = String(color.rgb(41, 98, 255));
const BASE_COL = String(color.new(color.gray, 80));
const HIDDEN_BULL_COL = String(color.new(color.green, 80));
const HIDDEN_BEAR_COL = String(color.new(color.red, 80));

export const defaultInputs: AllInOneRsiSystemInputs = {
  rsiLen: 14,
  src: 'close',
  baseLen: 14,
  osStart: 44.0,
  osExtreme: 25.0,
  obStart: 70.0,
  obExtreme: 85.0,
  showCloud: true,
  cloudOp: 55,
  showBuySell: true,
  buySellUseStoch: false,
  buyOnExtremeOS: true,
  sellOnExtremeOB: true,
  buyOnPurpleExit: true,
  sellOnBlueExit: true,
  showStoch: true,
  stochLen: 14,
  kLen: 3,
  dLen: 3,
  rsiColor: RSI_COL,
  baseColor: BASE_COL,
  cloudBullColor: color.lime,
  cloudBearColor: color.red,
  cloudExtremeOS: color.purple,
  cloudExtremeOB: color.blue,
  bgBandColor: color.blue,
  bgBandOpacity: 92,
  stochKColor: color.orange,
  stochDColor: color.fuchsia,
  stochLineOpacity: 45,
  buyColor: color.green,
  sellColor: color.red,
  labelTextColor: color.white,
  bullDivColor: color.green,
  bearDivColor: color.red,
  hiddenBullDivColor: HIDDEN_BULL_COL,
  hiddenBearDivColor: HIDDEN_BEAR_COL,
  wvfSpikeColor: color.lime,
  wvfNormalColor: color.gray,
  wvfRangeColor: color.orange,
  wvfBandColor: color.aqua,
  lbR: 5,
  lbL: 5,
  rangeUpper: 60,
  rangeLower: 5,
  plotBull: true,
  plotHiddenBull: false,
  plotBear: true,
  plotHiddenBear: false,
  showWVF: true,
  pd: 22,
  bbl: 20,
  mult: 2.0,
  lb: 50,
  ph: 0.85,
  pl: 1.01,
  hp: false,
  sd: false,
  wvfBase: -60.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Period', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'baseLen', type: 'int', title: 'RSI Base EMA', defval: 14 },
  { id: 'osStart', type: 'float', title: 'OS Start (red ≤)', defval: 44.0 },
  { id: 'osExtreme', type: 'float', title: 'OS Extreme (purple ≤)', defval: 25.0 },
  { id: 'obStart', type: 'float', title: 'OB Start (green ≥)', defval: 70.0 },
  { id: 'obExtreme', type: 'float', title: 'OB Extreme (blue ≥)', defval: 85.0 },
  { id: 'showCloud', type: 'bool', title: 'Show Cloud', defval: true },
  { id: 'cloudOp', type: 'int', title: 'Cloud Opacity (0=strong)', defval: 55, min: 0, max: 95 },
  { id: 'showBuySell', type: 'bool', title: 'Show BUY/SELL', defval: true },
  { id: 'buySellUseStoch', type: 'bool', title: 'BUY/SELL require Stoch confirmation', defval: false },
  { id: 'buyOnExtremeOS', type: 'bool', title: 'BUY when crosses UP from OS (44)', defval: true },
  { id: 'sellOnExtremeOB', type: 'bool', title: 'SELL when crosses DOWN from OB (70)', defval: true },
  { id: 'buyOnPurpleExit', type: 'bool', title: 'BUY when exits purple (25)', defval: true },
  { id: 'sellOnBlueExit', type: 'bool', title: 'SELL when exits blue (85)', defval: true },
  { id: 'showStoch', type: 'bool', title: 'Show Stoch RSI', defval: true },
  { id: 'stochLen', type: 'int', title: 'Stoch RSI Length', defval: 14 },
  { id: 'kLen', type: 'int', title: 'Stoch K', defval: 3 },
  { id: 'dLen', type: 'int', title: 'Stoch D', defval: 3 },
  { id: 'rsiColor', type: 'color', title: 'RSI Line Color', defval: RSI_COL },
  { id: 'baseColor', type: 'color', title: 'RSI Base (EMA) Color', defval: BASE_COL },
  { id: 'cloudBullColor', type: 'color', title: 'Cloud: Overbought (70-85)', defval: color.lime },
  { id: 'cloudBearColor', type: 'color', title: 'Cloud: Oversold (25-44)', defval: color.red },
  { id: 'cloudExtremeOS', type: 'color', title: 'Cloud: Extreme Oversold (<=25)', defval: color.purple },
  { id: 'cloudExtremeOB', type: 'color', title: 'Cloud: Extreme Overbought (>=85)', defval: color.blue },
  { id: 'bgBandColor', type: 'color', title: 'OB/OS Background Color', defval: color.blue },
  { id: 'bgBandOpacity', type: 'int', title: 'OB/OS Background Opacity', defval: 92, min: 0, max: 100 },
  { id: 'stochKColor', type: 'color', title: 'Stoch RSI %K Color', defval: color.orange },
  { id: 'stochDColor', type: 'color', title: 'Stoch RSI %D Color', defval: color.fuchsia },
  { id: 'stochLineOpacity', type: 'int', title: 'Stoch Lines Opacity', defval: 45, min: 0, max: 100 },
  { id: 'buyColor', type: 'color', title: 'BUY Label Color', defval: color.green },
  { id: 'sellColor', type: 'color', title: 'SELL Label Color', defval: color.red },
  { id: 'labelTextColor', type: 'color', title: 'Label Text Color', defval: color.white },
  { id: 'bullDivColor', type: 'color', title: 'Bull Div Stroke', defval: color.green },
  { id: 'bearDivColor', type: 'color', title: 'Bear Div Stroke', defval: color.red },
  { id: 'hiddenBullDivColor', type: 'color', title: 'Hidden Bull Div Stroke', defval: HIDDEN_BULL_COL },
  { id: 'hiddenBearDivColor', type: 'color', title: 'Hidden Bear Div Stroke', defval: HIDDEN_BEAR_COL },
  { id: 'wvfSpikeColor', type: 'color', title: 'WVF Spike (Green) Color', defval: color.lime },
  { id: 'wvfNormalColor', type: 'color', title: 'WVF Normal (Gray) Color', defval: color.gray },
  { id: 'wvfRangeColor', type: 'color', title: 'WVF Range Lines Color', defval: color.orange },
  { id: 'wvfBandColor', type: 'color', title: 'WVF Bands Color', defval: color.aqua },
  { id: 'lbR', type: 'int', title: 'Pivot Lookback Right', defval: 5, display: 'data_window' },
  { id: 'lbL', type: 'int', title: 'Pivot Lookback Left', defval: 5, display: 'data_window' },
  { id: 'rangeUpper', type: 'int', title: 'Max of Lookback Range', defval: 60, display: 'data_window' },
  { id: 'rangeLower', type: 'int', title: 'Min of Lookback Range', defval: 5, display: 'data_window' },
  { id: 'plotBull', type: 'bool', title: 'Plot Bullish', defval: true, display: 'data_window' },
  { id: 'plotHiddenBull', type: 'bool', title: 'Plot Hidden Bullish', defval: false, display: 'data_window' },
  { id: 'plotBear', type: 'bool', title: 'Plot Bearish', defval: true, display: 'data_window' },
  { id: 'plotHiddenBear', type: 'bool', title: 'Plot Hidden Bearish', defval: false, display: 'data_window' },
  { id: 'showWVF', type: 'bool', title: 'Show CM_Williams_Vix_Fix (shifted down, ORIGINAL shape)', defval: true },
  { id: 'pd', type: 'int', title: 'WVF LookBack Period Standard Deviation High', defval: 22 },
  { id: 'bbl', type: 'int', title: 'WVF Bollinger Band Length', defval: 20 },
  { id: 'mult', type: 'float', title: 'WVF Bollinger Band Std Dev Up', defval: 2.0, min: 1, max: 5 },
  { id: 'lb', type: 'int', title: 'WVF Look Back Period Percentile High', defval: 50 },
  { id: 'ph', type: 'float', title: 'WVF Highest Percentile (e.g. 0.90 = 90%)', defval: 0.85, step: 0.01 },
  { id: 'pl', type: 'float', title: 'WVF Lowest Percentile (e.g. 1.10 = 90%)', defval: 1.01, step: 0.01 },
  { id: 'hp', type: 'bool', title: 'WVF Show High/Low Range (Percentile & LookBack)', defval: false },
  { id: 'sd', type: 'bool', title: 'WVF Show Standard Deviation Line', defval: false },
  { id: 'wvfBase', type: 'float', title: 'WVF Vertical Shift (more negative = lower)', defval: -60.0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: RSI_COL, lineWidth: 2 },
  { id: 'plot1', title: 'RSI Base (EMA)', color: BASE_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Stoch K', color: String(color.new(color.orange, 45)), lineWidth: 1 },
  { id: 'plot3', title: 'Stoch D', color: String(color.new(color.fuchsia, 45)), lineWidth: 1 },
  { id: 'plot4', title: 'Regular Bullish', color: color.green, lineWidth: 2, display: 'pane' },
  { id: 'plot5', title: 'Hidden Bullish', color: HIDDEN_BULL_COL, lineWidth: 2, display: 'pane' },
  { id: 'plot6', title: 'Regular Bearish', color: color.red, lineWidth: 2, display: 'pane' },
  { id: 'plot7', title: 'Hidden Bearish', color: HIDDEN_BEAR_COL, lineWidth: 2, display: 'pane' },
  { id: 'plot8', title: 'WVF Range High', color: color.orange, lineWidth: 1 },
  { id: 'plot9', title: 'WVF Range Low', color: color.orange, lineWidth: 1 },
  { id: 'plot10', title: 'Williams Vix Fix (Shifted)', color: color.gray, lineWidth: 2, style: 'histogram', histbase: -60 },
  { id: 'plot11', title: 'WVF Upper Band', color: color.aqua, lineWidth: 1 },
  { id: 'plot12', title: 'WVF Lower Band', color: color.aqua, lineWidth: 1 },
];

/** hline(50 / obStart / osStart) with the default levels */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_mid', price: 50, title: 'Middle', color: String(color.new('#787B86', 60)), linestyle: 'dotted' },
  { id: 'hline_ob', price: 70, title: 'Overbought', color: String(color.new('#787B86', 70)), linestyle: 'dotted' },
  { id: 'hline_os', price: 44, title: 'Oversold', color: String(color.new('#787B86', 70)), linestyle: 'dotted' },
];

/** fill(obLine, osLine, color.new(bgBandColor, bgBandOpacity)) with the default colour */
export const fillConfig: FillConfig[] = [
  { id: 'fill_obos', plot1: 'hline_ob', plot2: 'hline_os', color: String(color.new(color.blue, 92)), title: 'OB/OS Background' },
];

export const metadata = {
  title: 'ALL-IN-ONE RSI (Cloud + ORIGINAL Divergence + StochRSI + CM_WVF ORIGINAL + BUY/SELL) [Color Settings]',
  shortTitle: 'ALL-IN-ONE RSI (Cloud + ORIGINAL Divergence + StochRSI + CM_WVF ORIGINAL + BUY/SELL) [Color Settings]',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
/** Pine a != b: false with na */
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

type Point = { time: number; value: number; color?: string };

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

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface AioVars {
  /** ta.barssince(plFound[1]) / ta.barssince(phFound[1]): run on every bar */
  sincePl: number;
  sincePh: number;
  /** ta.valuewhen(found, x, 1): the value of the found bar before the latest one (prev), and the latest one */
  plOscPrev: number;
  plOscLast: number;
  plLowPrev: number;
  plLowLast: number;
  phOscPrev: number;
  phOscLast: number;
  phHighPrev: number;
  phHighLast: number;
}

interface AioRun extends BarRunState<AioVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  base: ReturnType<typeof taStep.ema>;
  oscMin: WindowExtreme;
  oscMax: WindowExtreme;
  k: WindowSma;
  d: WindowSma;
  kOverD: ReturnType<typeof taStep.crossover>;
  kUnderD: ReturnType<typeof taStep.crossunder>;
  crossUpOS: ReturnType<typeof taStep.crossover>;
  crossDownOB: ReturnType<typeof taStep.crossunder>;
  exitPurpleUp: ReturnType<typeof taStep.crossover>;
  exitBlueDown: ReturnType<typeof taStep.crossunder>;
  pivotLow: PivotStep;
  pivotHigh: PivotStep;
  hc: WindowExtreme;
  devW: WindowStdev;
  midW: WindowSma;
  rangeHigh: WindowExtreme;
  rangeLow: WindowExtreme;
  osc: number[];
  plFound: boolean[];
  phFound: boolean[];
  plots: Point[][];
  cloud: string[];
  markers: MarkerData[];
}

function study(inputs: Partial<AllInOneRsiSystemInputs>): BarStudy<AioRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  const lbR = cfg.lbR;
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const rsiCol = String(color.new(cfg.rsiColor, 0));
  const kCol = String(color.new(cfg.stochKColor, cfg.stochLineOpacity));
  const dCol = String(color.new(cfg.stochDColor, cfg.stochLineOpacity));
  const noneColor = String(color.new(color.white, 100));
  const buyCol = String(color.new(cfg.buyColor, 0));
  const sellCol = String(color.new(cfg.sellColor, 0));
  const textColor = cfg.labelTextColor;
  const obosFill = String(color.new(cfg.bgBandColor, cfg.bgBandOpacity));
  const inRange = (bars_: number) => cfg.rangeLower <= bars_ && bars_ <= cfg.rangeUpper;
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const s: AioRun = {
        rsi: taStep.rsi(cfg.rsiLen), base: taStep.ema(cfg.baseLen),
        oscMin: new WindowExtreme(true, cfg.stochLen), oscMax: new WindowExtreme(false, cfg.stochLen),
        k: new WindowSma(cfg.kLen), d: new WindowSma(cfg.dLen),
        kOverD: taStep.crossover(), kUnderD: taStep.crossunder(),
        crossUpOS: taStep.crossover(), crossDownOB: taStep.crossunder(),
        exitPurpleUp: taStep.crossover(), exitBlueDown: taStep.crossunder(),
        pivotLow: new PivotStep(cfg.lbL, lbR, false), pivotHigh: new PivotStep(cfg.lbL, lbR, true),
        hc: new WindowExtreme(false, cfg.pd), devW: new WindowStdev(cfg.bbl), midW: new WindowSma(cfg.bbl),
        rangeHigh: new WindowExtreme(false, cfg.lb), rangeLow: new WindowExtreme(true, cfg.lb),
        osc: [], plFound: [], phFound: [],
        plots: Array.from({ length: 13 }, () => []),
        cloud: [], markers: [],
        steps: [],
        vars: {
          sincePl: NaN, sincePh: NaN, plOscPrev: NaN, plOscLast: NaN, plLowPrev: NaN, plLowLast: NaN,
          phOscPrev: NaN, phOscLast: NaN, phHighPrev: NaN, phHighLast: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [
        s.rsi, s.base, s.oscMin, s.oscMax, s.k, s.d, s.kOverD, s.kUnderD, s.crossUpOS, s.crossDownOB, s.exitPurpleUp,
        s.exitBlueDown, s.pivotLow, s.pivotHigh, s.hc, s.devW, s.midW, s.rangeHigh, s.rangeLow,
      ];
      s.lists = [s.markers];
      s.series = [s.osc, s.plFound, s.phFound, ...s.plots, s.cloud];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const v = s.vars;

      // Core
      const osc = s.rsi.step(value(b));
      s.osc[i] = osc;
      const base = s.base.step(osc);

      // Stoch RSI: stochRSI = oscMax != oscMin ? (osc - oscMin) / (oscMax - oscMin) : 0.0 (0 while na)
      const oscMin = s.oscMin.step(osc);
      const oscMax = s.oscMax.step(osc);
      const stoch100 = (ne(oscMax, oscMin) ? (osc - oscMin) / (oscMax - oscMin) : 0.0) * 100.0;
      const K = s.k.step(stoch100);
      const D = s.d.step(K);
      const kOverD = s.kOverD.step(K, D);
      const kUnderD = s.kUnderD.step(K, D);

      // BUY / SELL
      const crossUpOS = s.crossUpOS.step(osc, cfg.osStart);
      const crossDownOB = s.crossDownOB.step(osc, cfg.obStart);
      const exitPurpleUp = s.exitPurpleUp.step(osc, cfg.osExtreme);
      const exitBlueDown = s.exitBlueDown.step(osc, cfg.obExtreme);

      // Divergences
      const pivotLow = s.pivotLow.step(i, osc);
      const pivotHigh = s.pivotHigh.step(i, osc);
      const o = i - lbR >= 0 ? s.osc[i - lbR] : NaN;
      const lowLbr = i - lbR >= 0 ? bars[i - lbR].low : NaN;
      const highLbr = i - lbR >= 0 ? bars[i - lbR].high : NaN;
      if (i > 0 && s.plFound[i - 1]) v.sincePl = 0;
      else if (!isNaN(v.sincePl)) v.sincePl++;
      if (i > 0 && s.phFound[i - 1]) v.sincePh = 0;
      else if (!isNaN(v.sincePh)) v.sincePh++;

      const plFound = !isNaN(pivotLow);
      const phFound = !isNaN(pivotHigh);
      s.plFound[i] = plFound;
      s.phFound[i] = phFound;
      if (plFound) {
        v.plOscPrev = v.plOscLast;
        v.plOscLast = o;
        v.plLowPrev = v.plLowLast;
        v.plLowLast = lowLbr;
      }
      if (phFound) {
        v.phOscPrev = v.phOscLast;
        v.phOscLast = o;
        v.phHighPrev = v.phHighLast;
        v.phHighLast = highLbr;
      }
      const inRangePl = inRange(v.sincePl);
      const inRangePh = inRange(v.sincePh);
      const vwPlOsc = v.plOscPrev;
      const vwPlLow = v.plLowPrev;
      const vwPhOsc = v.phOscPrev;
      const vwPhHigh = v.phHighPrev;

      // Regular bullish: osc higher low, price lower low
      const oscHL = gt(o, vwPlOsc) && inRangePl;
      const priceLL = lt(lowLbr, vwPlLow);
      const bullCond = cfg.plotBull && priceLL && oscHL && plFound;
      // Hidden bullish: osc lower low, price higher low
      const oscLL = lt(o, vwPlOsc) && inRangePl;
      const priceHL = gt(lowLbr, vwPlLow);
      const hiddenBullCond = cfg.plotHiddenBull && priceHL && oscLL && plFound;
      // Regular bearish: osc lower high, price higher high
      const oscLH = lt(o, vwPhOsc) && inRangePh;
      const priceHH = gt(highLbr, vwPhHigh);
      const bearCond = cfg.plotBear && priceHH && oscLH && phFound;
      // Hidden bearish: osc higher high, price lower high
      const oscHH = gt(o, vwPhOsc) && inRangePh;
      const priceLH = lt(highLbr, vwPhHigh);
      const hiddenBearCond = cfg.plotHiddenBear && priceLH && oscHH && phFound;

      // CM Williams Vix Fix
      const hc = s.hc.step(b.close);
      const wvf = ((hc - b.low) / hc) * 100.0;
      const sDevW = cfg.mult * s.devW.step(wvf);
      const midLineW = s.midW.step(wvf);
      const lowerBandW = midLineW - sDevW;
      const upperBandW = midLineW + sDevW;
      const rangeHighW = s.rangeHigh.step(wvf) * cfg.ph;
      const rangeLowW = s.rangeLow.step(wvf) * cfg.pl;

      // Plots
      const p = s.plots;
      p[0][i] = { time, value: osc, color: rsiCol };
      p[1][i] = { time, value: base, color: cfg.baseColor };
      p[2][i] = { time, value: cfg.showStoch ? K : NaN, color: kCol };
      p[3][i] = { time, value: cfg.showStoch ? D : NaN, color: dCol };
      // plot(found ? osc[lbR] : na, offset = -lbR, color = cond ? divColor : noneColor): the value of bar i on bar
      // i - lbR (bar i is the only writer of that slot)
      if (i >= Math.max(lbR, 0)) {
        const at = bars[i - lbR].time;
        p[4][i - lbR] = { time: at, value: plFound ? fin(o) : NaN, color: bullCond ? cfg.bullDivColor : noneColor };
        p[5][i - lbR] = { time: at, value: plFound ? fin(o) : NaN, color: hiddenBullCond ? cfg.hiddenBullDivColor : noneColor };
        p[6][i - lbR] = { time: at, value: phFound ? fin(o) : NaN, color: bearCond ? cfg.bearDivColor : noneColor };
        p[7][i - lbR] = { time: at, value: phFound ? fin(o) : NaN, color: hiddenBearCond ? cfg.hiddenBearDivColor : noneColor };
      }
      const showHp = cfg.showWVF && cfg.hp;
      const showSd = cfg.showWVF && cfg.sd;
      p[8][i] = { time, value: showHp ? fin(cfg.wvfBase + rangeHighW) : NaN, color: cfg.wvfRangeColor };
      p[9][i] = { time, value: showHp ? fin(cfg.wvfBase + rangeLowW) : NaN, color: cfg.wvfRangeColor };
      // colW = (wvf >= upperBandW or wvf >= rangeHighW) ? wvfSpikeColor : wvfNormalColor
      p[10][i] = {
        time, value: cfg.showWVF ? fin(cfg.wvfBase + wvf) : NaN,
        color: ge(wvf, upperBandW) || ge(wvf, rangeHighW) ? cfg.wvfSpikeColor : cfg.wvfNormalColor,
      };
      p[11][i] = { time, value: showSd ? fin(cfg.wvfBase + upperBandW) : NaN, color: cfg.wvfBandColor };
      p[12][i] = { time, value: showSd ? fin(cfg.wvfBase + lowerBandW) : NaN, color: cfg.wvfBandColor };

      // Cloud colour: osc <= osExtreme ? purple : osc <= osStart ? red : osc >= obExtreme ? blue : osc >= obStart ? green : na
      if (!cfg.showCloud) s.cloud[i] = 'transparent';
      else {
        const c = le(osc, cfg.osExtreme) ? cfg.cloudExtremeOS : le(osc, cfg.osStart) ? cfg.cloudBearColor
          : ge(osc, cfg.obExtreme) ? cfg.cloudExtremeOB : ge(osc, cfg.obStart) ? cfg.cloudBullColor : null;
        s.cloud[i] = c === null ? 'transparent' : String(color.new(c, cfg.cloudOp));
      }

      // Markers
      const stochBull = kOverD && lt(K, 20);
      const stochBear = kUnderD && gt(K, 80);
      const buyCond = (cfg.buyOnExtremeOS && crossUpOS) || (cfg.buyOnPurpleExit && exitPurpleUp);
      const sellCond = (cfg.sellOnExtremeOB && crossDownOB) || (cfg.sellOnBlueExit && exitBlueDown);
      const buyFinal = cfg.showBuySell && buyCond && (!cfg.buySellUseStoch || stochBull);
      const sellFinal = cfg.showBuySell && sellCond && (!cfg.buySellUseStoch || stochBear);
      // plotshape(buyFinal ? osc : na, "BUY", shape.labelup, location.absolute, text = "BUY", size = size.small)
      if (buyFinal && !isNaN(osc)) {
        s.markers.push({ id: 'shape0', time, position: 'atPriceBottom', price: osc, shape: 'labelUp', color: buyCol, text: 'BUY',
          textColor, size: 'small' });
      }
      if (sellFinal && !isNaN(osc)) {
        s.markers.push({ id: 'shape1', time, position: 'atPriceTop', price: osc, shape: 'labelDown', color: sellCol, text: 'SELL',
          textColor, size: 'small' });
      }
      // Divergence labels: plotshape(cond ? osc[lbR] : na, offset = -lbR, location.absolute)
      const price = o;
      if (i - lbR < 0 || isNaN(price)) return;
      const at = bars[i - lbR].time;
      if (bullCond) {
        s.markers.push({ id: 'shape2', time: at, position: 'atPriceBottom', price, shape: 'labelUp', color: cfg.bullDivColor, text: ' Bull ',
          textColor });
      }
      if (hiddenBullCond) {
        s.markers.push({ id: 'shape3', time: at, position: 'atPriceBottom', price, shape: 'labelUp', color: cfg.bullDivColor,
          text: ' H Bull ', textColor });
      }
      if (bearCond) {
        s.markers.push({ id: 'shape4', time: at, position: 'atPriceTop', price, shape: 'labelDown', color: cfg.bearDivColor, text: ' Bear ',
          textColor });
      }
      if (hiddenBearCond) {
        s.markers.push({ id: 'shape5', time: at, position: 'atPriceTop', price, shape: 'labelDown', color: cfg.bearDivColor,
          text: ' H Bear ', textColor });
      }
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      const divCount = Math.max(0, n - Math.max(lbR, 0));
      s.plots.forEach((pts, k) => { plots[`plot${k}`] = k >= 4 && k <= 7 ? pts.slice(0, divCount) : pts.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        hlines: [
          { value: 50, options: { title: 'Middle', color: String(color.new('#787B86', 60)), linestyle: 'dotted' } },
          { value: cfg.obStart, options: { title: 'Overbought', color: String(color.new('#787B86', 70)), linestyle: 'dotted' } },
          { value: cfg.osStart, options: { title: 'Oversold', color: String(color.new('#787B86', 70)), linestyle: 'dotted' } },
        ],
        fills: [
          // fill(pOsc, pBase, color = showCloud ? cloudColor : na)
          { plot1: 'plot0', plot2: 'plot1', colors: s.cloud.slice() },
          // fill(obLine, osLine, title = "OB/OS Background", color = color.new(bgBandColor, bgBandOpacity))
          { plot1: 'hline_ob', plot2: 'hline_os', options: { title: 'OB/OS Background' }, colors: new Array<string>(n).fill(obosFill) },
        ],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AllInOneRsiSystemInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AllInOneRsiSystemInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const AllInOneRsiSystem = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
};
