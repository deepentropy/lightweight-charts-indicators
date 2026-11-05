/**
 * [RS]ZigZag Percent Reversal - Forecast - patterns - labels
 *
 * Zigzag: in an up leg the highest high since the last pivot is tracked; when the close is at or below that high
 * minus the reversal range (the last pivot price times the percent, or times ATR / open x multiplier with an ATR
 * method), the high becomes a pivot and the leg turns down; a down leg does the same with the lowest low. The
 * reversal level is plotted one bar to the right (step line, and a circle on its last value).
 * Each new pivot (A) shifts the six pivots before it (B to G). The script then draws:
 * - a line from A to B and a label at A with the price and the names of the patterns found in the ratios of the
 *   last legs (harmonic triangles, double / triple / quadruple taps, AB=CD, Bat, Butterfly, Gartley, Crab, Shark,
 *   5o, Wolfe, contracting / expanding triangles, head and shoulders), within a margin of error;
 * - dashed lines between pivots with a label of their price and time ratios (up to 8, each one replaces the one
 *   of the same kind);
 * - a forecast of the next pivot: the averages of the price and time lengths of the legs (exponential weight
 *   2 / (length + 1), updated on a new leg) and their positive / negative deviations give a dashed mid line from A,
 *   two arrow lines (price and time deviation) and a dashed rectangle between the 0.618 and 1.618 targets.
 * The forecast is drawn again on the last bar.
 *
 * Drawing count: the script keeps the default 50 lines and 50 labels, so only the newest pivots are drawn. The
 * objects that the script still holds in a variable (the last of each kind) are not removed by this limit.
 * Pivot and target points are times (xloc.bar_time): a target after the last bar is a time in the future, and a
 * point between two bars is drawn on the next bar.
 *
 * Reference: "[RS]ZigZag Percent Reversal - Forecast - patterns - labels" by RicardoSantos
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, str, barTime, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { LabelData, LabelStyle, LineDrawingData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ZigzagPercentReversalForecastPatternsInputs {
  /** Method to use for the zigzag reversal range */
  percentMethod: 'MANUAL' | 'ATR005 * X' | 'ATR010 * X' | 'ATR020 * X' | 'ATR050 * X' | 'ATR100 * X' | 'ATR250 * X';
  /** Percent of the last pivot price for a reversal (MANUAL) */
  percent: number;
  /** Multiplier applied to ATR / open with an ATR method */
  percentMultiplier: number;
  showRealPivots: boolean;
  showZigzagLines: boolean;
  showPivotPrice: boolean;
  showTriangleRates: boolean;
  showAngles: boolean;
  showPatterns: boolean;
  showHarmonic: boolean;
  showTap: boolean;
  showAbcd: boolean;
  showBat: boolean;
  showButterfly: boolean;
  showGartley: boolean;
  showCrab: boolean;
  showShark: boolean;
  show5o: boolean;
  showWolfe: boolean;
  showContria: boolean;
  showExptria: boolean;
  showHns: boolean;
  showProjections: boolean;
  showProjectionsSquare: boolean;
  showProjectionsSquareRates: boolean;
  /** Length of the averages of the forecast (untitled input) */
  weightLength: number;
  /** Margin of error of the patterns, in percent (untitled input) */
  err: number;
}

export const defaultInputs: ZigzagPercentReversalForecastPatternsInputs = {
  percentMethod: 'MANUAL',
  percent: 0.25,
  percentMultiplier: 1.0,
  showRealPivots: true,
  showZigzagLines: true,
  showPivotPrice: true,
  showTriangleRates: true,
  showAngles: false,
  showPatterns: true,
  showHarmonic: true,
  showTap: true,
  showAbcd: true,
  showBat: true,
  showButterfly: true,
  showGartley: true,
  showCrab: true,
  showShark: true,
  show5o: true,
  showWolfe: true,
  showContria: true,
  showExptria: true,
  showHns: true,
  showProjections: true,
  showProjectionsSquare: true,
  showProjectionsSquareRates: false,
  weightLength: 10,
  err: 5.0,
};

