/**
 * MOST on RSI
 *
 * OTT-style trailing stop applied to RSI instead of price.
 * Includes RSI, RSI-based MA, MOST line, divergence detection,
 * divergence markers/lines, OB/OS gradient fills, and optional BB bands.
 *
 * Reference: TradingView "MOST on RSI" (TV#452)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type FillData, type Bar } from 'oakscriptjs';
import type { MarkerData, LineDrawingData } from '../types';

export interface MOSTRSIInputs {
  rsiLen: number;
  percent: number;
  maLen: number;
  showDivergence: boolean;
  showSignals: boolean;
}

export const defaultInputs: MOSTRSIInputs = {
  rsiLen: 14,
  percent: 9.0,
  maLen: 5,
  showDivergence: true,
  showSignals: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'percent', type: 'float', title: 'STOP LOSS Percent', defval: 9.0, min: 0.1, step: 0.1 },
  { id: 'maLen', type: 'int', title: 'MA Length', defval: 5, min: 1 },
  { id: 'showDivergence', type: 'bool', title: 'Show Divergence', defval: true },
  { id: 'showSignals', type: 'bool', title: 'Show Signals', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'rsi', title: 'RSI', color: '#7E57C2', lineWidth: 1 },
  { id: 'rsiMa', title: 'RSI-based MA', color: '#FFFF00', lineWidth: 1 },
  { id: 'most', title: 'MOST', color: '#800000', lineWidth: 3 },
  { id: 'bullDiv', title: 'Bullish Divergence', color: '#26A69A', lineWidth: 2 },
  { id: 'bearDiv', title: 'Bearish Divergence', color: '#EF5350', lineWidth: 2 },
  { id: 'obData', title: 'RSI OB', color: '#4CAF50', lineWidth: 0, display: 'none' },
  { id: 'osData', title: 'RSI OS', color: '#FF5252', lineWidth: 0, display: 'none' },
  { id: 'midline', title: 'Middle Line', color: 'transparent', lineWidth: 0, display: 'none' },
];

export const metadata = {
  title: 'MOST on RSI',
  shortTitle: 'MOST-RSI',
  overlay: false,
};

// VAR (Variable Moving Average) function matching Pine
function computeVAR(values: number[], length: number): number[] {
  const n = values.length;
  const result = new Array(n).fill(NaN);
  const valpha = 2 / (length + 1);

  for (let i = 0; i < n; i++) {
    if (i < 9) { result[i] = NaN; continue; }
    // vud1 = source > source[1] ? source - source[1] : 0
    let vUD = 0, vDD = 0;
    for (let j = i - 8; j <= i; j++) {
      const diff = values[j] - values[j - 1];
      if (diff > 0) vUD += diff;
      else if (diff < 0) vDD += -diff;
    }
    const denom = vUD + vDD;
    const vCMO = denom === 0 ? 0 : (vUD - vDD) / denom;
    if (isNaN(result[i - 1])) {
      result[i] = values[i];
    } else {
      result[i] = valpha * Math.abs(vCMO) * values[i] + (1 - valpha * Math.abs(vCMO)) * result[i - 1];
    }
  }
  return result;
}

export function calculate(bars: Bar[], inputs: Partial<MOSTRSIInputs> = {}): IndicatorResult & { markers: MarkerData[]; lines: LineDrawingData[] } {
  const { rsiLen, percent, maLen, showDivergence, showSignals } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const src = getSourceSeries(bars, 'close');
  const rsiSeries = ta.rsi(src, rsiLen);
  const rsiArr = rsiSeries.toArray();

  // Pine uses VAR MA by default
  const rsiVals = rsiArr.map(v => v ?? 0);
  const rsiMaArr = computeVAR(rsiVals, maLen);

  // OTT trailing stop logic on RSI MA
  const longStop: number[] = new Array(n);
  const shortStop: number[] = new Array(n);
  const dir: number[] = new Array(n);
  const most: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const val = rsiMaArr[i] ?? 0;
    const fark = val * percent * 0.01;

    longStop[i] = val - fark;
    shortStop[i] = val + fark;

    if (i > 0) {
      if (val > longStop[i - 1]) longStop[i] = Math.max(longStop[i], longStop[i - 1]);
      if (val < shortStop[i - 1]) shortStop[i] = Math.min(shortStop[i], shortStop[i - 1]);

      dir[i] = dir[i - 1];
      if (dir[i - 1] === -1 && val > shortStop[i - 1]) dir[i] = 1;
      else if (dir[i - 1] === 1 && val < longStop[i - 1]) dir[i] = -1;
    } else {
      dir[i] = 1;
    }

    most[i] = dir[i] === 1 ? longStop[i] : shortStop[i];
  }

  const warmup = rsiLen + maLen;

  // Pine: plot(rsi, "RSI", color=#7E57C2)
  const rsiPlot = rsiArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < rsiLen) ? NaN : v,
  }));

  // Pine: plot(rsiMA, "RSI-based MA", color=color.yellow)
  const rsiMaPlot = rsiMaArr.map((v, i) => ({
    time: bars[i].time,
    value: (isNaN(v) || i < warmup) ? NaN : v,
  }));

  // Pine: plot(MOST, color=color.maroon, linewidth=3)
  const mostPlot = most.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : v,
  }));

  // OB/OS gradient fill auxiliary plots (matching rsi.ts pattern)
  // Pine: fill(rsiPlot, midLinePlot, 100, 70, top_color=green(0), bottom_color=green(100))
  // Pine: fill(rsiPlot, midLinePlot, 30, 0, top_color=red(100), bottom_color=red(0))
  const obData = rsiArr.map((v, i) => ({
    time: bars[i].time,
    value: (v != null && v > 70) ? v : NaN,
  }));
  const osData = rsiArr.map((v, i) => ({
    time: bars[i].time,
    value: (v != null && v < 30) ? v : NaN,
  }));
  const midlinePlot = bars.map(b => ({ time: b.time, value: 50 }));

  const fills: FillData[] = [
    // Pine: fill(rsiUpperBand, rsiLowerBand, color=color.rgb(126,87,194,90))
    // This is the band fill between hlines 70-30 (handled via hlines below)
    // OB gradient fill
    { plot1: 'obData', plot2: 'midline', options: { color: '#4CAF50', transp: 90, title: 'Overbought Gradient Fill' } },
    // OS gradient fill
    { plot1: 'osData', plot2: 'midline', options: { color: '#FF5252', transp: 90, title: 'Oversold Gradient Fill' } },
  ];

  // BUY/SELL markers
  const markers: MarkerData[] = [];
  for (let i = warmup + 1; i < n; i++) {
    const val = rsiMaArr[i];
    const prevVal = rsiMaArr[i - 1];
    const mostVal = most[i];
    const prevMost = most[i - 1];
    if (isNaN(val) || isNaN(prevVal)) continue;

    const cro = prevVal <= prevMost && val > mostVal;
    const cru = prevVal >= prevMost && val < mostVal;

    if (showSignals && cro) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#0F18BF', text: 'BUY' });
    }
    if (showSignals && cru) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#0F18BF', text: 'SELL' });
    }
  }

  // Divergence detection (Pine lookbackLeft=5, lookbackRight=5, rangeUpper=60, rangeLower=5)
  const lookbackLeft = 5;
  const lookbackRight = 5;
  const rangeUpper = 60;
  const rangeLower = 5;

  const lines: LineDrawingData[] = [];

  // Compute pivot highs and lows on RSI
  const rsiPivotHighSeries = ta.pivothigh(new Series(bars, (_b, i) => rsiArr[i] ?? NaN), lookbackLeft, lookbackRight);
  const rsiPivotLowSeries = ta.pivotlow(new Series(bars, (_b, i) => rsiArr[i] ?? NaN), lookbackLeft, lookbackRight);
  const phArr = rsiPivotHighSeries.toArray();
  const plArr = rsiPivotLowSeries.toArray();

  // Track pivot positions for divergence line plots
  // Pine: plot(plFound ? rsi[lookbackRight] : na, offset=-lookbackRight, color=(bullCond ? bullColor : noneColor))
  // Pine: plot(phFound ? rsi[lookbackRight] : na, offset=-lookbackRight, color=(bearCond ? bearColor : noneColor))
  const bullDivPlot: { time: number; value: number }[] = bars.map(b => ({ time: b.time, value: NaN }));
  const bearDivPlot: { time: number; value: number }[] = bars.map(b => ({ time: b.time, value: NaN }));

  if (showDivergence) {
    // Find pivot low positions for bullish divergence
    let lastPLIdx = -1;
    let lastPLRsi = NaN;
    let lastPLPrice = NaN;

    for (let i = lookbackLeft + lookbackRight; i < n; i++) {
      const plVal = plArr[i];
      if (plVal != null && !isNaN(plVal) && plVal !== 0) {
        const pivotIdx = i - lookbackRight;
        const pivotRsi = rsiArr[pivotIdx] ?? NaN;
        const pivotPrice = bars[pivotIdx].low;

        if (!isNaN(pivotRsi) && lastPLIdx >= 0 && !isNaN(lastPLRsi)) {
          const barsSince = pivotIdx - lastPLIdx;
          if (barsSince >= rangeLower && barsSince <= rangeUpper) {
            // Regular Bullish: RSI higher low, Price lower low
            if (pivotRsi > lastPLRsi && pivotPrice < lastPLPrice) {
              // Divergence line between the two pivot points
              lines.push({
                time1: bars[lastPLIdx].time,
                price1: lastPLRsi,
                time2: bars[pivotIdx].time,
                price2: pivotRsi,
                color: '#26A69A',
                width: 2,
                style: 'solid',
              });
              // Plot point at the pivot (Pine: plot with offset)
              bullDivPlot[pivotIdx] = { time: bars[pivotIdx].time, value: pivotRsi };
              // Marker label (Pine: plotshape with location.absolute)
              markers.push({
                time: bars[pivotIdx].time,
                position: 'belowBar',
                shape: 'labelUp',
                color: '#26A69A',
                text: ' Bull ',
              });
            }
          }
        }
        lastPLIdx = pivotIdx;
        lastPLRsi = pivotRsi;
        lastPLPrice = pivotPrice;
      }
    }

    // Find pivot high positions for bearish divergence
    let lastPHIdx = -1;
    let lastPHRsi = NaN;
    let lastPHPrice = NaN;

    for (let i = lookbackLeft + lookbackRight; i < n; i++) {
      const phVal = phArr[i];
      if (phVal != null && !isNaN(phVal) && phVal !== 0) {
        const pivotIdx = i - lookbackRight;
        const pivotRsi = rsiArr[pivotIdx] ?? NaN;
        const pivotPrice = bars[pivotIdx].high;

        if (!isNaN(pivotRsi) && lastPHIdx >= 0 && !isNaN(lastPHRsi)) {
          const barsSince = pivotIdx - lastPHIdx;
          if (barsSince >= rangeLower && barsSince <= rangeUpper) {
            // Regular Bearish: RSI lower high, Price higher high
            if (pivotRsi < lastPHRsi && pivotPrice > lastPHPrice) {
              lines.push({
                time1: bars[lastPHIdx].time,
                price1: lastPHRsi,
                time2: bars[pivotIdx].time,
                price2: pivotRsi,
                color: '#EF5350',
                width: 2,
                style: 'solid',
              });
              bearDivPlot[pivotIdx] = { time: bars[pivotIdx].time, value: pivotRsi };
              markers.push({
                time: bars[pivotIdx].time,
                position: 'aboveBar',
                shape: 'labelDown',
                color: '#EF5350',
                text: ' Bear ',
              });
            }
          }
        }
        lastPHIdx = pivotIdx;
        lastPHRsi = pivotRsi;
        lastPHPrice = pivotPrice;
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'rsi': rsiPlot,
      'rsiMa': rsiMaPlot,
      'most': mostPlot,
      'bullDiv': bullDivPlot,
      'bearDiv': bearDivPlot,
      'obData': obData,
      'osData': osData,
      'midline': midlinePlot,
    },
    hlines: [
      { value: 70, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: 50, options: { color: 'rgba(120,123,134,0.5)', linestyle: 'dotted' as const, title: 'Midline' } },
      { value: 30, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
    fills,
    markers,
    lines,
  };
}

export const MOSTRSI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
