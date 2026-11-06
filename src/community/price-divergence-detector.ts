/**
 * Price Divergence Detector V3.2
 *
 * An oscillator is computed twice, on the high and on the low (RSI, MACD histogram, Stochastic, volume SMA,
 * Accumulation/Distribution SMA, Fisher Transform, CCI, Bollinger %B with a 0.1 deviation, Ehlers "Ideal RSI" with a
 * Homodyne Discriminator length, Elders Force Index or Trend Accumulation Volume). A 5-bar fractal of the
 * oscillator (bar 2 above / below the two bars on each side) marks a top or a bottom, known 2 bars later. Each top
 * is compared with the top before: a higher price high with a lower oscillator is a regular bearish divergence, a
 * lower price high with a higher oscillator a hidden one (bottoms likewise). The fractal bars and the divergence
 * labels are drawn 2 bars back (plot offset -2): fractal lines and circles at the high / low, maroon (bearish) or
 * green (bullish) on a divergence, silver on the other fractals when "Show Channel" is on.
 *
 * Pine version 3: the colour constants of that version (maroon #800000, green #008000, silver #C0C0C0) and the
 * default plot / shape transparency of that version (35).
 *
 * Reference: "Price Divergence Detector V3.2 revised by JustUncleL" by JustUncleL (original author RicardoSantos)
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, math, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowExtreme, WindowSma, WindowStdev, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

export type DivergenceMethod = 'RSI' | 'MACD' | 'Stochastic' | 'Volume' | 'Accumulation/Distribution'
  | 'Fisher Transform' | 'CCI' | 'BB %B' | 'Ideal RSI' | 'Elders Force Index' | 'Trend Acc Volume';

export interface PriceDivergenceDetectorInputs {
  method: DivergenceMethod;
  showLabels: boolean;
  showChannel: boolean;
  showHidden: boolean;
  showRegular: boolean;
  /** Trend Acc Volume: direction from an EMA of the price instead of the candle colour */
  useTrendEma: boolean;
  /** Length of every method except MACD */
  length: number;
  macdSource: SourceType;
  macdFast: number;
  macdSlow: number;
  macdSmooth: number;
}

export const defaultInputs: PriceDivergenceDetectorInputs = {
  method: 'BB %B',
  showLabels: true,
  showChannel: false,
  showHidden: true,
  showRegular: true,
  useTrendEma: false,
  length: 20,
  macdSource: 'close',
  macdFast: 12,
  macdSlow: 26,
  macdSmooth: 9,
};

const METHODS: DivergenceMethod[] = ['RSI', 'MACD', 'Stochastic', 'Volume', 'Accumulation/Distribution',
  'Fisher Transform', 'CCI', 'BB %B', 'Ideal RSI', 'Elders Force Index', 'Trend Acc Volume'];

export const inputConfig: InputConfig[] = [
  { id: 'method', type: 'string', title: 'method', defval: 'BB %B', options: METHODS },
  { id: 'showLabels', type: 'bool', title: 'Show Labels', defval: true },
  { id: 'showChannel', type: 'bool', title: 'Show Channel', defval: false },
  { id: 'showHidden', type: 'bool', title: 'Show Hidden Divergence', defval: true },
  { id: 'showRegular', type: 'bool', title: 'Show Regular Divergence', defval: true },
  { id: 'useTrendEma', type: 'bool', title: 'Use EMA Trend direction for Trend Acc Volume', defval: false },
  { id: 'length', type: 'int', title: 'Length for Method (except MACD):', defval: 20 },
  { id: 'macdSource', type: 'source', title: 'MACD Source:', defval: 'close' },
  { id: 'macdFast', type: 'int', title: 'MACD Fast:', defval: 12 },
  { id: 'macdSlow', type: 'int', title: 'MACD Slow:', defval: 26 },
  { id: 'macdSmooth', type: 'int', title: 'MACD Smooth Signal:', defval: 9 },
];

