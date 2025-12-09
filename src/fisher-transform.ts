/**
 * Fisher Transform Indicator
 *
 * Converts prices into a Gaussian normal distribution, making
 * turning points easier to identify.
 *
 * Based on TradingView's Fisher Transform indicator.
 */

import type { Bar } from 'oakscriptjs';
import type { InputConfig, PlotConfig } from './index.js';

export interface FisherTransformInputs {
  /** Lookback period for highest/lowest calculation */
  length: number;
}

export const defaultInputs: FisherTransformInputs = {
  length: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 9, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fisher', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'Trigger', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'Fisher Transform',
  shortTitle: 'Fisher',
  overlay: false,
};

/**
 * Calculate Fisher Transform
 *
 * Algorithm:
 * 1. Calculate hl2 (midpoint of high and low)
 * 2. Normalize to range [-1, 1] using highest/lowest over length
 * 3. Apply smoothing with previous value
 * 4. Apply Fisher Transform: 0.5 * ln((1+x)/(1-x))
 */
export function calculate(bars: Bar[], inputs: Partial<FisherTransformInputs> = {}): ReturnType<typeof import('./index.js').SMA.calculate> {
  const { length } = { ...defaultInputs, ...inputs };

  const fisher: number[] = [];
  const trigger: number[] = [];

  let value = 0;
  let fish1 = 0;

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const hl2 = (bar.high + bar.low) / 2;

    // Find highest and lowest hl2 over length period
    let highestHl2 = hl2;
    let lowestHl2 = hl2;
    const lookback = Math.min(i + 1, length);

    for (let j = 0; j < lookback; j++) {
      const prevBar = bars[i - j];
      const prevHl2 = (prevBar.high + prevBar.low) / 2;
      if (prevHl2 > highestHl2) highestHl2 = prevHl2;
      if (prevHl2 < lowestHl2) lowestHl2 = prevHl2;
    }

    // Normalize hl2 to [-0.5, 0.5] range, then apply coefficient and smooth
    const range = highestHl2 - lowestHl2;
    const normalized = range !== 0 ? (hl2 - lowestHl2) / range - 0.5 : 0;

    // Apply 0.66 coefficient and smooth with 0.67 of previous value
    const rawValue = 0.66 * normalized + 0.67 * value;

    // Clamp to avoid infinity in log calculation
    value = rawValue > 0.99 ? 0.999 : rawValue < -0.99 ? -0.999 : rawValue;

    // Apply Fisher Transform with smoothing
    const prevFish1 = fish1;
    fish1 = 0.5 * Math.log((1 + value) / (1 - value)) + 0.5 * prevFish1;

    fisher.push(fish1);
    trigger.push(prevFish1); // Trigger is previous Fisher value
  }

  const plotData0 = fisher.map((value, i) => ({
    time: bars[i].time,
    value: i < length - 1 ? NaN : value,
  }));

  const plotData1 = trigger.map((value, i) => ({
    time: bars[i].time,
    value: i < length ? NaN : value,
  }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': plotData0,
      'plot1': plotData1,
    },
  };
}

export const FisherTransform = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
