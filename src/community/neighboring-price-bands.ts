/**
 * Neighboring Price Bands
 *
 * The closes of the last `bufferSize` bars are kept in a sorted list. On each bar, before the current close is
 * added, the close is located in the sorted list (binary search, leftmost). The bearish value is a percentile
 * (100 - percentile, linear interpolation) of the K sorted closes below that position; the bullish value is the
 * percentile of the K + 1 sorted closes from that position up. Both are smoothed with an SMA and kept na where the
 * raw value is na (close outside the stored range: a "new discovery", shown with a background colour). The band
 * average is the mean of the two bands; gradient fills go from each band to the average.
 *
 * Reference: "Neighboring Price Bands [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: This work is licensed under a Attribution-NonCommercial-ShareAlike 4.0 International
 * (CC BY-NC-SA 4.0) https://creativecommons.org/licenses/by-nc-sa/4.0/ © LuxAlgo
 */

import { taStep, array, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BgColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface NeighboringPriceBandsInputs {
  /** Number of historical bars kept in the price distribution */
  bufferSize: number;
  /** Number of neighbors checked on each side of the current price position in the sorted distribution */
  k: number;
  /** Percentile rank used for the bands (50 is the median) */
  percentile: number;
  /** SMA smoothing of the bands */
  smooth: number;
}

export const defaultInputs: NeighboringPriceBandsInputs = {
  bufferSize: 200,
  k: 50,
  percentile: 90,
  smooth: 5,
};

export const inputConfig: InputConfig[] = [
  { id: 'bufferSize', type: 'int', title: 'Historical Buffer (Bars)', defval: 200, min: 100, max: 20000,
    tooltip: 'Number of historical bars to keep in the price distribution.' },
  { id: 'k', type: 'int', title: 'Neighboring Range (K)', defval: 50, min: 5,
    tooltip: 'Number of neighbors to check on each side of the current price position in the sorted distribution.' },
  { id: 'percentile', type: 'float', title: 'Percentile', defval: 90, min: 1, max: 99,
    tooltip: 'Percentile rank used for the bands. 50 is the median. Higher values make the lower band lower and the upper band higher.' },
  { id: 'smooth', type: 'int', title: 'Smoothing', defval: 5, min: 1, tooltip: 'SMA smoothing applied to the band averages.' },
];

const BULL_COLOR = '#089981';
const BEAR_COLOR = '#f23645';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Price', color: color.blue, lineWidth: 1, display: 'none' },
  { id: 'plot1', title: 'Bullish Band', color: BULL_COLOR, lineWidth: 1, style: 'linebr' },
  { id: 'plot2', title: 'Bearish Band', color: BEAR_COLOR, lineWidth: 1, style: 'linebr' },
  { id: 'plot3', title: 'Band Average', color: color.gray, lineWidth: 1, style: 'linebr', display: 'none' },
];

