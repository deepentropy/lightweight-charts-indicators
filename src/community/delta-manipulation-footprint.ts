/**
 * Delta Manipulation Footprint
 *
 * Bar volume delta: + volume on an up or flat candle (close >= open), - volume on a down candle. The change of this
 * delta from the previous bar is significant when its absolute value is above the SMA of the absolute changes times
 * a multiplier. Significant bars are coloured: green (up candle, delta rising), red (down candle, delta falling),
 * yellow (candle and delta in opposite directions).
 *
 * Reference: "Delta Manipulation Footprint" by destrobr0685
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DeltaManipulationFootprintInputs {
  /** SMA length of the absolute delta change */
  length: number;
  /** Threshold multiplier of the SMA */
  thresholdMultiplier: number;
}

export const defaultInputs: DeltaManipulationFootprintInputs = {
  length: 20,
  thresholdMultiplier: 1.9,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Moving Average Length', defval: 20 },
  { id: 'thresholdMultiplier', type: 'float', title: 'Threshold Multiplier', defval: 1.9 },
];

/** No plot: the only output is the bar colour */
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Delta Manipulation Footprint',
  shortTitle: 'Delta Manipulation Footprint',
  overlay: true,
};

/** Pine a > b: a - b > 1e-10 (false with na) */
const gt = (a: number, b: number) => a - b > 1e-10;
/** Pine a >= b: not (b > a), false with na */
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > 1e-10);
/** Pine a < b */
const lt = (a: number, b: number) => b - a > 1e-10;

type Result = IndicatorResult & { barColors: BarColorData[] };

interface DeltaRun extends BarRunState<Record<string, never>> {
  sma: WindowSma;
  aggDelta: number[];
  barColors: BarColorData[];
}

function study(inputs: Partial<DeltaManipulationFootprintInputs>): BarStudy<DeltaRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  const vol = (b: Bar) => b.volume ?? NaN;
  return {
    init() {
      const sma = new WindowSma(cfg.length);
      const s: DeltaRun = { sma, aggDelta: [], barColors: [], steps: [sma], vars: {}, lists: [], series: [] };
      s.lists = [s.barColors];
      s.series = [s.aggDelta];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // aggDelta = buyVol - sellVol, buyVol = volume * (close >= open ? 1 : 0), sellVol = volume * (close < open ? 1 : 0)
      const d = vol(b) * (ge(b.close, b.open) ? 1 : 0) - vol(b) * (lt(b.close, b.open) ? 1 : 0);
      s.aggDelta[i] = d;
      // deltaDiff = aggDelta - nz(aggDelta[1], 0)
      const prev = i > 0 ? s.aggDelta[i - 1] : NaN;
      const deltaDiff = d - (Number.isFinite(prev) ? prev : 0);
      const absDeltaDiff = Math.abs(deltaDiff);
      const avgAbs = s.sma.step(absDeltaDiff);

      const threshold = avgAbs * cfg.thresholdMultiplier;
      if (!gt(absDeltaDiff, threshold)) return; // isSignificantDelta
      const candleIsPositive = ge(b.close, b.open);
      const deltaIsPositive = gt(deltaDiff, 0);
      let c: string;
      if (candleIsPositive && deltaIsPositive) c = color.green; // candle up and delta rising
      else if (!candleIsPositive && !deltaIsPositive) c = color.red; // candle down and delta falling
      else c = color.yellow; // candle and delta in opposite directions (divergence)
      s.barColors.push({ time: b.time, color: c });
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
export function createRun(inputs: Partial<DeltaManipulationFootprintInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DeltaManipulationFootprintInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const DeltaManipulationFootprint = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
