/**
 * VolumeDivergence
 *
 * Detects 4 divergence types between price and a custom weighted-MA volume oscillator.
 * Custom WMA weights by candle direction, pivot detection on volume to find divergences.
 *
 * Reference: TradingView "Volume Divergence by MM" by baymucuk
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface VolumeDivergenceInputs {
  vl1: number;
  vl2: number;
  pivotLookbackRight: number;
  pivotLookbackLeft: number;
  maxLookbackRange: number;
  minLookbackRange: number;
  plotBull: boolean;
  plotHiddenBull: boolean;
  plotBear: boolean;
  plotHiddenBear: boolean;
}

export const defaultInputs: VolumeDivergenceInputs = {
  vl1: 5,
  vl2: 8,
  pivotLookbackRight: 5,
  pivotLookbackLeft: 5,
  maxLookbackRange: 60,
  minLookbackRange: 5,
  plotBull: true,
  plotHiddenBull: false,
  plotBear: true,
  plotHiddenBear: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'vl1', type: 'int', title: 'First Moving Average Length', defval: 5, min: 1 },
  { id: 'vl2', type: 'int', title: 'Second Moving Average Length', defval: 8, min: 1 },
  { id: 'pivotLookbackRight', type: 'int', title: 'Pivot Lookback Right', defval: 5, min: 1 },
  { id: 'pivotLookbackLeft', type: 'int', title: 'Pivot Lookback Left', defval: 5, min: 1 },
  { id: 'maxLookbackRange', type: 'int', title: 'Max Lookback Range', defval: 60, min: 1 },
  { id: 'minLookbackRange', type: 'int', title: 'Min Lookback Range', defval: 5, min: 1 },
  { id: 'plotBull', type: 'bool', title: 'Plot Bullish', defval: true },
  { id: 'plotHiddenBull', type: 'bool', title: 'Plot Hidden Bullish', defval: false },
  { id: 'plotBear', type: 'bool', title: 'Plot Bearish', defval: true },
  { id: 'plotHiddenBear', type: 'bool', title: 'Plot Hidden Bearish', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'vol', title: 'Volume', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'Volume Divergence',
  shortTitle: 'VolDiv',
  overlay: false,
};

/**
 * Custom WMA from Pine: weights volume by candle direction (positive for bullish, negative for bearish).
 * pine_wma(x, y) =>
 *   for i = 0 to y - 1
 *     weight = (y - i) * y
 *     factor = close[i] < open[i] ? -1 : 1
 *     sum += x[i] * weight * factor
 *   sum / norm
 */
function pineWma(xArr: number[], bars: Bar[], period: number): number[] {
  const n = xArr.length;
  const out: number[] = new Array(n).fill(NaN);

  for (let i = period - 1; i < n; i++) {
    let norm = 0;
    let sum = 0;
    for (let j = 0; j < period; j++) {
      const weight = (period - j) * period;
      norm += weight;
      const factor = bars[i - j].close < bars[i - j].open ? -1 : 1;
      sum += xArr[i - j] * weight * factor;
    }
    out[i] = norm === 0 ? 0 : sum / norm;
  }

  return out;
}

