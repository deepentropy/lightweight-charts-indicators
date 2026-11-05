/**
 * VCO Fusion
 *
 * A channel around the SMA of the candle midpoint, with a half width of the average range * scale, widened by the
 * ratio of the average body to the average range. The oscillator is the close position in the channel (-50 at the
 * lower band, +50 at the upper band, clamped to -100..100). MA 1 = SMA(EMA(osc, smoothing 1), length 1) and
 * MA 2 = SMA(EMA(osc, smoothing 2), length 2); the histogram is MA 1 - MA 2. The trend (line and fill colour) turns
 * up / down on the crosses of MA 1 and MA 2. Diamonds mark histogram turns beyond the peak levels, triangles the
 * crosses of MA 1 with the oversold / overbought levels, circles the MA crosses with MA 1 inside a range, and pivot
 * divergences between MA 1 and the price give Bull Div / Bear Div labels. The overbought / oversold lines are more
 * opaque as MA 1 gets closer to them; gradient fills go from MA 1 to zero.
 * Alerts (alertcondition, `alerts` of the result): long / short (triangles), bull / bear cross in range (circles),
 * histogram peak up / down (diamonds) and bullish / bearish divergence (on the bar where the pivot is confirmed).
 *
 * Reference: "VCO Fusion" by Uncle_the_shooter
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Uncle_the_shooter
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type Committable, type BarStudy, type IndicatorRun } from '../live-run';

export interface VcoFusionInputs {
  /** Volatility window */
  length: number;
  /** Band scaling (%) */
  scale: number;
  overbought: number;
  oversold: number;
  /** EMA smoothing of MA 1 */
  smoothLen1: number;
  /** SMA length of MA 1 */
  maLen1: number;
  /** EMA smoothing of MA 2 */
  smoothLen2: number;
  /** SMA length of MA 2 */
  maLen2: number;
  bullCircleUpper: number;
  bullCircleLower: number;
  bearCircleUpper: number;
  bearCircleLower: number;
  /** Histogram peak down level (diamonds) */
  histPeakUpper: number;
  /** Histogram peak up level (diamonds) */
  histPeakLower: number;
  showDivergence: boolean;
  /** Pivot lookback (left / right) */
  pivotLength: number;
  colBullMain: string;
  colBearMain: string;
  bullDivColor: string;
  bearDivColor: string;
  divTextColor: string;
  colOB: string;
  colOS: string;
  /** Draw the overbought / oversold lines with a dynamic transparency */
  useDynamicLevels: boolean;
  /** Transparency of a weak signal */
  minTransp: number;
  /** Transparency of a strong signal */
  maxTransp: number;
  /** Overbought / oversold line width (Pine input; the plot width is static) */
  levelLineWidth: number;
}

const BULL = 'rgb(6, 162, 47)';
const BEAR = 'rgb(207, 23, 23)';

