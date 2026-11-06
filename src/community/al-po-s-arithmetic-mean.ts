/**
 * Al Po's Arithmetic Mean (Enhanced Arithmetic Mean)
 *
 * The cumulative arithmetic mean of the source: the sum of the source from the first bar divided by bar_index + 1.
 * Two counters give the number of bars on which the source closed above / below the mean (shown in the status line
 * and in the data window); a bar on which the source equals the mean resets both counters to 0.
 *
 * Reference: "Enhanced Arithmetic Mean by @nocachy" by sequentialvision
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: ©nocachy
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface AlPoSArithmeticMeanInputs {
  /** Sum source */
  sumSource: SourceType;
  /** Plot style of the mean (0 line ... 10 steplinebr); the port draws the default style (line with breaks) */
  sumStyle: number;
  /** Line width of the mean (1..4); the port draws the default width 1 */
  sumWidth: number;
}

export const defaultInputs: AlPoSArithmeticMeanInputs = {
  sumSource: 'close',
  sumStyle: 1,
  sumWidth: 1,
};

export const inputConfig: InputConfig[] = [
  { id: 'sumSource', type: 'source', title: 'Sum source', defval: 'close' },
  { id: 'sumStyle', type: 'int', title: 'Sum style', defval: 1, min: 0, max: 10, step: 1 },
  { id: 'sumWidth', type: 'int', title: 'Sum width', defval: 1, min: 1, max: 4, step: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bars above the arithmetic mean', color: color.green, lineWidth: 1, display: 'status_line' },
  { id: 'plot1', title: 'Bars below the arithmetic mean', color: color.red, lineWidth: 1, display: 'status_line' },
  { id: 'plot2', title: 'Bars above the arithmetic mean', color: color.green, lineWidth: 1, display: 'data_window' },
  { id: 'plot3', title: 'Bars below the arithmetic mean', color: color.red, lineWidth: 1, display: 'data_window' },
  { id: 'plot4', title: 'Nocachy Arithmetic Mean', color: color.purple, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'Enhanced Arithmetic Mean by @nocachy',
  shortTitle: 'EAM',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color: string };

interface EamVars {
  /** var sum: the running sum of the source */
  sum: number;
}

interface EamRun extends BarRunState<EamVars> {
  above: number[];
  below: number[];
  /** plot0..plot4 */
  points: Point[][];
}

function study(inputs: Partial<AlPoSArithmeticMeanInputs>): BarStudy<EamRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.sumSource);
  return {
    fullRunReason: () => (isBarSource(cfg.sumSource) ? null : 'source of another study'),
    init() {
      const s: EamRun = {
        above: [], below: [], points: [[], [], [], [], []],
        steps: [], vars: { sum: NaN }, lists: [], series: [],
      };
      s.series = [s.above, s.below, ...s.points];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i]!;
      const time = bar.time as number;
      const src = value(bar);
      // sum := barstate.isfirst ? sumSource : sum[1] + sumSource
      const sum = i === 0 ? src : s.vars.sum + src;
      s.vars.sum = sum;
      const am = sum / (i + 1);
      // barsAbove / barsBelow start at 0 on each bar; above the mean: barsAbove[1] + 1 (barsBelow kept), below:
      // barsBelow[1] + 1 (barsAbove kept); equal (within 1e-10) or na: both stay 0
      let a = 0;
      let b = 0;
      if (lt(am, src)) {
        if (i === 0) a = 1;
        else {
          a = s.above[i - 1]! + 1;
          b = s.below[i - 1]!;
        }
      } else if (gt(am, src)) {
        if (i === 0) b = 1;
        else {
          b = s.below[i - 1]! + 1;
          a = s.above[i - 1]!;
        }
      }
      s.above[i] = a;
      s.below[i] = b;
      // plotchar(barsAbove / barsBelow, ..., '', location.top, display = display.status_line / display.data_window):
      // an empty character, only the value is shown
      s.points[0]![i] = { time, value: a, color: color.green };
      s.points[1]![i] = { time, value: b, color: color.red };
      s.points[2]![i] = { time, value: a, color: color.green };
      s.points[3]![i] = { time, value: b, color: color.red };
      // plot(am, color = color.purple, style = GetStyle(sumStyle), linewidth = math.max(1, sumWidth))
      s.points[4]![i] = { time, value: am, color: color.purple };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: {
          plot0: s.points[0]!.slice(),
          plot1: s.points[1]!.slice(),
          plot2: s.points[2]!.slice(),
          plot3: s.points[3]!.slice(),
          plot4: s.points[4]!.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<AlPoSArithmeticMeanInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<AlPoSArithmeticMeanInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const AlPoSArithmeticMean = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
