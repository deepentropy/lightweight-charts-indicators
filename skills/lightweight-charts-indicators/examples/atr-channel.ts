/**
 * Example: an indicator with several plots, fills and markers.
 *
 * An EMA basis with bands at +/- ATR * multiplier. The zone between the basis and the upper band is tinted while the
 * close is above the basis, the lower zone while it is below. A marker shows each close that breaks out of the
 * channel.
 *
 * Fills between plots are part of the result (`fills`), one colour per bar in `colors`; the `fillConfig` rows declare
 * them for a host's Style settings and carry the same `id`. Markers carry the `id` of their `shapeConfig` row.
 */

import {
  ta,
  getSourceSeries,
  type Bar,
  type FillConfig,
  type FillData,
  type IndicatorResult,
  type InputConfig,
  type MarkerData,
  type PlotConfig,
  type ShapeConfig,
} from 'oakscriptjs';
import type { IndicatorRegistryEntry } from 'lightweight-charts-indicators';

export interface AtrChannelInputs {
  length: number;
  atrLength: number;
  mult: number;
  showBreakouts: boolean;
}

export const defaultInputs: AtrChannelInputs = {
  length: 20,
  atrLength: 14,
  mult: 2,
  showBreakouts: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Basis Length', defval: 20, min: 1 },
  { id: 'atrLength', type: 'int', title: 'ATR Length', defval: 14, min: 1, group: 'Bands', inline: 'atr' },
  { id: 'mult', type: 'float', title: 'Multiplier', defval: 2, min: 0.1, step: 0.1, group: 'Bands', inline: 'atr' },
  { id: 'showBreakouts', type: 'bool', title: 'Show breakouts', defval: true, group: 'Signals' },
];

const BASIS = '#2962FF';
const UPPER = '#089981';
const LOWER = '#F23645';
const UP_ZONE = 'rgba(8, 153, 129, 0.15)';
const DOWN_ZONE = 'rgba(242, 54, 69, 0.15)';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Basis', color: BASIS, lineWidth: 1 },
  { id: 'plot1', title: 'Upper', color: UPPER, lineWidth: 1 },
  { id: 'plot2', title: 'Lower', color: LOWER, lineWidth: 1 },
];

/** Style declarations of the fills between plots (drawn from the result's `fills`) */
export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot1', plot2: 'plot0', title: 'Upper Zone', palette: [UP_ZONE] },
  { id: 'fill1', plot1: 'plot0', plot2: 'plot2', title: 'Lower Zone', palette: [DOWN_ZONE] },
];

/** plotshape() declarations: the markers of the result with the same `id` belong to them */
export const shapeConfig: ShapeConfig[] = [
  { id: 'shape0', kind: 'shape', title: 'Breakout Up', style: 'arrowup', location: 'belowbar', color: UPPER },
  { id: 'shape1', kind: 'shape', title: 'Breakout Down', style: 'arrowdown', location: 'abovebar', color: LOWER },
];

export const metadata = {
  title: 'ATR Channel',
  shortTitle: 'ATR Ch',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<AtrChannelInputs> = {}): IndicatorResult {
  const { length, atrLength, mult, showBreakouts } = { ...defaultInputs, ...inputs };
  const basis = ta.ema(getSourceSeries(bars, 'close'), length).toArray().map((v) => v ?? NaN);
  const atr = ta.atr(bars, atrLength).toArray().map((v) => v ?? NaN);
  const upper = basis.map((b, i) => b + atr[i] * mult);
  const lower = basis.map((b, i) => b - atr[i] * mult);
  const points = (values: number[]) => values.map((value, i) => ({ time: bars[i].time, value }));

  // A colour per bar; 'transparent' draws nothing on that bar
  const fills: FillData[] = [
    {
      id: 'fill0', plot1: 'plot1', plot2: 'plot0', options: { title: 'Upper Zone' },
      colors: bars.map((b, i) => (b.close > basis[i] ? UP_ZONE : 'transparent')),
    },
    {
      id: 'fill1', plot1: 'plot0', plot2: 'plot2', options: { title: 'Lower Zone' },
      colors: bars.map((b, i) => (b.close < basis[i] ? DOWN_ZONE : 'transparent')),
    },
  ];

  const markers: MarkerData[] = [];
  if (showBreakouts) {
    for (let i = 1; i < bars.length; i++) {
      const close = bars[i].close;
      const prev = bars[i - 1].close;
      if (close > upper[i] && !(prev > upper[i - 1])) {
        markers.push({ id: 'shape0', time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: UPPER });
      } else if (close < lower[i] && !(prev < lower[i - 1])) {
        markers.push({ id: 'shape1', time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: LOWER });
      }
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: points(basis), plot1: points(upper), plot2: points(lower) },
    fills,
    markers,
  };
}

export const AtrChannel = { calculate, metadata, defaultInputs, inputConfig, plotConfig, fillConfig, shapeConfig };

export const registryEntry: IndicatorRegistryEntry = {
  id: 'atr-channel',
  group: 'community',
  name: 'ATR Channel',
  shortName: metadata.shortTitle,
  description: 'EMA basis with ATR bands, trend-tinted zones and breakout markers.',
  category: 'Channels & Bands',
  overlay: metadata.overlay,
  metadata,
  inputConfig,
  plotConfig,
  fillConfig,
  shapeConfig,
  defaultInputs: { ...defaultInputs },
  calculate,
};
