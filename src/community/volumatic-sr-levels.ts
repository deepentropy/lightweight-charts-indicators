/**
 * Volumatic Support/Resistance Levels [BigBeluga]
 *
 * Dynamic support/resistance based on volume concentration.
 * Uses highest/lowest with volume percentile filtering.
 * Fills with gradient coloring based on volume strength.
 *
 * Reference: "Volumatic Support/Resistance Levels [BigBeluga]" by BigBeluga
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumaticSRLevelsInputs {
  length: number;
  upperThreshold: number;
  lowerThreshold: number;
  barsThreshold: number;
}

export const defaultInputs: VolumaticSRLevelsInputs = {
  length: 25,
  upperThreshold: 80,
  lowerThreshold: 80,
  barsThreshold: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 25, min: 1 },
  { id: 'upperThreshold', type: 'int', title: 'Resistance Max Volume %', defval: 80, min: 50 },
  { id: 'lowerThreshold', type: 'int', title: 'Support Max Volume %', defval: 80, min: 50 },
  { id: 'barsThreshold', type: 'int', title: 'Bars Max Volume %', defval: 50, min: 50 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Resistance', color: '#CE2525', lineWidth: 1 },
  { id: 'plot1', title: 'Resistance Upper Fill', color: 'transparent', lineWidth: 0 },
  { id: 'plot2', title: 'Resistance Lower Fill', color: 'transparent', lineWidth: 0 },
  { id: 'plot3', title: 'Support', color: '#1CC272', lineWidth: 1 },
  { id: 'plot4', title: 'Support Upper Fill', color: 'transparent', lineWidth: 0 },
  { id: 'plot5', title: 'Support Lower Fill', color: 'transparent', lineWidth: 0 },
];

export const metadata = {
  title: 'Volumatic S/R Levels',
  shortTitle: 'VolSR',
  overlay: true,
};

/** Percentile via linear interpolation (matching Pine's percentile_linear_interpolation) */
function percentileLinear(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
}

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[]; barColors: BarColorData[] };

interface VolSrVars {
  /** Track S/R levels (var = persistent) */
  upper1: number;
  upper2: number;
  lower1: number;
  lower2: number;
}

interface VolSrRun extends BarRunState<VolSrVars> {
  highest: ReturnType<typeof taStep.highest>;
  lowest: ReturnType<typeof taStep.lowest>;
  atr: ReturnType<typeof taStep.atr>;
  hArr: number[];
  lArr: number[];
  volArr: number[];
  upper1Arr: number[];
  lower1Arr: number[];
  plots: Point[][];
  fillColorsUpper: string[];
  fillColorsLower: string[];
  markers: MarkerData[];
  barColors: BarColorData[];
}

const resCss = '#CE2525';
const supCss = '#1CC272';
const barCss = '#FF9137';

