/**
 * SMA Squeeze Oscillator
 *
 * Three SMAs of the close (6, 18, 26). A squeeze is on when the spread between the highest and the lowest of them is
 * below ATR * multiplier. The momentum is the SMA (3) of ((sma1 - sma2) + (sma1 - sma3)) / 2. Gradient fills from
 * the momentum to zero are green / red outside a squeeze and yellow inside it. Diamonds mark the momentum crosses of
 * zero, circles the first bar after a squeeze (both filtered by the close against an SMA filter when enabled).
 * Candles are coloured yellow in a squeeze, else green / red by the momentum sign. Pivot divergences between the
 * momentum and the price give Bull / Bear labels.
 * Alerts (alertcondition, `alerts` of the result): bull / bear cross of zero, first bar after a squeeze long / short,
 * bullish / bearish divergence (on the bar that confirms the pivot), true on the bars of each signal.
 *
 * Reference: "SMA Squeeze Oscillator" by Uncle_the_shooter
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Uncle_the_shooter
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, PlotCandleData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, PivotStep, type BarRunState, type Committable, type BarStudy, type IndicatorRun } from '../live-run';

export interface SmaSqueezeOscillatorInputs {
  /** SMA 1 length (squeeze and momentum) */
  len1: number;
  /** SMA 2 length (squeeze and momentum) */
  len2: number;
  /** SMA 3 length (squeeze and momentum) */
  len3: number;
  /** Filter the signals and the zero line colour by the close against the SMA filter */
  useSmaFilter: boolean;
  /** SMA filter length */
  smaFilterLen: number;
  /** ATR length */
  atrLen: number;
  /** ATR multiplier of the squeeze threshold */
  atrMult: number;
  /** SMA smoothing of the momentum */
  momentumSmoothing: number;
  /** Colour the candles (wave style) */
  enableCandleColor: boolean;
  /** Draw the divergences */
  calculateDivergence: boolean;
  /** Pivot length (left and right) */
  pivotLength: number;
  bullColor: string;
  bearColor: string;
  squeezeColor: string;
  bullCrossColor: string;
  bearCrossColor: string;
  firstLongColor: string;
  firstShortColor: string;
  /** Divergence text colour */
  textColor: string;
}

export const defaultInputs: SmaSqueezeOscillatorInputs = {
  len1: 6,
  len2: 18,
  len3: 26,
  useSmaFilter: true,
  smaFilterLen: 50,
  atrLen: 14,
  atrMult: 0.8,
  momentumSmoothing: 3,
  enableCandleColor: true,
  calculateDivergence: true,
  pivotLength: 2,
  bullColor: '#54b859',
  bearColor: '#e06161',
  squeezeColor: '#e9cd31',
  bullCrossColor: '#16b900',
  bearCrossColor: '#df0303',
  firstLongColor: '#16b900',
  firstShortColor: '#df0303',
  textColor: color.white,
};

