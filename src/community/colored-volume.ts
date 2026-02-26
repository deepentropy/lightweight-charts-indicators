/**
 * Colored Volume Bars
 *
 * Colors volume bars based on price/volume trend comparison:
 * - Green: price up + volume up
 * - Blue: price up + volume down
 * - Orange: price down + volume down
 * - Red: price down + volume up
 *
 * Reference: TradingView "Colored Volume Bars" by LazyBear
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ColoredVolumeInputs {
  lookback: number;
}

export const defaultInputs: ColoredVolumeInputs = {
  lookback: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Lookback', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Volume', color: '#787B86', lineWidth: 1 },
];

export const metadata = {
  title: 'Colored Volume Bars',
  shortTitle: 'CVolBars',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<ColoredVolumeInputs> = {}): IndicatorResult {
  const { lookback } = { ...defaultInputs, ...inputs };

  const data = bars.map((bar, i) => {
    const vol = bar.volume ?? 0;
    if (i < lookback) return { time: bar.time, value: NaN };

    return { time: bar.time, value: vol };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': data },
  };
}

export const ColoredVolume = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
