/**
 * Pullback Depth
 *
 * Number of bars back to the last bar with a lower low than the current low, searched over at most `lookback` bars
 * (and at most bar_index bars). When no lower low is found the count is the search length. The histogram shows the
 * count as a negative value: a deep bar means the current low is the lowest for a long time.
 *
 * Reference: "Pullback Depth" by TradeStation
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PullbackDepthInputs {
  /** Maximum number of bars searched back */
  lookback: number;
}

export const defaultInputs: PullbackDepthInputs = {
  lookback: 125,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Max Lookback Bars', defval: 125, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bars Since Lower Low', color: color.red, lineWidth: 2, style: 'histogram' },
];

export const metadata = {
  title: 'Pullback Depth',
  shortTitle: 'Pullback Depth',
  overlay: false,
};

/** Pine float comparisons: a < b only when b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };

interface PullbackRun extends BarRunState<Record<string, never>> {
  plot0: Point[];
}

function study(inputs: Partial<PullbackDepthInputs>): BarStudy<PullbackRun, IndicatorResult> {
  const { lookback } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: PullbackRun = { plot0: [], steps: [], vars: {}, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // actualLookback = math.max(1, math.min(lookback, bar_index))
      const actualLookback = Math.max(1, Math.min(lookback, i));
      let barsBack = NaN;
      if (i > 0) {
        barsBack = actualLookback;
        const low = b.low;
        for (let k = 1; k <= actualLookback; k++) {
          // low[k] < low (low[k] before the first bar is na: false)
          if (i - k >= 0 && lt(bars[i - k].low, low)) {
            barsBack = k;
            break;
          }
        }
      }
      s.plot0[i] = { time: b.time, value: -barsBack, color: color.red };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: [{ value: 0, options: { title: 'Zero', color: String(color.new(color.gray, 70)), linestyle: 'dashed' } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PullbackDepthInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PullbackDepthInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const PullbackDepth = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
