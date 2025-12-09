/**
 * Ultimate Oscillator Indicator
 *
 * Multi-timeframe momentum oscillator that uses weighted average of three periods.
 * Designed to capture momentum across short, medium, and long-term periods.
 *
 * Based on TradingView's Ultimate Oscillator indicator.
 */

import type { Bar } from 'oakscriptjs';
import type { InputConfig, PlotConfig } from './index.js';

export interface UltimateOscillatorInputs {
  /** Fast period length */
  length1: number;
  /** Medium period length */
  length2: number;
  /** Slow period length */
  length3: number;
}

export const defaultInputs: UltimateOscillatorInputs = {
  length1: 7,
  length2: 14,
  length3: 28,
};

export const inputConfig: InputConfig[] = [
  { id: 'length1', type: 'int', title: 'Fast Length', defval: 7, min: 1 },
  { id: 'length2', type: 'int', title: 'Middle Length', defval: 14, min: 1 },
  { id: 'length3', type: 'int', title: 'Slow Length', defval: 28, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'UO', color: '#F44336', lineWidth: 2 },
];

export const metadata = {
  title: 'Ultimate Oscillator',
  shortTitle: 'UO',
  overlay: false,
};

/**
 * Calculate sum over a period
 */
function sumOver(values: number[], index: number, length: number): number {
  let sum = 0;
  const start = Math.max(0, index - length + 1);
  for (let i = start; i <= index; i++) {
    sum += values[i];
  }
  return sum;
}

/**
 * Calculate Ultimate Oscillator
 *
 * Algorithm:
 * 1. Calculate True Range: max(high, close[1]) - min(low, close[1])
 * 2. Calculate Buying Pressure: close - min(low, close[1])
 * 3. Calculate average BP/TR for each period
 * 4. Combine with weights: 100 * (4*avg1 + 2*avg2 + avg3) / 7
 */
export function calculate(bars: Bar[], inputs: Partial<UltimateOscillatorInputs> = {}): ReturnType<typeof import('./index.js').SMA.calculate> {
  const { length1, length2, length3 } = { ...defaultInputs, ...inputs };

  const bp: number[] = [];
  const tr: number[] = [];

  // Calculate Buying Pressure and True Range
  for (let i = 0; i < bars.length; i++) {
    if (i === 0) {
      bp.push(0);
      tr.push(bars[i].high - bars[i].low);
    } else {
      const prevClose = bars[i - 1].close;
      const high_ = Math.max(bars[i].high, prevClose);
      const low_ = Math.min(bars[i].low, prevClose);

      bp.push(bars[i].close - low_);
      tr.push(high_ - low_);
    }
  }

  // Calculate Ultimate Oscillator
  const uo: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    const sumBP1 = sumOver(bp, i, length1);
    const sumTR1 = sumOver(tr, i, length1);
    const sumBP2 = sumOver(bp, i, length2);
    const sumTR2 = sumOver(tr, i, length2);
    const sumBP3 = sumOver(bp, i, length3);
    const sumTR3 = sumOver(tr, i, length3);

    const avg1 = sumTR1 !== 0 ? sumBP1 / sumTR1 : 0;
    const avg2 = sumTR2 !== 0 ? sumBP2 / sumTR2 : 0;
    const avg3 = sumTR3 !== 0 ? sumBP3 / sumTR3 : 0;

    // Weighted combination: 4:2:1
    const value = 100 * (4 * avg1 + 2 * avg2 + avg3) / 7;
    uo.push(value);
  }

  // Warmup period is the longest length
  const warmup = length3;

  const plotData = uo.map((value, i) => ({
    time: bars[i].time,
    value: i < warmup ? NaN : value,
  }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': plotData,
    },
  };
}

export const UltimateOscillator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