export const metadata = {
  title: 'Neighboring Price Bands [LuxAlgo]',
  shortTitle: 'LuxAlgo - Neighboring Price Bands',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10; a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

/** getPercentile(arr, p): linear interpolation between the two nearest ranks of a sorted array (na when empty) */
function getPercentile(arr: number[], p: number): number {
  const size = array.size(arr);
  if (size === 0) return NaN;
  const idx = ((size - 1) * p) / 100;
  const i1 = Math.floor(idx);
  const i2 = Math.ceil(idx);
  if (i1 === i2) return array.get(arr, i1);
  const v1 = array.get(arr, i1);
  const v2 = array.get(arr, i2);
  return v1 + (v2 - v1) * (idx - i1);
}

type Point = { time: number; value: number };
type Result = IndicatorResult & { bgColors: BgColorData[] };

interface NpbVars {
  /** var priceArray (the last bufferSize closes) and var sortedArray (their sorted non-na values), changed in place */
  priceArray: number[];
  sortedArray: number[];
}

interface NpbRun extends BarRunState<NpbVars> {
  smaBull: ReturnType<typeof taStep.sma>;
  smaBear: ReturnType<typeof taStep.sma>;
  finalBull: number[];
  finalBear: number[];
  finalAvg: number[];
  plots: Point[][];
  bgColors: BgColorData[];
}

function study(inputs: Partial<NeighboringPriceBandsInputs>): BarStudy<NpbRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { bufferSize, k, percentile, smooth } = cfg;
  // bgcolor(na(bullVal) ? color.new(BULL_COLOR, 85) : na); bgcolor(na(bearVal) ? color.new(BEAR_COLOR, 85) : na)
  const bullBg = String(color.new(BULL_COLOR, 85));
  const bearBg = String(color.new(BEAR_COLOR, 85));
  const bullTop = String(color.new(BULL_COLOR, 80));
  const bullBottom = String(color.new(BULL_COLOR, 100));
  const bearTop = String(color.new(BEAR_COLOR, 80));
  const bearBottom = String(color.new(BEAR_COLOR, 100));

  // removeValue(val): remove one occurrence of val from the sorted distribution
  const removeValue = (sortedArray: number[], val: number) => {
    if (!isNaN(val) && array.size(sortedArray) > 0) {
      const idx = array.binary_search_leftmost(sortedArray, val);
      if (idx < array.size(sortedArray) && eq(array.get(sortedArray, idx), val)) array.remove(sortedArray, idx);
    }
  };
  // addValue(val): insert val keeping the order
  const addValue = (sortedArray: number[], val: number) => {
    if (!isNaN(val)) {
      let idx = 0;
      if (array.size(sortedArray) > 0) {
        idx = array.binary_search_leftmost(sortedArray, val);
        if (gt(val, array.get(sortedArray, idx))) idx += 1;
      }
      array.insert(sortedArray, idx, val);
    }
  };

  return {
    init() {
      const s: NpbRun = {
        smaBull: taStep.sma(), smaBear: taStep.sma(), finalBull: [], finalBear: [], finalAvg: [],
        plots: [[], [], [], []], bgColors: [],
        steps: [], vars: { priceArray: [], sortedArray: [] }, lists: [], series: [],
      };
      s.steps = [s.smaBull, s.smaBear];
      s.lists = [s.bgColors];
      s.series = [s.finalBull, s.finalBear, s.finalAvg, ...s.plots];
      return s;
    },
    copyVars: (v) => ({ priceArray: v.priceArray.slice(), sortedArray: v.sortedArray.slice() }),
    bar(s, i, bars) {
      const { priceArray, sortedArray } = s.vars;
      const time = bars[i].time;
      const close = bars[i].close;
      let bullVal = NaN;
      let bearVal = NaN;
      // Values of the current bar from the distribution of the previous bars (before the buffer update)
      if (array.size(sortedArray) > 0) {
        const idx = array.binary_search_leftmost(sortedArray, close);
        const size = array.size(sortedArray);
        // Bearish component: idx - K to idx (higher percentile = further below the price)
        const bearStart = Math.max(0, idx - k);
        if (idx > bearStart) bearVal = getPercentile(array.slice(sortedArray, bearStart, idx), 100 - percentile);
        // Bullish component: idx to idx + K
        const bullEnd = Math.min(size - 1, idx + k);
        if (bullEnd > idx) bullVal = getPercentile(array.slice(sortedArray, idx, bullEnd + 1), percentile);
      }
      // Update the buffer for the next bar
      if (array.size(priceArray) >= bufferSize) removeValue(sortedArray, array.shift(priceArray));
      array.push(priceArray, close);
      addValue(sortedArray, close);

      const smoothedBull = s.smaBull.step(bullVal, smooth);
      const smoothedBear = s.smaBear.step(bearVal, smooth);
      const finalBull = !isNaN(bullVal) ? smoothedBull : NaN;
      const finalBear = !isNaN(bearVal) ? smoothedBear : NaN;
      // math.avg(finalBull, finalBear): na when one of them is na
      const finalAvg = (finalBull + finalBear) / 2;
      s.finalBull[i] = finalBull;
      s.finalBear[i] = finalBear;
      s.finalAvg[i] = finalAvg;
      const p = s.plots;
      p[0][i] = { time, value: close };
      p[1][i] = { time, value: finalBull };
      p[2][i] = { time, value: finalBear };
      p[3][i] = { time, value: finalAvg };
      if (isNaN(bullVal)) s.bgColors.push({ time, color: bullBg });
      if (isNaN(bearVal)) s.bgColors.push({ time, color: bearBg });
    },
    result(s, bars) {
      const n = bars.length;
      const p = s.plots;
      // fill(plotBull, plotAvg, finalBull, finalAvg, color.new(BULL_COLOR, 80), color.new(BULL_COLOR, 100)) and the
      // same for the bearish band
      const fills = [
        { plot1: 'plot1', plot2: 'plot3', gradient: { topValue: s.finalBull.slice(), bottomValue: s.finalAvg.slice(),
          topColor: new Array<string | null>(n).fill(bullTop), bottomColor: new Array<string | null>(n).fill(bullBottom) } },
        { plot1: 'plot2', plot2: 'plot3', gradient: { topValue: s.finalBear.slice(), bottomValue: s.finalAvg.slice(),
          topColor: new Array<string | null>(n).fill(bearTop), bottomColor: new Array<string | null>(n).fill(bearBottom) } },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: p[0].slice(), plot1: p[1].slice(), plot2: p[2].slice(), plot3: p[3].slice() },
        fills,
        bgColors: s.bgColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<NeighboringPriceBandsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<NeighboringPriceBandsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const NeighboringPriceBands = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
