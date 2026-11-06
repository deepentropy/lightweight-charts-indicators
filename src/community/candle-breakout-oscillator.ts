/**
 * Candle Breakout Oscillator
 *
 * Each bar is a bullish breakout (close above the previous high), a bearish breakout (close below the previous low)
 * or sideways. For each kind, +1 (the bar is of that kind) or -1 (it is not) is kept for the last `window` bars,
 * optionally weighted by volume or by the breakout distance (the weighted sum is then divided by the sum of the
 * weights). Each sum is normalised to 0..100 against its lowest and highest value over `window` bars and smoothed
 * (method and length selectable). Three lines (bullish, bearish, sideways), circles where the bullish line crosses
 * above the bearish line and the reverse, and fills beyond the top and bottom thresholds.
 *
 * Reference: "Candle Breakout Oscillator [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type CandleBreakoutSmoothing = 'None' | 'RMA' | 'SMA' | 'TMA' | 'EMA' | 'DEMA' | 'TEMA' | 'HMA' | 'WMA' | 'SWMA' | 'VWMA';
export type CandleBreakoutWeighting = 'None' | 'Volume' | 'Price';

export interface CandleBreakoutOscillatorInputs {
  /** Window (bars kept and normalisation length) */
  windowInput: number;
  /** Smoothing method */
  smoothingInput: CandleBreakoutSmoothing;
  /** Smoothing length */
  smoothingLengthInput: number;
  /** Weighting method */
  weightTypeInput: CandleBreakoutWeighting;
  /** Top threshold (50..100) */
  topThresholdInput: number;
  /** Bottom threshold (0..50) */
  bottomThresholdInput: number;
}

export const defaultInputs: CandleBreakoutOscillatorInputs = {
  windowInput: 100,
  smoothingInput: 'RMA',
  smoothingLengthInput: 2,
  weightTypeInput: 'None',
  topThresholdInput: 80,
  bottomThresholdInput: 20,
};

const SMOOTHING: CandleBreakoutSmoothing[] = ['None', 'RMA', 'SMA', 'TMA', 'EMA', 'DEMA', 'TEMA', 'HMA', 'WMA', 'SWMA', 'VWMA'];

export const inputConfig: InputConfig[] = [
  { id: 'windowInput', type: 'int', title: 'Window', defval: 100 },
  { id: 'smoothingInput', type: 'string', title: 'Smoothing Method', defval: 'RMA', options: SMOOTHING },
  { id: 'smoothingLengthInput', type: 'int', title: 'Smoothing Length', defval: 2, min: 1, max: 100, step: 1 },
  { id: 'weightTypeInput', type: 'string', title: 'Weighting Method', defval: 'None', options: ['None', 'Volume', 'Price'] },
  { id: 'topThresholdInput', type: 'int', title: 'Top', defval: 80, min: 50, max: 100 },
  { id: 'bottomThresholdInput', type: 'int', title: 'Bottom', defval: 20, min: 0, max: 50 },
];

const GREEN = '#089981';
const RED = '#F23645';
const bullColor = String(color.new(GREEN, 50));
const bearColor = String(color.new(RED, 50));
const sidewaysColor = String(color.new(color.silver, 50));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bullish', color: bullColor, lineWidth: 1 },
  { id: 'plot1', title: 'Bearish', color: bearColor, lineWidth: 1 },
  { id: 'plot2', title: 'Sideways', color: sidewaysColor, lineWidth: 1 },
  { id: 'plot3', title: 'Top', color: 'transparent', lineWidth: 1 },
  { id: 'plot4', title: 'Bottom', color: 'transparent', lineWidth: 1 },
];

export const metadata = {
  title: 'Candle Breakout Oscillator',
  shortTitle: 'Candle Breakout Oscillator',
  overlay: false,
};

/** Pine float comparison: a > b only when a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;
/**
 * x / 0 gives NaN. In Pine a non-zero x / 0 is +/-infinity, but here x is always 0 when the denominator is 0 (the sums
 * of the same weights; a value between its own lowest and highest), and Pine 0 / 0 is NaN too.
 */
const div = (a: number, b: number) => (b === 0 ? NaN : a / b);
/** Pine array.sum of the array kept: the values of bars from..to (oldest first); the na elements are skipped */
const sum = (a: number[], from: number, to: number) => {
  let s = 0;
  for (let j = from; j <= to; j++) {
    const v = a[j];
    if (!isNaN(v)) s = s + v;
  }
  return s;
};

