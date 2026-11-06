/**
 * RSI + MACD (RSI Divergence) V3.2
 *
 * The RSI centred on 0 (RSI - 50), orange in the overbought / oversold zones, with regular and hidden divergence
 * labels between price and the RSI pivots (pivot lookback left / right, previous pivot 5..60 bars back). The MACD,
 * its signal and the histogram are scaled into the RSI pane: they are multiplied by the range (highest - lowest) of
 * the centred RSI over the scale lookback divided by the largest of the ranges of the histogram, the MACD and the
 * signal over the same lookback. MACD and signal are drawn as columns; the histogram is hidden by default.
 * Horizontal lines at overbought - 45, oversold - 55 and 0.
 *
 * Reference: "RSI + MACD (RSI Divergence) V3.2" by MKhoa
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: M.Khoa
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, PivotStep, type BarRunState, type BarStudy, type IndicatorRun, WindowExtreme, WindowSma } from '../live-run';

export interface RsiMacdV32Inputs {
  src: SourceType;
  len: number;
  /** Pivot lookback right */
  lbR: number;
  /** Pivot lookback left */
  lbL: number;
  rangeLower: number;
  rangeUpper: number;
  plotBull: boolean;
  plotHiddenBull: boolean;
  plotBear: boolean;
  plotHiddenBear: boolean;
  overbought: number;
  oversold: number;
  srcd: SourceType;
  fastLength: number;
  slowLength: number;
  signalLength: number;
  smaSource: boolean;
  smaSignal: boolean;
  scaleLb: number;
}

export const defaultInputs: RsiMacdV32Inputs = {
  src: 'close',
  len: 14,
  lbR: 5,
  lbL: 3,
  rangeLower: 5,
  rangeUpper: 60,
  plotBull: true,
  plotHiddenBull: false,
  plotBear: true,
  plotHiddenBear: false,
  overbought: 70,
  oversold: 30,
  srcd: 'close',
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  smaSource: false,
  smaSignal: false,
  scaleLb: 200,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'RSI Source', defval: 'close' },
  { id: 'len', type: 'int', title: 'RSI Period', defval: 14, min: 1 },
  { id: 'lbR', type: 'int', title: 'Pivot Lookback Right', defval: 5, min: 1 },
  { id: 'lbL', type: 'int', title: 'Pivot Lookback Left', defval: 3, min: 1 },
  { id: 'rangeLower', type: 'int', title: 'Min Lookback Range', defval: 5, min: 1 },
  { id: 'rangeUpper', type: 'int', title: 'Max Lookback Range', defval: 60, min: 10 },
  { id: 'plotBull', type: 'bool', title: 'Plot Regular Bullish', defval: true },
  { id: 'plotHiddenBull', type: 'bool', title: 'Plot Hidden Bullish', defval: false },
  { id: 'plotBear', type: 'bool', title: 'Plot Regular Bearish', defval: true },
  { id: 'plotHiddenBear', type: 'bool', title: 'Plot Hidden Bearish', defval: false },
  { id: 'overbought', type: 'int', title: 'Overbought Level', defval: 70 },
  { id: 'oversold', type: 'int', title: 'Oversold Level', defval: 30 },
  { id: 'srcd', type: 'source', title: 'MACD Source', defval: 'close' },
  { id: 'fastLength', type: 'int', title: 'Fast Length', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow Length', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Smoothing', defval: 9, min: 1 },
  { id: 'smaSource', type: 'bool', title: 'Simple MA (Oscillator)', defval: false },
  { id: 'smaSignal', type: 'bool', title: 'Simple MA (Signal Line)', defval: false },
  { id: 'scaleLb', type: 'int', title: 'Scale Lookback', defval: 200, min: 10 },
];

const BULL_COLOR = color.green;
const BEAR_COLOR = color.maroon;
const TEXT_COLOR = color.white;
const COL_GROW_ABOVE = '#26A69A';
const COL_GROW_BELOW = '#FFC1D5';
const COL_FALL_ABOVE = '#B2DFDB';
const COL_FALL_BELOW = '#EF5550';
const MACD_COLOR = String(color.new('#2962ff', 66));
const SIGNAL_COLOR = String(color.new('#e65100', 80));
const RSI_NORMAL_COLOR = String(color.new('#d1d4dc', 11));
const RSI_ZONE_COLOR = color.orange;

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI', color: RSI_NORMAL_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'Histogram', color: COL_GROW_ABOVE, lineWidth: 1, style: 'columns', display: 'none' },
  { id: 'plot2', title: 'MACD', color: MACD_COLOR, lineWidth: 1, style: 'columns' },
  { id: 'plot3', title: 'Signal', color: SIGNAL_COLOR, lineWidth: 1, style: 'columns' },
];

