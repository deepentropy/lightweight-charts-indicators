/**
 * Keyzone
 *
 * Step lines at the lowest low and the highest high of the previous 3, 8, 21 and 89 bars (the current bar is not
 * in the window): ultra fast (lime), fast (green), slow (orange) and ultra slow (red) key zones. The Pine script
 * also tracks buy / sell conditions but draws nothing with them.
 *
 * Reference: "Keyzone" by Uttaya
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface KeyzoneInputs {}

export const defaultInputs: KeyzoneInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Ultra Fast Lower Keyzone', color: color.lime, lineWidth: 1, style: 'stepline' },
  { id: 'plot1', title: 'Ultra Fast Upper Keyzone', color: color.lime, lineWidth: 1, style: 'stepline' },
  { id: 'plot2', title: 'Fast Lower Keyzone', color: color.green, lineWidth: 1, style: 'stepline' },
  { id: 'plot3', title: 'Fast Upper Keyzone', color: color.green, lineWidth: 1, style: 'stepline' },
  { id: 'plot4', title: 'Slow Lower Keyzone', color: color.orange, lineWidth: 1, style: 'stepline' },
  { id: 'plot5', title: 'Slow Upper Keyzone', color: color.orange, lineWidth: 1, style: 'stepline' },
  { id: 'plot6', title: 'Ultra Slow Lower Keyzone', color: color.red, lineWidth: 1, style: 'stepline' },
  { id: 'plot7', title: 'Ultra Slow Upper Keyzone', color: color.red, lineWidth: 1, style: 'stepline' },
];

export const metadata = {
  title: 'Keyzone',
  shortTitle: 'Keyzone',
  overlay: true,
};

type Point = { time: number; value: number };

interface KeyzoneRun extends BarRunState<Record<string, never>> {
  /** ta.lowest(low, len) / ta.highest(high, len) for 3, 8, 21 and 89 bars */
  ext: WindowExtreme[];
  /** Their values by bar */
  vals: number[][];
  plots: Point[][];
}

function study(): BarStudy<KeyzoneRun, IndicatorResult> {
  const lengths = [3, 8, 21, 89];
  return {
    init() {
      const s: KeyzoneRun = {
        ext: lengths.flatMap((len) => [new WindowExtreme(true, len), new WindowExtreme(false, len)]),
        vals: Array.from({ length: 8 }, () => []), plots: Array.from({ length: 8 }, () => []),
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = s.ext;
      s.series = [...s.vals, ...s.plots];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // ta.lowest(len)[1] / ta.highest(len)[1]: the extreme of the low / high on the previous bar
      for (let k = 0; k < 8; k++) {
        s.vals[k][i] = s.ext[k].step(k % 2 === 0 ? b.low : b.high);
        s.plots[k][i] = { time: b.time, value: i > 0 ? s.vals[k][i - 1] : NaN };
      }
    },
    result(s) {
      const plots: IndicatorResult['plots'] = {};
      s.plots.forEach((p, k) => {
        plots[`plot${k}`] = p.slice();
      });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<KeyzoneInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<KeyzoneInputs> = {}): IndicatorResult {
  return fullResult(createRun(_inputs).update(bars));
}

export const Keyzone = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
