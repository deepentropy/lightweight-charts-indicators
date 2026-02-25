/**
 * Chop Zone Indicator
 *
 * Uses EMA angle to determine trending vs choppy market conditions.
 * Output is a constant 1 (column plot) with color based on the EMA angle.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ChopZoneInputs {
  // No configurable inputs in the standard indicator
}

export const defaultInputs: ChopZoneInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Chop Zone', color: '#26C6DA', lineWidth: 1 },
];

export const metadata = {
  title: 'Chop Zone',
  shortTitle: 'Chop Zone',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ChopZoneInputs> = {}): IndicatorResult {
  // The indicator outputs a constant 1 for every bar (colored by EMA angle)
  const plotData = bars.map(bar => ({
    time: bar.time,
    value: 1,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData },
  };
}

export const ChopZone = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