// Pine version 3 colours; plots and shapes without transp have the transparency 35 of that version
const MAROON = String(color.new('#800000', 35));
const GREEN = String(color.new('#008000', 35));
const SILVER = String(color.new('#C0C0C0', 35));
const WHITE = '#FFFFFF';
const NA = 'transparent';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'H F', color: MAROON, lineWidth: 1 },
  { id: 'plot1', title: 'L F', color: GREEN, lineWidth: 1 },
  { id: 'plot2', title: 'H D', color: MAROON, lineWidth: 3, style: 'circles' },
  { id: 'plot3', title: 'L D', color: GREEN, lineWidth: 3, style: 'circles' },
];

export const metadata = {
  title: 'Price Divergence Detector V3.2 revised by JustUncleL',
  shortTitle: 'PDDR',
  overlay: true,
};

/** Pine comparisons: a > b only when a - b > 1e-10; na compares false */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;
/** nz(): na and +-infinity give 0 */
const nz = (x: number) => (Number.isFinite(x) ? x : 0);
/** A number used as a condition (version 3): na and 0 are false */
const truthy = (x: number) => !isNaN(x) && x !== 0;

/**
 * `ta.rising(source, length)` / `ta.falling` one bar at a time: a counter of rises (falls, beyond the 1e-10
 * tolerance) from the previous bar, reset by a step that is not one, unchanged by a step from or to an na bar; true
 * when the counter is at least `length` (the rules of the oakscriptjs array function).
 */
class MonotonicStep implements Committable {
  private count = 0;
  private prev = NaN;
  private nextCount = 0;
  private pending = NaN;
  private stepped = false;

  constructor(private readonly length: number, private readonly rising: boolean) {}

  step(v: number): boolean {
    this.stepped = true;
    this.pending = v;
    let c = this.count;
    if (Number.isFinite(v) && Number.isFinite(this.prev)) c = (this.rising ? gt(v, this.prev) : lt(v, this.prev)) ? c + 1 : 0;
    this.nextCount = c;
    return c >= this.length;
  }

  commit(): void {
    if (!this.stepped) return;
    this.stepped = false;
    this.count = this.nextCount;
    this.prev = this.pending;
  }
}

/** f_top_fractal(_src): _src[4] < _src[2] and _src[3] < _src[2] and _src[2] > _src[1] and _src[2] > _src[0] */
const at = (a: number[], i: number) => (i >= 0 ? a[i] : NaN);
const topFractal = (a: number[], i: number) =>
  lt(at(a, i - 4), at(a, i - 2)) && lt(at(a, i - 3), at(a, i - 2)) && gt(at(a, i - 2), at(a, i - 1)) && gt(at(a, i - 2), a[i]);
const botFractal = (a: number[], i: number) =>
  gt(at(a, i - 4), at(a, i - 2)) && gt(at(a, i - 3), at(a, i - 2)) && lt(at(a, i - 2), at(a, i - 1)) && lt(at(a, i - 2), a[i]);

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

/** The recursive values of the oscillators (`nz(x[1])` of the script), for the high and the low calls */
interface PddVars {
  /** Fisher Transform: value, fish */
  v0H: number; fH: number; v0L: number; fL: number;
  /** Trend Acc Volume: direction, accumulated volume */
  dirH: number; accH: number; dirL: number; accL: number;
  /** Ideal RSI: the Homodyne Discriminator state and the rolling averages of the gains / losses */
  period: number; i2: number; q2: number; re: number; im: number; smoothPeriod: number;
  upH: number; downH: number; upL: number; downL: number;
  /** valuewhen(fractal, x[2], 0) */
  tOsc: number; tPrice: number; bOsc: number; bPrice: number;
}

interface PddRun extends BarRunState<PddVars> {
  /** The machines of the selected method (in `steps`), by name */
  m: Record<string, any>;
  oscHigh: number[];
  oscLow: number[];
  /** Ideal RSI: hl2 and the Homodyne Discriminator series */
  hl2: number[];
  smooth: number[];
  det: number[];
  q1: number[];
  i1: number[];
  fractalTop: number[];
  fractalBot: number[];
  whenTopOsc: number[];
  whenTopPrice: number[];
  whenBotOsc: number[];
  whenBotPrice: number[];
  /** The plots start on bar 2 (one point per bar from bar 2, drawn on the bar 2 bars back) */
  hf: Point[];
  lf: Point[];
  hd: Point[];
  ld: Point[];
  markers: MarkerData[];
}

