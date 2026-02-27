/**
 * SuperTrend AI (Clustering) [LuxAlgo]
 *
 * Tests multiple SuperTrend factors, scores each by recent trend-tracking
 * performance (fewer whipsaws = better), clusters scores via k-means into
 * poor/average/excellent groups, then uses the weighted average of excellent
 * factors as the final optimized factor.
 *
 * Reference: TradingView "SuperTrend AI (Clustering) [LuxAlgo]" (TV#683)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData, LabelData } from '../types';
import type { TableData, TableCell } from '../types';

export interface SupertrendAiClusteringInputs {
  atrLen: number;
  minFactor: number;
  maxFactor: number;
  factorStep: number;
  perfAlpha: number;
  fromCluster: 'Best' | 'Average' | 'Worst';
  maxIter: number;
  maxData: number;
}

export const defaultInputs: SupertrendAiClusteringInputs = {
  atrLen: 10,
  minFactor: 1,
  maxFactor: 5,
  factorStep: 0.5,
  perfAlpha: 10,
  fromCluster: 'Best',
  maxIter: 1000,
  maxData: 10000,
};

export const inputConfig: InputConfig[] = [
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 10, min: 1 },
  { id: 'minFactor', type: 'int', title: 'Min Factor', defval: 1, min: 0 },
  { id: 'maxFactor', type: 'int', title: 'Max Factor', defval: 5, min: 0 },
  { id: 'factorStep', type: 'float', title: 'Step', defval: 0.5, min: 0, step: 0.1 },
  { id: 'perfAlpha', type: 'float', title: 'Performance Memory', defval: 10, min: 2 },
  { id: 'fromCluster', type: 'string', title: 'From Cluster', defval: 'Best', options: ['Best', 'Average', 'Worst'] },
  { id: 'maxIter', type: 'int', title: 'Maximum Iteration Steps', defval: 1000, min: 0 },
  { id: 'maxData', type: 'int', title: 'Historical Bars Calculation', defval: 10000, min: 0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Trailing Stop', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Trailing Stop AMA', color: '#26A69A80', lineWidth: 1 },
];

export const metadata = {
  title: 'SuperTrend AI Clustering',
  shortTitle: 'STAI',
  overlay: true,
};

/** Hex color to {r,g,b} */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const v = parseInt(hex.replace('#', ''), 16);
  return { r: (v >> 16) & 255, g: (v >> 8) & 255, b: v & 255 };
}

/** Pine color.from_gradient: interpolate between two colors with alpha */
function colorFromGradient(value: number, lo: number, hi: number, colorLoHex: string, alphaLo: number, colorHiHex: string, alphaHi: number): string {
  const t = hi === lo ? 1 : Math.max(0, Math.min(1, (value - lo) / (hi - lo)));
  const c0 = hexToRgb(colorLoHex);
  const c1 = hexToRgb(colorHiHex);
  const r = Math.round(c0.r + t * (c1.r - c0.r));
  const g = Math.round(c0.g + t * (c1.g - c0.g));
  const b = Math.round(c0.b + t * (c1.b - c0.b));
  const a = alphaLo + t * (alphaHi - alphaLo);
  // alpha 0..100 Pine => 0=opaque, 100=transparent. Convert to CSS alpha 0..1.
  const cssAlpha = Math.max(0, Math.min(1, 1 - a / 100));
  return `rgba(${r},${g},${b},${cssAlpha.toFixed(2)})`;
}

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

