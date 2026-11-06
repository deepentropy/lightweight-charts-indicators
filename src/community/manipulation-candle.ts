/**
 * Manipulation Candle
 *
 * Colours a bar that takes the extreme of the previous bar and closes beyond the body of the previous bar on the
 * other side. Buy: the low is under the previous low and the close is above the previous body top (max of open and
 * close). Sell: the high is above the previous high and the close is under the previous body bottom. Buy has
 * priority when both are true. The script has no plot: the only output is the bar colour.
 *
 * Reference: "[RealEdgeFX] - Manipulation Candle" by DrauzioFx
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ManipulationCandleInputs {}

export const defaultInputs: ManipulationCandleInputs = {};

export const inputConfig: InputConfig[] = [];

// No plot: bar colours only
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Manipulation Candle',
  shortTitle: 'Manipulation Candle',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

const BUY_COLOR = String(color.rgb(165, 214, 167, 18));
const SELL_COLOR = String(color.rgb(161, 79, 58, 40));

type Result = Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] };

interface ManipulationRun extends BarRunState<Record<string, never>> {
  barColors: BarColorData[];
}

function study(): BarStudy<ManipulationRun, Result> {
  return {
    init() {
      const s: ManipulationRun = { barColors: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.barColors];
      return s;
    },
    bar(s, i, bars) {
      if (i < 1) return;
      const prev = bars[i - 1];
      const cur = bars[i];
      const bodyHighPrev = Math.max(prev.open, prev.close);
      const bodyLowPrev = Math.min(prev.open, prev.close);
      const isSell = gt(cur.high, prev.high) && lt(cur.close, bodyLowPrev);
      const isBuy = lt(cur.low, prev.low) && gt(cur.close, bodyHighPrev);
      if (isBuy) s.barColors.push({ time: cur.time, color: BUY_COLOR });
      else if (isSell) s.barColors.push({ time: cur.time, color: SELL_COLOR });
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
export function createRun(_inputs: Partial<ManipulationCandleInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<ManipulationCandleInputs> = {}): Result {
  return fullResult(createRun(_inputs).update(bars));
}

export const ManipulationCandle = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