export const inputConfig: InputConfig[] = [
  {
    id: 'percentMethod', type: 'string', title: 'Method to use for the zigzag reversal range:', defval: 'MANUAL',
    options: ['MANUAL', 'ATR005 * X', 'ATR010 * X', 'ATR020 * X', 'ATR050 * X', 'ATR100 * X', 'ATR250 * X'],
  },
  { id: 'percent', type: 'float', title: 'Percent of last pivot price for zigzag reversal:', defval: 0.25, min: 0.0, max: 99.0 },
  { id: 'percentMultiplier', type: 'float', title: 'Multiplier to apply to ATR if applicable:', defval: 1.0 },
  { id: 'showRealPivots', type: 'bool', title: 'Show real zigzag pivots:', defval: true },
  { id: 'showZigzagLines', type: 'bool', title: 'Show zigzag lines:', defval: true },
  { id: 'showPivotPrice', type: 'bool', title: 'Show price labels on zigzag:', defval: true },
  { id: 'showTriangleRates', type: 'bool', title: 'Show rate labels on triangles:', defval: true },
  { id: 'showAngles', type: 'bool', title: 'Show Angle Degree information(EXPERIMENTAL):', defval: false },
  { id: 'showPatterns', type: 'bool', title: 'Show Patterns:', defval: true },
  { id: 'showHarmonic', type: 'bool', title: 'Show Harmonic Triangle Pattern:', defval: true },
  { id: 'showTap', type: 'bool', title: 'Show 2/3/4 Tap Patterns:', defval: true },
  { id: 'showAbcd', type: 'bool', title: 'Show AB=CD Pattern:', defval: true },
  { id: 'showBat', type: 'bool', title: 'Show Bat Pattern:', defval: true },
  { id: 'showButterfly', type: 'bool', title: 'Show Butterfly Pattern:', defval: true },
  { id: 'showGartley', type: 'bool', title: 'Show Gartley Pattern:', defval: true },
  { id: 'showCrab', type: 'bool', title: 'Show Crab Pattern:', defval: true },
  { id: 'showShark', type: 'bool', title: 'Show Shark Pattern:', defval: true },
  { id: 'show5o', type: 'bool', title: 'Show 5o Pattern:', defval: true },
  { id: 'showWolfe', type: 'bool', title: 'Show wolfe Pattern:', defval: true },
  { id: 'showContria', type: 'bool', title: 'Show Contracting Triangle Pattern:', defval: true },
  { id: 'showExptria', type: 'bool', title: 'Show Expanding Triangle Pattern:', defval: true },
  { id: 'showHns', type: 'bool', title: 'Show Head and Shoulders Pattern:', defval: true },
  { id: 'showProjections', type: 'bool', title: 'Show projections forecast of zigzag:', defval: true },
  { id: 'showProjectionsSquare', type: 'bool', title: 'Show projections forecast Bounds:', defval: true },
  { id: 'showProjectionsSquareRates', type: 'bool', title: 'Show projections target rates:', defval: false },
  { id: 'weightLength', type: 'int', title: '', defval: 10 },
  { id: 'err', type: 'float', title: '', defval: 5.0 },
];

// Colour constants of Pine v4
const TEAL = '#00897B';
const ORANGE = '#FF9800';
const GRAY = '#787B86';
const SILVER = '#B2B5BE';
const SILVER_20 = 'rgba(178, 181, 190, 0.8)';
const BLACK = '#363A45';
const BLUE = '#0066ff';
const GRAY_40 = 'rgba(120, 123, 134, 0.6)';
const WHITE_40 = 'rgba(255, 255, 255, 0.6)';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'R', color: GRAY_40, lineWidth: 1, style: 'stepline', offset: 1 },
  { id: 'plot1', title: 'R', color: WHITE_40, lineWidth: 4, style: 'circles', offset: 1 },
];

export const metadata = {
  title: '[RS]ZigZag Percent Reversal - Forecast - patterns - labels',
  shortTitle: 'ZZ',
  overlay: true,
};

/** study() without max_lines_count / max_labels_count: the default of 50 */
const MAX_OBJECTS = 50;

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(a - b > EPS);
/** `x != 0` (false when x is na) */
const nonZero = (x: number) => !Number.isNaN(x) && Math.abs(x) > EPS;

/** Drawings as the script makes them: x is a time in ms (xloc.bar_time) */
interface Ln {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  width: number;
  style: 'solid' | 'dashed' | 'arrow_both';
  extend?: 'right';
}
interface Lb {
  x: number;
  y: number;
  text: string;
  color: string;
  style: LabelStyle;
}

/**
 * Live objects in creation order. At most max objects are kept: a creation that brings the count above max + 5
 * deletes the oldest until max remain. An object that a `var` variable of the script still refers to is not deleted
 * by this rule, but it counts.
 */