export function calculate(bars: Bar[], inputs: Partial<SupertrendAiClusteringInputs> = {}): IndicatorResult & { markers: MarkerData[]; tables: TableData; barColors: BarColorData[]; labels: LabelData[] } {
  const { atrLen, minFactor, maxFactor, factorStep, perfAlpha, fromCluster, maxIter, maxData } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const bullCss = '#26A69A';
  const bearCss = '#EF5350';
  const amaBullCss = bullCss;
  const amaBearCss = bearCss;

  // From cluster index: Best=2, Average=1, Worst=0
  const fromIdx = fromCluster === 'Best' ? 2 : fromCluster === 'Average' ? 1 : 0;

  // ATR
  const atrArr = ta.atr(bars, atrLen).toArray();

  // Generate candidate factors
  const factors: number[] = [];
  for (let f = minFactor; f <= maxFactor + 0.001; f += factorStep) {
    factors.push(Math.round(f * 1000) / 1000);
  }
  const numFactors = factors.length;

  // --- Per-factor SuperTrend state arrays (Pine: holder array of supertrend UDT) ---
  // Each factor has: upper, lower, output, perf, trend
  const stUpper = new Float64Array(numFactors);
  const stLower = new Float64Array(numFactors);
  const stOutput = new Float64Array(numFactors);
  const stPerf = new Float64Array(numFactors);
  const stTrend = new Int8Array(numFactors); // 0 or 1

  // EMA alpha for performance
  const perfEmaAlpha = 2 / (perfAlpha + 1);

  // EMA denominator: ta.ema(abs(close - close[1]), int(perfAlpha))
  const absDiffArr: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    absDiffArr[i] = Math.abs(bars[i].close - bars[i - 1].close);
  }
  const denSeries = Series.fromArray(bars, absDiffArr);
  const denArr = ta.ema(denSeries, Math.floor(perfAlpha)).toArray();

  // Final output arrays
  const tsArr: number[] = new Array(n).fill(NaN);
  const osArr: number[] = new Array(n).fill(0); // trend: 0 or 1
  const perfIdxArr: number[] = new Array(n).fill(NaN);
  const perfAmaArr: number[] = new Array(n).fill(NaN);
  const targetFactorArr: number[] = new Array(n).fill(NaN);

  // State for final supertrend
  let upper = 0;
  let lower = 0;
  let os = 0;
  let perfAma = NaN;
  let targetFactor = NaN;
  let perfIdx = NaN;

  // Dashboard info (last bar)
  let lastClusters: { perfValues: number[][]; factorValues: number[][]; centroids: number[] } | null = null;

  // Initialize per-factor state on first bar with valid hl2
  let initialized = false;

  for (let i = 0; i < n; i++) {
    const atr = atrArr[i];
    const hl2 = (bars[i].high + bars[i].low) / 2;
    const close = bars[i].close;
    const prevClose = i > 0 ? bars[i - 1].close : close;

    if (atr == null || isNaN(atr)) {
      tsArr[i] = NaN;
      continue;
    }

    if (!initialized) {
      // First valid bar: initialize all factors
      for (let k = 0; k < numFactors; k++) {
        stUpper[k] = hl2;
        stLower[k] = hl2;
        stOutput[k] = hl2;
        stPerf[k] = 0;
        stTrend[k] = 0;
      }
      upper = hl2;
      lower = hl2;
      initialized = true;
    }

    // --- Compute SuperTrend for each factor (Pine lines 70-85) ---
    for (let k = 0; k < numFactors; k++) {
      const factor = factors[k];
      const up = hl2 + atr * factor;
      const dn = hl2 - atr * factor;

      // Update trend
      stTrend[k] = close > stUpper[k] ? 1 : close < stLower[k] ? 0 : stTrend[k];

      // Update upper/lower bands
      stUpper[k] = prevClose < stUpper[k] ? Math.min(up, stUpper[k]) : up;
      stLower[k] = prevClose > stLower[k] ? Math.max(dn, stLower[k]) : dn;

      // Performance EMA: perf += alpha * (nz(close - prevClose) * diff - perf)
      const diff = i > 0 ? Math.sign(prevClose - stOutput[k]) : 0;
      const closeDiff = i > 0 ? close - prevClose : 0;
      stPerf[k] += perfEmaAlpha * (closeDiff * diff - stPerf[k]);

      // Output
      stOutput[k] = stTrend[k] === 1 ? stLower[k] : stUpper[k];
    }

    // --- K-means clustering (Pine lines 90-136) ---
    // Only run within maxData range from last bar
    const lastBarIdx = n - 1;
    if (lastBarIdx - i <= maxData) {
      // Build data arrays from current bar's factor performances
      const data: number[] = [];
      const factorData: number[] = [];
      for (let k = 0; k < numFactors; k++) {
        data.push(stPerf[k]);
        factorData.push(factors[k]);
      }

      // Initialize centroids using quartiles
      const centroids = [
        percentileLinear(data, 25),
        percentileLinear(data, 50),
        percentileLinear(data, 75),
      ];

      // K-means iterations
      let perfClusters: number[][] = [[], [], []];
      let factorsClusters: number[][] = [[], [], []];

      for (let iter = 0; iter <= maxIter; iter++) {
        perfClusters = [[], [], []];
        factorsClusters = [[], [], []];

        // Assign each value to nearest centroid
        for (let di = 0; di < data.length; di++) {
          const value = data[di];
          let minDist = Infinity;
          let bestIdx = 0;
          for (let c = 0; c < 3; c++) {
            const d = Math.abs(value - centroids[c]);
            if (d < minDist) { minDist = d; bestIdx = c; }
          }
          perfClusters[bestIdx].push(value);
          factorsClusters[bestIdx].push(factorData[di]);
        }

        // Update centroids
        const newCentroids = perfClusters.map(cluster =>
          cluster.length > 0 ? cluster.reduce((a, b) => a + b, 0) / cluster.length : 0
        );

        // Check convergence
        if (newCentroids[0] === centroids[0] && newCentroids[1] === centroids[1] && newCentroids[2] === centroids[2]) {
          break;
        }

        centroids[0] = newCentroids[0];
        centroids[1] = newCentroids[1];
        centroids[2] = newCentroids[2];
      }

      // Sort clusters by centroid to identify worst(0), average(1), best(2)
      // Pine stores clusters in order [0,1,2] where 2=best, 1=avg, 0=worst
      // Pine uses centroids initialized at 25th/50th/75th percentile,
      // so index 0=worst, 1=average, 2=best by construction
      lastClusters = { perfValues: perfClusters, factorValues: factorsClusters, centroids };

      // Get target factor from selected cluster
      const targetClusterFactors = factorsClusters[fromIdx];
      if (targetClusterFactors.length > 0) {
        targetFactor = targetClusterFactors.reduce((a, b) => a + b, 0) / targetClusterFactors.length;
      }

      // Get performance index
      const targetClusterPerfs = perfClusters[fromIdx];
      const avgPerf = targetClusterPerfs.length > 0
        ? targetClusterPerfs.reduce((a, b) => a + b, 0) / targetClusterPerfs.length
        : 0;
      const den = denArr[i];
      perfIdx = (den != null && den !== 0) ? Math.max(avgPerf, 0) / den : 0;
    }

    targetFactorArr[i] = targetFactor;
    perfIdxArr[i] = perfIdx;

    // --- Compute final SuperTrend with target factor (Pine lines 161-177) ---
    if (!isNaN(targetFactor)) {
      const up = hl2 + atr * targetFactor;
      const dn = hl2 - atr * targetFactor;

      upper = prevClose < upper ? Math.min(up, upper) : up;
      lower = prevClose > lower ? Math.max(dn, lower) : dn;
      os = close > upper ? 1 : close < lower ? 0 : os;
      const ts = os === 1 ? lower : upper;

      tsArr[i] = ts;
      osArr[i] = os;

      // AMA: perf_ama += perf_idx * (ts - perf_ama)
      if (isNaN(perfAma)) {
        perfAma = ts;
      } else {
        perfAma += perfIdx * (ts - perfAma);
      }
      perfAmaArr[i] = perfAma;
    }
  }

  // --- Build outputs ---
  const markers: MarkerData[] = [];
  const labels: LabelData[] = [];

  for (let i = 1; i < n; i++) {
    if (isNaN(tsArr[i]) || isNaN(tsArr[i - 1])) continue;

    // Pine: os > os[1] => bullish signal
    if (osArr[i] === 1 && osArr[i - 1] === 0) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: bullCss, text: 'Buy' });
      const perfScore = isNaN(perfIdxArr[i]) ? 0 : Math.floor(perfIdxArr[i] * 10);
      labels.push({
        time: bars[i].time,
        price: tsArr[i],
        text: String(perfScore),
        color: bullCss,
        textColor: '#FFFFFF',
        style: 'label_up',
        size: 'tiny',
      });
    }

    // Pine: os < os[1] => bearish signal
    if (osArr[i] === 0 && osArr[i - 1] === 1) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: bearCss, text: 'Sell' });
      const perfScore = isNaN(perfIdxArr[i]) ? 0 : Math.floor(perfIdxArr[i] * 10);
      labels.push({
        time: bars[i].time,
        price: tsArr[i],
        text: String(perfScore),
        color: bearCss,
        textColor: '#FFFFFF',
        style: 'label_down',
        size: 'tiny',
      });
    }
  }

  // Plot 0: Trailing Stop (gap on direction change)
  // Pine: plot(ts, 'Trailing Stop', os != os[1] ? na : css)
  const plot0 = bars.map((bar, i) => {
    if (isNaN(tsArr[i])) return { time: bar.time, value: NaN };
    const gapped = i > 0 && !isNaN(tsArr[i - 1]) && osArr[i] !== osArr[i - 1];
    if (gapped) return { time: bar.time, value: NaN };
    const color = osArr[i] === 1 ? bullCss : bearCss;
    return { time: bar.time, value: tsArr[i], color };
  });

  // Plot 1: Trailing Stop AMA
  // Pine: plot(perf_ama, 'Trailing Stop AMA', ta.cross(close, perf_ama) ? na : close > perf_ama ? amaBullCss : amaBearCss)
  const plot1 = bars.map((bar, i) => {
    if (isNaN(perfAmaArr[i])) return { time: bar.time, value: NaN };
    // Gap when close crosses perf_ama
    if (i > 0 && !isNaN(perfAmaArr[i - 1])) {
      const prevAbove = bars[i - 1].close > perfAmaArr[i - 1];
      const currAbove = bars[i].close > perfAmaArr[i];
      if (prevAbove !== currAbove) return { time: bar.time, value: NaN };
    }
    const color = bars[i].close > perfAmaArr[i] ? amaBullCss + '80' : amaBearCss + '80';
    return { time: bar.time, value: perfAmaArr[i], color };
  });

  // Barcolor: gradient based on perf_idx
  // Pine: barcolor(color.from_gradient(perf_idx, 0, 1, color.new(css, 80), css))
  // css = os ? bullCss : bearCss; color.new(css, 80) = same color at 80% transparency
  const barColors: BarColorData[] = [];
  for (let i = 0; i < n; i++) {
    if (isNaN(tsArr[i]) || isNaN(perfIdxArr[i])) continue;
    const css = osArr[i] === 1 ? bullCss : bearCss;
    // from_gradient(perf_idx, 0, 1, color.new(css, 80), css)
    // At perf_idx=0 => css with 80 alpha (80% transparent), at perf_idx=1 => css with 0 alpha (opaque)
    const gradColor = colorFromGradient(perfIdxArr[i], 0, 1, css, 80, css, 0);
    barColors.push({ time: bars[i].time, color: gradColor });
  }

  // Dashboard table (Pine lines 180-237): 4 columns x 4 rows
  // Row 0: headers [Cluster, Size, Centroid Dispersion, Factors]
  // Row 1: Best cluster
  // Row 2: Average cluster
  // Row 3: Worst cluster
  const cells: TableCell[] = [
    { row: 0, column: 0, text: 'Cluster', bgColor: '#1E222D', textColor: '#FFFFFF', textSize: 'small' },
    { row: 0, column: 1, text: 'Size', bgColor: '#1E222D', textColor: '#FFFFFF', textSize: 'small' },
    { row: 0, column: 2, text: 'Centroid Dispersion', bgColor: '#1E222D', textColor: '#FFFFFF', textSize: 'small' },
    { row: 0, column: 3, text: 'Factors', bgColor: '#1E222D', textColor: '#FFFFFF', textSize: 'small' },
    { row: 1, column: 0, text: 'Best', bgColor: '#1E222D', textColor: '#FFFFFF', textSize: 'small' },
    { row: 2, column: 0, text: 'Average', bgColor: '#1E222D', textColor: '#FFFFFF', textSize: 'small' },
    { row: 3, column: 0, text: 'Worst', bgColor: '#1E222D', textColor: '#FFFFFF', textSize: 'small' },
  ];

  if (lastClusters) {
    const clusterOrder = [2, 1, 0]; // Best, Average, Worst => Pine indices 2, 1, 0
    for (let ci = 0; ci < 3; ci++) {
      const pIdx = clusterOrder[ci];
      const row = ci + 1;
      const clusterPerfs = lastClusters.perfValues[pIdx];
      const clusterFactors = lastClusters.factorValues[pIdx];
      const centroid = lastClusters.centroids[pIdx];

      // Size
      cells.push({ row, column: 1, text: String(clusterPerfs.length), bgColor: '#1E222D', textColor: '#FFFFFF', textSize: 'small' });

      // Centroid dispersion
      let disp = 0;
      if (clusterPerfs.length > 1) {
        for (const v of clusterPerfs) {
          disp += Math.abs(v - centroid);
        }
      }
      disp = clusterPerfs.length > 0 ? disp / clusterPerfs.length : 0;
      cells.push({ row, column: 2, text: disp.toFixed(4), bgColor: '#1E222D', textColor: '#FFFFFF', textSize: 'small' });

      // Factors
      const factorsStr = clusterFactors.map(f => f.toFixed(1)).join(', ');
      cells.push({ row, column: 3, text: factorsStr || '-', bgColor: '#1E222D', textColor: '#FFFFFF', textSize: 'small' });
    }
  }

  const tables: TableData = {
    position: 'top_right',
    columns: 4,
    rows: 4,
    cells,
  };

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    markers,
    labels,
    tables,
    barColors,
  };
}

export const SupertrendAiClustering = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
