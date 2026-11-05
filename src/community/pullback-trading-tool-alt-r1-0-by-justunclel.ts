/**
 * Pullback Trading Tool ALT R2.0 by JustUncleL
 *
 * Moving averages for pullback trading:
 * - a ribbon of a fast and a slow average (EMA 5 and EMA 12), coloured by their rise, with a fill;
 * - a signal average (EMA 50, circles) and bar colours from the open and the close against it (three tones, or the
 *   six "Grab" tones that also tell rising from falling candles);
 * - a fast, a medium and an optional slow anchored average (EMA 35 / 65 / 200) with a fill;
 * - pivot highs and lows (dots), optional HH / LH / HL / LL marks, and the last pivot levels as extensions or as a
 *   fractal chaos channel;
 * - optional entry arrows (the original's four plotarrow outputs, `arrows` of the result): a trend break (both
 *   ribbon averages above, or below, the three other averages) and the break of the last pivot level inside a trend.
 * Eleven average types: SMA, EMA, WMA, VWMA, SMMA, DEMA, TEMA, HullMA, ZEMA, TMA, SSMA.
 *
 * With an anchor timeframe in minutes above the chart timeframe (intraday charts only) every length is multiplied by
 * anchor / chart minutes. The chart timeframe is read from the chart context; without it, from the spacing of the
 * bars.
 *
 * Reference: "Pullback Trading Tool ALT R2.0 by JustUncleL" by JustUncleL
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright 2017,2018 JustUncleL
 */

import {
  taStep, color, compare, timeframe,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType, type ArrowData,
} from 'oakscriptjs';
import type { BarColorData, MarkerData } from '../types';
import { chartTimeframe } from '../anchor-period';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, PivotStep, type BarRunState, type BarStudy, type Committable, type IndicatorRun } from '../live-run';

type MaType = 'SMA' | 'EMA' | 'WMA' | 'VWMA' | 'SMMA' | 'DEMA' | 'TEMA' | 'HullMA' | 'ZEMA' | 'TMA' | 'SSMA';
const MA_TYPES: MaType[] = ['SMA', 'EMA', 'WMA', 'VWMA', 'SMMA', 'DEMA', 'TEMA', 'HullMA', 'ZEMA', 'TMA', 'SSMA'];

export interface PullbackTradingToolAltInputs {
  maSrc: SourceType;
  showMAs: boolean;
  /** Multiply the ribbon lengths by the anchor multiplier too */
  anchorRibbon: boolean;
  fastType: MaType;
  fastLen: number;
  slowType: MaType;
  slowLen: number;
  /** Anchor timeframe in minutes (0 = none) */
  anchor: number;
  fastAnchorType: MaType;
  fastAnchorLen: number;
  mediumAnchorType: MaType;
  mediumAnchorLen: number;
  useSlowMA: boolean;
  slowAnchorType: MaType;
  slowAnchorLen: number;
  signalType: MaType;
  signalLen: number;
  showBreak: boolean;
  showPB: boolean;
  closeBr: boolean;
  lookback: number;
  showBarColor: boolean;
  useGrabClr: boolean;
  showPivots: boolean;
  pvtLenL: number;
  pvtLenR: number;
  showSRLevels: boolean;
  showChannel: boolean;
  maxLvlLen: number;
  uRenko: boolean;
  showHHLL: boolean;
}