function study(inputs: Partial<PriceDivergenceDetectorInputs>): BarStudy<PddRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.length;
  const macdValue = barSource(cfg.macdSource);
  const other = cfg.showChannel ? SILVER : NA;

  /** The machines of the method */
  const machines = (): Record<string, any> => {
    switch (cfg.method) {
      case 'RSI': return { h: taStep.rsi(len), l: taStep.rsi(len) };
      case 'MACD': return { fast: new WindowSma(cfg.macdFast), slow: new WindowSma(cfg.macdSlow), sig: taStep.ema(cfg.macdSmooth) };
      case 'Stochastic': return { k: taStep.stoch(len) };
      case 'Volume': return { v: new WindowSma(len) };
      case 'Accumulation/Distribution': return { cum: taStep.cum(), v: new WindowSma(len) };
      case 'Fisher Transform': return {
        hh: new WindowExtreme(false, len), hl: new WindowExtreme(true, len),
        lh: new WindowExtreme(false, len), ll: new WindowExtreme(true, len),
      };
      case 'CCI': return { h: taStep.cci(len), l: taStep.cci(len) };
      case 'BB %B': return { hb: new WindowSma(len), hs: new WindowStdev(len), lb: new WindowSma(len), ls: new WindowStdev(len) };
      case 'Trend Acc Volume': return {
        hma: taStep.ema(len), lma: taStep.ema(len),
        ...(cfg.useTrendEma ? {
          hr: new MonotonicStep(3, true), hf: new MonotonicStep(3, false),
          lr: new MonotonicStep(3, true), lf: new MonotonicStep(3, false),
        } : {}),
      };
      default: return {};
    }
  };

  /** fisher(): one bar of the Fisher Transform of `x` (its highest / lowest), the state in vars `v0` / `f` */
  const fisher = (v: PddVars, high: boolean, x: number, h: number, l: number): number => {
    const v0 = 0.66 * ((x - l) / Math.max(h - l, 0.001) - 0.5) + 0.67 * nz(high ? v.v0H : v.v0L);
    const v1 = gt(v0, 0.99) ? 0.999 : lt(v0, -0.99) ? -0.999 : v0;
    const f = 0.5 * Math.log((1 + v1) / Math.max(1 - v1, 0.001)) + 0.5 * nz(high ? v.fH : v.fL);
    if (high) { v.v0H = v0; v.fH = f; } else { v.v0L = v0; v.fL = f; }
    return f;
  };

  /** pcBB(): (p - lower) / (upper - lower) with basis sma(p, l) and deviation 0.1 * stdev(p, l) */
  const pcBB = (x: number, basis: number, sd: number): number => {
    const dev = 0.1 * sd;
    const upper = basis + dev;
    const lower = basis - dev;
    return (x - lower) / (upper - lower);
  };

  /** TVA(p, l): volume accumulated while the direction (candle colour, or a rising / falling EMA) stays the same */
  const tva = (v: PddVars, high: boolean, b: Bar, volume: number, rising: boolean, falling: boolean): number => {
    const prevDir = high ? v.dirH : v.dirL;
    const direction = cfg.useTrendEma
      ? (rising ? 1 : falling ? -1 : nz(prevDir))
      : (lt(b.open, b.close) ? 1 : gt(b.open, b.close) ? -1 : nz(prevDir));
    const prev = nz(high ? v.accH : v.accL);
    const acc = gt(direction, 0) ? (!lt(prev, 0) ? prev + volume : volume)
      : lt(direction, 0) ? (!gt(prev, 0) ? prev - volume : -volume) : prev;
    if (high) { v.dirH = direction; v.accH = acc; } else { v.dirL = direction; v.accL = acc; }
    return acc;
  };

  /** irsi(p, l) on one bar: RSI of rolling averages irma := (nz(irma[1]) * (l - 1) + p) / l */
  const irsi = (v: PddVars, high: boolean, ch: number, l: number): number => {
    const up = (nz(high ? v.upH : v.upL) * (l - 1) + Math.max(ch, 0)) / l;
    const down = (nz(high ? v.downH : v.downL) * (l - 1) + -Math.min(ch, 0)) / l;
    if (high) { v.upH = up; v.downH = down; } else { v.upL = up; v.downL = down; }
    if (!isNaN(down) && !ne(down, 0)) return 100;
    if (!isNaN(up) && !ne(up, 0)) return 0;
    return 100 - 100 / (1 + up / down);
  };

  /** RSI length of idealRSI(): Homodyne Discriminator period of hl2 (the same for the high and the low call) */
  const idealRsiLength = (s: PddRun, i: number, b: Bar): number => {
    const v = s.vars;
    const C1 = 0.0962;
    const C2 = 0.5769;
    const Df = 0.5;
    const { hl2, smooth, det, q1, i1 } = s;
    hl2[i] = (b.high + b.low) / 2;
    const c3 = nz(v.period) * 0.075 + 0.54;
    smooth[i] = (hl2[i] * 4.0 + at(hl2, i - 1) * 3.0 + at(hl2, i - 2) * 2.0 + at(hl2, i - 3)) / 10.0;
    det[i] = (smooth[i] * C1 + nz(at(smooth, i - 2)) * C2 - nz(at(smooth, i - 4)) * C2 - nz(at(smooth, i - 6)) * C1) * c3;
    q1[i] = (det[i] * C1 + nz(at(det, i - 2)) * C2 - nz(at(det, i - 4)) * C2 - nz(at(det, i - 6)) * C1) * c3;
    i1[i] = nz(at(det, i - 3));
    const jI = (i1[i] * C1 + nz(at(i1, i - 2)) * C2 - nz(at(i1, i - 4)) * C2 - nz(at(i1, i - 6)) * C1) * c3;
    const jQ = (q1[i] * C1 + nz(at(q1, i - 2)) * C2 - nz(at(q1, i - 4)) * C2 - nz(at(q1, i - 6)) * C1) * c3;
    const i2n = 0.2 * (i1[i] - jQ) + 0.8 * nz(v.i2);
    const q2n = 0.2 * (q1[i] + jI) + 0.8 * nz(v.q2);
    const reN = 0.2 * (i2n * nz(v.i2) + q2n * nz(v.q2)) + 0.8 * nz(v.re);
    const imN = 0.2 * (i2n * nz(v.q2) - q2n * nz(v.i2)) + 0.8 * nz(v.im);
    v.i2 = i2n;
    v.q2 = q2n;
    v.re = reN;
    v.im = imN;
    // iff(Re != 0 and Im != 0, 6.28318 / atan(Im / Re), 0): na != 0 is false
    const re = v.re;
    const im = v.im;
    const dpRaw = !isNaN(re) && ne(re, 0) && !isNaN(im) && ne(im, 0) ? 6.28318 / Math.atan(im / re) : 0;
    const ii = nz(v.period);
    const dp = Math.max(Math.max(Math.min(Math.min(dpRaw, 1.5 * ii), 50), 0.6667 * ii), 6);
    v.period = dp * 0.2 + nz(v.period) * 0.8;
    v.smoothPeriod = 0.33 * v.period + nz(v.smoothPeriod) * 0.67;
    return math.round(v.smoothPeriod * Df - 1) as number;
  };

  /** The oscillators of the method on bar i (oscHigh[i], oscLow[i]) */
  const oscillators = (s: PddRun, i: number, bars: Bar[]): void => {
    const m = s.m;
    const v = s.vars;
    const b = bars[i];
    const volume = b.volume ?? NaN;
    let hi = NaN;
    let lo = NaN;
    switch (cfg.method) {
      case 'RSI':
        hi = m.h.step(b.high);
        lo = m.l.step(b.low);
        break;
      case 'MACD': {
        // f_macd(): SMA fast - SMA slow, EMA signal, histogram
        const src = macdValue(b);
        const macd = m.fast.step(src) - m.slow.step(src);
        hi = lo = macd - m.sig.step(macd);
        break;
      }
      case 'Stochastic':
        hi = lo = m.k.step(b.close, b.high, b.low);
        break;
      case 'Volume':
        hi = lo = m.v.step(volume);
        break;
      case 'Accumulation/Distribution': {
        // sma(cum(close == high and close == low or high == low ? 0 : (2 * close - low - high) / (high - low) * volume))
        const ad = (!ne(b.close, b.high) && !ne(b.close, b.low)) || !ne(b.high, b.low)
          ? 0 : ((2 * b.close - b.low - b.high) / (b.high - b.low)) * volume;
        hi = lo = m.v.step(m.cum.step(ad));
        break;
      }
      case 'Fisher Transform':
        hi = fisher(v, true, b.high, m.hh.step(b.high), m.hl.step(b.high));
        lo = fisher(v, false, b.low, m.lh.step(b.low), m.ll.step(b.low));
        break;
      case 'CCI':
        hi = m.h.step(b.high);
        lo = m.l.step(b.low);
        break;
      case 'BB %B':
        hi = pcBB(b.high, m.hb.step(b.high), m.hs.step(b.high));
        lo = pcBB(b.low, m.lb.step(b.low), m.ls.step(b.low));
        break;
      case 'Ideal RSI': {
        const l = idealRsiLength(s, i, b);
        const p = i > 0 ? bars[i - 1] : null;
        hi = irsi(v, true, p ? b.high - p.high : NaN, l);
        lo = irsi(v, false, p ? b.low - p.low : NaN, l);
        break;
      }
      case 'Elders Force Index': {
        const p = i > 0 ? bars[i - 1] : null;
        hi = p ? (b.high - p.high) * volume : NaN;
        lo = p ? (b.low - p.low) * volume : NaN;
        break;
      }
      case 'Trend Acc Volume': {
        const hma = m.hma.step(b.high);
        const lma = m.lma.step(b.low);
        const ema = cfg.useTrendEma;
        hi = tva(v, true, b, volume, ema && m.hr.step(hma), ema && m.hf.step(hma));
        lo = tva(v, false, b, volume, ema && m.lr.step(lma), ema && m.lf.step(lma));
        break;
      }
      default:
        break;
    }
    s.oscHigh[i] = hi;
    s.oscLow[i] = lo;
  };

  return {
    fullRunReason: () => (cfg.method !== 'MACD' || isBarSource(cfg.macdSource) ? null : 'source of another study'),
    init() {
      const m = machines();
      const s: PddRun = {
        m, oscHigh: [], oscLow: [], hl2: [], smooth: [], det: [], q1: [], i1: [],
        fractalTop: [], fractalBot: [], whenTopOsc: [], whenTopPrice: [], whenBotOsc: [], whenBotPrice: [],
        hf: [], lf: [], hd: [], ld: [], markers: [],
        steps: Object.values(m) as Committable[],
        vars: {
          v0H: NaN, fH: NaN, v0L: NaN, fL: NaN, dirH: NaN, accH: NaN, dirL: NaN, accL: NaN,
          period: NaN, i2: NaN, q2: NaN, re: NaN, im: NaN, smoothPeriod: NaN, upH: NaN, downH: NaN, upL: NaN, downL: NaN,
          tOsc: NaN, tPrice: NaN, bOsc: NaN, bPrice: NaN,
        },
        lists: [], series: [],
      };
      s.lists = [s.hf, s.lf, s.hd, s.ld, s.markers];
      s.series = [
        s.oscHigh, s.oscLow, s.hl2, s.smooth, s.det, s.q1, s.i1, s.fractalTop, s.fractalBot, s.whenTopOsc,
        s.whenTopPrice, s.whenBotOsc, s.whenBotPrice,
      ];
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      oscillators(s, i, bars);
      const { oscHigh, oscLow } = s;

      // f_fractalize(_src) = f_top_fractal(_src) ? 1 : f_bot_fractal(_src) ? -1 : 0, on the series of the caller
      // (measured: f_bot_fractal reads the full history of _src, also on the bars where it does not run)
      const fractalTop = topFractal(oscHigh, i) ? at(oscHigh, i - 2) : NaN;
      const fractalBot = !topFractal(oscLow, i) && botFractal(oscLow, i) ? at(oscLow, i - 2) : NaN;
      s.fractalTop[i] = fractalTop;
      s.fractalBot[i] = fractalBot;

      // valuewhen(fractal, x[2], 0)[2]
      if (truthy(fractalTop)) {
        v.tOsc = at(oscHigh, i - 2);
        v.tPrice = i >= 2 ? bars[i - 2].high : NaN;
      }
      if (truthy(fractalBot)) {
        v.bOsc = at(oscLow, i - 2);
        v.bPrice = i >= 2 ? bars[i - 2].low : NaN;
      }
      s.whenTopOsc[i] = v.tOsc;
      s.whenTopPrice[i] = v.tPrice;
      s.whenBotOsc[i] = v.bOsc;
      s.whenBotPrice[i] = v.bPrice;

      if (i < 2) return;
      const top = truthy(fractalTop);
      const bot = truthy(fractalBot);
      const h2 = bars[i - 2].high;
      const l2 = bars[i - 2].low;
      const highPrev = at(s.whenTopOsc, i - 2);
      const highPrice = at(s.whenTopPrice, i - 2);
      const lowPrev = at(s.whenBotOsc, i - 2);
      const lowPrice = at(s.whenBotPrice, i - 2);
      const regularBear = top && gt(h2, highPrice) && lt(oscHigh[i - 2], highPrev);
      const hiddenBear = top && lt(h2, highPrice) && gt(oscHigh[i - 2], highPrev);
      const regularBull = bot && lt(l2, lowPrice) && gt(oscLow[i - 2], lowPrev);
      const hiddenBull = bot && gt(l2, lowPrice) && lt(oscLow[i - 2], lowPrev);

      // offset = -2: the values of bar i are drawn on bar i - 2
      const time = bars[i - 2].time;
      const hColor = (regularBear && cfg.showRegular) || (hiddenBear && cfg.showHidden) ? MAROON : other;
      const lColor = (regularBull && cfg.showRegular) || (hiddenBull && cfg.showHidden) ? GREEN : other;
      const hv = top ? h2 : NaN;
      const lv = bot ? l2 : NaN;
      s.hf.push({ time, value: hv, color: hColor });
      s.lf.push({ time, value: lv, color: lColor });
      s.hd.push({ time, value: hv, color: hColor });
      s.ld.push({ time, value: lv, color: lColor });

      if (cfg.showLabels) {
        const markers = s.markers;
        // plotshape order: +RBD, +HBD, -RBD, -HBD
        if (cfg.showRegular && regularBear) markers.push({ time, position: 'atPriceTop', price: h2, shape: 'labelDown', color: MAROON, text: 'R', textColor: WHITE });
        if (cfg.showHidden && hiddenBear) markers.push({ time, position: 'atPriceTop', price: h2, shape: 'labelDown', color: MAROON, text: 'H', textColor: WHITE });
        if (cfg.showRegular && regularBull) markers.push({ time, position: 'atPriceBottom', price: l2, shape: 'labelUp', color: GREEN, text: 'R', textColor: WHITE });
        if (cfg.showHidden && hiddenBull) markers.push({ time, position: 'atPriceBottom', price: l2, shape: 'labelUp', color: GREEN, text: 'H', textColor: WHITE });
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.hf.slice(), plot1: s.lf.slice(), plot2: s.hd.slice(), plot3: s.ld.slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PriceDivergenceDetectorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PriceDivergenceDetectorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const PriceDivergenceDetector = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
