/**
 * WD Gann Square Root Levels
 *
 * Constant levels around a base price: the square root of the base price plus / minus 0.25, 0.50, 1.00 and 1.50,
 * squared again. The four levels above are the resistances, the four levels below the supports; the base price is
 * drawn too.
 *
 * Reference: "HTH - WD Gann Square Root Levels" by tamillselvan
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { math, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HthWdGannSquareRootLevelsInputs {
  /** Base price of the levels */
  basePrice: number;
}

export const defaultInputs: HthWdGannSquareRootLevelsInputs = {
  basePrice: 55168.90,
};

export const inputConfig: InputConfig[] = [
  { id: 'basePrice', type: 'float', title: 'Base Price', defval: 55168.90 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Resistance 1', color: color.red, lineWidth: 1 },
  { id: 'plot1', title: 'Resistance 2', color: color.red, lineWidth: 1 },
  { id: 'plot2', title: 'Resistance 3', color: color.red, lineWidth: 1 },
  { id: 'plot3', title: 'Resistance 4', color: color.red, lineWidth: 1 },
  { id: 'plot4', title: 'Support 1', color: color.green, lineWidth: 1 },
  { id: 'plot5', title: 'Support 2', color: color.green, lineWidth: 1 },
  { id: 'plot6', title: 'Support 3', color: color.green, lineWidth: 1 },
  { id: 'plot7', title: 'Support 4', color: color.green, lineWidth: 1 },
  { id: 'plot8', title: 'Base Price', color: color.blue, lineWidth: 1, style: 'linebr' },
];

export const metadata = {
  title: 'WD Gann Square Root Levels',
  shortTitle: 'WD Gann Square Root Levels',
  overlay: true,
};

/** Angle fractions (45, 90, 180 ... degrees) */
const ANGLE_FRACTIONS = [0.25, 0.50, 1.00, 1.50];

type Point = { time: number; value: number; color: string };

interface GannRun extends BarRunState<Record<string, never>> {
  /** plot0 .. plot8 */
  plots: Point[][];
}

function study(inputs: Partial<HthWdGannSquareRootLevelsInputs>): BarStudy<GannRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const sqrtPrice = math.sqrt(cfg.basePrice);
  const res = ANGLE_FRACTIONS.map((f) => math.pow(sqrtPrice + f, 2));
  const sup = ANGLE_FRACTIONS.map((f) => math.pow(sqrtPrice - f, 2));
  const levels = [...res, ...sup, cfg.basePrice].map((level) => (Number.isFinite(level) ? level : NaN));
  const colors = [...res.map(() => color.red), ...sup.map(() => color.green), color.blue];
  return {
    init() {
      const s: GannRun = { plots: levels.map(() => []), steps: [], vars: {}, lists: [], series: [] };
      s.series = s.plots;
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time as number;
      for (let k = 0; k < levels.length; k++) s.plots[k]![i] = { time, value: levels[k]!, color: colors[k]! };
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
export function createRun(inputs: Partial<HthWdGannSquareRootLevelsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<HthWdGannSquareRootLevelsInputs> = {},
): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const HthWdGannSquareRootLevels = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
