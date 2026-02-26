/**
 * Volume Delta Indicator
 *
 * Approximates up/down volume by comparing close to open price.
 * When close > open, volume is considered buying pressure (up volume).
 * When close < open, volume is considered selling pressure (down volume).
 * Delta = upVolume - downVolume
 *
 * PineScript display:
 *   hline(0)
 *   plotcandle(openVolume, maxVolume, minVolume, lastVolume, "Volume Delta", color=col, bordercolor=col, wickcolor=col)
 *
 * Note: TradingView's version uses intrabar data for more precise calculation.
 * This implementation uses close vs open as an approximation.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar } from 'oakscriptjs';
import type { PlotCandleData } from '../types';

export interface VolumeDeltaInputs {
  // No configurable inputs in the standard indicator
}

export const defaultInputs: VolumeDeltaInputs = {};

export const inputConfig: InputConfig[] = [];

// No line plots — rendered via plotCandles
export const plotConfig: PlotConfig[] = [];

export const plotCandleConfig = [
  { id: 'delta', title: 'Volume Delta' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_zero', price: 0, color: '#787B86', linestyle: 'solid', title: 'Zero' },
];

export const metadata = {
  title: 'Volume Delta',
  shortTitle: 'Vol Delta',
  overlay: false,
};

export function calculate(bars: Bar[], _inputs: Partial<VolumeDeltaInputs> = {}): IndicatorResult & { plotCandles: Record<string, PlotCandleData[]> } {
  const candles: PlotCandleData[] = [];

  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const volume = bar.volume ?? 0;

    let delta: number;
    if (bar.close > bar.open) {
      delta = volume;
    } else if (bar.close < bar.open) {
      delta = -volume;
    } else {
      delta = 0;
    }

    // open=0, close=delta, high=max(0,delta), low=min(0,delta)
    const col = delta >= 0 ? '#26A69A' : '#EF5350';
    candles.push({
      time: bar.time as number,
      open: 0,
      high: Math.max(0, delta),
      low: Math.min(0, delta),
      close: delta,
      color: col,
      borderColor: col,
      wickColor: col,
    });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    plotCandles: { delta: candles },
  };
}

export const VolumeDelta = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  plotCandleConfig,
  hlineConfig,
};