class Live<T> {
  items: T[] = [];
  held = new Set<T>();
  /** Creates the object for a `var` variable: `slot.ref := new` */
  assign(slot: { ref: T | null }, o: T): void {
    if (slot.ref) this.held.delete(slot.ref);
    slot.ref = o;
    this.held.add(o);
    this.items.push(o);
    if (this.items.length > MAX_OBJECTS + 5) {
      let excess = this.items.length - MAX_OBJECTS;
      this.items = this.items.filter((x) => this.held.has(x) || excess-- <= 0);
    }
  }
  /** line.delete / label.delete of the object of a `var` variable (the variable keeps its reference) */
  delete(slot: { ref: T | null }): void {
    if (!slot.ref) return;
    this.held.delete(slot.ref);
    const k = this.items.lastIndexOf(slot.ref);
    if (k >= 0) this.items.splice(k, 1);
  }
  /** A copy (the objects themselves are never changed: shared) */
  clone(): Live<T> {
    const c = new Live<T>();
    c.items = this.items.slice();
    c.held = new Set(this.held);
    return c;
  }
}
type Slot<T> = { ref: T | null };
const slot = <T>(): Slot<T> => ({ ref: null });

/** f_rate / f_timerate: plain divisions (x / 0 is infinite, 0 / 0 is na) */
const rate = (c: number, b: number, a: number) => (a - b) / (b - c);
const timeRate = (c: number, b: number, a: number) => (0 - (a - b)) / (b - c);

/**
 * f_mode_process_stats(): average of the leg length (updated when the length changes) and the averages of its
 * positive and negative deviations.
 */
class StatsSite {
  prevData = NaN;
  prevAvg = NaN;
  prevPos = NaN;
  prevNeg = NaN;
  posDev = 0;
  negDev = 0;

  constructor(private readonly weight: number) {}

  step(barIndex: number, data: number) {
    const weight = this.weight;
    let avg = data;
    if (barIndex >= 1) {
      if (nonZero(data - this.prevData)) {
        avg = weight * data + (1 - weight) * (Number.isNaN(this.prevAvg) ? this.prevData : this.prevAvg);
      } else {
        avg = this.prevAvg;
      }
    }
    const posRange = Math.max(0.0, data - avg);
    const negRange = Math.min(0.0, data - avg);
    if (barIndex >= 1) {
      if (nonZero(posRange - this.prevPos)) this.posDev = weight * posRange + (1 - weight) * this.posDev;
      if (nonZero(negRange - this.prevNeg)) this.negDev = weight * negRange + (1 - weight) * this.negDev;
    }
    this.prevData = data;
    this.prevAvg = avg;
    this.prevPos = posRange;
    this.prevNeg = negRange;
    return { avg, posDev: this.posDev, negDev: this.negDev };
  }

  clone(): StatsSite {
    return Object.assign(new StatsSite(this.weight), this);
  }
}

/** int(): truncation; na stays na */
const int = (x: number) => (Number.isFinite(x) ? Math.trunc(x) : NaN);
/** nz(x, 0): na and the infinite values give 0 */
const nz = (x: number) => (Number.isFinite(x) ? x : 0);

/** Ranges [low, high] of the four ratios (EDC, DCB, CBA, EDA) of the five-point patterns */
const FIVE_POINT: Array<{
  name: string;
  key: 'showBat' | 'showButterfly' | 'showGartley' | 'showCrab' | 'showShark' | 'show5o' | 'showWolfe' | 'showContria' | 'showExptria';
  edc: [number, number];
  dcb: [number, number];
  cba: [number, number];
  eda: [number, number];
}> = [
  { name: 'Bat', key: 'showBat', edc: [-0.5, -0.382], dcb: [-0.886, -0.382], cba: [-2.618, -1.618], eda: [-0.886, -0.886] },
  { name: 'Butterfly', key: 'showButterfly', edc: [-0.786, -0.786], dcb: [-0.886, -0.382], cba: [-2.618, -1.618], eda: [-1.618, -1.27] },
  { name: 'Gartley', key: 'showGartley', edc: [-0.618, -0.618], dcb: [-0.886, -0.382], cba: [-2.618, -1.13], eda: [-0.786, -0.786] },
  { name: 'Crab', key: 'showCrab', edc: [-0.886, -0.886], dcb: [-0.886, -0.382], cba: [-3.618, -2.0], eda: [-1.618, -1.618] },
  { name: 'Shark', key: 'showShark', edc: [-0.886, -0.886], dcb: [-1.618, -1.13], cba: [-2.24, -1.27], eda: [-1.13, -0.886] },
  { name: '5o', key: 'show5o', edc: [-1.618, -1.13], dcb: [-2.24, -1.618], cba: [-0.5, -0.5], eda: [-0.236, 0.236] },
  { name: 'Wolf', key: 'showWolfe', edc: [-1.618, -1.27], dcb: [-5.0, -0.0], cba: [-1.618, -1.27], eda: [-5.0, -0.0] },
  { name: 'Contracting Triangle', key: 'showContria', edc: [-0.886, -0.236], dcb: [-0.886, -0.236], cba: [-0.886, -0.236], eda: [-0.886, -0.236] },
  { name: 'Expanding Triangle', key: 'showExptria', edc: [-2.618, -1.125], dcb: [-2.618, -1.125], cba: [-2.618, -1.125], eda: [-2.618, -1.125] },
];

