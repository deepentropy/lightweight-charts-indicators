/**
 * GMMA (Guppy Multiple Moving Average)
 *
 * Twelve EMAs of the close: six short ones (3, 5, 8, 10, 12, 15 by default) drawn in green and six long ones
 * (30, 35, 40, 45, 50, 60) drawn in red. The original is a Pine v3 study: the plot colours carry the default plot
 * transparency 35 of that version.
 *
 * Reference: "GMMA" by daisuke_gewinn
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type Bar, type IndicatorResult, type InputConfig, type PlotConfig } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface GmmaDaisukeGewinnInputs {
  /** EMA1 period (short) */
  period1: number;
  /** EMA2 period (short) */
  period2: number;
  /** EMA3 period (short) */
  period3: number;
  /** EMA4 period (short) */
  period4: number;
  /** EMA5 period (short) */
  period5: number;
  /** EMA6 period (short) */
  period6: number;
  /** EMA7 period (long) */
  period7: number;
  /** EMA8 period (long) */
  period8: number;
  /** EMA9 period (long) */
  period9: number;
  /** EMA10 period (long) */
  period10: number;
  /** EMA11 period (long) */
  period11: number;
  /** EMA12 period (long) */
  period12: number;
}

export const defaultInputs: GmmaDaisukeGewinnInputs = {
  period1: 3,
  period2: 5,
  period3: 8,
  period4: 10,
  period5: 12,
  period6: 15,
  period7: 30,
  period8: 35,
  period9: 40,
  period10: 45,
  period11: 50,
  period12: 60,
};

const KEYS = [
  'period1', 'period2', 'period3', 'period4', 'period5', 'period6',
  'period7', 'period8', 'period9', 'period10', 'period11', 'period12',
] as const;

export const inputConfig: InputConfig[] = KEYS.map((id, k) => ({
  id, type: 'int' as const, title: `EMA${k + 1} Period`, defval: defaultInputs[id],
}));

/** Pine v3 green / red with the default plot transparency 35 of v1 to v3 */
const GREEN = String(color.new('#008000', 35));
const RED = String(color.new('#FF0000', 35));

export const plotConfig: PlotConfig[] = KEYS.map((_, k) => ({
  id: `plot${k}`,
  title: k < 6 ? `short${k + 1}` : `long${k - 5}`,
  color: k < 6 ? GREEN : RED,
  lineWidth: 1,
}));

export const metadata = {
  title: 'GMMA',
  shortTitle: 'GMMA',
  overlay: true,
};

type Point = { time: number; value: number };

interface GmmaRun extends BarRunState<Record<string, never>> {
  emas: ReturnType<typeof taStep.ema>[];
  points: Point[][];
}

function study(inputs: Partial<GmmaDaisukeGewinnInputs>): BarStudy<GmmaRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const emas = KEYS.map((key) => taStep.ema(cfg[key]));
      const points: Point[][] = KEYS.map(() => []);
      return { emas, points, steps: emas, vars: {}, lists: [], series: points };
    },
    bar(s, i, bars) {
      const b = bars[i];
      for (let k = 0; k < KEYS.length; k++) s.points[k][i] = { time: b.time, value: s.emas[k].step(b.close) ?? NaN };
    },
    result(s) {
      const plots: IndicatorResult['plots'] = {};
      KEYS.forEach((_key, k) => {
        plots[`plot${k}`] = s.points[k].slice();
      });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<GmmaDaisukeGewinnInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<GmmaDaisukeGewinnInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const GmmaDaisukeGewinn = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
