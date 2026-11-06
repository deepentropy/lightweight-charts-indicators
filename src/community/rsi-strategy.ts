/**
 * RSI Strategy (bar colours)
 *
 * RSI of the close. The state is 1 when the RSI is above the overbought level, -1 when it is below the oversold
 * level, and keeps its previous value (0 at the start) in between. Bars are coloured red for -1, green for 1 and
 * blue otherwise. No plot.
 *
 * Reference: "Strategy RSI" by HPotter
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright by HPotter v1.0 19/05/2014
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RsiStrategyInputs {
  length: number;
  oversold: number;
  overbought: number;
}

export const defaultInputs: RsiStrategyInputs = {
  length: 12,
  oversold: 30,
  overbought: 70,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 12, min: 1 },
  { id: 'oversold', type: 'int', title: 'Oversold', defval: 30, min: 1 },
  { id: 'overbought', type: 'int', title: 'Overbought', defval: 70, min: 1 },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Strategy RSI',
  shortTitle: 'Strategy RSI',
  overlay: true,
};

// Pine comparison: a > b only when a - b > 1e-10; na compares false
const EPS = 1e-10;

type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface RsiStrategyRun extends BarRunState<{ pos: number }> {
  rsi: ReturnType<typeof taStep.rsi>;
  barColors: BarColorData[];
}

function study(inputs: Partial<RsiStrategyInputs>): BarStudy<RsiStrategyRun, Result> {
  const { length, oversold, overbought } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const rsi = taStep.rsi(length);
      const s: RsiStrategyRun = { rsi, barColors: [], steps: [rsi], vars: { pos: 0 }, lists: [], series: [] };
      s.lists = [s.barColors];
      return s;
    },
    bar(s, i, bars) {
      const r = s.rsi.step(bars[i]!.close);
      const v = r == null || Number.isNaN(r) ? NaN : r;
      const vars = s.vars;
      if (v - overbought > EPS) vars.pos = 1;
      else if (oversold - v > EPS) vars.pos = -1;
      // else: nz(pos[1], 0), the previous value
      const pos = vars.pos;
      s.barColors.push({ time: bars[i]!.time as number, color: pos === -1 ? '#FF0000' : pos === 1 ? '#008000' : '#0000FF' });
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RsiStrategyInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RsiStrategyInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const RsiStrategy = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
