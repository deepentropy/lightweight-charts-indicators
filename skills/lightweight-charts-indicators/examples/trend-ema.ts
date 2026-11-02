/**
 * Example: an overlay indicator (drawn on the price pane).
 *
 * An EMA of the chosen source, green while it rises and red while it falls. The module has the shape of every file
 * in src/standard and src/community (metadata, defaultInputs, inputConfig, plotConfig, calculate, one module object),
 * plus `registryEntry`: the object a registry part of src/index.ts holds for it.
 */

import { ta, getSourceSeries, type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type SourceType } from 'oakscriptjs';
import type { IndicatorRegistryEntry } from 'lightweight-charts-indicators';

export interface TrendEmaInputs {
  /** EMA length */
  length: number;
  /** Price source */
  src: SourceType;
}

export const defaultInputs: TrendEmaInputs = {
  length: 21,
  src: 'close',
};

/** One row per input: `id` is the key in the inputs object, `defval` repeats the default value */
export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 21, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

const RISING = '#089981';
const FALLING = '#F23645';

/** One row per line plot: `id` is the key of its points in the result's `plots` */
export const plotConfig: PlotConfig[] = [
  // coloured per bar from a fixed set: `palette` lets a host recolour each of them
  { id: 'plot0', title: 'EMA', color: RISING, lineWidth: 2, palette: [RISING, FALLING] },
];

export const metadata = {
  title: 'Trend EMA',
  shortTitle: 'Trend EMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TrendEmaInputs> = {}): IndicatorResult {
  const { length, src } = { ...defaultInputs, ...inputs };
  const ema = ta.ema(getSourceSeries(bars, src), length).toArray().map((v) => v ?? NaN);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      // one point per bar, NaN where there is no value (warm-up)
      plot0: bars.map((b, i) => ({
        time: b.time,
        value: ema[i],
        color: i > 0 && ema[i] < ema[i - 1] ? FALLING : RISING,
      })),
    },
  };
}

export const TrendEma = { calculate, metadata, defaultInputs, inputConfig, plotConfig };

/** The registry entry (src/index.ts): `overlay` must equal `metadata.overlay` */
export const registryEntry: IndicatorRegistryEntry = {
  id: 'trend-ema',
  group: 'community',
  name: 'Trend EMA',
  shortName: metadata.shortTitle,
  description: 'Exponential moving average coloured by its direction.',
  category: 'Moving Averages',
  overlay: metadata.overlay,
  metadata,
  inputConfig,
  plotConfig,
  defaultInputs: { ...defaultInputs },
  calculate,
};
