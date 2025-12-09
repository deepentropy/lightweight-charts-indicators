/**
 * Vortex Indicator
 *
 * Identifies the start of a new trend or the continuation of an existing trend.
 * Consists of two oscillators: VI+ (positive) and VI- (negative).
 */

import { ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VortexInputs {
  /** Period length */
  length: number;
}

export const defaultInputs: VortexInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VI +', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'VI -', color: '#E91E63', lineWidth: 1 },
];

export const metadata = {
  title: 'Vortex Indicator',
  shortTitle: 'VI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<VortexInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  // VM+ = |high - low[1]|
  // VM- = |low - high[1]|
  // True Range = max(high - low, |high - close[1]|, |low - close[1]|)
  // VI+ = sum(VM+, length) / sum(TR, length)
  // VI- = sum(VM-, length) / sum(TR, length)

  const vmPlus: number[] = [NaN];
  const vmMinus: number[] = [NaN];
  const trueRange: number[] = [NaN];

  for (let i = 1; i < bars.length; i++) {
    const high = bars[i].high;
    const low = bars[i].low;
    const prevHigh = bars[i - 1].high;
    const prevLow = bars[i - 1].low;
    const prevClose = bars[i - 1].close;

    vmPlus.push(Math.abs(high - prevLow));
    vmMinus.push(Math.abs(low - prevHigh));

    const tr = Math.max(
      high - low,
      Math.abs(high - prevClose),
      Math.abs(low - prevClose)
    );
    trueRange.push(tr);
  }

  // Calculate VI+ and VI-
  const viPlusValues: number[] = [];
  const viMinusValues: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    if (i < length) {
      viPlusValues.push(NaN);
      viMinusValues.push(NaN);
      continue;
    }

    let sumVMPlus = 0;
    let sumVMMinus = 0;
    let sumTR = 0;

    for (let j = i - length + 1; j <= i; j++) {
      if (!isNaN(vmPlus[j])) sumVMPlus += vmPlus[j];
      if (!isNaN(vmMinus[j])) sumVMMinus += vmMinus[j];
      if (!isNaN(trueRange[j])) sumTR += trueRange[j];
    }

    if (sumTR === 0) {
      viPlusValues.push(NaN);
      viMinusValues.push(NaN);
    } else {
      viPlusValues.push(sumVMPlus / sumTR);
      viMinusValues.push(sumVMMinus / sumTR);
    }
  }

  const viPlusData = viPlusValues.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const viMinusData = viMinusValues.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': viPlusData,
      'plot1': viMinusData,
    },
  };
}

export const VortexIndicator = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