export function calculate(bars: Bar[], inputs: Partial<VolumeDivergenceInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const lbR = cfg.pivotLookbackRight;
  const lbL = cfg.pivotLookbackLeft;

  // Chain of custom WMAs
  const volArr = bars.map(b => b.volume ?? 0);
  const vl3 = cfg.vl1 + cfg.vl2;
  const vl4 = cfg.vl2 + vl3;
  const vl5 = vl3 + vl4;

  const w1 = pineWma(volArr, bars, cfg.vl1);
  const w2 = pineWma(w1, bars, cfg.vl2);
  const w3 = pineWma(w2, bars, vl3);
  const w4 = pineWma(w3, bars, vl4);
  const vol = pineWma(w4, bars, vl5);

  const warmup = vl5;

  // Pivot detection on vol
  // pivotlow: vol[lbR] is lower than all surrounding bars within lbL left and lbR right
  // pivothigh: vol[lbR] is higher than all surrounding bars
  function isPivotLow(arr: number[], idx: number): boolean {
    const pivotIdx = idx - lbR;
    if (pivotIdx < lbL) return false;
    const val = arr[pivotIdx];
    if (isNaN(val)) return false;
    for (let j = 1; j <= lbL; j++) {
      if (arr[pivotIdx - j] <= val) return false;
    }
    for (let j = 1; j <= lbR; j++) {
      if (arr[pivotIdx + j] <= val) return false;
    }
    return true;
  }

  function isPivotHigh(arr: number[], idx: number): boolean {
    const pivotIdx = idx - lbR;
    if (pivotIdx < lbL) return false;
    const val = arr[pivotIdx];
    if (isNaN(val)) return false;
    for (let j = 1; j <= lbL; j++) {
      if (arr[pivotIdx - j] >= val) return false;
    }
    for (let j = 1; j <= lbR; j++) {
      if (arr[pivotIdx + j] >= val) return false;
    }
    return true;
  }

  // Track pivot history for divergence comparison
  // For each bar i, check if there's a pivot at i-lbR, then compare with previous pivot
  const markers: MarkerData[] = [];

  // Store last pivot low/high info
  let lastPlIdx = -1;
  let lastPlVol = NaN;
  let lastPlLow = NaN;

  let lastPhIdx = -1;
  let lastPhVol = NaN;
  let lastPhHigh = NaN;

  for (let i = lbL + lbR; i < n; i++) {
    const pivotIdx = i - lbR;

    // Check pivot low
    if (isPivotLow(vol, i)) {
      const curVol = vol[pivotIdx];
      const curLow = bars[pivotIdx].low;

      if (lastPlIdx >= 0) {
        const barsSince = pivotIdx - lastPlIdx;
        const inRange = barsSince >= cfg.minLookbackRange && barsSince <= cfg.maxLookbackRange;

        if (inRange) {
          // Regular Bullish: price lower low, vol higher low
          if (cfg.plotBull && curLow < lastPlLow && curVol > lastPlVol) {
            markers.push({
              time: bars[pivotIdx].time,
              position: 'belowBar',
              shape: 'labelUp',
              color: '#00FF00',
              text: 'Bull',
            });
          }

          // Hidden Bullish: price higher low, vol lower low
          if (cfg.plotHiddenBull && curLow > lastPlLow && curVol < lastPlVol) {
            markers.push({
              time: bars[pivotIdx].time,
              position: 'belowBar',
              shape: 'labelUp',
              color: 'rgba(0,255,0,0.75)',
              text: 'H Bull',
            });
          }
        }
      }

      lastPlIdx = pivotIdx;
      lastPlVol = curVol;
      lastPlLow = curLow;
    }

    // Check pivot high
    if (isPivotHigh(vol, i)) {
      const curVol = vol[pivotIdx];
      const curHigh = bars[pivotIdx].high;

      if (lastPhIdx >= 0) {
        const barsSince = pivotIdx - lastPhIdx;
        const inRange = barsSince >= cfg.minLookbackRange && barsSince <= cfg.maxLookbackRange;

        if (inRange) {
          // Regular Bearish: price higher high, vol lower high
          if (cfg.plotBear && curHigh > lastPhHigh && curVol < lastPhVol) {
            markers.push({
              time: bars[pivotIdx].time,
              position: 'aboveBar',
              shape: 'labelDown',
              color: '#FF0000',
              text: 'Bear',
            });
          }

          // Hidden Bearish: price lower high, vol higher high
          if (cfg.plotHiddenBear && curHigh < lastPhHigh && curVol > lastPhVol) {
            markers.push({
              time: bars[pivotIdx].time,
              position: 'aboveBar',
              shape: 'labelDown',
              color: 'rgba(255,0,0,0.75)',
              text: 'H Bear',
            });
          }
        }
      }

      lastPhIdx = pivotIdx;
      lastPhVol = curVol;
      lastPhHigh = curHigh;
    }
  }

  // Volume plot colored green/red based on sign
  const volPlot = vol.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
    color: v > 0 ? '#26A69A' : '#EF5350',
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { vol: volPlot },
    hlines: [
      { value: 0, options: { color: '#C0C0C0', linestyle: 'solid' as const, title: 'Baseline' } },
    ],
    markers,
  };
}

export const VolumeDivergence = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
