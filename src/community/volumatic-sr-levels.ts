/**
 * Volumatic Support/Resistance Levels [BigBeluga]
 *
 * Dynamic support/resistance based on volume concentration.
 * Uses highest/lowest with volume percentile filtering.
 * Fills with gradient coloring based on volume strength.
 *
 * Reference: TradingView "Volumatic Support/Resistance Levels [BigBeluga]" by BigBeluga
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

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

export function calculate(bars: Bar[], inputs: Partial<VolumaticSRLevelsInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const { length, upperThreshold, lowerThreshold, barsThreshold } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const hArr = ta.highest(highSeries, length).toArray();
  const lArr = ta.lowest(lowSeries, length).toArray();

  // ATR(200) for fill width
  const atrLen = Math.min(200, n);
  const atrArr = ta.atr(bars, atrLen).toArray();

  // Normalized volume: volume / percentile_linear_interpolation(volume, 500, 100) * 100
  const volArr = bars.map((b) => b.volume ?? 0);
  const nVol: number[] = new Array(n).fill(0);
  for (let i = 0; i < n; i++) {
    const windowStart = Math.max(0, i - 499);
    const window = volArr.slice(windowStart, i + 1);
    const p100 = percentileLinear(window, 100);
    nVol[i] = p100 > 0 ? (volArr[i] / p100) * 100 : 0;
  }

  // Track S/R levels (var = persistent)
  let upper1 = NaN;
  let upper2 = NaN;
  let lower1 = NaN;
  let lower2 = NaN;

  const upper1Arr: number[] = new Array(n).fill(NaN);
  const upper2Arr: number[] = new Array(n).fill(NaN);
  const lower1Arr: number[] = new Array(n).fill(NaN);
  const lower2Arr: number[] = new Array(n).fill(NaN);

  for (let i = 0; i < n; i++) {
    const h = hArr[i] ?? NaN;
    const l = lArr[i] ?? NaN;
    const prevH = i > 0 ? (hArr[i - 1] ?? NaN) : NaN;
    const prevHigh = i > 0 ? bars[i - 1].high : NaN;

    // Pine: if h[1] == high[1] and high < h => new resistance
    if (!isNaN(prevH) && !isNaN(prevHigh) && prevH === prevHigh && bars[i].high < h) {
      upper1 = h;
      upper2 = h;
    }

    const prevL = i > 0 ? (lArr[i - 1] ?? NaN) : NaN;
    const prevLow = i > 0 ? bars[i - 1].low : NaN;

    // Pine: if l[1] == low[1] and low > l => new support
    if (!isNaN(prevL) && !isNaN(prevLow) && prevL === prevLow && bars[i].low > l) {
      lower1 = l;
      lower2 = l;
    }

    upper1Arr[i] = upper1;
    upper2Arr[i] = upper2;
    lower1Arr[i] = lower1;
    lower2Arr[i] = lower2;
  }

  // Build plots
  const plot0: { time: number; value: number; color?: string }[] = [];
  const plot1: { time: number; value: number }[] = [];
  const plot2: { time: number; value: number }[] = [];
  const plot3: { time: number; value: number; color?: string }[] = [];
  const plot4: { time: number; value: number }[] = [];
  const plot5: { time: number; value: number }[] = [];
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const fillColorsUpper: string[] = [];
  const fillColorsLower: string[] = [];

  const resCss = '#CE2525';
  const supCss = '#1CC272';
  const barCss = '#FF9137';

  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    const atr = (atrArr[i] ?? 0) / 100;
    const nv = nVol[i];

    // Resistance line color: na when level just changed, else res_col
    const upperChanged = i > 0 && upper1Arr[i] !== upper1Arr[i - 1];
    const upperColor = upperChanged ? 'transparent' : resCss;

    // Support line color: na when level just changed, else sup_col
    const lowerChanged = i > 0 && lower1Arr[i] !== lower1Arr[i - 1];
    const lowerColor = lowerChanged ? 'transparent' : supCss;

    plot0.push({ time: t, value: upper1Arr[i], color: upperColor });
    plot1.push({ time: t, value: isNaN(upper2Arr[i]) ? NaN : upper2Arr[i] + atr * nv });
    plot2.push({ time: t, value: isNaN(upper2Arr[i]) ? NaN : upper2Arr[i] - atr * nv });
    plot3.push({ time: t, value: lower1Arr[i], color: lowerColor });
    plot4.push({ time: t, value: isNaN(lower2Arr[i]) ? NaN : lower2Arr[i] + atr * nv });
    plot5.push({ time: t, value: isNaN(lower2Arr[i]) ? NaN : lower2Arr[i] - atr * nv });

    // Fill colors: gradient based on volume, na when level just changed
    // Pine: color.from_gradient(n_vol, 0, 100, color.new(col, 80), col)
    const alpha = upperChanged ? 0 : Math.min(1, Math.max(0.2, nv / 100));
    fillColorsUpper.push(upperChanged ? 'transparent' : `rgba(206,37,37,${alpha.toFixed(2)})`);
    const alphaL = lowerChanged ? 0 : Math.min(1, Math.max(0.2, nv / 100));
    fillColorsLower.push(lowerChanged ? 'transparent' : `rgba(28,194,114,${alphaL.toFixed(2)})`);

    // Markers for max volume threshold signals
    if (nv > lowerThreshold && !isNaN(lower2Arr[i])) {
      markers.push({ time: t, position: 'belowBar', shape: 'circle', color: supCss });
    }
    if (nv > upperThreshold && !isNaN(upper2Arr[i])) {
      markers.push({ time: t, position: 'aboveBar', shape: 'circle', color: resCss });
    }

    // Bar color for high volume bars
    if (nv > barsThreshold) {
      barColors.push({ time: t, color: barCss });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': plot0, 'plot1': plot1, 'plot2': plot2,
      'plot3': plot3, 'plot4': plot4, 'plot5': plot5,
    },
    fills: [
      { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(206,37,37,0.2)' }, colors: fillColorsUpper },
      { plot1: 'plot4', plot2: 'plot5', options: { color: 'rgba(28,194,114,0.2)' }, colors: fillColorsLower },
    ],
    markers,
    barColors,
  };
}

export const VolumaticSRLevels = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