type Result = IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[] };

interface ZzVars {
  // f_zz() state
  dirUp: boolean | null;
  htrack: number;
  ltrack: number;
  pivot: number;
  realPivotTime: number;
  htime: number;
  ltime: number;
  reverseLine: number;
  // Pivots A (newest) to G: time in ms and price
  timeA: number;
  /** B to G */
  times: number[];
  /** B to G */
  prices: number[];
  lines: Live<Ln>;
  labels: Live<Lb>;
  // `var` variables of the drawing functions
  zigzagLine: Slot<Ln>;
  midline: Slot<Ln>;
  priceDevLine: Slot<Ln>;
  timeDevLine: Slot<Ln>;
  label0618: Slot<Lb>;
  label1618: Slot<Lb>;
  sides: Slot<Ln>[];
  pivotLabel: Slot<Lb>;
  rateLines: Slot<Ln>[];
  rateLabels: Slot<Lb>[];
  priceStats: StatsSite;
  timeStats: StatsSite;
}

interface ZzRun extends BarRunState<ZzVars> {
  atr: ReturnType<typeof taStep.atr> | null;
  reverse: number[];
}

const copySlot = <T>(x: Slot<T>): Slot<T> => ({ ref: x.ref });

function study(inputs: Partial<ZigzagPercentReversalForecastPatternsInputs>): BarStudy<ZzRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const fmt = (v: number, format: string) => str.tostring(v, format);

  // percent: the input / 100, or atr(N) / open * multiplier on every bar
  const atrLength = cfg.percentMethod === 'MANUAL' ? 0 : Number(cfg.percentMethod.slice(3, 6));
  const manualPercent = cfg.percent / 100;
  const weight = 2 / (cfg.weightLength + 1);
  const margin = cfg.err / 100;

  /** in range with the margin of error: value <= high + margin and value >= low - margin */
  const inRange = (v: number, [low, high]: [number, number]) => le(v, high + margin) && ge(v, low - margin);
  const isHarmonicTriangle = (v: number) => {
    let found = false;
    for (let k = 1; k <= 12; k++) {
      const level = -Math.pow(1.618, -5 + k);
      if (le(v, level + margin) && ge(v, level - margin)) found = true;
    }
    return found;
  };
  const TAP: [number, number] = [-1.0, -1.0];
  const isAbcd = (cba: number, dcb: number) => inRange(cba, [-1.618, -1.27]) && inRange(dcb, [-0.786, -0.618]);
  const angle = (v: number, format: string) =>
    `, (sin:${fmt(nz(Math.asin(v) * (180 / 3.1416)), format)}º, cos:${fmt(nz(Math.acos(v) * (180 / 3.1416)), format)}º`
    + `, tan:${fmt(nz(Math.atan(v) * (180 / 3.1416)), format)}º)`;

  return {
    init() {
      const atr = atrLength > 0 ? taStep.atr(atrLength) : null;
      const s: ZzRun = {
        atr, reverse: [],
        steps: atr ? [atr] : [],
        vars: {
          dirUp: null, htrack: NaN, ltrack: NaN, pivot: NaN, realPivotTime: NaN, htime: NaN, ltime: NaN, reverseLine: 0.0,
          timeA: NaN, times: [NaN, NaN, NaN, NaN, NaN, NaN], prices: [NaN, NaN, NaN, NaN, NaN, NaN],
          lines: new Live<Ln>(), labels: new Live<Lb>(),
          zigzagLine: slot<Ln>(), midline: slot<Ln>(), priceDevLine: slot<Ln>(), timeDevLine: slot<Ln>(),
          label0618: slot<Lb>(), label1618: slot<Lb>(), sides: [slot<Ln>(), slot<Ln>(), slot<Ln>(), slot<Ln>()],
          pivotLabel: slot<Lb>(), rateLines: Array.from({ length: 8 }, () => slot<Ln>()),
          rateLabels: Array.from({ length: 8 }, () => slot<Lb>()),
          priceStats: new StatsSite(weight), timeStats: new StatsSite(weight),
        },
        lists: [], series: [],
      };
      s.series = [s.reverse];
      return s;
    },
    copyVars: (v) => ({
      ...v,
      times: v.times.slice(),
      prices: v.prices.slice(),
      lines: v.lines.clone(),
      labels: v.labels.clone(),
      zigzagLine: copySlot(v.zigzagLine),
      midline: copySlot(v.midline),
      priceDevLine: copySlot(v.priceDevLine),
      timeDevLine: copySlot(v.timeDevLine),
      label0618: copySlot(v.label0618),
      label1618: copySlot(v.label1618),
      sides: v.sides.map(copySlot),
      pivotLabel: copySlot(v.pivotLabel),
      rateLines: v.rateLines.map(copySlot),
      rateLabels: v.rateLabels.map(copySlot),
      priceStats: v.priceStats.clone(),
      timeStats: v.timeStats.clone(),
    }),
    bar(s, i, bars) {
      const n = bars.length;
      const v = s.vars;
      const { times, prices, lines, labels, zigzagLine, midline, priceDevLine, timeDevLine, label0618, label1618, sides, pivotLabel, rateLines, rateLabels } = v;
      let { dirUp, htrack, ltrack, pivot, realPivotTime, htime, ltime, reverseLine, timeA } = v;
      const bar = bars[i];
      const time = bar.time * 1000;
      const prevPivot = pivot;
      const atrValue = s.atr ? s.atr.step(bar.high, bar.low, bar.close) ?? NaN : NaN;
      const percent = atrLength > 0 ? (atrValue / bar.open) * cfg.percentMultiplier : manualPercent;

      // ---- f_zz(percent)
      if (i >= 1) {
        const prev = bars[i - 1];
        if (dirUp === null) dirUp = true;
        const reverseRange = (Number.isNaN(prevPivot) ? 0 : prevPivot) * percent;
        if (dirUp) {
          ltrack = NaN;
          ltime = time;
          if (Number.isNaN(htrack)) {
            if (gt(bar.high, prev.high)) {
              htrack = bar.high;
              htime = time;
            } else {
              htrack = prev.high;
              htime = prev.time * 1000;
            }
          } else if (gt(bar.high, htrack)) {
            htrack = bar.high;
            htime = time;
          }
          reverseLine = htrack - reverseRange;
          if (le(bar.close, reverseLine)) {
            pivot = htrack;
            realPivotTime = htime;
            dirUp = false;
          }
        }
        if (!dirUp) {
          htrack = NaN;
          htime = NaN;
          if (Number.isNaN(ltrack)) {
            if (lt(bar.low, prev.low)) {
              ltrack = bar.low;
              ltime = time;
            } else {
              ltrack = prev.low;
              ltime = prev.time * 1000;
            }
          } else if (lt(bar.low, ltrack)) {
            ltrack = bar.low;
            ltime = time;
          }
          reverseLine = ltrack + reverseRange;
          if (ge(bar.close, reverseLine)) {
            pivot = ltrack;
            realPivotTime = ltime;
            dirUp = true;
          }
        }
      }
      s.reverse[i] = reverseLine;
      const priceA = pivot;
      const isUp = dirUp === true;
      const altTime = cfg.showRealPivots ? realPivotTime : time;
      // is_new_zig = change(price_a) != 0 ? price_a : na, read as a condition
      const isNewZig = nonZero(priceA - prevPivot) && nonZero(priceA);

      if (isNewZig) {
        for (let k = 5; k >= 1; k--) {
          times[k] = times[k - 1];
          prices[k] = prices[k - 1];
        }
        times[0] = timeA;
        prices[0] = prevPivot;
        timeA = altTime;
      }
      Object.assign(v, { dirUp, htrack, ltrack, pivot, realPivotTime, htime, ltime, reverseLine, timeA });
      const [timeB, timeC, timeD, timeE, timeF, timeG] = times;
      const [priceB, priceC, priceD, priceE, priceF, priceG] = prices;
      const aAboveB = gt(priceA, priceB);

      // ---- f_draw_zigzag_lines()
      if (cfg.showZigzagLines && isNewZig) {
        lines.assign(zigzagLine, { x1: timeA, y1: priceA, x2: timeB, y2: priceB, color: aAboveB ? TEAL : ORANGE, width: 2, style: 'solid' });
      }

      // ---- forecast statistics and targets
      const priceStat = v.priceStats.step(i, Math.abs(priceA - priceB));
      const timeStat = v.timeStats.step(i, timeA - timeB);
      const sign = aAboveB ? -1 : 1;
      const targetAvgPrice = aAboveB ? priceA - priceStat.avg : priceA + priceStat.avg;
      const targetPriceUpperDev = aAboveB ? priceA - priceStat.avg - priceStat.negDev : priceA + priceStat.avg + priceStat.negDev;
      const targetPriceLowerDev = aAboveB ? priceA - priceStat.avg - priceStat.posDev : priceA + priceStat.avg + priceStat.posDev;
      const targetPrice0618 = priceA + sign * ((priceStat.avg + priceStat.negDev) * 0.618);
      const targetPrice1618 = priceA + sign * ((priceStat.avg + priceStat.posDev) * 1.618);
      const targetAvgTime = int(timeA + timeStat.avg);
      const targetTimeUpperDev = int(targetAvgTime + timeStat.posDev);
      const targetTimeLowerDev = int(targetAvgTime + timeStat.negDev);
      const targetTime0618 = int(timeA + (timeStat.avg + timeStat.negDev) * 0.618);
      const targetTime1618 = int(timeA + (timeStat.avg + timeStat.posDev) * 1.618);

      // first_realtime_bar = barstate.islast and barstate.ishistory[1]: the forecast is drawn again on the last bar
      // (the last bar of an update is always calculated again by the next one)
      const firstRealtimeBar = i === n - 1 && i >= 1;

      // ---- f_cast_projections()
      if (cfg.showProjections && (isNewZig || firstRealtimeBar)) {
        lines.delete(midline);
        lines.delete(priceDevLine);
        lines.delete(timeDevLine);
        labels.delete(label0618);
        labels.delete(label1618);
        lines.assign(midline, {
          x1: timeA, y1: priceA, x2: targetAvgTime, y2: targetAvgPrice, color: ORANGE, width: 1, style: 'dashed', extend: 'right',
        });
        lines.assign(priceDevLine, {
          x1: targetAvgTime, y1: targetPriceLowerDev, x2: targetAvgTime, y2: targetPriceUpperDev, color: BLUE, width: 1, style: 'arrow_both',
        });
        lines.assign(timeDevLine, {
          x1: targetTimeLowerDev, y1: targetAvgPrice, x2: targetTimeUpperDev, y2: targetAvgPrice, color: BLUE, width: 1, style: 'arrow_both',
        });
        if (cfg.showProjectionsSquareRates) {
          labels.assign(label0618, {
            x: targetTime1618, y: targetPrice1618, text: `Target 1.618 @ ${fmt(targetPrice1618, '#.#####')}`,
            style: isUp ? 'label_down' : 'label_up', color: SILVER_20,
          });
          labels.assign(label1618, {
            x: targetTime0618, y: targetPrice0618, text: `Target 0.618 @ ${fmt(targetPrice0618, '#.#####')}`,
            style: isUp ? 'label_up' : 'label_down', color: SILVER_20,
          });
        }
      }

      // ---- f_line_rectangle(): the bounds of the forecast
      if (cfg.showProjections && cfg.showProjectionsSquare && (isNewZig || firstRealtimeBar)) {
        for (const side of sides) lines.delete(side);
        const [x1, y1, x2, y2] = [targetTime0618, targetPrice0618, targetTime1618, targetPrice1618];
        const side = (ax: number, ay: number, bx: number, by: number): Ln =>
          ({ x1: ax, y1: ay, x2: bx, y2: by, color: GRAY, width: 2, style: 'dashed' });
        lines.assign(sides[0], side(x1, y1, x1, y2));
        lines.assign(sides[1], side(x1, y2, x2, y2));
        lines.assign(sides[2], side(x2, y2, x2, y1));
        lines.assign(sides[3], side(x2, y1, x1, y1));
      }

      // ---- f_Detect_Patterns(err)
      if ((cfg.showPivotPrice || cfg.showPatterns) && isNewZig) {
        const pGfa = rate(priceG, priceF, priceA);
        const tGfa = timeRate(timeG, timeF, timeA);
        const pGda = rate(priceG, priceD, priceA);
        const tGda = timeRate(timeG, timeD, timeA);
        const pGfe = rate(priceG, priceF, priceE);
        const pGba = rate(priceG, priceB, priceA);
        const tGba = timeRate(timeG, timeB, timeA);
        const pFed = rate(priceF, priceE, priceD);
        const pFeb = rate(priceF, priceE, priceB);
        const tFeb = timeRate(timeF, timeE, timeB);
        const pFcb = rate(priceF, priceC, priceB);
        const pEdc = rate(priceE, priceD, priceC);
        const pEda = rate(priceE, priceD, priceA);
        const tEda = timeRate(timeE, timeD, timeA);
        const pEba = rate(priceE, priceB, priceA);
        const tEba = timeRate(timeE, timeB, timeA);
        const pDcb = rate(priceD, priceC, priceB);
        const tDcb = timeRate(timeD, timeC, timeB);
        const pCba = rate(priceC, priceB, priceA);
        const tCba = timeRate(timeC, timeB, timeA);

        // f_draw_zigzag_labels(text): the label of the pivot A
        const pivotText = (text: string) => {
          const shown = cfg.showPivotPrice
            ? (aAboveB ? fmt(priceA, '#.#####') + text : text + fmt(priceA, '#.#####'))
            : text;
          labels.assign(pivotLabel, {
            x: timeA, y: priceA, text: shown, style: aAboveB ? 'label_down' : 'label_up', color: aAboveB ? ORANGE : TEAL,
          });
        };

        if (cfg.showPatterns) {
          const validGfa = ge(pFed, -1) && ge(pFeb, -1) && le(pCba, -1) && le(pEda, -1);
          const validGda = le(pFed, -1) && ge(pGfe, -1) && le(pCba, -1) && ge(pDcb, -1);
          const validGba = le(pFeb, -1) && ge(pGfe, -1) && le(pCba, -1) && le(pDcb, -1);
          const validEba = le(pCba, -1) && le(pDcb, -1);
          const validEda = le(pCba, -1) && ge(pDcb, -1);
          const validFcb = ge(pFed, -1) && le(pEdc, -1);
          const validFeb = ge(pEdc, -1) && le(pDcb, -1);
          let list = '\n';
          const add = (on: boolean, name: string) => {
            if (on) list += `• ${name} •\n`;
          };
          if (cfg.showHarmonic) {
            add(isHarmonicTriangle(pGfa) && validGfa, 'Harmonic Triangle(GFA)');
            add(isHarmonicTriangle(pGda) && validGda, 'Harmonic Triangle(GDA)');
            add(isHarmonicTriangle(pGba) && validGba, 'Harmonic Triangle(GBA)');
            add(isHarmonicTriangle(pEba) && validEba, 'Harmonic Triangle(EBA)');
            add(isHarmonicTriangle(pEda) && validEda, 'Harmonic Triangle(EDA)');
            add(isHarmonicTriangle(pCba), 'Harmonic Triangle(CBA)');
          }
          if (cfg.showTap) {
            add(inRange(pCba, TAP), 'Double Tap(CBA)');
            add(inRange(pEba, TAP) && validEba, 'Double Tap(EBA)');
            add(inRange(pEda, TAP) && validEda, 'Double Tap(EDA)');
            add(inRange(pEdc, TAP) && inRange(pCba, TAP), 'Triple Tap(EDC, CBA)');
            add(inRange(pGfe, TAP) && inRange(pEdc, TAP) && inRange(pCba, TAP), 'Quadruple Tap(GFE, EDC, CBA)');
          }
          if (cfg.showAbcd) {
            add(isAbcd(pCba, pDcb), 'AB=CD(CBA, DCB)');
            add(isAbcd(pCba, pFcb) && validFcb, 'AB=CD(CBA, FCB)');
            add(isAbcd(pEba, pFeb) && validFeb, 'AB=CD(EBA, FEB)');
            add(isAbcd(pEda, pFed) && validEda, 'AB=CD(EDA, FED)');
          }
          for (const p of FIVE_POINT) {
            if (!cfg[p.key]) continue;
            const is = (edc: number, dcb: number, cba: number, eda: number) =>
              inRange(edc, p.edc) && inRange(dcb, p.dcb) && inRange(cba, p.cba) && inRange(eda, p.eda);
            add(is(pEdc, pDcb, pCba, pEda), `${p.name}(EDC, DCB, CBA, EDA)`);
            add(is(pGfe, pFeb, pEba, pGfa) && validEba, `${p.name}(GFE, FEB, EBA, GFA)`);
            add(is(pGfe, pFed, pEda, pGfa) && validEda, `${p.name}(GFE, FED, EDA, GFA)`);
          }
          if (cfg.showHns) {
            add(inRange(pFed, [-0.618, -0.09]) && inRange(pFeb, [-0.886, -0.09]) && inRange(pEdc, [-9.999, -1.0])
              && inRange(pEda, [-1.618, -0.09]) && inRange(pDcb, [-1.25, -0.75]) && inRange(pCba, [-0.886, -0.09]),
            'Head and Shoulders(FED, FEB, DCB, EDC, EDA, CBA)');
          }
          pivotText(list);
        } else if (cfg.showPivotPrice) {
          pivotText('');
        }

        // f_draw_rate_lines_and_label(): one line and one label per call place, replaced on each call
        if (cfg.showTriangleRates) {
          const draw = (
            site: number, priceRate: number, timeRateValue: number, x1: number, y1: number, x2: number, y2: number, up: boolean,
          ) => {
            const text = `Price: ${fmt(priceRate, '#.###')}${cfg.showAngles ? angle(priceRate, '#') : ''}`
              + `\nTime: ${fmt(timeRateValue, '#.###')}${cfg.showAngles ? angle(timeRateValue, '#.###') : ''}`;
            lines.delete(rateLines[site]);
            labels.delete(rateLabels[site]);
            lines.assign(rateLines[site], { x1, y1, x2, y2, color: GRAY, width: 1, style: 'dashed' });
            labels.assign(rateLabels[site], {
              x: Math.round((x1 + x2) / 2), y: (y1 + y2) / 2, text, style: up ? 'label_up' : 'label_down', color: SILVER,
            });
          };
          if (lt(pCba, pEdc) && lt(pEdc, pGfe)) {
            draw(0, pGfa, tGfa, timeA, priceA, timeG, priceG, lt(priceA, priceF));
            draw(1, pGda, tGda, timeA, priceA, timeG, priceG, lt(priceA, priceD));
            draw(2, pGba, tGba, timeA, priceA, timeG, priceG, lt(priceA, priceB));
          }
          if (lt(pCba, pEdc)) {
            draw(3, pEda, tEda, timeA, priceA, timeE, priceE, lt(priceA, priceD));
            draw(4, pEba, tEba, timeA, priceA, timeE, priceE, lt(priceA, priceB));
          }
          draw(5, pCba, tCba, timeA, priceA, timeC, priceC, lt(priceA, priceB));
          draw(6, pDcb, tDcb, timeB, priceB, timeD, priceD, lt(priceB, priceC));
          if (lt(pDcb, pFed)) draw(7, pFeb, tFeb, timeB, priceB, timeF, priceF, lt(priceB, priceE));
        }
      }
    },
    result(s, bars) {
      const n = bars.length;
      const reverse = s.reverse;
      const { lines, labels } = s.vars;
      // plot(reverse, offset = 1): the value of bar i is drawn on bar i + 1; the second plot has show_last = 1
      const plot0 = reverse.map((v, i) => ({ time: barTime(bars, i + 1), value: v }));
      const plot1 = n > 0 ? [{ time: barTime(bars, n), value: reverse[n - 1] }] : [];

      // An object with an na coordinate is not drawn. Times are in ms in the script and in seconds in the result.
      const lineOut: LineDrawingData[] = lines.items
        .filter((l) => [l.x1, l.y1, l.x2, l.y2].every(Number.isFinite))
        .map((l) => ({
          time1: l.x1 / 1000, price1: l.y1, time2: l.x2 / 1000, price2: l.y2, color: l.color, width: l.width, style: l.style,
          ...(l.extend ? { extend: l.extend } : {}),
        }));
      const labelOut: LabelData[] = labels.items
        .filter((l) => Number.isFinite(l.x) && Number.isFinite(l.y))
        .map((l) => ({ time: l.x / 1000, price: l.y, text: l.text, color: l.color, textColor: BLACK, style: l.style, size: 'small' }));

      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0, plot1 },
        lines: lineOut,
        labels: labelOut,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ZigzagPercentReversalForecastPatternsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ZigzagPercentReversalForecastPatternsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const ZigzagPercentReversalForecastPatterns = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