export const defaultInputs: PullbackTradingToolAltInputs = {
  maSrc: 'close',
  showMAs: true,
  anchorRibbon: true,
  fastType: 'EMA',
  fastLen: 5,
  slowType: 'EMA',
  slowLen: 12,
  anchor: 0,
  fastAnchorType: 'EMA',
  fastAnchorLen: 35,
  mediumAnchorType: 'EMA',
  mediumAnchorLen: 65,
  useSlowMA: false,
  slowAnchorType: 'EMA',
  slowAnchorLen: 200,
  signalType: 'EMA',
  signalLen: 50,
  showBreak: false,
  showPB: false,
  closeBr: true,
  lookback: 6,
  showBarColor: true,
  useGrabClr: true,
  showPivots: true,
  pvtLenL: 2,
  pvtLenR: 2,
  showSRLevels: false,
  showChannel: false,
  maxLvlLen: 0,
  uRenko: false,
  showHHLL: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'maSrc', type: 'source', title: 'Source for All Moving Averages', defval: 'close' },
  { id: 'showMAs', type: 'bool', title: 'Show MA Ribbon', defval: true },
  { id: 'anchorRibbon', type: 'bool', title: 'Anchor MA Ribbon', defval: true },
  { id: 'fastType', type: 'string', title: 'Fast Ribbon MA Type: ', defval: 'EMA', options: MA_TYPES },
  { id: 'fastLen', type: 'int', title: 'Fast Ribbon MA Length:', defval: 5, min: 1 },
  { id: 'slowType', type: 'string', title: 'Slow Ribbon MA Type: ', defval: 'EMA', options: MA_TYPES },
  { id: 'slowLen', type: 'int', title: 'Slow Ribbon MA Length:', defval: 12, min: 1 },
  { id: 'anchor', type: 'int', title: 'Anchor TimeFrame in Mins (0=none, 1D=1440, 1W=7200)', defval: 0, min: 0, max: 1440 },
  { id: 'fastAnchorType', type: 'string', title: 'Fast Anchored MA Type: ', defval: 'EMA', options: MA_TYPES },
  { id: 'fastAnchorLen', type: 'int', title: 'Fast Anchored MA Length:', defval: 35, min: 1 },
  { id: 'mediumAnchorType', type: 'string', title: 'Medium Anchored MA Type: ', defval: 'EMA', options: MA_TYPES },
  { id: 'mediumAnchorLen', type: 'int', title: 'Medium Anchored MA Length:', defval: 65, min: 1 },
  { id: 'useSlowMA', type: 'bool', title: 'Show Slow Anchored MA', defval: false },
  { id: 'slowAnchorType', type: 'string', title: 'Slow Anchored MA Type: ', defval: 'EMA', options: MA_TYPES },
  { id: 'slowAnchorLen', type: 'int', title: 'Slow Anchored MA Length:', defval: 200, min: 1 },
  { id: 'signalType', type: 'string', title: 'Signal Anchored MA Type: ', defval: 'EMA', options: MA_TYPES },
  { id: 'signalLen', type: 'int', title: 'Signal Anchored MA Length:', defval: 50, min: 1 },
  { id: 'showBreak', type: 'bool', title: 'Show Entrys for Trend Breaks', defval: false },
  { id: 'showPB', type: 'bool', title: 'Show Entrys for PB Fractal Breaks', defval: false },
  { id: 'closeBr', type: 'bool', title: 'Use Close Break instead Touch Fractal Break', defval: true },
  { id: 'lookback', type: 'int', title: 'Pull Back Lookback Length', defval: 6, min: 1 },
  { id: 'showBarColor', type: 'bool', title: 'Show coloured Bars close relative to Signal MA', defval: true },
  { id: 'useGrabClr', type: 'bool', title: 'Use Grab Candle (6-tone) Colouring, instead of Standard (3-tone)', defval: true },
  { id: 'showPivots', type: 'bool', title: 'Show Pivot Points', defval: true },
  { id: 'pvtLenL', type: 'int', title: 'Pivot Length Left Hand Side', defval: 2, min: 1 },
  { id: 'pvtLenR', type: 'int', title: 'Pivot Length Right Hand Side', defval: 2, min: 1 },
  { id: 'showSRLevels', type: 'bool', title: 'Show S/R Level Extensions', defval: false },
  { id: 'showChannel', type: 'bool', title: 'Show Levels as a Fractal Chaos Channel', defval: false },
  { id: 'maxLvlLen', type: 'int', title: 'Maximum S/R Level Extension Length', defval: 0, min: 0 },
  { id: 'uRenko', type: 'bool', title: 'Use Renko Style Pivots (open/close for high/low)', defval: false },
  { id: 'showHHLL', type: 'bool', title: 'ShowHHLL', defval: false },
];

