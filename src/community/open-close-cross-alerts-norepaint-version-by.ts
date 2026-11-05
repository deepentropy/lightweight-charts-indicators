/**
 * Open Close Cross Alerts NoRepaint Version
 *
 * Two moving averages of the same type, one of the closes and one of the opens. The "alternate resolution" is
 * simulated by a longer period (MA period * multiplier). The difference of the two longer averages, as a factor of
 * the average of the two shorter ones (50000 * diff / avg), is drawn as an area and a line, green when the close
 * average is above the open average, red otherwise. A circle at the bottom marks each cross of the two averages.
 * Optional divergence channel: 5-bar fractals of the difference factor, offset by a multiple of its 20-bar standard
 * deviation, with regular / hidden divergence labels (fractal against the high / low two bars back).
 *
 * Alerts (alertcondition, `alerts` of the result): "OCC BothCond" (either cross), "OCC LongCond" (close average
 * crossing over the open average) and "OCC ShortCond" (crossing under it).
 *
 * MA types: SMA, EMA, DEMA, TEMA, WMA, VWMA, SMMA, HullMA, ZEMA (zero-lag EMA), SSMA (Ehlers super smoother), TMA.
 *
 * Reference: "Open Close Cross Alerts NoRepaint Version by JustUncleL" by JustUncleL
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright 2017, 2019 JustUncleL
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { AlertConditionDecl, AlertConditionState } from '../alert-states';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, liveAlertStates, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

/** The original's alertcondition() calls, in declaration order */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'OCC BothCond', message: 'OCC BothCond' },
  { id: 'alert1', title: 'OCC LongCond', message: 'OCC LongCond' },
  { id: 'alert2', title: 'OCC ShortCond', message: 'OCC ShortCond' },
];

export type OccMaType = 'SMA' | 'EMA' | 'DEMA' | 'TEMA' | 'WMA' | 'VWMA' | 'SMMA' | 'HullMA' | 'ZEMA' | 'SSMA' | 'TMA';

export interface OpenCloseCrossAlertsNRPInputs {
  /** Simulate a higher resolution with a longer MA period */
  useRes: boolean;
  /** Multiplier of the MA period for the alternate resolution */
  intRes: number;
  basisType: OccMaType;
  basisLen: number;
  /** Show the divergence channel (only with regular or hidden divergence on) */
  showDivergence: boolean;
  /** Channel width factor (standard deviations) */
  multi: number;
  showHidden: boolean;
  showRegular: boolean;
}

export const defaultInputs: OpenCloseCrossAlertsNRPInputs = {
  useRes: true,
  intRes: 6,
  basisType: 'ZEMA',
  basisLen: 8,
  showDivergence: false,
  multi: 0.5,
  showHidden: false,
  showRegular: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'useRes', type: 'bool', title: 'Use Alternate Resolution?', defval: true },
  { id: 'intRes', type: 'int', title: 'Multiplier for Alernate Resolution', defval: 6, min: 1 },
  { id: 'basisType', type: 'string', title: 'MA Type: ', defval: 'ZEMA',
    options: ['SMA', 'EMA', 'DEMA', 'TEMA', 'WMA', 'VWMA', 'SMMA', 'HullMA', 'ZEMA', 'SSMA', 'TMA'] },
  { id: 'basisLen', type: 'int', title: 'MA Period', defval: 8, min: 1 },
  { id: 'showDivergence', type: 'bool', title: 'Show Divergence Channel', defval: false },
  { id: 'multi', type: 'float', title: 'Divergence Channel Width Factor (Stddev)', defval: 0.5, min: 0, max: 3 },
  { id: 'showHidden', type: 'bool', title: 'Show Hidden Divergence', defval: false },
  { id: 'showRegular', type: 'bool', title: 'Show Regular Divergence', defval: false },
];

const GREEN = '#4CAF50';
const RED = '#FF5252';
const GRAY = '#787B86';
const MAROON = '#880E4F';
const WHITE = '#FFFFFF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'OCC Difference Factor', color: String(color.new(GREEN, 80)), lineWidth: 1, style: 'area' },
  { id: 'plot1', title: 'OCC Difference Factor', color: String(color.new(GREEN, 20)), lineWidth: 2 },
  { id: 'plot2', title: 'RSI High', color: GRAY, lineWidth: 1 },
  { id: 'plot3', title: 'RSI Low', color: GRAY, lineWidth: 1 },
  { id: 'plot4', title: 'RSI H F', color: RED, lineWidth: 1, offset: -2 },
  { id: 'plot5', title: 'RSI L F', color: GREEN, lineWidth: 1, offset: -2 },
  { id: 'plot6', title: 'RSI H D', color: GRAY, lineWidth: 3, style: 'circles', offset: -2 },
  { id: 'plot7', title: 'RSI L D', color: GRAY, lineWidth: 3, style: 'circles', offset: -2 },
];

