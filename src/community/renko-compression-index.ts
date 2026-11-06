/**
 * Renko Compression Index (RCI)
 *
 * The direction of a bar is +1 when the close rises, -1 when it falls and 0 otherwise. The index counts the
 * direction switches between consecutive bars in the window from `length` bars back to 1 bar back, as a percentage of
 * the `length - 1` pairs: a high value means a choppy (compressed) market, a low value a trending one. It is 0 before
 * the window is full. Horizontal lines at 80, 50 and 20.
 *
 * Reference: "Renko Compression Index (RCI)" by nasu_is_gaji
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RenkoCompressionIndexInputs {
  /** Lookback length (number of directions compared) */
  rciLength: number;
}

export const defaultInputs: RenkoCompressionIndexInputs = {
  rciLength: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'rciLength', type: 'int', title: 'RCI Lookback Length', defval: 10, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RCI', color: color.orange, lineWidth: 2 },
];

export const metadata = {
  title: 'Renko Compression Index (RCI)',
  shortTitle: 'Renko Compression Index (RCI)',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color?: string };

interface RciRun extends BarRunState<Record<string, never>> {
  direction: number[];
  plot0: Point[];
}

function study(inputs: Partial<RenkoCompressionIndexInputs>): BarStudy<RciRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const len = cfg.rciLength;
  return {
    init() {
      const s: RciRun = { direction: [], plot0: [], steps: [], vars: {}, lists: [], series: [] };
      s.series = [s.direction, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const direction = s.direction;
      // direction = price_change > 0 ? 1 : price_change < 0 ? -1 : 0 (price_change na on bar 0 gives 0)
      const change = i > 0 ? b.close - bars[i - 1].close : NaN;
      direction[i] = gt(change, 0) ? 1 : gt(0, change) ? -1 : 0;
      let rci = 0.0;
      // not na(direction[rci_length]): the direction is never na, so only the history length counts
      if (i - len >= 0) {
        let switches = 0;
        let prev = direction[i - len];
        for (let k = 1; k <= len - 1; k++) {
          const curr = direction[i - (len - k)];
          if (curr !== prev) switches++;
          prev = curr;
        }
        rci = (switches / (len - 1)) * 100;
      }
      s.plot0[i] = { time: b.time as number, value: rci, color: color.orange };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: [
          { value: 80, options: { title: 'High Compression', color: color.red, linestyle: 'dashed' } },
          { value: 50, options: { title: 'Neutral', color: color.gray, linestyle: 'dotted' } },
          { value: 20, options: { title: 'Low Compression', color: color.green, linestyle: 'dashed' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RenkoCompressionIndexInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RenkoCompressionIndexInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RenkoCompressionIndex = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
