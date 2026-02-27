/**
 * ATR+ (Stop Loss Indicator)
 *
 * Overlay=false indicator showing 5 circle-style plots:
 * - ATR (whole number conversion)
 * - Long Entry Size (pips from close to recent low + stop)
 * - Long Target Size (long entry * R:R ratio)
 * - Short Entry Size (pips from recent high to close + stop)
 * - Short Target Size (short entry * R:R ratio)
 *
 * Reference: TradingView "ATR+ (Stop Loss Indicator)" by ZenAndTheArtOfTrading
 */

import { ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ATRPlusInputs {
  riskRatio: number;
  atrLength: number;
  lookback: number;
  stopSize: number;
  useATR: boolean;
}

export const defaultInputs: ATRPlusInputs = {
  riskRatio: 1.0,
  atrLength: 14,
  lookback: 3,
  stopSize: 1.0,
  useATR: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'riskRatio', type: 'float', title: 'R/R', defval: 1.0, min: 0.1, step: 0.1 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'lookback', type: 'int', title: 'Lookback', defval: 3, min: 1 },
  { id: 'stopSize', type: 'float', title: 'Stop Distance (pips or ATR)', defval: 1.0, min: 0.0, step: 0.1 },
  { id: 'useATR', type: 'bool', title: 'Use ATR Multiplier', defval: true },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ATR', color: '#009688', lineWidth: 2 },
  { id: 'plot1', title: 'Long Entry', color: '#4CAF50', lineWidth: 2 },
  { id: 'plot2', title: 'Long Target', color: '#4CAF50', lineWidth: 2 },
  { id: 'plot3', title: 'Short Entry', color: '#F44336', lineWidth: 2 },
  { id: 'plot4', title: 'Short Target', color: '#F44336', lineWidth: 2 },
];

export const metadata = {
  title: 'ATR+ (Stop Loss Indicator)',
  shortTitle: 'ATR+',
  overlay: false,
};

/**
 * Pine's toWhole: converts a price value to whole-number pips.
 * For forex pairs with 3+ decimals, multiply by 10^(decimals-1).
 * For simplicity in a general context, if the value < 1 we scale it to pips,
 * otherwise we leave it as-is (stocks, crypto).
 */
function toWhole(value: number): number {
  if (value === 0 || isNaN(value)) return 0;
  // If value is already >= 1, return rounded
  if (Math.abs(value) >= 1) return Math.round(value * 10) / 10;
  // Forex-like: multiply until >= 1
  let v = value;
  while (Math.abs(v) < 1) {
    v *= 10;
  }
  return Math.round(v * 10) / 10;
}

function toPips(value: number): number {
  return toWhole(value);
}

export function calculate(bars: Bar[], inputs: Partial<ATRPlusInputs> = {}): IndicatorResult {
  const { riskRatio, atrLength, lookback, stopSize, useATR } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const atrArr = ta.atr(bars, atrLength).toArray();

  // Compute lowest low over lookback
  const lowestLow: number[] = new Array(n);
  const highestHigh: number[] = new Array(n);
  for (let i = 0; i < n; i++) {
    let lo = bars[i].low;
    let hi = bars[i].high;
    for (let j = 1; j < lookback && i - j >= 0; j++) {
      lo = Math.min(lo, bars[i - j].low);
      hi = Math.max(hi, bars[i - j].high);
    }
    lowestLow[i] = lo;
    highestHigh[i] = hi;
  }

  const warmup = atrLength;

  const plot0: { time: number; value: number }[] = [];
  const plot1: { time: number; value: number }[] = [];
  const plot2: { time: number; value: number }[] = [];
  const plot3: { time: number; value: number }[] = [];
  const plot4: { time: number; value: number }[] = [];

  for (let i = 0; i < n; i++) {
    const t = bars[i].time;
    if (i < warmup || atrArr[i] == null) {
      plot0.push({ time: t, value: NaN });
      plot1.push({ time: t, value: NaN });
      plot2.push({ time: t, value: NaN });
      plot3.push({ time: t, value: NaN });
      plot4.push({ time: t, value: NaN });
      continue;
    }

    const atrValue = atrArr[i]!;
    const atrWhole = toWhole(atrValue);

    // Stop size: either ATR-based or fixed pip
    let stop: number;
    if (useATR) {
      stop = atrValue * stopSize;
    } else {
      stop = toPips(stopSize);
    }

    const close = bars[i].close;
    const longEntrySize = toWhole(close - lowestLow[i] + stop);
    const shortEntrySize = toWhole(highestHigh[i] - close + stop);

    plot0.push({ time: t, value: atrWhole });
    plot1.push({ time: t, value: longEntrySize });
    plot2.push({ time: t, value: longEntrySize * riskRatio });
    plot3.push({ time: t, value: shortEntrySize });
    plot4.push({ time: t, value: shortEntrySize * riskRatio });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2, 'plot3': plot3, 'plot4': plot4 },
  };
}

export const ATRPlus = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