// Colour constants of Pine version 3 and of the script
const AQUA = '#00FFFF';
const FUCHSIA = '#FF00FF';
const GREEN = '#008000';
const GRAY = '#808080';
const WHITE = '#FFFFFF';
const MAROON = '#800000';
const LIME = '#00FF00';
const RED = '#FF0000';
const BLUE = '#0000FF';
const YELLOW = '#FFFF00';
const DARK_RED = '#8B0000';
const DODGER_BLUE = '#1E90FF';
const GOLD = '#FFD700';
const T = (hex: string, transp: number) => String(color.new(hex, transp));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast MA', color: T(AQUA, 10), lineWidth: 1 },
  { id: 'plot1', title: 'Slow MA', color: T(AQUA, 10), lineWidth: 1 },
  { id: 'plot2', title: 'Signal MA', color: T(GOLD, 20), lineWidth: 2, style: 'circles' },
  { id: 'plot3', title: 'Fast Anchored MA', color: T(DODGER_BLUE, 20), lineWidth: 1 },
  { id: 'plot4', title: 'Medium Anchored MA', color: T(GREEN, 20), lineWidth: 1 },
  { id: 'plot5', title: 'Slow Anchored MA', color: T(GRAY, 20), lineWidth: 2 },
  { id: 'plot6', title: 'High Pivot *', color: T(WHITE, 50), lineWidth: 3, style: 'circles' },
  { id: 'plot7', title: 'Low Pivot *', color: T(WHITE, 50), lineWidth: 3, style: 'circles' },
  { id: 'plot8', title: 'High Pivot *', color: GREEN, lineWidth: 2, style: 'circles' },
  { id: 'plot9', title: 'Low Pivot *', color: MAROON, lineWidth: 2, style: 'circles' },
  { id: 'plot10', title: 'Top Levels', color: GREEN, lineWidth: 1 },
  { id: 'plot11', title: 'Bottom Levels', color: MAROON, lineWidth: 1 },
  { id: 'plot12', title: 'Top Levels 2', color: GREEN, lineWidth: 1 },
  { id: 'plot13', title: 'Bottom Levels 2', color: MAROON, lineWidth: 1 },
  { id: 'plot14', title: 'Top Chaos Channel', color: GREEN, lineWidth: 1 },
  { id: 'plot15', title: 'Bottom Chaos Channel', color: MAROON, lineWidth: 1 },
];

