/**
 * ADX and DI
 *
 * Classic Average Directional Index with DI+/DI- lines.
 * Uses Wilder's smoothing for TR, +DM, -DM.
 *
 * Reference: TradingView "ADX and DI" by TradingView (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ADXDIInputs {
  length: number;
  threshold: number;
}

export const defaultInputs: ADXDIInputs = {
  length: 14,
  threshold: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'ADX Smoothing', defval: 14, min: 1 },
  { id: 'threshold', type: 'int', title: 'DI Length', defval: 20, min: 0 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'DI+', color: '#26A69A', lineWidth: 1 },
  { id: 'plot1', title: 'DI-', color: '#EF5350', lineWidth: 1 },
  { id: 'plot2', title: 'ADX', color: '#FF6D00', lineWidth: 2 },
];

export const hlineConfig = [
  { value: 20, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Threshold' } },
];

export const metadata = {
  title: 'ADX and DI',
  shortTitle: 'ADX DI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ADXDIInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const diPlusArr: number[] = new Array(n);
  const diMinusArr: number[] = new Array(n);
  const adxArr: number[] = new Array(n);

  let smoothTR = 0;
  let smoothPlusDM = 0;
  let smoothMinusDM = 0;
  let adx = 0;

  for (let i = 0; i < n; i++) {
    const high = bars[i].high;
    const low = bars[i].low;
    const prevHigh = i > 0 ? bars[i - 1].high : high;
    const prevLow = i > 0 ? bars[i - 1].low : low;
    const prevClose = i > 0 ? bars[i - 1].close : bars[i].close;

    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    const plusDM = (high - prevHigh > prevLow - low) ? Math.max(high - prevHigh, 0) : 0;
    const minusDM = (prevLow - low > high - prevHigh) ? Math.max(prevLow - low, 0) : 0;

    if (i < length) {
      smoothTR += tr;
      smoothPlusDM += plusDM;
      smoothMinusDM += minusDM;
    } else if (i === length) {
      smoothTR += tr;
      smoothPlusDM += plusDM;
      smoothMinusDM += minusDM;
    } else {
      smoothTR = smoothTR - smoothTR / length + tr;
      smoothPlusDM = smoothPlusDM - smoothPlusDM / length + plusDM;
      smoothMinusDM = smoothMinusDM - smoothMinusDM / length + minusDM;
    }

    const diPlus = smoothTR !== 0 ? (smoothPlusDM / smoothTR) * 100 : 0;
    const diMinus = smoothTR !== 0 ? (smoothMinusDM / smoothTR) * 100 : 0;
    const diSum = diPlus + diMinus;
    const dx = diSum !== 0 ? Math.abs(diPlus - diMinus) / diSum * 100 : 0;

    if (i === 2 * length - 1) {
      // First ADX = average of first 'length' DX values (approximate with current dx)
      adx = dx;
    } else if (i >= 2 * length) {
      adx = (adx * (length - 1) + dx) / length;
    }

    diPlusArr[i] = diPlus;
    diMinusArr[i] = diMinus;
    adxArr[i] = adx;
  }

  const warmup = length;
  const toPlot = (arr: number[]) =>
    arr.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));

  const adxPlot = adxArr.map((v, i) => ({
    time: bars[i].time,
    value: i < 2 * length - 1 ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': toPlot(diPlusArr), 'plot1': toPlot(diMinusArr), 'plot2': adxPlot },
    hlines: hlineConfig.map(h => ({ value: h.value, options: h.options })),
  };
}

export const ADXDI = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
