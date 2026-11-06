/**
 * Price Contraction / Expansion
 *
 * The body |close - open| is compared with its SMA times a threshold multiplier: a smaller body is a contraction, a
 * larger or equal body an expansion. The volume is compared with its SMA times a high and a low multiplier. Bar
 * colours: contraction with high volume yellow, other contraction blue, expansion with low volume blue, bullish
 * expansion green, bearish expansion red. A bar that matches none of these keeps the previous colour.
 *
 * Reference: "Price Contraction / Expansion" by destrobr0685
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PriceContractionExpansionInputs {
  /** Body average period */
  lenRange: number;
  /** Threshold multiplier */
  multThresh: number;
  /** Volume average period */
  volPeriod: number;
  /** High volume multiplier */
  volThresh: number;
  /** Low volume multiplier */
  lowVolThresh: number;
}

export const defaultInputs: PriceContractionExpansionInputs = {
  lenRange: 20,
  multThresh: 0.8,
  volPeriod: 20,
  volThresh: 1.5,
  lowVolThresh: 0.7,
};

export const inputConfig: InputConfig[] = [
  { id: 'lenRange', type: 'int', title: 'Body average period', defval: 20 },
  { id: 'multThresh', type: 'float', title: 'Threshold multiplier', defval: 0.8, step: 0.1 },
  { id: 'volPeriod', type: 'int', title: 'Volume average period', defval: 20 },
  { id: 'volThresh', type: 'float', title: 'High volume multiplier', defval: 1.5, step: 0.1 },
  { id: 'lowVolThresh', type: 'float', title: 'Low volume multiplier', defval: 0.7, step: 0.1 },
];

// Only bar colours (barcolor): no line plots
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Price Contraction / Expansion',
  shortTitle: 'Price Contraction / Expansion',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Result = IndicatorResult & { barColors: BarColorData[] };

interface PceVars {
  /** var color barColor = na */
  barColor: string | null;
}

interface PceRun extends BarRunState<PceVars> {
  avgBody: WindowSma;
  avgVol: WindowSma;
  barColors: BarColorData[];
}

function study(inputs: Partial<PriceContractionExpansionInputs>): BarStudy<PceRun, Result> {
  const { lenRange, multThresh, volPeriod, volThresh, lowVolThresh } = { ...defaultInputs, ...inputs };
  const yellow = String(color.new(color.yellow, 0));
  const blue = String(color.new(color.blue, 0));
  const green = String(color.new(color.green, 0));
  const red = String(color.new(color.red, 0));
  return {
    init() {
      const avgBody = new WindowSma(lenRange);
      const avgVol = new WindowSma(volPeriod);
      const s: PceRun = { avgBody, avgVol, barColors: [], steps: [avgBody, avgVol], vars: { barColor: null }, lists: [], series: [] };
      s.lists = [s.barColors];
      return s;
    },
    bar(s, i, bars) {
      const { open, close, time } = bars[i];
      const bodySize = Math.abs(close - open);
      const volume = bars[i].volume ?? NaN;
      const avgBody = s.avgBody.step(bodySize);
      const avgVol = s.avgVol.step(volume);
      const thresh = avgBody * multThresh;
      const isHighVol = ge(volume, avgVol * volThresh);
      const isLowVol = le(volume, avgVol * lowVolThresh);
      const isContraction = lt(bodySize, thresh);
      const isExpansion = ge(bodySize, thresh);
      const isBull = gt(close, open);
      const isBear = lt(close, open);
      const v = s.vars;
      if (isContraction && isHighVol) v.barColor = yellow;
      else if (isContraction) v.barColor = blue;
      else if (isExpansion && isLowVol) v.barColor = blue;
      else if (isExpansion && isBull) v.barColor = green;
      else if (isExpansion && isBear) v.barColor = red;
      // barcolor(barColor)
      if (v.barColor !== null) s.barColors.push({ time, color: v.barColor });
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
export function createRun(inputs: Partial<PriceContractionExpansionInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PriceContractionExpansionInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const PriceContractionExpansion = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