export const metadata = {
  title: 'RSI + MACD (RSI Divergence)',
  shortTitle: 'RSI + MACD',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };
type MaStep = { step(v: number): number; commit(): void };

interface RsiMacdVars {
  /** ta.barssince(plFound[1]) / ta.barssince(phFound[1]) */
  barsSinceLow: number;
  barsSinceHigh: number;
  /** ta.valuewhen(found, x[lbR], 1) */
  plPrevOsc: number;
  plPrevLow: number;
  phPrevOsc: number;
  phPrevHigh: number;
  prevPlFound: boolean;
  prevPhFound: boolean;
  prevHist: number;
}

interface RsiMacdRun extends BarRunState<RsiMacdVars> {
  rsi: ReturnType<typeof taStep.rsi>;
  pl: PivotStep;
  ph: PivotStep;
  fast: MaStep;
  slow: MaStep;
  signal: MaStep;
  hi: WindowExtreme[];
  lo: WindowExtreme[];
  osc: number[];
  markers: MarkerData[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
}

function study(inputs: Partial<RsiMacdV32Inputs>): BarStudy<RsiMacdRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { lbL, lbR, rangeLower, rangeUpper } = cfg;
  const src = barSource(cfg.src);
  const srcd = barSource(cfg.srcd);
  const ma = (sma: boolean, length: number): MaStep => {
    return sma ? new WindowSma(length) : taStep.ema(length);
  };
  // math.max with an na argument is na
  const pineMax = (a: number, b: number) => (isNaN(a) || isNaN(b) ? NaN : Math.max(a, b));
  const finite = (v: number) => (Number.isFinite(v) ? v : NaN);
  return {
    fullRunReason: () => (isBarSource(cfg.src) && isBarSource(cfg.srcd) ? null : 'source of another study'),
    init() {
      const s: RsiMacdRun = {
        rsi: taStep.rsi(cfg.len), pl: new PivotStep(lbL, lbR, false), ph: new PivotStep(lbL, lbR, true),
        fast: ma(cfg.smaSource, cfg.fastLength), slow: ma(cfg.smaSource, cfg.slowLength),
        signal: ma(cfg.smaSignal, cfg.signalLength),
        hi: [0, 1, 2, 3].map(() => new WindowExtreme(false, cfg.scaleLb)),
        lo: [0, 1, 2, 3].map(() => new WindowExtreme(true, cfg.scaleLb)),
        osc: [], markers: [], plot0: [], plot1: [], plot2: [], plot3: [],
        steps: [],
        vars: {
          barsSinceLow: NaN, barsSinceHigh: NaN, plPrevOsc: NaN, plPrevLow: NaN, phPrevOsc: NaN, phPrevHigh: NaN,
          prevPlFound: false, prevPhFound: false, prevHist: NaN,
        },
        lists: [], series: [],
      };
      s.steps = [s.rsi, s.pl, s.ph, s.fast, s.slow, s.signal, ...s.hi, ...s.lo];
      s.lists = [s.markers];
      s.series = [s.osc, s.plot0, s.plot1, s.plot2, s.plot3];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      // RSI centred on 0
      const rsiRaw = s.rsi.step(src(b));
      const osc = rsiRaw - 50;
      s.osc[i] = osc;

      // Divergences
      const plFound = !isNaN(s.pl.step(i, osc));
      const phFound = !isNaN(s.ph.step(i, osc));
      // ta.barssince(plFound[1]) / ta.barssince(phFound[1]): run on every bar (assigned before the conditions)
      if (i > 0 && v.prevPlFound) v.barsSinceLow = 0;
      else if (!isNaN(v.barsSinceLow)) v.barsSinceLow++;
      if (i > 0 && v.prevPhFound) v.barsSinceHigh = 0;
      else if (!isNaN(v.barsSinceHigh)) v.barsSinceHigh++;
      v.prevPlFound = plFound;
      v.prevPhFound = phFound;
      const { barsSinceLow, barsSinceHigh } = v;
      const inRangeLow = barsSinceLow >= rangeLower && barsSinceLow <= rangeUpper;
      const inRangeHigh = barsSinceHigh >= rangeLower && barsSinceHigh <= rangeUpper;
      const back = i - lbR >= 0 ? bars[i - lbR] : undefined;
      const o = back ? s.osc[i - lbR] : NaN;
      const low = back ? back.low : NaN;
      const high = back ? back.high : NaN;
      const t = back ? back.time : NaN;

      if (plFound) {
        const bullCond = cfg.plotBull && lt(low, v.plPrevLow) && gt(o, v.plPrevOsc) && inRangeLow;
        const hiddenBullCond = cfg.plotHiddenBull && gt(low, v.plPrevLow) && lt(o, v.plPrevOsc) && inRangeLow;
        // plotshape(cond ? osc[lbR] : na, offset = -lbR, style = shape.labelup, location = location.absolute)
        if (bullCond && !isNaN(o)) {
          s.markers.push({ id: 'shape0', time: t, position: 'atPriceBottom', price: o, shape: 'labelUp', color: BULL_COLOR, text: ' Bull ', textColor: TEXT_COLOR });
        }
        if (hiddenBullCond && !isNaN(o)) {
          s.markers.push({ id: 'shape1', time: t, position: 'atPriceBottom', price: o, shape: 'labelUp', color: BULL_COLOR, text: ' Hidden Bull ', textColor: TEXT_COLOR });
        }
        v.plPrevOsc = o;
        v.plPrevLow = low;
      }
      if (phFound) {
        const bearCond = cfg.plotBear && gt(high, v.phPrevHigh) && lt(o, v.phPrevOsc) && inRangeHigh;
        const hiddenBearCond = cfg.plotHiddenBear && lt(high, v.phPrevHigh) && gt(o, v.phPrevOsc) && inRangeHigh;
        if (bearCond && !isNaN(o)) {
          s.markers.push({ id: 'shape2', time: t, position: 'atPriceTop', price: o, shape: 'labelDown', color: BEAR_COLOR, text: ' Bear ', textColor: TEXT_COLOR });
        }
        if (hiddenBearCond && !isNaN(o)) {
          s.markers.push({ id: 'shape3', time: t, position: 'atPriceTop', price: o, shape: 'labelDown', color: BEAR_COLOR, text: ' Hidden Bear ', textColor: TEXT_COLOR });
        }
        v.phPrevOsc = o;
        v.phPrevHigh = high;
      }

      // MACD scaled into the RSI pane
      const sd = srcd(b);
      const macd = s.fast.step(sd) - s.slow.step(sd);
      const signal = s.signal.step(macd);
      const hist = macd - signal;
      const range = (k: number, x: number) => s.hi[k].step(x) - s.lo[k].step(x);
      const rsiRange = range(0, osc);
      const histRange = range(1, hist);
      const macdRange = range(2, macd);
      const signalRange = range(3, signal);
      const rr = eq(rsiRange, 0) ? 0.0001 : rsiRange;
      let overall = pineMax(histRange, pineMax(macdRange, signalRange));
      overall = eq(overall, 0) ? 0.0001 : overall;
      const scaleFactor = rr / overall;
      const scaledHist = hist * scaleFactor;

      const time = b.time;
      s.plot0[i] = {
        time,
        value: finite(osc),
        color: ge(rsiRaw, cfg.overbought) ? RSI_ZONE_COLOR : le(rsiRaw, cfg.oversold) ? RSI_ZONE_COLOR : RSI_NORMAL_COLOR,
      };
      const rising = i > 0 && lt(v.prevHist, scaledHist);
      v.prevHist = scaledHist;
      const c = ge(scaledHist, 0) ? (rising ? COL_GROW_ABOVE : COL_FALL_ABOVE) : rising ? COL_GROW_BELOW : COL_FALL_BELOW;
      s.plot1[i] = { time, value: finite(scaledHist), color: c };
      s.plot2[i] = { time, value: finite(macd * scaleFactor) };
      s.plot3[i] = { time, value: finite(signal * scaleFactor) };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
        hlines: [
          { value: cfg.overbought - 45, options: { title: 'Overbought', color: color.gray, linestyle: 'dashed' } },
          { value: cfg.oversold - 55, options: { title: 'Oversold', color: color.gray, linestyle: 'dashed' } },
          // hline(0, 'Middle Line', linestyle = hline.style_dotted): Pine default colour #787B86
          { value: 0, options: { title: 'Middle Line', color: '#787B86', linestyle: 'dotted' } },
        ],
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsiMacdV32Inputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RsiMacdV32Inputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const RsiMacdV32 = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
