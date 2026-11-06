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
  taStep, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType, type FillConfig,
} from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

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

type Point = { time: number; value: number };

interface FillRun extends BarRunState<Record<string, never>> {
  e1: ReturnType<typeof taStep.ema>;
  e2: ReturnType<typeof taStep.ema>;
  plot0: Point[];
  plot1: Point[];
  colors: string[];
}

function study(inputs: Partial<MovingAverageShadedFillAreaCrossoverEmaInputs>): BarStudy<FillRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const e1 = taStep.ema(cfg.ema1);
      const e2 = taStep.ema(cfg.ema2);
      const s: FillRun = { e1, e2, plot0: [], plot1: [], colors: [], steps: [e1, e2], vars: {}, lists: [], series: [] };
      s.series = [s.plot0, s.plot1, s.colors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = value(b);
      const pema1 = s.e1.step(v);
      const pema2 = s.e2.step(v);
      s.plot0[i] = { time: b.time as number, value: pema1 };
      s.plot1[i] = { time: b.time as number, value: pema2 };
      // pema1 > pema2 (Pine > with 1e-10; na compares false)
      s.colors[i] = pema1 - pema2 > 1e-10 ? FILL_UP : FILL_DN;
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
        fills: [{ id: 'fill0', plot1: 'plot0', plot2: 'plot1', options: { title: 'Plots Background' }, colors: s.colors.slice() }],
      } as IndicatorResult;
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MovingAverageShadedFillAreaCrossoverEmaInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MovingAverageShadedFillAreaCrossoverEmaInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MovingAverageShadedFillAreaCrossoverEma = {
  calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig, fillConfig,
};
