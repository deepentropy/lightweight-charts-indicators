/**
 * High For Loop | MisinkoMaster
 *
 * For-loop score of the high: for each offset i from `start` to `end`, -1 when high[i] > high and +1 when
 * high > high[i]. A crossover of the score above the upper threshold starts an uptrend (teal), a crossunder below
 * the lower threshold starts a downtrend (magenta); the colour is kept until the next signal (white before the first
 * one). The score line, both thresholds and the bars use this colour.
 *
 * Reference: "High For Loop | MisinkoMaster" by MisinkoMaster
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © MisinkoMaster
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HighForLoopMisinkomasterInputs {
  /** Start of the for loop */
  start: number;
  /** End of the for loop */
  end: number;
  /** Upper threshold: a crossover of the score above it triggers an uptrend */
  ut: number;
  /** Lower threshold: a crossunder of the score below it triggers a downtrend */
  lt: number;
}

export const defaultInputs: HighForLoopMisinkomasterInputs = {
  start: 0,
  end: 45,
  ut: 25,
  lt: -7,
};

export const inputConfig: InputConfig[] = [
  { id: 'start', type: 'int', title: 'Start', defval: 0, min: 0, step: 1 },
  { id: 'end', type: 'int', title: 'End', defval: 45, min: 1, step: 1 },
  { id: 'ut', type: 'int', title: 'Upper Treshhold', defval: 25, step: 1 },
  { id: 'lt', type: 'int', title: 'Lower Treshhold', defval: -7, step: 1 },
];

const LONG_COL = String(color.rgb(10, 226, 179, 10));
const SHORT_COL = String(color.rgb(247, 0, 255, 10));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'High For Loop', color: color.white, lineWidth: 3 },
  { id: 'plot1', title: 'Upper Treshhold', color: LONG_COL, lineWidth: 1 },
  { id: 'plot2', title: 'Lower Treshhold', color: SHORT_COL, lineWidth: 1 },
];

export const metadata = {
  title: 'High For Loop | MisinkoMaster',
  shortTitle: 'HLF | MisinkoMaster',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

type Point = { time: number; value: number; color: string };
type Result = IndicatorResult & { barColors: BarColorData[] };

interface HflVars {
  /** var col = color.white */
  col: string;
}

interface HflRun extends BarRunState<HflVars> {
  high: number[];
  score: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  barColors: BarColorData[];
}

function study(inputs: Partial<HighForLoopMisinkomasterInputs>): BarStudy<HflRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const { start, end, ut, lt } = cfg;
  // flscore: for i = start to end (counts down when start > end); high[i] before the first bar is na
  const step = start <= end ? 1 : -1;
  return {
    init() {
      const s: HflRun = {
        high: [], score: [], plot0: [], plot1: [], plot2: [], barColors: [],
        steps: [], vars: { col: color.white }, lists: [], series: [],
      };
      s.series = [s.high, s.score, s.plot0, s.plot1, s.plot2, s.barColors];
      return s;
    },
    bar(s, k, bars) {
      const b = bars[k];
      const h = b.high;
      const high = s.high;
      high[k] = h;
      let flscore = 0;
      for (let i = start; step > 0 ? i <= end : i >= end; i += step) {
        const hi = k - i >= 0 ? high[k - i] : NaN;
        if (gt(hi, h)) flscore += -1;
        if (gt(h, hi)) flscore += 1;
      }
      s.score[k] = flscore;
      // L = ta.crossover(flscore, ut), S = ta.crossunder(flscore, lt) (exact comparisons)
      const L = k > 0 && flscore > ut && s.score[k - 1] <= ut;
      const S = k > 0 && flscore < lt && s.score[k - 1] >= lt;
      if (L && !S) s.vars.col = LONG_COL;
      if (S) s.vars.col = SHORT_COL;
      const col = s.vars.col;
      s.plot0[k] = { time: b.time, value: flscore, color: col };
      s.plot1[k] = { time: b.time, value: ut, color: LONG_COL };
      s.plot2[k] = { time: b.time, value: lt, color: SHORT_COL };
      s.barColors[k] = { time: b.time, color: col };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        barColors: s.barColors.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HighForLoopMisinkomasterInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<HighForLoopMisinkomasterInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const HighForLoopMisinkomaster = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
