/**
 * Moving Average Shaded Fill Area Crossover EMA
 *
 * Two EMAs of the source (lengths 21 and 55) with a fill between them: green while EMA-1 is above EMA-2, red
 * otherwise (also while one of them is na), with a transparency of 85.
 *
 * Pine version 2: plots have the default transparency of that version (35), and its green / red colours.
 *
 * Reference: "Moving Average Shaded Fill Area Crossover EMA Color - Editable" by aballard11
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  ta, color, getSourceSeries,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType, type FillConfig,
} from 'oakscriptjs';

export interface MovingAverageShadedFillAreaCrossoverEmaInputs {
  src: SourceType;
  ema1: number;
  ema2: number;
}

export const defaultInputs: MovingAverageShadedFillAreaCrossoverEmaInputs = {
  src: 'close',
  ema1: 21,
  ema2: 55,
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'src', defval: 'close' },
  { id: 'ema1', type: 'int', title: 'EMA-1', defval: 21 },
  { id: 'ema2', type: 'int', title: 'EMA-2', defval: 55 },
];

// Default plot transparency of Pine version 2 (35)
const EMA1_COLOR = String(color.new('#2ECC71', 35));
const EMA2_COLOR = String(color.new('#F00B0B', 35));
// Version 2 green / red with transp = 85
const FILL_UP = String(color.new('#008000', 85));
const FILL_DN = String(color.new('#FF0000', 85));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA-1', color: EMA1_COLOR, lineWidth: 1 },
  { id: 'plot1', title: 'EMA 2', color: EMA2_COLOR, lineWidth: 1 },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill0', plot1: 'plot0', plot2: 'plot1', title: 'Plots Background', color: FILL_UP },
];

export const metadata = {
  title: 'Moving Average Shaded Fill Area Crossover EMA',
  shortTitle: 'EMA Fill',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<MovingAverageShadedFillAreaCrossoverEmaInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const src = getSourceSeries(bars, cfg.src);
  const pema1 = ta.ema(src, cfg.ema1).toArray().map((v) => v ?? NaN);
  const pema2 = ta.ema(src, cfg.ema2).toArray().map((v) => v ?? NaN);

  const plot0 = bars.map((b, i) => ({ time: b.time, value: pema1[i] }));
  const plot1 = bars.map((b, i) => ({ time: b.time, value: pema2[i] }));
  // pema1 > pema2 (Pine > with 1e-10; na compares false)
  const colors = bars.map((_b, i) => (pema1[i] - pema2[i] > 1e-10 ? FILL_UP : FILL_DN));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    fills: [{ id: 'fill0', plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' }, colors }],
  } as IndicatorResult;
}

export const MovingAverageShadedFillAreaCrossoverEma = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, fillConfig,
};
