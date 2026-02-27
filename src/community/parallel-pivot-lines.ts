/**
 * Parallel Pivot Lines [LuxAlgo]
 *
 * Detects pivot highs and pivot lows, computes a linear regression slope of
 * close vs bar_index over a dynamic window, then projects sloped lines from
 * each of the most recent pivot points.
 *
 * All lines share the same slope (they are "parallel"), offset vertically
 * to pass through each pivot price at its pivot bar.
 *
 * Pine source uses line.new(extend.right). Since we output time-series,
 * we project each line forward from its pivot origin until a newer pivot
 * of the same type replaces it.
 *
 * Reference: TradingView "Parallel Pivot Lines [LuxAlgo]" by LuxAlgo
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ParallelPivotLinesInputs {
  length: number;
  lookback: number;
  slope: number;
}

export const defaultInputs: ParallelPivotLinesInputs = {
  length: 30,
  lookback: 3,
  slope: 1.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Pivot Length', defval: 30, min: 1 },
  { id: 'lookback', type: 'int', title: 'Lookback', defval: 3, min: 1, max: 10 },
  { id: 'slope', type: 'float', title: 'Slope Multiplier', defval: 1.0, min: -1, max: 1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PH Line 1', color: '#2157f3', lineWidth: 1 },
  { id: 'plot1', title: 'PH Line 2', color: '#2157f3', lineWidth: 1 },
  { id: 'plot2', title: 'PH Line 3', color: '#2157f3', lineWidth: 1 },
  { id: 'plot3', title: 'PL Line 1', color: '#ff1100', lineWidth: 1 },
  { id: 'plot4', title: 'PL Line 2', color: '#ff1100', lineWidth: 1 },
  { id: 'plot5', title: 'PL Line 3', color: '#ff1100', lineWidth: 1 },
];

export const metadata = {
  title: 'Parallel Pivot Lines',
  shortTitle: 'PPL',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<ParallelPivotLinesInputs> = {}): IndicatorResult {
  const { length, lookback, slope: slopeMul } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);

  const phArr = ta.pivothigh(highSeries, length, length).toArray();
  const plArr = ta.pivotlow(lowSeries, length, length).toArray();

  // Collect pivot high/low values and their bar indices (offset by -length, as Pine does)
  // phList[0] = most recent pivot high, etc.
  const phValues: number[] = [];   // pivot price values
  const phIndices: number[] = [];  // bar index where the actual pivot bar is (bar_index - length)
  const plValues: number[] = [];
  const plIndices: number[] = [];

  for (let i = 0; i < n; i++) {
    const ph = phArr[i];
    if (ph != null && !isNaN(ph) && ph !== 0) {
      phValues.unshift(ph);
      phIndices.unshift(i - length);  // Pine: ph_x1 = array.get(ph_n_array,i) - length
    }
    const pl = plArr[i];
    if (pl != null && !isNaN(pl) && pl !== 0) {
      plValues.unshift(pl);
      plIndices.unshift(i - length);
    }
  }

  // Pine cumulative SMA functions for slope computation:
  //   Sma(src, p) = (cum(src) - cum(src)[p]) / p
  //   Variance(src, p) = Sma(src*src, p) - Sma(src, p)^2
  //   Covariance(x, y, p) = Sma(x*y, p) - Sma(x, p) * Sma(y, p)

  // Build cumulative sums needed for slope at each bar
  const close: number[] = bars.map((b) => b.close);
  const barIdx: number[] = bars.map((_, i) => i);

  // cumClose[i] = sum of close[0..i]
  const cumClose = new Float64Array(n);
  const cumBarIdx = new Float64Array(n);
  const cumCloseBarIdx = new Float64Array(n);  // cum(close * barIndex)
  const cumBarIdx2 = new Float64Array(n);      // cum(barIndex^2)

  cumClose[0] = close[0];
  cumBarIdx[0] = 0;
  cumCloseBarIdx[0] = close[0] * 0;
  cumBarIdx2[0] = 0;

  for (let i = 1; i < n; i++) {
    cumClose[i] = cumClose[i - 1] + close[i];
    cumBarIdx[i] = cumBarIdx[i - 1] + i;
    cumCloseBarIdx[i] = cumCloseBarIdx[i - 1] + close[i] * i;
    cumBarIdx2[i] = cumBarIdx2[i - 1] + i * i;
  }

  // Pine's Sma using cumulative: Sma(src, p) = (cum[i] - cum[i-p]) / p
  function cumSma(cum: Float64Array, i: number, p: number): number {
    if (p <= 0) return 0;
    const prev = (i - p) >= 0 ? cum[i - p] : 0;
    return (cum[i] - prev) / p;
  }

  // Compute slope at each bar using Pine's method
  // val_ph = valuewhen(ph, n-length, lookback-1) -> bar index of (lookback-1)th pivot high
  // val_pl = valuewhen(pl, n-length, lookback-1) -> bar index of (lookback-1)th pivot low
  // val = min(val_ph, val_pl), k = n - val > 0 ? n - val : 2
  // slope = Covariance(close, n, k) / Variance(n, k) * SlopeMul

  // To compute valuewhen at each bar, track occurrences incrementally
  const slopeArr = new Float64Array(n);

  // Track the (lookback-1)th occurrence of pivot high/low bar indices
  const phOccurrences: number[] = [];  // bar indices (n - length) when ph fires, most recent first
  const plOccurrences: number[] = [];

  for (let i = 0; i < n; i++) {
    const ph = phArr[i];
    if (ph != null && !isNaN(ph) && ph !== 0) {
      phOccurrences.unshift(i - length);
    }
    const pl = plArr[i];
    if (pl != null && !isNaN(pl) && pl !== 0) {
      plOccurrences.unshift(i - length);
    }

    // valuewhen(ph, n-length, lookback-1) = the (lookback-1)th most recent ph bar index
    const valPh = phOccurrences.length >= lookback ? phOccurrences[lookback - 1] : NaN;
    const valPl = plOccurrences.length >= lookback ? plOccurrences[lookback - 1] : NaN;

    if (isNaN(valPh) || isNaN(valPl)) {
      slopeArr[i] = 0;
      continue;
    }

    const val = Math.min(valPh, valPl);
    const k = (i - val) > 0 ? (i - val) : 2;

    // Covariance(close, barIdx, k) = Sma(close*barIdx, k) - Sma(close, k) * Sma(barIdx, k)
    const smaCloseBarIdx = cumSma(cumCloseBarIdx, i, k);
    const smaClose = cumSma(cumClose, i, k);
    const smaBarIdx = cumSma(cumBarIdx, i, k);
    const covariance = smaCloseBarIdx - smaClose * smaBarIdx;

    // Variance(barIdx, k) = Sma(barIdx^2, k) - Sma(barIdx, k)^2
    const smaBarIdx2 = cumSma(cumBarIdx2, i, k);
    const variance = smaBarIdx2 - smaBarIdx * smaBarIdx;

    slopeArr[i] = variance !== 0 ? (covariance / variance) * slopeMul : 0;
  }

  // Build output plots: lookback PH lines + lookback PL lines
  // Each line projects from its pivot origin with the current bar's slope.
  // Pine draws lines only on the last bar (barstate.islast), extending right.
  // For a time-series, we project each line at every bar from its origin onward.
  // When more than `lookback` pivots exist, older lines get replaced.

  const numPlots = lookback * 2;
  const plots: { time: number; value: number }[][] = [];
  for (let p = 0; p < numPlots; p++) {
    plots.push(new Array(n));
  }

  // Track active PH and PL pivots incrementally
  const activePH: { barIdx: number; value: number }[] = [];  // most recent first
  const activePL: { barIdx: number; value: number }[] = [];

  for (let i = 0; i < n; i++) {
    const ph = phArr[i];
    if (ph != null && !isNaN(ph) && ph !== 0) {
      activePH.unshift({ barIdx: i - length, value: ph });
      if (activePH.length > lookback) activePH.pop();
    }
    const pl = plArr[i];
    if (pl != null && !isNaN(pl) && pl !== 0) {
      activePL.unshift({ barIdx: i - length, value: pl });
      if (activePL.length > lookback) activePL.pop();
    }

    const sl = slopeArr[i];

    // PH lines: plots 0..lookback-1
    for (let j = 0; j < lookback; j++) {
      if (j < activePH.length) {
        const pivot = activePH[j];
        const projected = pivot.value + sl * (i - pivot.barIdx);
        plots[j][i] = { time: bars[i].time, value: projected };
      } else {
        plots[j][i] = { time: bars[i].time, value: NaN };
      }
    }

    // PL lines: plots lookback..2*lookback-1
    for (let j = 0; j < lookback; j++) {
      if (j < activePL.length) {
        const pivot = activePL[j];
        const projected = pivot.value + sl * (i - pivot.barIdx);
        plots[lookback + j][i] = { time: bars[i].time, value: projected };
      } else {
        plots[lookback + j][i] = { time: bars[i].time, value: NaN };
      }
    }
  }

  const plotsObj: Record<string, { time: number; value: number }[]> = {};
  for (let p = 0; p < numPlots; p++) {
    plotsObj[`plot${p}`] = plots[p];
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: plotsObj,
  };
}

export const ParallelPivotLines = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
