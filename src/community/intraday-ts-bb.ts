/**
 * Intraday TS, BB + Buy/Sell + Squeeze Mom + ADX-DMI
 *
 * Overlay with Bollinger Bands, entry/SL/TP levels, buy/sell arrows,
 * DMI directional shapes, and bar coloring.
 *
 * Reference: TradingView "Intraday TS ,BB + Buy/Sell +Squeeze Mom.+ adx-dmi" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface IntradayTSBBInputs {
  bbLen: number;
  bbStdev: number;
  diLen: number;
  adxSmooth: number;
  adxThresh: number;
}

export const defaultInputs: IntradayTSBBInputs = {
  bbLen: 46,
  bbStdev: 0.35,
  diLen: 14,
  adxSmooth: 14,
  adxThresh: 29,
};

export const inputConfig: InputConfig[] = [
  { id: 'bbLen', type: 'int', title: 'BB Length', defval: 46, min: 1 },
  { id: 'bbStdev', type: 'float', title: 'BB Std Dev', defval: 0.35, min: 0.1, step: 0.05 },
  { id: 'diLen', type: 'int', title: 'DI Length', defval: 14, min: 1 },
  { id: 'adxSmooth', type: 'int', title: 'ADX Smoothing', defval: 14, min: 1 },
  { id: 'adxThresh', type: 'int', title: 'ADX Threshold', defval: 29, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'upperBB', title: 'BB Upper Band', color: '#00FFFF', lineWidth: 2 },
  { id: 'lowerBB', title: 'BB Lower Band', color: '#00FFFF', lineWidth: 2 },
];

export const metadata = {
  title: 'Intraday TS BB',
  shortTitle: 'ITSBB',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<IntradayTSBBInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const { bbLen, bbStdev, diLen, adxSmooth, adxThresh } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  // BB calculation: basis = SMA(close, bbLen), dev = bbStdev * stdev(close, bbLen)
  const closeSeries = new Series(bars, (b) => b.close);
  const basis = ta.sma(closeSeries, bbLen);
  const basisArr = basis.toArray();

  // Manual stdev for BB
  const closeArr = bars.map(b => b.close);
  const stdevArr: number[] = new Array(n).fill(NaN);
  for (let i = bbLen - 1; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < bbLen; j++) sum += closeArr[i - j];
    const mean = sum / bbLen;
    let sumSq = 0;
    for (let j = 0; j < bbLen; j++) sumSq += (closeArr[i - j] - mean) ** 2;
    stdevArr[i] = Math.sqrt(sumSq / bbLen);
  }

  const upperArr: number[] = new Array(n).fill(NaN);
  const lowerArr: number[] = new Array(n).fill(NaN);
  for (let i = 0; i < n; i++) {
    const b = basisArr[i];
    const sd = stdevArr[i];
    if (b != null && !isNaN(sd)) {
      upperArr[i] = b + bbStdev * sd;
      lowerArr[i] = b - bbStdev * sd;
    }
  }

  // Detect isOverBBTop / isUnderBBBottom
  const isOverBBTop: boolean[] = new Array(n).fill(false);
  const isUnderBBBottom: boolean[] = new Array(n).fill(false);
  for (let i = bbLen - 1; i < n; i++) {
    isOverBBTop[i] = bars[i].low > upperArr[i];
    isUnderBBBottom[i] = bars[i].high < lowerArr[i];
  }

  // Detect new state transitions
  const newIsOverBBTop: boolean[] = new Array(n).fill(false);
  const newIsUnderBBBottom: boolean[] = new Array(n).fill(false);
  for (let i = 1; i < n; i++) {
    newIsOverBBTop[i] = isOverBBTop[i] !== isOverBBTop[i - 1];
    newIsUnderBBBottom[i] = isUnderBBBottom[i] !== isUnderBBBottom[i - 1];
  }

  // BB upper/lower plots with conditional color: lime when over/under, aqua otherwise
  const upperBBPlot = upperArr.map((v, i) => {
    if (isNaN(v)) return { time: bars[i].time, value: NaN };
    const color = isOverBBTop[i] ? '#00FF00' : '#00FFFF';
    return { time: bars[i].time, value: v, color };
  });

  const lowerBBPlot = lowerArr.map((v, i) => {
    if (isNaN(v)) return { time: bars[i].time, value: NaN };
    const color = isUnderBBBottom[i] ? '#00FF00' : '#00FFFF';
    return { time: bars[i].time, value: v, color };
  });

  // DMI / ADX for directional signals
  const trArr: number[] = new Array(n).fill(0);
  const plusDM: number[] = new Array(n).fill(0);
  const minusDM: number[] = new Array(n).fill(0);
  for (let i = 1; i < n; i++) {
    const h = bars[i].high;
    const l = bars[i].low;
    const pc = bars[i - 1].close;
    trArr[i] = Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
    const up = h - bars[i - 1].high;
    const dn = bars[i - 1].low - l;
    plusDM[i] = up > dn && up > 0 ? up : 0;
    minusDM[i] = dn > up && dn > 0 ? dn : 0;
  }

  // RMA for smoothing
  function rma(arr: number[], len: number): number[] {
    const out: number[] = new Array(arr.length).fill(NaN);
    let sum = 0;
    for (let i = 0; i < len && i < arr.length; i++) sum += arr[i];
    out[len - 1] = sum / len;
    const alpha = 1 / len;
    for (let i = len; i < arr.length; i++) {
      out[i] = alpha * arr[i] + (1 - alpha) * out[i - 1];
    }
    return out;
  }

  const trRma = rma(trArr, diLen);
  const plusRma = rma(plusDM, diLen);
  const minusRma = rma(minusDM, diLen);

  const plusDI: number[] = new Array(n).fill(NaN);
  const minusDI: number[] = new Array(n).fill(NaN);
  const adxArr: number[] = new Array(n).fill(NaN);
  const dx: number[] = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {
    if (!isNaN(trRma[i]) && trRma[i] !== 0) {
      plusDI[i] = 100 * plusRma[i] / trRma[i];
      minusDI[i] = 100 * minusRma[i] / trRma[i];
      const s = plusDI[i] + minusDI[i];
      dx[i] = s === 0 ? 0 : 100 * Math.abs(plusDI[i] - minusDI[i]) / s;
    }
  }

  const adxRma = rma(dx, adxSmooth);
  for (let i = 0; i < n; i++) {
    if (!isNaN(adxRma[i])) adxArr[i] = adxRma[i];
  }

  // Markers
  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];
  const warmup = bbLen;

  for (let i = warmup; i < n; i++) {
    // Buy arrows: when isOverBBTop and high_range is stable
    if (isOverBBTop[i] && newIsOverBBTop[i]) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#00FF00', text: '' });
    }
    // Sell arrows: when isUnderBBBottom and low_range is stable
    if (isUnderBBBottom[i] && newIsUnderBBBottom[i]) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#FFA500', text: '' });
    }

    // DMI shapes
    if (!isNaN(plusDI[i]) && !isNaN(minusDI[i]) && !isNaN(adxArr[i])) {
      if (plusDI[i] >= minusDI[i] && adxArr[i] >= adxThresh) {
        markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleUp', color: '#00FF00', text: '' });
      }
      if (minusDI[i] >= plusDI[i] && adxArr[i] >= adxThresh) {
        markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleDown', color: '#800000', text: '' });
      }
      if (adxArr[i] <= 20) {
        markers.push({ time: bars[i].time, position: 'inBar', shape: 'diamond', color: '#FF0000', text: '' });
      }
    }

    // Bar colors
    if (!isNaN(upperArr[i]) && !isNaN(lowerArr[i])) {
      if (bars[i].high >= lowerArr[i] && bars[i].low <= upperArr[i]) {
        barColors.push({ time: bars[i].time, color: '#00FFFF' }); // aqua: inside bands
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'upperBB': upperBBPlot, 'lowerBB': lowerBBPlot },
    fills: [
      { plot1: 'upperBB', plot2: 'lowerBB', options: { color: 'rgba(0, 255, 255, 0.13)' } },
    ],
    markers,
    barColors,
  };
}

export const IntradayTSBB = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
