/**
 * The Strat
 *
 * Labels each bar with its Strat number below the bar: "1" for an inside bar (high <= previous high and
 * low >= previous low), green "2" for a two-up bar (higher high, low >= previous low), red "2" for a two-down bar
 * (lower low, high <= previous high) and "3" for an outside bar (higher high and lower low).
 *
 * Reference: "The Strat" by shayy110
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// The Pine script has no inputs
export type TheStratInputs = Record<string, never>;

export const defaultInputs: TheStratInputs = {};

export const inputConfig: InputConfig[] = [];

// No plot(): the only outputs are four plotchar markers
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'The Strat',
  shortTitle: 'The Strat',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface StratRun extends BarRunState<Record<string, never>> {
  markers: MarkerData[];
}

const bullColor = color.green;
const bearColor = color.red;
const insideColor = String(color.new('#F6BE00', 0));
const outsideColor = color.fuchsia;

/**
 * plotchar(cond, char, location.belowbar, color): the char as text in the colour, no shape; `id`: the plotchar
 * output (char0 to char3 in declaration order)
 */
const plotchar = (markers: MarkerData[], time: number, text: string, c: string, id: string) =>
  markers.push({ time, position: 'belowBar', shape: 'circle', color: 'transparent', text, textColor: c, id });

function study(): BarStudy<StratRun, Result> {
  return {
    init() {
      const s: StratRun = { markers: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.markers];
      return s;
    },
    bar(s, i, bars) {
      const { time, high, low } = bars[i];
      // high[1] / low[1]: na on bar 0
      const high1 = i > 0 ? bars[i - 1].high : NaN;
      const low1 = i > 0 ? bars[i - 1].low : NaN;

      const isInsideBar = le(high, high1) && ge(low, low1);
      const isTwoUpBar = gt(high, high1) && ge(low, low1);
      const isTwoDownBar = lt(low, low1) && le(high, high1);
      const isThreeBar = gt(high, high1) && lt(low, low1);

      if (isInsideBar) plotchar(s.markers, time, '1', insideColor, 'char0');
      if (isTwoUpBar) plotchar(s.markers, time, '2', bullColor, 'char1');
      if (isTwoDownBar) plotchar(s.markers, time, '2', bearColor, 'char2');
      if (isThreeBar) plotchar(s.markers, time, '3', outsideColor, 'char3');
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {},
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<TheStratInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], inputs: Partial<TheStratInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const TheStrat = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