export const metadata = {
  title: 'Pullback Trading Tool ALT R2.0 by JustUncleL',
  shortTitle: 'PBTOOLA R2.0',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
/** a != b (false when a value is na) */
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;
/** A float read as a condition: na and 0 are false */
const truthy = (v: number) => !isNaN(v) && v !== 0;

type Point = { time: number; value: number; color?: string };

type Result = Omit<IndicatorResult, 'markers' | 'barColors'> & { markers: MarkerData[]; barColors: BarColorData[]; arrows: ArrowData[] };
/** One moving average of the source on bar i (its machines and arrays in the run) */
type MaFn = (x: number, volume: number, i: number) => number;

interface PbVars {
  /** ta.rising(fastMA, 2) / ta.rising(slowMA, 2): the counters of rises */
  riseFast: number;
  riseSlow: number;
  /** valuewhen histories of the pivots: the latest value (0) and the one before (1) */
  hi0: number;
  hi1: number;
  lo0: number;
  lo1: number;
  counthi: number;
  countlo: number;
  pvthis: number;
  pvtlos: number;
  trUp: boolean | null; // tr_up[1] is na on the first bar
  trDown: boolean | null;
  pullbackUpT: number;
  pullbackDnT: number;
}

interface PbRun extends BarRunState<PbVars> {
  fast: MaFn;
  slow: MaFn;
  fastAnchor: MaFn;
  mediumAnchor: MaFn;
  slowAnchor: MaFn;
  signal: MaFn;
  pvthi: PivotStep;
  pvtlo: PivotStep;
  hi: number[];
  lo: number[];
  fastMA: number[];
  slowMA: number[];
  plots: Point[][];
  /** plot6 .. plot11: the point of bar i - pvtLenR, written by bar i (index i - pvtLenR) */
  backPlots: Point[][];
  ribbonFill: string[];
  barColors: BarColorData[];
  markers: MarkerData[];
  arrows: ArrowData[];
}

/** Anchor multiplier: on an intraday chart below the anchor timeframe, round(anchor / chart minutes) */
function anchorMultiplier(bars: Bar[], chart: ChartContext | undefined, anchor: number): number {
  // On daily, weekly and monthly charts the source needs an anchor above 1440 minutes, which the input does not
  // allow: 1.
  const tf = chart?.timeframe ?? chartTimeframe(bars);
  const info = tf === '' ? null : timeframe.info(tf);
  const interval = info ? info.multiplier : 0;
  return info !== null && info.isintraday && !(anchor === 0 || interval <= 0 || interval >= anchor)
    ? Math.round(anchor / interval) : 1;
}

function study(inputs: Partial<PullbackTradingToolAltInputs>): BarStudy<PbRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.maSrc);
  const R = cfg.pvtLenR;
  const levelsOn = cfg.showSRLevels && !cfg.showChannel;
  const channelOn = cfg.showSRLevels && cfg.showChannel;
  const pivotsOn = cfg.showPivots && !cfg.showHHLL;
  const nz = (v: number) => (isNaN(v) ? 0 : v);

  // variant(type, src, len): the selected moving average, SMA for an unknown type
  const variant = (s: PbRun, type: string, len: number): MaFn => {
    const add = <M extends Committable>(m: M): M => { s.steps.push(m); return m; };
    const ema = () => add(taStep.ema(len));
    switch (type) {
      case 'EMA': { const e = ema(); return (x) => e.step(x); }
      case 'WMA': { const w = add(taStep.wma()); return (x) => w.step(x, len); }
      case 'VWMA': { const w = add(taStep.vwma(len)); return (x, vol) => w.step(x, vol); }
      case 'SMMA': {
        // v5 := na(v5[1]) ? sma(src, len) : (v5[1] * (len - 1) + src) / len
        const sma = add(taStep.sma());
        const out: number[] = [];
        s.series.push(out);
        return (x, _vol, i) => {
          const m = sma.step(x, len);
          out[i] = i === 0 || isNaN(out[i - 1]) ? m : (out[i - 1] * (len - 1) + x) / len;
          return out[i];
        };
      }
      case 'DEMA': {
        const e1 = ema(); const e2 = ema();
        return (x) => { const v2 = e1.step(x); return v2 * 2 - e2.step(v2); };
      }
      case 'TEMA': {
        const e1 = ema(); const e2 = ema(); const e3 = ema();
        return (x) => {
          const v2 = e1.step(x);
          const v3 = e2.step(v2);
          return (v2 - v3) * 3 + e3.step(v3);
        };
      }
      case 'HullMA': {
        // wma(2 * wma(src, len / 2) - wma(src, len), round(sqrt(len)))
        const w1 = add(taStep.wma()); const w2 = add(taStep.wma()); const w3 = add(taStep.wma());
        const half = Math.trunc(len / 2);
        const root = Math.round(Math.sqrt(len));
        return (x) => w3.step(w1.step(x, half) * 2 - w2.step(x, len), root);
      }
      case 'SSMA': {
        // SuperSmoother filter, (c) 2013 John F. Ehlers
        const a1 = Math.exp((-1.414 * 3.14159) / len);
        const b1 = 2 * a1 * Math.cos((1.414 * 3.14159) / len);
        const c2 = b1;
        const c3 = -a1 * a1;
        const c1 = 1 - c2 - c3;
        const src: number[] = [];
        const out: number[] = [];
        s.series.push(src, out);
        return (x, _vol, i) => {
          src[i] = x;
          out[i] = (c1 * (x + nz(i > 0 ? src[i - 1] : NaN))) / 2 + c2 * nz(i > 0 ? out[i - 1] : NaN) + c3 * nz(i > 1 ? out[i - 2] : NaN);
          return out[i];
        };
      }
      case 'ZEMA': {
        const e1 = ema(); const e2 = ema();
        return (x) => { const v = e1.step(x); return v + (v - e2.step(v)); };
      }
      case 'TMA': {
        const s1 = add(taStep.sma()); const s2 = add(taStep.sma());
        return (x) => s2.step(s1.step(x, len), len);
      }
      default: { const m = add(taStep.sma()); return (x) => m.step(x, len); }
    }
  };

  /** ta.rising(x, 2) of one bar: the counter of rises from the previous bar (unchanged at an na step) */
  const rising = (count: number, x: number, prev: number): number =>
    (Number.isFinite(x) && Number.isFinite(prev) ? (compare.gt(x, prev) ? count + 1 : 0) : count);

  return {
    fullRunReason: () => (isBarSource(cfg.maSrc) ? null : 'source of another study'),
    // the lengths follow the anchor multiplier of the chart timeframe (from the bar gaps without a chart timeframe)
    key: (bars, chart) => String(anchorMultiplier(bars, chart, cfg.anchor)),
    init(bars, chart) {
      const mult = anchorMultiplier(bars, chart, cfg.anchor);
      const fastAnchorLen = cfg.fastAnchorLen * mult;
      const mediumAnchorLen = cfg.mediumAnchorLen * mult;
      const slowAnchorLen = cfg.slowAnchorLen * mult;
      const signalLen = cfg.signalLen * mult;
      const fastLen = cfg.anchorRibbon ? cfg.fastLen * mult : cfg.fastLen;
      const slowLen = cfg.anchorRibbon ? cfg.slowLen * mult : cfg.slowLen;
      const nop: MaFn = () => NaN;
      const s: PbRun = {
        fast: nop, slow: nop, fastAnchor: nop, mediumAnchor: nop, slowAnchor: nop, signal: nop,
        pvthi: new PivotStep(cfg.pvtLenL, R, true), pvtlo: new PivotStep(cfg.pvtLenL, R, false),
        hi: [], lo: [], fastMA: [], slowMA: [], plots: Array.from({ length: 16 }, () => []), backPlots: [],
        ribbonFill: [], barColors: [], markers: [], arrows: [],
        steps: [],
        vars: {
          riseFast: 0, riseSlow: 0, hi0: NaN, hi1: NaN, lo0: NaN, lo1: NaN, counthi: NaN, countlo: NaN, pvthis: NaN,
          pvtlos: NaN, trUp: null, trDown: null, pullbackUpT: NaN, pullbackDnT: NaN,
        },
        lists: [], series: [],
      };
      s.fast = variant(s, cfg.fastType, fastLen);
      s.slow = variant(s, cfg.slowType, slowLen);
      s.fastAnchor = variant(s, cfg.fastAnchorType, fastAnchorLen);
      s.mediumAnchor = variant(s, cfg.mediumAnchorType, mediumAnchorLen);
      s.slowAnchor = variant(s, cfg.slowAnchorType, slowAnchorLen);
      s.signal = variant(s, cfg.signalType, signalLen);
      s.steps.push(s.pvthi, s.pvtlo);
      s.backPlots = [6, 7, 8, 9, 10, 11].map((k) => s.plots[k]);
      s.lists = [s.barColors, s.markers, s.arrows];
      s.series.push(s.hi, s.lo, s.fastMA, s.slowMA, s.ribbonFill,
        ...s.plots.filter((p) => !s.backPlots.includes(p)));
      return s;
    },
    bar(s, i, bars) {
      const v = s.vars;
      const b = bars[i];
      const t = b.time as number;
      const x = value(b);
      const vol = b.volume ?? NaN;
      const fastMA = s.fast(x, vol, i);
      const slowMA = s.slow(x, vol, i);
      const fastAnchorMA = s.fastAnchor(x, vol, i);
      const mediumAnchorMA = s.mediumAnchor(x, vol, i);
      const slowAnchorMA = s.slowAnchor(x, vol, i);
      const sig = s.signal(x, vol, i);
      s.fastMA[i] = fastMA;
      s.slowMA[i] = slowMA;
      v.riseFast = rising(v.riseFast, fastMA, i > 0 ? s.fastMA[i - 1] : NaN);
      v.riseSlow = rising(v.riseSlow, slowMA, i > 0 ? s.slowMA[i - 1] : NaN);
      const fastRising = v.riseFast >= 2;
      const slowRising = v.riseSlow >= 2;

      // Pivots on the highs and lows, or on the candle bodies (Renko style)
      const hiV = cfg.uRenko ? Math.max(b.close, b.open) : b.high;
      const loV = cfg.uRenko ? Math.min(b.close, b.open) : b.low;
      s.hi[i] = hiV;
      s.lo[i] = loV;
      const pvthi = s.pvthi.step(i, hiV);
      const pvtlo = s.pvtlo.step(i, loV);
      const p = s.plots;

      // Bar colour from the open and the close against the signal average
      if (cfg.showBarColor) {
        const above = gt(b.open, sig) && gt(b.close, sig);
        const below = lt(b.open, sig) && lt(b.close, sig);
        const falling = gt(b.open, b.close);
        const c = !cfg.useGrabClr
          ? (above ? DODGER_BLUE : below ? RED : YELLOW)
          : above ? (falling ? GREEN : LIME) : below ? (falling ? DARK_RED : RED) : (falling ? BLUE : AQUA);
        s.barColors.push({ time: t, color: c });
      }

      p[0][i] = { time: t, value: cfg.showMAs ? fastMA : NaN, color: T(fastRising ? AQUA : FUCHSIA, 10) };
      p[1][i] = { time: t, value: cfg.showMAs ? slowMA : NaN, color: T(slowRising ? AQUA : FUCHSIA, 10) };
      s.ribbonFill[i] = T(gt(fastMA, slowMA) ? AQUA : FUCHSIA, 90);
      p[2][i] = { time: t, value: sig };
      p[3][i] = { time: t, value: fastAnchorMA };
      p[4][i] = { time: t, value: mediumAnchorMA };
      p[5][i] = { time: t, value: cfg.useSlowMA ? slowAnchorMA : NaN };

      // Higher highs, lower highs, higher lows, lower lows: valuewhen(pvthi, high_[pvtLenR], 1) against (..., 0)
      const isHi = truthy(pvthi);
      const isLo = truthy(pvtlo);
      if (isHi) { v.hi1 = v.hi0; v.hi0 = i - R >= 0 ? s.hi[i - R] : NaN; }
      if (isLo) { v.lo1 = v.lo0; v.lo0 = i - R >= 0 ? s.lo[i - R] : NaN; }
      const hasHi = !isNaN(pvthi);
      const hasLo = !isNaN(pvtlo);
      const higherHigh = hasHi && lt(v.hi1, v.hi0) ? pvthi : NaN;
      const lowerHigh = hasHi && gt(v.hi1, v.hi0) ? pvthi : NaN;
      const higherLow = hasLo && lt(v.lo1, v.lo0) ? pvtlo : NaN;
      const lowerLow = hasLo && gt(v.lo1, v.lo0) ? pvtlo : NaN;
      // plotshape(..., offset = -pvtLenR, transp = 20): the mark is drawn pvtLenR bars back
      if (cfg.showHHLL && i - R >= 0) {
        const tb = bars[i - R].time as number;
        const mark = (val: number, above: boolean, base: string, text: string, id: string) => {
          if (truthy(val)) {
            s.markers.push({
              time: tb, position: above ? 'aboveBar' : 'belowBar', shape: above ? 'triangleUp' : 'triangleDown',
              color: T(base, 20), text, id,
            });
          }
        };
        mark(higherHigh, true, LIME, 'HH', 'shape0');
        mark(lowerHigh, true, RED, 'LH', 'shape1');
        mark(higherLow, false, LIME, 'HL', 'shape2');
        mark(lowerLow, false, RED, 'LL', 'shape3');
      }

      // Pivot dots, drawn pvtLenR bars back
      if (i - R >= 0) {
        const tb = bars[i - R].time as number;
        p[6][i - R] = { time: tb, value: pivotsOn ? pvthi : NaN };
        p[7][i - R] = { time: tb, value: pivotsOn ? pvtlo : NaN };
        p[8][i - R] = { time: tb, value: pivotsOn ? pvthi : NaN };
        p[9][i - R] = { time: tb, value: pivotsOn ? pvtlo : NaN };
      }

      // Bars since the last pivot, and the last pivot levels
      v.counthi = isHi ? 0 : (isNaN(v.counthi) ? 0 : v.counthi) + 1;
      v.countlo = isLo ? 0 : (isNaN(v.countlo) ? 0 : v.countlo) + 1;
      const prevHis = v.pvthis;
      const prevLos = v.pvtlos;
      const pvthis = isHi ? (i - R >= 0 ? bars[i - R].high : NaN) : (isNaN(prevHis) ? b.high : prevHis);
      const pvtlos = isLo ? (i - R >= 0 ? bars[i - R].low : NaN) : (isNaN(prevLos) ? b.low : prevLos);
      v.pvthis = pvthis;
      v.pvtlos = pvtlos;
      // hipc = (pvthis != pvthis[1]) ? na : green; lopc = (pvtlos != pvtlos[1]) ? na : maroon
      const hipc = ne(pvthis, prevHis) ? 'transparent' : GREEN;
      const lopc = ne(pvtlos, prevLos) ? 'transparent' : MAROON;
      const top = levelsOn && (cfg.maxLvlLen === 0 || v.counthi < cfg.maxLvlLen) ? pvthis : NaN;
      const bottom = levelsOn && (cfg.maxLvlLen === 0 || v.countlo < cfg.maxLvlLen) ? pvtlos : NaN;
      if (i - R >= 0) {
        const tb = bars[i - R].time as number;
        p[10][i - R] = { time: tb, value: top, color: hipc };
        p[11][i - R] = { time: tb, value: bottom, color: lopc };
      }
      p[12][i] = { time: t, value: top, color: hipc };
      p[13][i] = { time: t, value: bottom, color: lopc };
      p[14][i] = { time: t, value: channelOn ? pvthis : NaN };
      p[15][i] = { time: t, value: channelOn ? pvtlos : NaN };

      // Trend: both ribbon averages above (below) the medium, the fast anchored and the signal averages
      const prevUp = v.trUp;
      const prevDown = v.trDown;
      const trUp = gt(slowMA, mediumAnchorMA) && gt(slowMA, fastAnchorMA) && gt(slowMA, sig)
        && gt(fastMA, mediumAnchorMA) && gt(fastMA, fastAnchorMA) && gt(fastMA, sig);
      const trDown = lt(slowMA, mediumAnchorMA) && lt(slowMA, fastAnchorMA) && lt(slowMA, sig)
        && lt(fastMA, mediumAnchorMA) && lt(fastMA, fastAnchorMA) && lt(fastMA, sig);
      v.trUp = trUp;
      v.trDown = trDown;

      // Break of the last pivot level inside a trend
      const prevHigh = i > 0 ? bars[i - 1].high : NaN;
      const prevLow = i > 0 ? bars[i - 1].low : NaN;
      v.pullbackUpT = trUp && lt(prevHigh, pvthis) && gt(b.high, pvthis) && (!cfg.closeBr || gt(b.close, pvthis))
        ? (isNaN(v.pullbackUpT) ? 0 : v.pullbackUpT) + 1 : 0;
      v.pullbackDnT = trDown && gt(prevLow, pvtlos) && lt(b.low, pvtlos) && (!cfg.closeBr || lt(b.close, pvtlos))
        ? (isNaN(v.pullbackDnT) ? 0 : v.pullbackDnT) + 1 : 0;

      // plotarrow(series, colorup / colordown, transp = 0): the series value (sign = direction)
      if (cfg.showBreak && trUp && !prevUp) s.arrows.push({ time: t, id: 'arrow0', value: 1, color: AQUA });
      if (cfg.showBreak && trDown && !prevDown) s.arrows.push({ time: t, id: 'arrow1', value: -1, color: BLUE });
      if (cfg.showPB && v.pullbackUpT === 1) s.arrows.push({ time: t, id: 'arrow2', value: v.pullbackUpT, color: LIME });
      if (cfg.showPB && v.pullbackDnT === 1) s.arrows.push({ time: t, id: 'arrow3', value: -v.pullbackDnT, color: RED });
    },
    result(s, bars) {
      const back = Math.max(0, bars.length - R);
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, k) => { plots[`plot${k}`] = s.backPlots.includes(p) ? p.slice(0, back) : p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills: [
          // fill(p1, p2, color = fastMA > slowMA ? aqua : fuchsia, transp = 90, title = "Ribbon Fill")
          { plot1: 'plot0', plot2: 'plot1', colors: s.ribbonFill.slice(), options: { title: 'Ribbon Fill', color: T(AQUA, 90) } },
          // fill(p3, p4, color = gray, transp = 90, title = "Anchored MA Fill")
          { plot1: 'plot3', plot2: 'plot4', options: { title: 'Anchored MA Fill', color: T(GRAY, 90) } },
        ],
        markers: s.markers.slice().sort((p, q) => p.time - q.time),
        arrows: s.arrows.slice(),
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PullbackTradingToolAltInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PullbackTradingToolAltInputs> = {}, chart?: ChartContext): Result {
  return fullResult(createRun(inputs, chart).update(bars));
}

export const PullbackTradingToolAlt = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