function study(inputs: Partial<VolumaticSRLevelsInputs>): BarStudy<VolSrRun, Result> {
  const { length, upperThreshold, lowerThreshold, barsThreshold } = { ...defaultInputs, ...inputs };
  return {
    // ATR(min(200, bar count)) for the fill width: the length follows the bar count below 200 bars
    key: (bars) => String(Math.min(200, bars.length)),
    init(bars) {
      const s: VolSrRun = {
        highest: taStep.highest(), lowest: taStep.lowest(), atr: taStep.atr(Math.min(200, bars.length)),
        hArr: [], lArr: [], volArr: [], upper1Arr: [], lower1Arr: [], plots: Array.from({ length: 6 }, () => []),
        fillColorsUpper: [], fillColorsLower: [], markers: [], barColors: [],
        steps: [], vars: { upper1: NaN, upper2: NaN, lower1: NaN, lower2: NaN }, lists: [], series: [],
      };
      s.steps = [s.highest, s.lowest, s.atr];
      s.lists = [s.markers, s.barColors];
      s.series = [s.hArr, s.lArr, s.volArr, s.upper1Arr, s.lower1Arr, ...s.plots, s.fillColorsUpper, s.fillColorsLower];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const t = b.time;
      const v = s.vars;
      const h = s.highest.step(b.high, length);
      const l = s.lowest.step(b.low, length);
      s.hArr[i] = h;
      s.lArr[i] = l;
      // ATR(200) for fill width
      const atr = s.atr.step(b.high, b.low, b.close) / 100;

      // Normalized volume: volume / percentile_linear_interpolation(volume, 500, 100) * 100
      s.volArr[i] = b.volume ?? 0;
      const window = s.volArr.slice(Math.max(0, i - 499), i + 1);
      const p100 = percentileLinear(window, 100);
      const nv = p100 > 0 ? (s.volArr[i] / p100) * 100 : 0;

      const prevH = i > 0 ? s.hArr[i - 1] : NaN;
      const prevHigh = i > 0 ? bars[i - 1].high : NaN;
      // Pine: if h[1] == high[1] and high < h => new resistance
      if (!isNaN(prevH) && !isNaN(prevHigh) && prevH === prevHigh && b.high < h) {
        v.upper1 = h;
        v.upper2 = h;
      }
      const prevL = i > 0 ? s.lArr[i - 1] : NaN;
      const prevLow = i > 0 ? bars[i - 1].low : NaN;
      // Pine: if l[1] == low[1] and low > l => new support
      if (!isNaN(prevL) && !isNaN(prevLow) && prevL === prevLow && b.low > l) {
        v.lower1 = l;
        v.lower2 = l;
      }
      s.upper1Arr[i] = v.upper1;
      s.lower1Arr[i] = v.lower1;

      // Resistance / support line colour: na when the level just changed
      const upperChanged = i > 0 && s.upper1Arr[i] !== s.upper1Arr[i - 1];
      const lowerChanged = i > 0 && s.lower1Arr[i] !== s.lower1Arr[i - 1];
      const p = s.plots;
      p[0][i] = { time: t, value: v.upper1, color: upperChanged ? 'transparent' : resCss };
      p[1][i] = { time: t, value: isNaN(v.upper2) ? NaN : v.upper2 + atr * nv };
      p[2][i] = { time: t, value: isNaN(v.upper2) ? NaN : v.upper2 - atr * nv };
      p[3][i] = { time: t, value: v.lower1, color: lowerChanged ? 'transparent' : supCss };
      p[4][i] = { time: t, value: isNaN(v.lower2) ? NaN : v.lower2 + atr * nv };
      p[5][i] = { time: t, value: isNaN(v.lower2) ? NaN : v.lower2 - atr * nv };

      // Fill colors: gradient based on volume, na when level just changed
      // Pine: color.from_gradient(n_vol, 0, 100, color.new(col, 80), col)
      const alpha = upperChanged ? 0 : Math.min(1, Math.max(0.2, nv / 100));
      s.fillColorsUpper[i] = upperChanged ? 'transparent' : `rgba(206,37,37,${alpha.toFixed(2)})`;
      const alphaL = lowerChanged ? 0 : Math.min(1, Math.max(0.2, nv / 100));
      s.fillColorsLower[i] = lowerChanged ? 'transparent' : `rgba(28,194,114,${alphaL.toFixed(2)})`;

      // plotshape(n_vol > threshold ? level -/+ atr * n_vol : na, shape.circle, location.absolute, size.tiny): four
      // outputs, Style ids shape0 / shape1 (support - / +) and shape2 / shape3 (resistance + / -)
      const dot = (price: number, col: string, id: string) => {
        if (!isNaN(price)) s.markers.push({ time: t, position: 'atPriceMiddle', price, shape: 'circle', color: col, size: 'tiny', id });
      };
      if (nv > lowerThreshold) {
        dot(v.lower2 - atr * nv, supCss, 'shape0');
        dot(v.lower2 + atr * nv, supCss, 'shape1');
      }
      if (nv > upperThreshold) {
        dot(v.upper2 + atr * nv, resCss, 'shape2');
        dot(v.upper2 - atr * nv, resCss, 'shape3');
      }
      // Bar color for high volume bars
      if (nv > barsThreshold) s.barColors.push({ time: t, color: barCss });
    },
    result(s) {
      const p = s.plots;
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          'plot0': p[0].slice(), 'plot1': p[1].slice(), 'plot2': p[2].slice(),
          'plot3': p[3].slice(), 'plot4': p[4].slice(), 'plot5': p[5].slice(),
        },
        fills: [
          { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(206,37,37,0.2)' }, colors: s.fillColorsUpper.slice() },
          { plot1: 'plot4', plot2: 'plot5', options: { color: 'rgba(28,194,114,0.2)' }, colors: s.fillColorsLower.slice() },
        ],
        markers: s.markers.slice(),
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumaticSRLevelsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VolumaticSRLevelsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}


export const VolumaticSRLevels = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
