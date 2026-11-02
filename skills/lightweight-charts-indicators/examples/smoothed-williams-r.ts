/**
 * Example: an oscillator in its own pane.
 *
 * Williams %R (0 at the highest high of the period, -100 at the lowest low) with an EMA signal line, three
 * horizontal levels and a background fill between the upper and lower levels. Levels and the fill that do not change
 * with the inputs are declared once (`hlineConfig`, `fillConfig`) instead of being returned by `calculate`.
 */

import { ta, type Bar, type FillConfig, type HLineConfig, type IndicatorResult, type InputConfig, type PlotConfig } from 'oakscriptjs';
import type { IndicatorRegistryEntry } from 'lightweight-charts-indicators';

export interface SmoothedWilliamsRInputs {
  /** %R period */
  length: number;
  /** EMA length of the signal line */
  signalLength: number;
}

export const defaultInputs: SmoothedWilliamsRInputs = {
  length: 14,
  signalLength: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1, group: 'Signal' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '%R', color: '#7E57C2', lineWidth: 1 },
  { id: 'plot1', title: 'Signal', color: '#FF6D00', lineWidth: 1 },
];

/** Horizontal levels: `id` is what a fill names in plot1 / plot2 */
export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: -20, color: '#787B86', linestyle: 'dashed', title: 'Upper Band' },
  { id: 'hline_mid', price: -50, color: '#787B8680', linestyle: 'dotted', title: 'Middle Level' },
  { id: 'hline_lower', price: -80, color: '#787B86', linestyle: 'dashed', title: 'Lower Band' },
];

/** A fill between two hlines is drawn from the declaration alone */
export const fillConfig: FillConfig[] = [
  { id: 'fill_band', plot1: 'hline_upper', plot2: 'hline_lower', color: '#7E57C21A', title: 'Background' },
];

export const metadata = {
  title: 'Smoothed Williams %R',
  shortTitle: '%R+',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<SmoothedWilliamsRInputs> = {}): IndicatorResult {
  const { length, signalLength } = { ...defaultInputs, ...inputs };
  const wpr = ta.wpr(bars, length);
  const signal = ta.ema(wpr, signalLength);
  const toPoints = (values: (number | null | undefined)[]) =>
    values.map((v, i) => ({ time: bars[i].time, value: v ?? NaN }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      plot0: toPoints(wpr.toArray()),
      plot1: toPoints(signal.toArray()),
    },
  };
}

export const SmoothedWilliamsR = { calculate, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig };

export const registryEntry: IndicatorRegistryEntry = {
  id: 'smoothed-williams-r',
  group: 'community',
  name: 'Smoothed Williams %R',
  shortName: metadata.shortTitle,
  description: 'Williams %R with an EMA signal line and overbought / oversold levels.',
  category: 'Oscillators',
  overlay: metadata.overlay,
  metadata,
  inputConfig,
  plotConfig,
  hlineConfig,
  fillConfig,
  defaultInputs: { ...defaultInputs },
  calculate,
};
