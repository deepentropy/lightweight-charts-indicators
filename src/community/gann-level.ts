/**
 * GANN Level
 *
 * base = round(sqrt(open)). The GANN level is base^2; the support levels S1..S6 are (base - 0.25 * k)^2 and the
 * resistance levels R1..R6 are (base + 0.25 * k)^2 (k = 1..6). A level below 60 is rounded to one decimal, other
 * levels to an integer. All levels are drawn as crosses.
 *
 * Reference: "GANN Level" by prabhat76
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © prabhat76
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface GannLevelInputs {}

export const defaultInputs: GannLevelInputs = {};

export const inputConfig: InputConfig[] = [];

const TITLES = [
  'GANN Base',
  'Support 1', 'Support 2', 'Support 3', 'Support 4', 'Support 5', 'Support 6',
  'Resistance 1', 'Resistance 2', 'Resistance 3', 'Resistance 4', 'Resistance 5', 'Resistance 6',
];
const COLORS = [color.black, ...new Array(6).fill(color.red), ...new Array(6).fill(color.green)] as string[];
/** Offset of each level from the base, in plot order */
const STEPS = [0, -0.25, -0.5, -0.75, -1.0, -1.25, -1.5, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5];

export const plotConfig: PlotConfig[] = TITLES.map((title, k) => ({
  id: `plot${k}`, title, color: COLORS[k], lineWidth: 1, style: 'cross' as const,
}));

export const metadata = {
  title: 'GANN Level',
  shortTitle: 'GANN Level',
  overlay: true,
};

/** Pine math.round: nearest integer, ties rounded up */
const round = (x: number) => Math.round(x);
/** roundIfBelow60(val) => val < 60 ? math.round(val * 10) / 10 : math.round(val) */
const roundIfBelow60 = (val: number) => (60 - val > 1e-10 ? round(val * 10) / 10 : round(val));

type Point = { time: number; value: number; color: string };

interface GannRun extends BarRunState<Record<string, never>> {
  levels: Point[][];
}

function study(): BarStudy<GannRun, IndicatorResult> {
  return {
    init() {
      const levels = STEPS.map((): Point[] => []);
      return { levels, steps: [], vars: {}, lists: [], series: levels };
    },
    bar(s, i, bars) {
      const b = bars[i];
      const base = round(Math.sqrt(b.open));
      for (let k = 0; k < STEPS.length; k++) {
        const v = base + STEPS[k];
        s.levels[k][i] = { time: b.time, value: roundIfBelow60(v * v), color: COLORS[k] };
      }
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.levels.forEach((level, k) => { plots[`plot${k}`] = level.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<GannLevelInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<GannLevelInputs> = {}): IndicatorResult {
  return fullResult(createRun(_inputs).update(bars));
}

export const GannLevel = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