/** hline(0, color = color.gray, linestyle = hline.style_dashed) */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_0', price: 0, color: GRAY, linestyle: 'dashed' },
];

export const metadata = {
  title: 'Open Close Cross Alerts NoRepaint Version by JustUncleL',
  shortTitle: 'OCC Alerts NRP',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** A float used as a condition: na and 0 are false */
const truthy = (x: number) => !isNaN(x) && x !== 0;

type Point = { time: number; value: number; color?: string };

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

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] };

/** variant(type, src, len) on one bar at a time: the source is the close or the open of the bars */
class Variant implements Committable {
  private readonly ema1 = taStep.ema(1);
  private readonly ema2: ReturnType<typeof taStep.ema> | null = null;
  private readonly ema3: ReturnType<typeof taStep.ema> | null = null;
  private readonly sma1 = taStep.sma();
  private readonly sma2 = taStep.sma();
  private readonly wma1 = taStep.wma();
  private readonly wma2 = taStep.wma();
  private readonly wma3 = taStep.wma();
  private readonly vwma: ReturnType<typeof taStep.vwma> | null = null;
  private readonly steps: Committable[];
  /** The variant's own values of the last two bars (SMMA, SSMA) */
  private v1 = NaN;
  private v2 = NaN;
  private next = NaN;
  private stepped = false;

  constructor(private readonly type: OccMaType, private readonly len: number, private readonly field: 'close' | 'open') {
    const usesEma = type === 'EMA' || type === 'DEMA' || type === 'TEMA' || type === 'ZEMA';
    if (usesEma) this.ema1 = taStep.ema(len);
    if (type === 'DEMA' || type === 'TEMA') this.ema2 = taStep.ema(len);
    if (type === 'TEMA') this.ema3 = taStep.ema(len);
    if (type === 'VWMA') this.vwma = taStep.vwma(len);
    this.steps = [
      ...(usesEma ? [this.ema1] : []), ...(this.ema2 ? [this.ema2] : []), ...(this.ema3 ? [this.ema3] : []),
      this.sma1, this.sma2, this.wma1, this.wma2, this.wma3, ...(this.vwma ? [this.vwma] : []),
    ];
  }

  step(i: number, bars: Bar[]): number {
    this.stepped = true;
    const len = this.len;
    const x = bars[i][this.field];
    let v: number;
    switch (this.type) {
      case 'EMA': v = this.ema1.step(x); break;
      case 'WMA': v = this.wma1.step(x, len); break;
      case 'VWMA': v = this.vwma!.step(x, bars[i].volume ?? NaN); break;
      case 'SMMA': {
        // v5 := na(v5[1]) ? sma(src, len) : (v5[1] * (len - 1) + src) / len
        const sma = this.sma1.step(x, len);
        const prev = this.v1;
        v = isNaN(prev) ? sma : (prev * (len - 1) + x) / len;
        break;
      }
      case 'DEMA': {
        const e1 = this.ema1.step(x);
        v = 2 * e1 - this.ema2!.step(e1);
        break;
      }
      case 'TEMA': {
        const e1 = this.ema1.step(x);
        const e2 = this.ema2!.step(e1);
        const e3 = this.ema3!.step(e2);
        v = 3 * (e1 - e2) + e3;
        break;
      }
      case 'HullMA': {
        const wma2 = this.wma1.step(x, len / 2);
        const wma3 = this.wma2.step(x, len);
        v = this.wma3.step(2 * wma2 - wma3, Math.round(Math.sqrt(len)));
        break;
      }
      case 'SSMA': {
        // Ehlers super smoother
        const a1 = Math.exp((-1.414 * 3.14159) / len);
        const b1 = 2 * a1 * Math.cos((1.414 * 3.14159) / len);
        const c2 = b1;
        const c3 = -a1 * a1;
        const c1 = 1 - c2 - c3;
        const nz = (y: number) => (isNaN(y) ? 0 : y);
        const s1 = i > 0 ? bars[i - 1][this.field] : NaN;
        const v1 = i > 0 ? this.v1 : NaN;
        const v2 = i > 1 ? this.v2 : NaN;
        v = (c1 * (x + nz(s1))) / 2 + c2 * nz(v1) + c3 * nz(v2);
        break;
      }
      case 'ZEMA': {
        // lag = (len - 1) / 2; emaSrc = src + src - src[lag] (a fractional history index is truncated)
        const lag = Math.trunc((len - 1) / 2);
        v = this.ema1.step(i - lag >= 0 ? x + x - bars[i - lag][this.field] : NaN);
        break;
      }
      case 'TMA': v = this.sma2.step(this.sma1.step(x, len), len); break;
      default: v = this.sma1.step(x, len);
    }
    this.next = v;
    return v;
  }