export const inputConfig: InputConfig[] = [
  { id: 'len1', type: 'int', title: 'SMA 1 (used for Squeeze & Momentum)', defval: 6 },
  { id: 'len2', type: 'int', title: 'SMA 2 (used for Squeeze & Momentum)', defval: 18 },
  { id: 'len3', type: 'int', title: 'SMA 3 (used for Squeeze & Momentum)', defval: 26 },
  { id: 'useSmaFilter', type: 'bool', title: 'Enable SMA Filter', defval: true },
  { id: 'smaFilterLen', type: 'int', title: 'SMA Filter Length', defval: 50 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 0.8, step: 0.1 },
  { id: 'momentumSmoothing', type: 'int', title: 'Momentum SMA Smoothing', defval: 3 },
  { id: 'enableCandleColor', type: 'bool', title: 'Enable candle coloring (wave style)', defval: true },
  { id: 'calculateDivergence', type: 'bool', title: 'Enable Divergence', defval: true },
  { id: 'pivotLength', type: 'int', title: 'Pivot Length', defval: 2, min: 1 },
  { id: 'bullColor', type: 'color', title: 'Bullish color (green)', defval: '#54b859' },
  { id: 'bearColor', type: 'color', title: 'Bearish color (red)', defval: '#e06161' },
  { id: 'squeezeColor', type: 'color', title: 'Squeeze color (yellow)', defval: '#e9cd31' },
  { id: 'bullCrossColor', type: 'color', title: 'Bull Cross color', defval: '#16b900' },
  { id: 'bearCrossColor', type: 'color', title: 'Bear Cross color', defval: '#df0303' },
  { id: 'firstLongColor', type: 'color', title: '1st after Squeeze LONG color', defval: '#16b900' },
  { id: 'firstShortColor', type: 'color', title: '1st after Squeeze SHORT color', defval: '#df0303' },
  { id: 'textColor', type: 'color', title: 'Divergence Text Color', defval: color.white },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Zero Line Filter', color: '#54b859', lineWidth: 3 },
  { id: 'plot1', title: 'Momentum', color: '#54b859', lineWidth: 2 },
  { id: 'plot2', title: 'Zero (fill base)', color: color.blue, lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Bullish Divergence', color: '#54b859', lineWidth: 2 },
  { id: 'plot4', title: 'Bearish Divergence', color: '#e06161', lineWidth: 2 },
];

export const metadata = {
  title: 'SMA Squeeze Oscillator',
  shortTitle: 'SMA Squeeze Oscillator',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

type Point = { time: number; value: number; color?: string };
type Gradient = { topValue: number[]; bottomValue: number[]; topColor: Array<string | null>; bottomColor: Array<string | null> };
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

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] };

interface SsoVars {
  /** ta.valuewhen(found, x, 1): the last two values of x on the found bars (prev: the one before the latest) */
  plOsc: number;
  plOscPrev: number;
  plLow: number;
  plLowPrev: number;
  phOsc: number;
  phOscPrev: number;
  phHigh: number;
  phHighPrev: number;
  /** ta.barssince(found): na until the first found bar */
  bsLow: number;
  bsHigh: number;
}