type Point = { time: number; value: number; color: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

/** smooth(data) of the script, one bar at a time (SWMA reads the earlier values of `data`) */
interface Smoother {
  step(value: number, volume: number, data: number[], i: number): number;
  commit(): void;
}

function smoother(method: CandleBreakoutSmoothing, len: number): Smoother {
  const none = { commit() {} };
  switch (method) {
    case 'RMA': { const m = taStep.rma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'SMA': { const m = taStep.sma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
    case 'TMA': {
      const m1 = taStep.sma();
      const m2 = taStep.sma();
      return { step: (v) => m2.step(m1.step(v, len), len), commit: () => { m1.commit(); m2.commit(); } };
    }
    case 'EMA': { const m = taStep.ema(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'DEMA': {
      const e1 = taStep.ema(len);
      const e2 = taStep.ema(len);
      return {
        step: (v) => { const a1 = e1.step(v); return 2 * a1 - e2.step(a1); },
        commit: () => { e1.commit(); e2.commit(); },
      };
    }
    case 'TEMA': {
      const e1 = taStep.ema(len);
      const e2 = taStep.ema(len);
      const e3 = taStep.ema(len);
      return {
        step: (v) => { const a1 = e1.step(v); const a2 = e2.step(a1); const a3 = e3.step(a2); return 3 * a1 - 3 * a2 + a3; },
        commit: () => { e1.commit(); e2.commit(); e3.commit(); },
      };
    }
    case 'HMA': { const m = taStep.hma(len); return { step: (v) => m.step(v), commit: () => m.commit() }; }
    case 'WMA': { const m = taStep.wma(); return { step: (v) => m.step(v, len), commit: () => m.commit() }; }
    // ta.swma: (x + 2 * x[1] + 2 * x[2] + x[3]) / 6, na on the first 3 bars
    case 'SWMA': return { ...none, step: (_v, _vol, d, i) => (i < 3 ? NaN : (d[i] + 2 * d[i - 1] + 2 * d[i - 2] + d[i - 3]) / 6) };
    case 'VWMA': { const m = taStep.vwma(len); return { step: (v, vol) => m.step(v, vol), commit: () => m.commit() }; }
    default: return { ...none, step: (v) => v };
  }
}

interface CboRun extends BarRunState<Record<string, never>> {
  lowest: Array<ReturnType<typeof taStep.lowest>>;
  highest: Array<ReturnType<typeof taStep.highest>>;
  smooth: Smoother[];
  /** The values pushed to the arrays of the script on each bar (bulls, bears, sideways, volumes, bull / bear weights) */
  pushed: number[][];
  /** The normalised values (before smoothing) and the smoothed lines */
  norm: number[][];
  lines: number[][];
  plots: Point[][];
  fillColors: string[][];
  markers: MarkerData[];
}

function study(inputs: Partial<CandleBreakoutOscillatorInputs>): BarStudy<CboRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { windowInput: window, weightTypeInput: weightType, topThresholdInput: top, bottomThresholdInput: bottom } = cfg;
  const transparent = 'transparent';
  const bullCross = String(color.new(bullColor, 0));
  const bearCross = String(color.new(bearColor, 0));
  const lineColors = [bullColor, bearColor, sidewaysColor];
  return {
    init() {
      const lowest = [taStep.lowest(), taStep.lowest(), taStep.lowest()];
      const highest = [taStep.highest(), taStep.highest(), taStep.highest()];
      const smooth = [0, 1, 2].map(() => smoother(cfg.smoothingInput, cfg.smoothingLengthInput));
      const s: CboRun = {
        lowest, highest, smooth, pushed: [[], [], [], [], [], []], norm: [[], [], []], lines: [[], [], []],
        plots: [[], [], [], [], []], fillColors: [[], [], [], [], []], markers: [],
        steps: [...lowest, ...highest, ...smooth], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [...s.pushed, ...s.norm, ...s.lines, ...s.plots, ...s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const close = b.close;
      const volume = b.volume ?? NaN;
      const prevHigh = i > 0 ? bars[i - 1].high : NaN;
      const prevLow = i > 0 ? bars[i - 1].low : NaN;
      const bull = gt(close, prevHigh);
      const bear = gt(prevLow, close);
      const sideway = !bull && !bear;
      const bullWeight = Math.abs(close - prevHigh);
      const bearWeight = Math.abs(close - prevLow);
      const sidewayWeight = 1;
      // parseWeight(weight) => weightTypeInput != NONE ? (weightTypeInput == VOLUME ? volume : weight) : 1
      const parseWeight = (weight: number) => (weightType !== 'None' ? (weightType === 'Volume' ? volume : weight) : 1);
      // array.push, then array.shift when the size is above `window`: the arrays hold the values of the last bars
      const [bulls, bears, sideways, volumes, bullWeights, bearWeights] = s.pushed;
      bulls[i] = (bull ? 1 : -1) * parseWeight(bullWeight);
      bears[i] = (bear ? 1 : -1) * parseWeight(bearWeight);
      sideways[i] = (sideway ? 1 : -1) * parseWeight(sidewayWeight);
      volumes[i] = volume;
      bullWeights[i] = bullWeight;
      bearWeights[i] = bearWeight;
      const from = Math.max(0, i - window + 1);
      // value = weightTypeInput != NONE ? a_rray.sum() / (VOLUME ? volumes.sum() : weights.sum()) : a_rray.sum()
      // (the sideway weights are all 1)
      const value = (arr: number[], weights: number[] | null) =>
        weightType !== 'None'
          ? div(sum(arr, from, i), weightType === 'Volume' ? sum(volumes, from, i) : weights ? sum(weights, from, i) : sumOnes(from, i))
          : sum(arr, from, i);
      const values = [value(bulls, bullWeights), value(bears, bearWeights), value(sideways, null)];

      for (let k = 0; k < 3; k++) {
        // normalize: 100 * (value - ta.lowest(value, window)) / (ta.highest(value, window) - ta.lowest(value, window))
        const x = values[k];
        const lo = s.lowest[k].step(x, window);
        const hi = s.highest[k].step(x, window);
        s.norm[k][i] = div(100 * (x - lo), hi - lo);
        s.lines[k][i] = s.smooth[k].step(s.norm[k][i], volume, s.norm[k], i);
        s.plots[k][i] = { time: t, value: s.lines[k][i], color: lineColors[k] };
      }
      s.plots[3][i] = { time: t, value: top, color: transparent };
      s.plots[4][i] = { time: t, value: bottom, color: transparent };

      const bu = s.lines[0][i];
      const be = s.lines[1][i];
      const pbu = i > 0 ? s.lines[0][i - 1] : NaN;
      const pbe = i > 0 ? s.lines[1][i - 1] : NaN;
      // bullishCross = bulls > bears and bulls[1] <= bears[1]; bearishCross = bears > bulls and bears[1] <= bulls[1]
      const bullishCross = gt(bu, be) && !isNaN(pbu) && !isNaN(pbe) && !gt(pbu, pbe);
      const bearishCross = gt(be, bu) && !isNaN(pbu) && !isNaN(pbe) && !gt(pbe, pbu);
      // plotshape(bullsNormalized, 'Bullish Cross', circle, absolute, bullishCross ? color.new(bullColor, 0) : na, tiny)
      if (bullishCross && !isNaN(bu)) {
        s.markers.push({ id: 'shape0', time: t, position: 'atPriceMiddle', price: bu, shape: 'circle', color: bullCross, size: 'tiny' });
      }
      if (bearishCross && !isNaN(be)) {
        // plotshape(bearsNormalized, 'Bearish Cross', circle, absolute, bearishCross ? color.new(bearColor, 0) : na, tiny)
        s.markers.push({ id: 'shape1', time: t, position: 'atPriceMiddle', price: be, shape: 'circle', color: bearCross, size: 'tiny' });
      }
      s.fillColors[0][i] = gt(bu, top) ? bullColor : transparent;
      s.fillColors[1][i] = gt(bottom, bu) ? bullColor : transparent;
      s.fillColors[2][i] = gt(be, top) ? bearColor : transparent;
      s.fillColors[3][i] = gt(bottom, be) ? bearColor : transparent;
      s.fillColors[4][i] = gt(bottom, s.lines[2][i]) ? sidewaysColor : transparent;
    },
    result(s) {
      const fillColors = s.fillColors;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.plots[0].slice(),
          plot1: s.plots[1].slice(),
          plot2: s.plots[2].slice(),
          plot3: s.plots[3].slice(),
          plot4: s.plots[4].slice(),
        },
        hlines: [
          { value: top, options: { title: 'Top Threshold', color: color.gray, linestyle: 'dashed', linewidth: 1 } },
          { value: bottom, options: { title: 'Bottom Threshold', color: color.gray, linestyle: 'dashed', linewidth: 1 } },
        ],
        fills: [
          { plot1: 'plot0', plot2: 'plot3', options: { title: 'Bullish Top Fill' }, colors: fillColors[0].slice() },
          { plot1: 'plot0', plot2: 'plot4', options: { title: 'Bullish Bottom Fill' }, colors: fillColors[1].slice() },
          { plot1: 'plot1', plot2: 'plot3', options: { title: 'Bearish Top Fill' }, colors: fillColors[2].slice() },
          { plot1: 'plot1', plot2: 'plot4', options: { title: 'Bearish Bottom Fill' }, colors: fillColors[3].slice() },
          { plot1: 'plot2', plot2: 'plot4', options: { title: 'Sideways Bottom Fill' }, colors: fillColors[4].slice() },
        ],
        markers: s.markers.slice(),
      };
    },
  };
}

/** array.sum of an array of ones (bars from..to) */
function sumOnes(from: number, to: number): number {
  let s = 0;
  for (let j = from; j <= to; j++) s = s + 1;
  return s;
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<CandleBreakoutOscillatorInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<CandleBreakoutOscillatorInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const CandleBreakoutOscillator = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