export const defaultInputs: VcoFusionInputs = {
  length: 10,
  scale: 200,
  overbought: 25,
  oversold: -25,
  smoothLen1: 7,
  maLen1: 5,
  smoothLen2: 10,
  maLen2: 5,
  bullCircleUpper: 20,
  bullCircleLower: 1,
  bearCircleUpper: -1,
  bearCircleLower: -20,
  histPeakUpper: 3,
  histPeakLower: -3,
  showDivergence: true,
  pivotLength: 2,
  colBullMain: BULL,
  colBearMain: BEAR,
  bullDivColor: BULL,
  bearDivColor: BEAR,
  divTextColor: color.white,
  colOB: BEAR,
  colOS: BULL,
  useDynamicLevels: true,
  minTransp: 85,
  maxTransp: 10,
  levelLineWidth: 4,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Volatility Window', defval: 10, min: 1, group: 'Channel / Oscillator' },
  { id: 'scale', type: 'float', title: 'Band Scaling (%)', defval: 200, min: 100, step: 5, group: 'Channel / Oscillator' },
  { id: 'overbought', type: 'float', title: 'Overbought Level', defval: 25, step: 0.1, group: 'Channel / Oscillator' },
  { id: 'oversold', type: 'float', title: 'Oversold Level', defval: -25, step: 0.1, group: 'Channel / Oscillator' },
  { id: 'smoothLen1', type: 'int', title: 'Smoothing 1 (EMA)', defval: 7, min: 1, group: 'MA1 / MA2' },
  { id: 'maLen1', type: 'int', title: 'MA 1 Length (SMA)', defval: 5, min: 1, group: 'MA1 / MA2' },
  { id: 'smoothLen2', type: 'int', title: 'Smoothing 2 (EMA)', defval: 10, min: 1, group: 'MA1 / MA2' },
  { id: 'maLen2', type: 'int', title: 'MA 2 Length (SMA)', defval: 5, min: 1, group: 'MA1 / MA2' },
  { id: 'bullCircleUpper', type: 'float', title: 'Bull Signal – Upper Filter Level', defval: 20, step: 0.5, group: 'SIGNALS' },
  { id: 'bullCircleLower', type: 'float', title: 'Bull Signal – Lower Filter Level', defval: 1, step: 0.5, group: 'SIGNALS' },
  { id: 'bearCircleUpper', type: 'float', title: 'Bear Signal – Upper Filter Level', defval: -1, step: 0.5, group: 'SIGNALS' },
  { id: 'bearCircleLower', type: 'float', title: 'Bear Signal – Lower Filter Level', defval: -20, step: 0.5, group: 'SIGNALS' },
  { id: 'histPeakUpper', type: 'float', title: 'Histogram Peak Down Level (diamonds)', defval: 3, step: 0.5, group: 'SIGNALS' },
  { id: 'histPeakLower', type: 'float', title: 'Histogram Peak Up Level (diamonds)', defval: -3, step: 0.5, group: 'SIGNALS' },
  { id: 'showDivergence', type: 'bool', title: 'Show Divergences on MA1', defval: true, group: 'Divergences' },
  { id: 'pivotLength', type: 'int', title: 'Pivot Lookback (left/right)', defval: 2, min: 1, group: 'Divergences' },
  { id: 'colBullMain', type: 'color', title: 'Bull Color (MA lines / hist / gradient / labels)', defval: BULL, group: 'Colors' },
  { id: 'colBearMain', type: 'color', title: 'Bear Color (MA lines / hist / gradient / labels)', defval: BEAR, group: 'Colors' },
  { id: 'bullDivColor', type: 'color', title: 'Bullish Divergence', defval: BULL, group: 'Colors' },
  { id: 'bearDivColor', type: 'color', title: 'Bearish Divergence', defval: BEAR, group: 'Colors' },
  { id: 'divTextColor', type: 'color', title: 'Divergence Text', defval: color.white, group: 'Colors' },
  { id: 'colOB', type: 'color', title: 'Overbought Color', defval: BEAR, group: 'Colors' },
  { id: 'colOS', type: 'color', title: 'Oversold Color', defval: BULL, group: 'Colors' },
  { id: 'useDynamicLevels', type: 'bool', title: 'OB/OS Lines', defval: true, group: 'Colors' },
  { id: 'minTransp', type: 'int', title: 'Min. Transparency (weak signal)', defval: 85, min: 0, max: 100, group: 'Colors' },
  { id: 'maxTransp', type: 'int', title: 'Max. Transparency (strong signal)', defval: 10, min: 0, max: 100, group: 'Colors' },
  { id: 'levelLineWidth', type: 'int', title: 'OB/OS Line Thickness', defval: 4, min: 1, max: 6, group: 'Colors' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Overbought', color: BEAR, lineWidth: 4 },
  { id: 'plot1', title: 'Oversold', color: BULL, lineWidth: 4 },
  { id: 'plot2', title: 'MA 1', color: BULL, lineWidth: 2 },
  { id: 'plot3', title: 'MA 2', color: BULL, lineWidth: 2 },
  { id: 'plot4', title: 'MA 1 Fill Edge', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot5', title: 'MA 2 Fill Edge', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot6', title: 'Zero Fill Edge', color: 'transparent', lineWidth: 1, display: 'none' },
  { id: 'plot7', title: 'Histogram MA1-MA2', color: String(color.new(BULL, 60)), lineWidth: 1, style: 'area' },
  { id: 'plot8', title: 'Bull Div point', color: BULL, lineWidth: 2 },
  { id: 'plot9', title: 'Bear Div point', color: BEAR, lineWidth: 2 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, title: 'Zero', color: color.gray, linestyle: 'dashed' },
];

export const metadata = {
  title: 'VCO Fusion',
  shortTitle: 'VCO Fusion',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a >= b when b - a <= 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };
type Gradient = { topValue: number[]; bottomValue: number[]; topColor: Array<string | null>; bottomColor: Array<string | null> };

interface VcoVars {
  /** var bool trendUp = true */
  trendUp: boolean;
}

interface VcoRun extends BarRunState<VcoVars> {
  midStep: ExactSma;
  rangeStep: ExactSma;
  bodyStep: ExactSma;
  ema1: ReturnType<typeof taStep.ema>;
  ema2: ReturnType<typeof taStep.ema>;
  sma1: ExactSma;
  sma2: ExactSma;
  ph: PivotStep;
  pl: PivotStep;
  ma1: number[];
  ma2: number[];
  hist: number[];
  /** plot0 .. plot7 */
  plots: Point[][];
  /** plot8 / plot9: the value of bar i drawn on bar i - lb (no point for the first lb bars) */
  bullLine: Point[];
  bearLine: Point[];
  trendColors: string[];
  gradTop: Gradient;
  gradBottom: Gradient;
  /** ta.valuewhen(found, x, 1) histories */
  plOsc: number[];
  plLow: number[];
  phOsc: number[];
  phHigh: number[];
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

/** `ta.sma(source, length)` with a constant length: {@link ExactSum} divided by the length (the operations of taStep.sma) */
class ExactSma implements Committable {
  private readonly sum: ExactSum;
  private readonly len: number;

  constructor(length: number) {
    // the length checks of ta.sma (the same errors)
    taStep.sma().step(NaN, length);
    this.sum = new ExactSum(length);
    this.len = Math.floor(length);
  }

  step(x: number): number {
    return this.sum.step(x) / this.len;
  }

  commit(): void {
    this.sum.commit();
  }
}

function study(inputs: Partial<VcoFusionInputs>): BarStudy<VcoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const triangleOffset = 6.0;
  const circleOffset = 2.0;
  const ma1PeakTransp = 55;
  const masGradientTransp = 30;
  const lb = cfg.pivotLength;

  // Dynamic overbought / oversold colours
  const remap = (val: number, inMin: number, inMax: number, outMin: number, outMax: number) =>
    outMin + ((val - inMin) * (outMax - outMin)) / (inMax - inMin);
  // Pine math.round: half away from zero
  const pineRound = (x: number) => Math.sign(x) * Math.round(Math.abs(x));
  const obColor = (m1: number) => {
    if (!cfg.useDynamicLevels) return cfg.colOB;
    const rawDist = cfg.overbought - m1;
    const clamped = Math.max(0, Math.min(rawDist, cfg.overbought));
    return String(color.new(cfg.colOB, pineRound(remap(clamped, 0, cfg.overbought, cfg.maxTransp, cfg.minTransp))));
  };
  const osColor = (m1: number) => {
    if (!cfg.useDynamicLevels) return cfg.colOS;
    const rawDist = m1 - cfg.oversold;
    const clamped = Math.max(0, Math.min(rawDist, -cfg.oversold));
    return String(color.new(cfg.colOS, pineRound(remap(clamped, 0, -cfg.oversold, cfg.maxTransp, cfg.minTransp))));
  };

  const cBullPeak = String(color.new(cfg.colBullMain, ma1PeakTransp));
  const cBearPeak = String(color.new(cfg.colBearMain, ma1PeakTransp));
  const cBullZero = String(color.new(cfg.colBullMain, 100));
  const cBearZero = String(color.new(cfg.colBearMain, 100));
  const histBull = String(color.new(cfg.colBullMain, 60));
  const histBear = String(color.new(cfg.colBearMain, 60));
  const noDiv = String(color.new(color.white, 100));
  const bullLabel = String(color.new(cfg.bullDivColor, 40));
  const bearLabel = String(color.new(cfg.bearDivColor, 40));
  const fin = (v: number) => (Number.isFinite(v) ? v : NaN);
  const gradient = (): Gradient => ({ topValue: [], bottomValue: [], topColor: [], bottomColor: [] });

  return {
    init() {
      const s: VcoRun = {
        midStep: new ExactSma(cfg.length), rangeStep: new ExactSma(cfg.length), bodyStep: new ExactSma(cfg.length),
        ema1: taStep.ema(cfg.smoothLen1), ema2: taStep.ema(cfg.smoothLen2), sma1: new ExactSma(cfg.maLen1), sma2: new ExactSma(cfg.maLen2),
        ph: new PivotStep(lb, lb, true), pl: new PivotStep(lb, lb, false),
        ma1: [], ma2: [], hist: [], plots: Array.from({ length: 8 }, () => []), bullLine: [], bearLine: [],
        trendColors: [], gradTop: gradient(), gradBottom: gradient(), plOsc: [], plLow: [], phOsc: [], phHigh: [],
        markers: [], flags: Array.from({ length: 8 }, () => []), times: Array.from({ length: 8 }, () => []),
        steps: [], vars: { trendUp: true }, lists: [], series: [],
      };
      s.steps = [s.midStep, s.rangeStep, s.bodyStep, s.ema1, s.ema2, s.sma1, s.sma2, s.ph, s.pl];
      s.lists = [s.plOsc, s.plLow, s.phOsc, s.phHigh, s.markers, ...s.times];
      const g = (x: Gradient) => [x.topValue, x.bottomValue, x.topColor, x.bottomColor];
      s.series = [s.ma1, s.ma2, s.hist, ...s.plots, s.trendColors, ...g(s.gradTop), ...g(s.gradBottom), ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const t = b.time;

      // Channel and oscillator
      const midSma = s.midStep.step((b.high + b.low) / 2);
      const avgRange = s.rangeStep.step(b.high - b.low);
      const avgBody = s.bodyStep.step(Math.abs(b.close - b.open));
      const off = ((avgRange * cfg.scale) / 100) * (1 + avgBody / Math.max(avgRange, 1e-10));
      const upperBand = midSma + off;
      const lowerBand = midSma - off;
      const bandWidth = Math.max(upperBand - lowerBand, 1e-10);
      const rawBaseOsc = (100 * (b.close - lowerBand)) / bandWidth - 50;
      const osc = Math.max(Math.min(rawBaseOsc, 100), -100);
      const m1 = s.sma1.step(s.ema1.step(osc));
      const m2 = s.sma2.step(s.ema2.step(osc));
      const h = m1 - m2;
      const ma1 = s.ma1;
      const ma2 = s.ma2;
      ma1[i] = m1;
      ma2[i] = m2;
      s.hist[i] = h;

      // ta.crossover / ta.crossunder compare exactly (no 1e-10; na compares false)
      const up = i > 0 && m1 > m2 && ma1[i - 1] <= ma2[i - 1];
      const down = i > 0 && m1 < m2 && ma1[i - 1] >= ma2[i - 1];
      const crossoverLevel = (lvl: number) => i > 0 && m1 > lvl && ma1[i - 1] <= lvl;
      const crossunderLevel = (lvl: number) => i > 0 && m1 < lvl && ma1[i - 1] >= lvl;

      // Divergences: pivots of MA 1 and ta.valuewhen(found, x, 1) (x on the found bar before the latest one)
      const o = i - lb >= 0 ? ma1[i - lb] : NaN;
      let plFound = false;
      let phFound = false;
      let bullCond = false;
      let bearCond = false;
      if (cfg.showDivergence) {
        const lowLb = i - lb >= 0 ? bars[i - lb].low : NaN;
        const highLb = i - lb >= 0 ? bars[i - lb].high : NaN;
        plFound = !isNaN(s.pl.step(i, m1));
        if (plFound) {
          s.plOsc.push(o);
          s.plLow.push(lowLb);
        }
        const vwPlOsc = s.plOsc.length >= 2 ? s.plOsc[s.plOsc.length - 2] : NaN;
        const vwPlLow = s.plLow.length >= 2 ? s.plLow[s.plLow.length - 2] : NaN;
        bullCond = lt(lowLb, vwPlLow) && gt(o, vwPlOsc) && plFound;

        phFound = !isNaN(s.ph.step(i, m1));
        if (phFound) {
          s.phOsc.push(o);
          s.phHigh.push(highLb);
        }
        const vwPhOsc = s.phOsc.length >= 2 ? s.phOsc[s.phOsc.length - 2] : NaN;
        const vwPhHigh = s.phHigh.length >= 2 ? s.phHigh[s.phHigh.length - 2] : NaN;
        bearCond = gt(highLb, vwPhHigh) && lt(o, vwPhOsc) && phFound;
      }

      if (up) v.trendUp = true;
      if (down) v.trendUp = false;
      const trendColor = v.trendUp ? cfg.colBullMain : cfg.colBearMain;
      s.trendColors[i] = String(color.new(trendColor, masGradientTransp));

      const p = s.plots;
      p[0][i] = { time: t, value: cfg.useDynamicLevels ? cfg.overbought : NaN, color: obColor(m1) };
      p[1][i] = { time: t, value: cfg.useDynamicLevels ? cfg.oversold : NaN, color: osColor(m1) };
      p[2][i] = { time: t, value: fin(m1), color: trendColor };
      p[3][i] = { time: t, value: fin(m2), color: trendColor };
      p[4][i] = { time: t, value: fin(m1) };
      p[5][i] = { time: t, value: fin(m2) };
      p[6][i] = { time: t, value: 0 };
      p[7][i] = { time: t, value: fin(h), color: ge(h, 0) ? histBull : histBear };

      // Gradient MA 1 -> zero (above zero: bull colours, below zero: bear colours)
      const pos = gt(m1, 0);
      const neg = lt(m1, 0);
      const gT = s.gradTop;
      const gB = s.gradBottom;
      gT.topValue[i] = pos ? m1 : NaN;
      gT.bottomValue[i] = pos ? 0 : NaN;
      gT.topColor[i] = pos ? cBullPeak : null;
      gT.bottomColor[i] = pos ? cBullZero : null;
      gB.topValue[i] = neg ? 0 : NaN;
      gB.bottomValue[i] = neg ? m1 : NaN;
      gB.topColor[i] = neg ? cBearZero : null;
      gB.bottomColor[i] = neg ? cBearPeak : null;

      // Diamonds: histogram turns beyond the peak levels
      const h1 = i >= 1 ? s.hist[i - 1] : NaN;
      const h2 = i >= 2 ? s.hist[i - 2] : NaN;
      const histTurnDown = lt(h, h1) && gt(h1, h2) && gt(h1, cfg.histPeakUpper);
      const histTurnUp = gt(h, h1) && lt(h1, h2) && lt(h1, cfg.histPeakLower);
      if (histTurnDown && !isNaN(h)) {
        s.markers.push({ time: t, position: 'atPriceMiddle', price: h, shape: 'diamond', color: cfg.colBearMain, size: 'tiny', id: 'shape0' });
      }
      if (histTurnUp && !isNaN(h)) {
        s.markers.push({ time: t, position: 'atPriceMiddle', price: h, shape: 'diamond', color: cfg.colBullMain, size: 'tiny', id: 'shape1' });
      }
      // Triangles: MA 1 crosses the oversold / overbought levels
      const longSignal = crossoverLevel(cfg.oversold);
      const shortSignal = crossunderLevel(cfg.overbought);
      if (longSignal) {
        s.markers.push({ time: t, position: 'atPriceMiddle', price: cfg.oversold - triangleOffset, shape: 'triangleUp',
          color: cfg.colBullMain, size: 'tiny', id: 'shape2' });
      }
      if (shortSignal) {
        s.markers.push({ time: t, position: 'atPriceMiddle', price: cfg.overbought + triangleOffset, shape: 'triangleDown',
          color: cfg.colBearMain, size: 'tiny', id: 'shape3' });
      }
      // Circles: MA crosses with MA 1 inside the filter range
      const bullCrossSignal = up && ge(m1, cfg.bullCircleLower) && le(m1, cfg.bullCircleUpper);
      const bearCrossSignal = down && ge(m1, cfg.bearCircleLower) && le(m1, cfg.bearCircleUpper);
      if (bullCrossSignal) {
        s.markers.push({ time: t, position: 'atPriceMiddle', price: cfg.oversold - circleOffset, shape: 'circle',
          color: cfg.colBullMain, size: 'tiny', id: 'shape4' });
      }
      if (bearCrossSignal) {
        s.markers.push({ time: t, position: 'atPriceMiddle', price: cfg.overbought + circleOffset, shape: 'circle',
          color: cfg.colBearMain, size: 'tiny', id: 'shape5' });
      }
      const f = s.flags;
      f[0][i] = longSignal;
      f[1][i] = shortSignal;
      f[2][i] = bullCrossSignal;
      f[3][i] = bearCrossSignal;
      f[4][i] = histTurnUp;
      f[5][i] = histTurnDown;
      f[6][i] = cfg.showDivergence && bullCond;
      f[7][i] = cfg.showDivergence && bearCond;
      for (let k = 0; k < 8; k++) if (f[k][i]) s.times[k].push(t as number);

      // Divergences, offset = -lookbackRight: the value of bar i is drawn on bar i - lb (bar i is the only writer)
      if (i - lb >= 0) {
        const tp = bars[i - lb].time;
        s.bullLine[i - lb] = { time: tp, value: cfg.showDivergence && plFound ? fin(o) : NaN,
          color: bullCond ? cfg.bullDivColor : noDiv };
        s.bearLine[i - lb] = { time: tp, value: cfg.showDivergence && phFound ? fin(o) : NaN,
          color: bearCond ? cfg.bearDivColor : noDiv };
        if (cfg.showDivergence && bullCond && !isNaN(o)) {
          s.markers.push({ time: tp, position: 'atPriceBottom', price: o, shape: 'labelUp', color: bullLabel,
            text: 'Bull Div', textColor: cfg.divTextColor, size: 'tiny', id: 'shape6' });
        }
        if (cfg.showDivergence && bearCond && !isNaN(o)) {
          s.markers.push({ time: tp, position: 'atPriceTop', price: o, shape: 'labelDown', color: bearLabel,
            text: 'Bear Div', textColor: cfg.divTextColor, size: 'tiny', id: 'shape7' });
        }
      }
    },
    result(s, bars) {
      const n = bars.length;
      const shifted = Math.max(0, n - lb);
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = p.slice(); });
      plots.plot8 = s.bullLine.slice(0, shifted);
      plots.plot9 = s.bearLine.slice(0, shifted);
      const g = (x: Gradient): Gradient => ({
        topValue: x.topValue.slice(), bottomValue: x.bottomValue.slice(), topColor: x.topColor.slice(), bottomColor: x.bottomColor.slice(),
      });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        hlines: [{ value: 0, options: { title: 'Zero', color: color.gray, linestyle: 'dashed' } }],
        fills: [
          // fill(pMA1, pZero, top_value = ma1 > 0 ? ma1 : na, bottom_value = ma1 > 0 ? 0 : na, c_bull_peak -> c_bull_zero)
          { plot1: 'plot4', plot2: 'plot6', gradient: g(s.gradTop) },
          // fill(pZero, pMA1, top_value = ma1 < 0 ? 0 : na, bottom_value = ma1 < 0 ? ma1 : na, c_bear_zero -> c_bear_peak)
          { plot1: 'plot6', plot2: 'plot4', gradient: g(s.gradBottom) },
          // fill(pMA1, pMA2, color.new(trendUp ? colBullMain : colBearMain, 30))
          { plot1: 'plot4', plot2: 'plot5', colors: s.trendColors.slice() },
        ],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VcoFusionInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VcoFusionInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Long Signal', message: 'VCO Long Signal – MA1 crossed above Oversold' },
  { id: 'alert1', title: 'Short Signal', message: 'VCO Short Signal – MA1 crossed below Overbought' },
  { id: 'alert2', title: 'Bull Cross (Range Filter)', message: 'VCO Bull Cross – MA1 crossed above MA2 in bull range' },
  { id: 'alert3', title: 'Bear Cross (Range Filter)', message: 'VCO Bear Cross – MA1 crossed below MA2 in bear range' },
  { id: 'alert4', title: 'Histogram Peak Up', message: 'VCO Histogram turned UP (bullish wave turn)' },
  { id: 'alert5', title: 'Histogram Peak Down', message: 'VCO Histogram turned DOWN (bearish wave turn)' },
  { id: 'alert6', title: 'Bullish Divergence', message: 'VCO Bullish Divergence detected on MA1' },
  { id: 'alert7', title: 'Bearish Divergence', message: 'VCO Bearish Divergence detected on MA1' },
];

export const VcoFusion = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  alertConditions,
};