  commit(): void {
    for (const m of this.steps) m.commit();
    if (!this.stepped) return;
    this.stepped = false;
    this.v2 = this.v1;
    this.v1 = this.next;
  }
}

interface OccVars {
  /** valuewhen(cond, x, 1): the value at the condition bar before the latest one (prev), and the latest one */
  topValPrev: number;
  topValLast: number;
  topHighPrev: number;
  topHighLast: number;
  botValPrev: number;
  botValLast: number;
  botLowPrev: number;
  botLowLast: number;
}

interface OccRun extends BarRunState<OccVars> {
  closeSeries: Variant;
  openSeries: Variant;
  closeSeriesAlt: Variant;
  openSeriesAlt: Variant;
  xlong: ReturnType<typeof taStep.crossover>;
  xshort: ReturnType<typeof taStep.crossunder>;
  dev: WindowStdev;
  pcd: number[];
  plots: Point[][];
  markers: MarkerData[];
  flags: boolean[][];
  times: number[][];
}

function study(inputs: Partial<OpenCloseCrossAlertsNRPInputs>): BarStudy<OccRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const intRes = cfg.useRes ? cfg.intRes : 1;
  // uDiv := uReg or uHid ? uDiv : false
  const uDiv = cfg.showRegular || cfg.showHidden ? cfg.showDivergence : false;
  const uReg = cfg.showRegular;
  const uHid = cfg.showHidden;
  return {
    init() {
      const s: OccRun = {
        closeSeries: new Variant(cfg.basisType, cfg.basisLen, 'close'),
        openSeries: new Variant(cfg.basisType, cfg.basisLen, 'open'),
        closeSeriesAlt: new Variant(cfg.basisType, cfg.basisLen * intRes, 'close'),
        openSeriesAlt: new Variant(cfg.basisType, cfg.basisLen * intRes, 'open'),
        xlong: taStep.crossover(), xshort: taStep.crossunder(), dev: new WindowStdev(20),
        pcd: [], plots: Array.from({ length: 8 }, () => []), markers: [], flags: [[], [], []], times: [[], [], []],
        steps: [],
        vars: {
          topValPrev: NaN, topValLast: NaN, topHighPrev: NaN, topHighLast: NaN,
          botValPrev: NaN, botValLast: NaN, botLowPrev: NaN, botLowLast: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [s.closeSeries, s.openSeries, s.closeSeriesAlt, s.openSeriesAlt, s.xlong, s.xshort, s.dev];
      s.lists = [s.markers, ...s.times];
      s.series = [s.pcd, ...s.plots, ...s.flags];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time;
      const v = s.vars;
      const closeSeries = s.closeSeries.step(i, bars);
      const openSeries = s.openSeries.step(i, bars);
      const closeOpenAvg = (closeSeries + openSeries) / 2;
      const closeSeriesAlt = s.closeSeriesAlt.step(i, bars);
      const openSeriesAlt = s.openSeriesAlt.step(i, bars);

      const xlong = s.xlong.step(closeSeriesAlt, openSeriesAlt);
      const xshort = s.xshort.step(closeSeriesAlt, openSeriesAlt);

      // pcd = 50000.0 * diff / closeOpenAvg
      const pcd = (50000.0 * (closeSeriesAlt - openSeriesAlt)) / closeOpenAvg;
      s.pcd[i] = pcd;
      const trendColour = gt(closeSeriesAlt, openSeriesAlt) ? GREEN : RED;

      // Divergence channel
      const offset = cfg.multi * s.dev.step(pcd);
      const at = (j: number) => (j >= 0 ? s.pcd[j] : NaN);
      const topFractal =
        lt(at(i - 4), at(i - 2)) && lt(at(i - 3), at(i - 2)) && gt(at(i - 2), at(i - 1)) && gt(at(i - 2), at(i));
      const botFractal =
        gt(at(i - 4), at(i - 2)) && gt(at(i - 3), at(i - 2)) && lt(at(i - 2), at(i - 1)) && lt(at(i - 2), at(i));
      // f_fractalize: top fractal ? 1 : bottom fractal ? -1 : 0
      const f = topFractal ? 1 : botFractal ? -1 : 0;
      const fractalTop = f > 0 ? at(i - 2) : NaN;
      const fractalBot = f < 0 ? at(i - 2) : NaN;
      const high2 = i >= 2 ? bars[i - 2].high : NaN;
      const low2 = i >= 2 ? bars[i - 2].low : NaN;
      const ft = truthy(fractalTop);
      const fb = truthy(fractalBot);
      if (ft) {
        v.topValPrev = v.topValLast;
        v.topValLast = at(i - 2);
        v.topHighPrev = v.topHighLast;
        v.topHighLast = high2;
      }
      if (fb) {
        v.botValPrev = v.botValLast;
        v.botValLast = at(i - 2);
        v.botLowPrev = v.botLowLast;
        v.botLowLast = low2;
      }
      const highPrev = v.topValPrev;
      const highPrice = v.topHighPrev;
      const lowPrev = v.botValPrev;
      const lowPrice = v.botLowPrev;
      const regBear = ft && gt(high2, highPrice) && lt(at(i - 2), highPrev) && gt(pcd, 0);
      const hidBear = ft && lt(high2, highPrice) && gt(at(i - 2), highPrev) && gt(pcd, 0);
      const regBull = fb && lt(low2, lowPrice) && gt(at(i - 2), lowPrev) && lt(pcd, 0);
      const hidBull = fb && gt(low2, lowPrice) && lt(at(i - 2), lowPrev) && lt(pcd, 0);

      const p = s.plots;
      p[0][i] = { time, value: pcd, color: String(color.new(trendColour, 80)) };
      p[1][i] = { time, value: pcd, color: String(color.new(trendColour, 20)) };
      p[2][i] = { time, value: uDiv ? pcd : NaN, color: GRAY };
      p[3][i] = { time, value: uDiv ? pcd : NaN, color: GRAY };
      if (i >= 2) {
        // offset = -2: the value of bar i is drawn on bar i - 2 (bar i is the only writer of that slot)
        const back2 = bars[i - 2].time;
        p[4][i - 2] = { time: back2, value: uDiv ? fractalTop + offset : NaN, color: RED };
        p[5][i - 2] = { time: back2, value: uDiv ? fractalBot - offset : NaN, color: GREEN };
        p[6][i - 2] = {
          time: back2, value: uDiv ? fractalTop + offset : NaN,
          color: (regBear && uReg) || (hidBear && uHid) ? MAROON : GRAY,
        };
        p[7][i - 2] = {
          time: back2, value: uDiv ? fractalBot - offset : NaN,
          color: (regBull && uReg) || (hidBull && uHid) ? GREEN : GRAY,
        };
      }

      // plotshape(alert, "OCC Alert Plot", color = trendColour, style = shape.circle, location = location.bottom, size = size.auto)
      if (xlong || xshort) {
        s.markers.push({ time, position: 'bottom', shape: 'circle', color: trendColour, size: 'auto', id: 'shape0' });
      }
      if (i >= 2) {
        const back2 = bars[i - 2].time;
        // plotshape(cond ? price : na, text, style, location.absolute, color, textcolor = color.white, offset = -2)
        const label = (on: boolean, price: number, text: string, down: boolean, col: string, id: string) => {
          if (!on || isNaN(price)) return;
          s.markers.push({ time: back2, position: down ? 'atPriceTop' : 'atPriceBottom', price,
            shape: down ? 'labelDown' : 'labelUp', color: col, text, textColor: WHITE, id });
        };
        label(regBear && uReg, at(i - 2) + offset, 'Regular', true, MAROON, 'shape1');
        label(hidBear && uHid, at(i - 2) + offset, 'hidden', true, MAROON, 'shape2');
        label(regBull && uReg, at(i - 2) - offset, 'Regular', false, GREEN, 'shape3');
        label(hidBull && uHid, at(i - 2) - offset, 'hidden', false, GREEN, 'shape4');
      }

      // alert = longCond or shortCond; longCond = xlong; shortCond = xshort
      const flags = [xlong || xshort, xlong, xshort];
      for (let k = 0; k < 3; k++) {
        s.flags[k][i] = flags[k];
        if (flags[k]) s.times[k].push(time as number);
      }
    },
    result(s, bars) {
      const n = bars.length;
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((pts, k) => { plots[`plot${k}`] = k >= 4 ? pts.slice(0, Math.max(0, n - 2)) : pts.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        hlines: [{ value: 0, options: { color: GRAY, linestyle: 'dashed' } }],
        markers: s.markers.slice(),
        alerts: liveAlertStates(alertConditions, s.times, s.flags.map((f) => n > 0 && f[n - 1])),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<OpenCloseCrossAlertsNRPInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<OpenCloseCrossAlertsNRPInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } & { alerts: AlertConditionState[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const OpenCloseCrossAlertsNRP = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hlineConfig,
  alertConditions,
};
