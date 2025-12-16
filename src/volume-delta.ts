/**
 * Volume Delta Indicator
 *
 * Approximates up/down volume by comparing close to open price.
 * When close > open, volume is considered buying pressure (up volume).
 * When close < open, volume is considered selling pressure (down volume).
 * Delta = upVolume - downVolume
 *
 * Note: TradingView's version uses intrabar data for more precise calculation.
 * This implementation uses close vs open as an approximation.
 *
 * Based on TradingView's Volume Delta indicator.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface VolumeDeltaInputs {
  // No configurable inputs in the standard indicator
}

export const defaultInputs: VolumeDeltaInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Open Volume', color: '#26A69A', lineWidth: 1 },
  { id: 'plot1', title: 'Max Volume', color: '#26A69A', lineWidth: 1 },
  { id: 'plot2', title: 'Min Volume', color: '#26A69A', lineWidth: 1 },
  { id: 'plot3', title: 'Close Volume', color: '#26A69A', lineWidth: 1 },
];

export const metadata = {
  title: 'Volume Delta',
  shortTitle: 'Vol Delta',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<VolumeDeltaInputs> = {}): IndicatorResult {
  const openValues: number[] = [];
  const maxValues: number[] = [];
  const minValues: number[] = [];
  const closeValues: number[] = [];

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const volume = bar.volume ?? 0;

    // Determine up/down volume based on close vs open
    let delta: number;
    if (bar.close > bar.open) {
      // Bullish bar - all volume is "up volume"
      delta = volume;
    } else if (bar.close < bar.open) {
      // Bearish bar - all volume is "down volume"
      delta = -volume;
    } else {
      // Neutral bar - no clear direction
      delta = 0;
    }

    // For candle representation:
    // open = 0, close = delta
    // high = max(0, delta), low = min(0, delta)
    const openVol = 0;
    const closeVol = delta;
    const maxVol = Math.max(0, delta);
    const minVol = Math.min(0, delta);

    openValues.push(openVol);
    maxValues.push(maxVol);
    minValues.push(minVol);
    closeValues.push(closeVol);
  }

  const openData = openValues.map((value, i) => ({
    time: bars[i].time,
    value: value,
  }));

  const maxData = maxValues.map((value, i) => ({
    time: bars[i].time,
    value: value,
  }));

  const minData = minValues.map((value, i) => ({
    time: bars[i].time,
    value: value,
  }));

  const closeData = closeValues.map((value, i) => ({
    time: bars[i].time,
    value: value,
  }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': openData,
      'plot1': maxData,
      'plot2': minData,
      'plot3': closeData,
    },
  };
}

export const VolumeDelta = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