interface SsoRun extends BarRunState<SsoVars> {
  sma1: WindowSma;
  sma2: WindowSma;
  sma3: WindowSma;
  smaFilter: WindowSma;
  atr: ReturnType<typeof taStep.atr>;
  momentum: WindowSma;
  crossUp: ReturnType<typeof taStep.crossover>;
  crossDown: ReturnType<typeof taStep.crossunder>;
  pivotHigh: PivotStep;
  pivotLow: PivotStep;
  isSqueeze: boolean[];
  momentumArr: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  /** The divergence lines: one point per bar from bar lb, drawn lb bars back */
  plot3: Point[];
  plot4: Point[];
  gBull: Gradient;
  gBear: Gradient;
  gSqBull: Gradient;
  gSqBear: Gradient;
  squeezeFill: string[];
  candles: PlotCandleData[];
  markers: MarkerData[];
  barColors: BarColorData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<SmaSqueezeOscillatorInputs>): BarStudy<SsoRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };

  // Colours
  const colBullStrong = String(color.new(cfg.bullColor, 0));
  const colBullFade = String(color.new(cfg.bullColor, 90));
  const colBearStrong = String(color.new(cfg.bearColor, 0));
  const colBearFade = String(color.new(cfg.bearColor, 90));
  const sqStrong = String(color.new(cfg.squeezeColor, 0));
  const sqFade = String(color.new(cfg.squeezeColor, 90));
  const sqFill = String(color.new(cfg.squeezeColor, 85));
  const bullLabel = String(color.new(cfg.bullColor, 10));
  const bearLabel = String(color.new(cfg.bearColor, 10));

  // Divergence
  const lb = cfg.pivotLength;
  const rangeUpper = 60;
  const rangeLower = 1;

  const newGradient = (): Gradient => ({ topValue: [], bottomValue: [], topColor: [], bottomColor: [] });
  const gradArrays = (g: Gradient) => [g.topValue, g.bottomValue, g.topColor, g.bottomColor];
  const setGrad = (g: Gradient, i: number, on: boolean, top: number, bottom: number, topC: string, bottomC: string) => {
    g.topValue[i] = on ? top : NaN;
    g.bottomValue[i] = on ? bottom : NaN;
    g.topColor[i] = on ? topC : null;
    g.bottomColor[i] = on ? bottomC : null;
  };
  const sliceGrad = (g: Gradient): Gradient => ({
    topValue: g.topValue.slice(), bottomValue: g.bottomValue.slice(), topColor: g.topColor.slice(), bottomColor: g.bottomColor.slice(),
  });

  return {
    init() {
      const s: SsoRun = {
        sma1: new WindowSma(cfg.len1), sma2: new WindowSma(cfg.len2), sma3: new WindowSma(cfg.len3), smaFilter: new WindowSma(cfg.smaFilterLen), atr: taStep.atr(cfg.atrLen),
        momentum: new WindowSma(cfg.momentumSmoothing), crossUp: taStep.crossover(), crossDown: taStep.crossunder(),
        pivotHigh: new PivotStep(lb, lb, true), pivotLow: new PivotStep(lb, lb, false),
        isSqueeze: [], momentumArr: [], plot0: [], plot1: [], plot2: [], plot3: [], plot4: [],
        gBull: newGradient(), gBear: newGradient(), gSqBull: newGradient(), gSqBear: newGradient(), squeezeFill: [],
        candles: [], markers: [], barColors: [], flags: alertConditions.map(() => []), times: alertConditions.map(() => []),
        steps: [],
        vars: {
          plOsc: NaN, plOscPrev: NaN, plLow: NaN, plLowPrev: NaN, phOsc: NaN, phOscPrev: NaN, phHigh: NaN, phHighPrev: NaN,
          bsLow: NaN, bsHigh: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [s.sma1, s.sma2, s.sma3, s.smaFilter, s.atr, s.momentum, s.crossUp, s.crossDown, s.pivotHigh, s.pivotLow];
      s.lists = [s.plot3, s.plot4, s.markers, s.barColors, ...s.times];
      s.series = [
        s.isSqueeze, s.momentumArr, s.plot0, s.plot1, s.plot2, ...gradArrays(s.gBull), ...gradArrays(s.gBear),
        ...gradArrays(s.gSqBull), ...gradArrays(s.gSqBear), s.squeezeFill, s.candles, ...s.flags,
      ];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time;

      // Calculations
      const sma1 = s.sma1.step(b.close);
      const sma2 = s.sma2.step(b.close);
      const sma3 = s.sma3.step(b.close);
      const smaFilter = s.smaFilter.step(b.close);
      const atr = s.atr.step(b.high, b.low, b.close);
      const maxSma = Math.max(sma1, Math.max(sma2, sma3));
      const minSma = Math.min(sma1, Math.min(sma2, sma3));
      const sq = lt(maxSma - minSma, atr * cfg.atrMult);
      s.isSqueeze[i] = sq;
      const rawMomentum = (sma1 - sma2 + sma1 - sma3) / 2;
      const m = s.momentum.step(rawMomentum);
      s.momentumArr[i] = m;
      const crossUp = s.crossUp.step(m, 0);
      const crossDown = s.crossDown.step(m, 0);

      // Divergence
      const pivotHighOsc = s.pivotHigh.step(i, m);
      const pivotLowOsc = s.pivotLow.step(i, m);
      const o = i - lb >= 0 ? s.momentumArr[i - lb] : NaN;
      const lowLbr = i - lb >= 0 ? bars[i - lb].low : NaN;
      const highLbr = i - lb >= 0 ? bars[i - lb].high : NaN;
      const plFound = !isNaN(pivotLowOsc);
      const phFound = !isNaN(pivotHighOsc);
      // ta.valuewhen(found, x, 1): x on the found bar before the latest one (the latest can be the current bar)
      if (plFound) {
        v.plOscPrev = v.plOsc;
        v.plOsc = o;
        v.plLowPrev = v.plLow;
        v.plLow = lowLbr;
      }
      if (phFound) {
        v.phOscPrev = v.phOsc;
        v.phOsc = o;
        v.phHighPrev = v.phHigh;
        v.phHigh = highLbr;
      }
      const prevOscLow = v.plOscPrev;
      const prevPriceLow = v.plLowPrev;
      const prevOscHigh = v.phOscPrev;
      const prevPriceHigh = v.phHighPrev;
      // ta.barssince(...)[1]: the count of the previous bar
      const bsLowPrev = v.bsLow;
      const bsHighPrev = v.bsHigh;
      v.bsLow = plFound ? 0 : isNaN(v.bsLow) ? NaN : v.bsLow + 1;
      v.bsHigh = phFound ? 0 : isNaN(v.bsHigh) ? NaN : v.bsHigh + 1;
      const inRangeLow = bsLowPrev >= rangeLower && bsLowPrev <= rangeUpper;
      const inRangeHigh = bsHighPrev >= rangeLower && bsHighPrev <= rangeUpper;
      const bullCond = plFound && lt(lowLbr, prevPriceLow) && gt(o, prevOscLow) && inRangeLow;
      const bearCond = phFound && gt(highLbr, prevPriceHigh) && lt(o, prevOscHigh) && inRangeHigh;

      const trendUp = !cfg.useSmaFilter || gt(b.close, smaFilter);
      const trendDown = !cfg.useSmaFilter || lt(b.close, smaFilter);

      // plot(0, 'Zero Line Filter', color = not useSmaFilter ? bullColor : close > smaFilter ? bullColor : bearColor)
      s.plot0[i] = { time: t, value: 0, color: trendUp ? cfg.bullColor : cfg.bearColor };
      s.plot1[i] = { time: t, value: m, color: ge(m, 0) ? cfg.bullColor : cfg.bearColor };
      s.plot2[i] = { time: t, value: 0 };

      // Fills between the momentum and zero
      const pos = gt(m, 0);
      const neg = lt(m, 0);
      setGrad(s.gBull, i, !sq && pos, m, 0, colBullStrong, colBullFade);
      setGrad(s.gBear, i, !sq && neg, 0, m, colBearFade, colBearStrong);
      s.squeezeFill[i] = sq ? sqFill : 'transparent';
      setGrad(s.gSqBull, i, sq && pos, m, 0, sqStrong, sqFade);
      setGrad(s.gSqBear, i, sq && neg, 0, m, sqFade, sqStrong);

      // Cross signals (diamonds at the momentum)
      const bullCross = crossUp && trendUp && !isNaN(m);
      const bearCross = crossDown && trendDown && !isNaN(m);
      if (bullCross) {
        s.markers.push({ id: 'shape0', time: t, position: 'atPriceMiddle', price: m, shape: 'diamond', color: cfg.bullCrossColor, size: 'small' });
      }
      if (bearCross) {
        s.markers.push({ id: 'shape1', time: t, position: 'atPriceMiddle', price: m, shape: 'diamond', color: cfg.bearCrossColor, size: 'small' });
      }
      // First bar after a squeeze (circles at the momentum)
      const nowOutOfSqueeze = !sq && i > 0 && s.isSqueeze[i - 1];
      const firstLong = nowOutOfSqueeze && pos && trendUp;
      const firstShort = nowOutOfSqueeze && neg && trendDown;
      if (firstLong) {
        s.markers.push({ id: 'shape2', time: t, position: 'atPriceMiddle', price: m, shape: 'circle', color: cfg.firstLongColor, size: 'small' });
      }
      if (firstShort) {
        s.markers.push({ id: 'shape3', time: t, position: 'atPriceMiddle', price: m, shape: 'circle', color: cfg.firstShortColor, size: 'small' });
      }
      // alertcondition(bullCross / bearCross / firstAfterSqueezeLong / firstAfterSqueezeShort /
      //   calculateDivergence and bullCond / calculateDivergence and bearCond)
      const flag = (k: number, f: boolean) => {
        s.flags[k][i] = f;
        if (f) s.times[k].push(t as number);
      };
      flag(0, bullCross);
      flag(1, bearCross);
      flag(2, firstLong);
      flag(3, firstShort);
      flag(4, cfg.calculateDivergence && bullCond);
      flag(5, cfg.calculateDivergence && bearCond);

      // Wave candles: barcolor and plotcandle(force_overlay = true); colour na draws nothing
      const wave = sq ? sqStrong : pos ? colBullStrong : neg ? colBearStrong : null;
      const candleColor = cfg.enableCandleColor ? wave : null;
      if (candleColor) s.barColors.push({ time: t, color: candleColor });
      const cc = candleColor ?? 'transparent';
      s.candles[i] = { time: t, open: b.open, high: b.high, low: b.low, close: b.close, color: cc, wickColor: cc,
        borderColor: cc, forceOverlay: true };

      // Divergences, offset = -lookbackRight: the value of bar i is drawn on bar i - lb
      if (i - lb >= 0) {
        const tp = bars[i - lb].time;
        s.plot3.push({ time: tp, value: cfg.calculateDivergence && plFound ? o : NaN,
          color: cfg.calculateDivergence && bullCond ? cfg.bullColor : 'transparent' });
        s.plot4.push({ time: tp, value: cfg.calculateDivergence && phFound ? o : NaN,
          color: cfg.calculateDivergence && bearCond ? cfg.bearColor : 'transparent' });
        if (cfg.calculateDivergence && bullCond && !isNaN(o)) {
          s.markers.push({ id: 'shape4', time: tp, position: 'atPriceBottom', price: o, shape: 'labelUp', color: bullLabel, text: 'Bull',
            textColor: cfg.textColor, size: 'small' });
        }
        if (cfg.calculateDivergence && bearCond && !isNaN(o)) {
          s.markers.push({ id: 'shape5', time: tp, position: 'atPriceTop', price: o, shape: 'labelDown', color: bearLabel, text: 'Bear',
            textColor: cfg.textColor, size: 'small' });
        }
      }
    },
    result(s, bars) {
      const n = bars.length;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice(), plot4: s.plot4.slice() },
        fills: [
          // fill(momPlot, p0, top_value / bottom_value = momentum / 0 when not squeeze and momentum > 0, bull strong -> fade)
          { plot1: 'plot1', plot2: 'plot2', gradient: sliceGrad(s.gBull) },
          // fill(momPlot, p0, top_value / bottom_value = 0 / momentum when not squeeze and momentum < 0, bear fade -> strong)
          { plot1: 'plot1', plot2: 'plot2', gradient: sliceGrad(s.gBear) },
          // fill(momPlot, p0, color = isSqueeze ? color.new(squeezeColor, 85) : na, title = 'Squeeze Fill')
          { plot1: 'plot1', plot2: 'plot2', options: { title: 'Squeeze Fill' }, colors: s.squeezeFill.slice() },
          // squeeze gradients (yellow), above / below zero
          { plot1: 'plot1', plot2: 'plot2', gradient: sliceGrad(s.gSqBull) },
          { plot1: 'plot1', plot2: 'plot2', gradient: sliceGrad(s.gSqBear) },
        ],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
        plotCandles: { waveCandles: s.candles.slice() },
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SmaSqueezeOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SmaSqueezeOscillatorInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[]; plotCandles: Record<string, PlotCandleData[]> }
  & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Bull Cross Alert', message: 'Momentum crossed above zero' },
  { id: 'alert1', title: 'Bear Cross Alert', message: 'Momentum crossed below zero' },
  { id: 'alert2', title: '1st after Squeeze LONG Alert', message: 'First bullish momentum after squeeze' },
  { id: 'alert3', title: '1st after Squeeze SHORT Alert', message: 'First bearish momentum after squeeze' },
  { id: 'alert4', title: 'Bullish Divergence Alert', message: 'Bullish divergence detected on momentum' },
  { id: 'alert5', title: 'Bearish Divergence Alert', message: 'Bearish divergence detected on momentum' },
];

export const SmaSqueezeOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  alertConditions,
};
