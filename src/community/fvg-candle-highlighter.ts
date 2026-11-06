/**
 * FVG Candle Highlighter
 *
 * A fair value gap on bar i: a bullish gap when the low of bar i is above the high of bar i - 2, a bearish gap when
 * the high of bar i is below the low of bar i - 2. The middle bar i - 1 (the bar that made the gap) is coloured lime
 * (bullish) or red (bearish), 70 % transparent (barcolor with offset -1).
 *
 * Reference: "FVG Candle Highlighter" by SmellyTaz
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// The Pine script has no inputs
export interface FvgCandleHighlighterInputs {}

export const defaultInputs: FvgCandleHighlighterInputs = {};

export const inputConfig: InputConfig[] = [];

// No plot(): the only output is a bar colour
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'FVG Candle Highlighter',
  shortTitle: 'FVG Candle Highlighter',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = IndicatorResult & { barColors: BarColorData[] };

interface FvgRun extends BarRunState<Record<string, never>> {
  barColors: BarColorData[];
}

function study(): BarStudy<FvgRun, Result> {
  const bullColor = String(color.new(color.lime, 70));
  const bearColor = String(color.new(color.red, 70));
  return {
    init() {
      const s: FvgRun = { barColors: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.barColors];
      return s;
    },
    bar(s, i, bars) {
      // bars 0 and 1: high[2] / low[2] are na, no gap
      if (i < 2) return;
      const isBullFVG = gt(bars[i].low, bars[i - 2].high);
      const isBearFVG = lt(bars[i].high, bars[i - 2].low);
      // barcolor(..., offset = -1): the colour of bar i is drawn on bar i - 1
      if (isBullFVG) s.barColors.push({ time: bars[i - 1].time, color: bullColor });
      else if (isBearFVG) s.barColors.push({ time: bars[i - 1].time, color: bearColor });
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
export function createRun(_inputs: Partial<FvgCandleHighlighterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(
  bars: Bar[],
  _inputs: Partial<FvgCandleHighlighterInputs> = {},
): Result {
  return fullResult(createRun(_inputs).update(bars));
}

export const FvgCandleHighlighter = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
