/**
 * Inside Candle Indicator
 *
 * An inside candle has a high below the previous high and a low above the previous low. A small circle above the
 * bar marks it.
 *
 * Reference: "Inside Candle Indicator (Chart Timeframe)" by mushirinamdar
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type MushirInsideCandleInputs = Record<string, never>;

export const defaultInputs: MushirInsideCandleInputs = {};

export const inputConfig: InputConfig[] = [];

// No plot(): the only output is a plotshape marker
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Inside Candle Indicator (Chart Timeframe)',
  shortTitle: 'Inside Candle',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface InsideRun extends BarRunState<Record<string, never>> {
  markers: MarkerData[];
}

function study(): BarStudy<InsideRun, Result> {
  const black = color.black;
  return {
    init() {
      const s: InsideRun = { markers: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.markers];
      return s;
    },
    bar(s, i, bars) {
      if (i < 1) return;
      const b = bars[i];
      const isInside = lt(b.high, bars[i - 1].high) && gt(b.low, bars[i - 1].low);
      // plotshape(isInside, title = "Inside Candle Detected", style = shape.circle, location = location.abovebar,
      //           color = color.black, size = size.tiny)
      if (isInside) s.markers.push({ time: b.time, position: 'aboveBar', shape: 'circle', color: black, size: 'tiny' });
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
export function createRun(_inputs: Partial<MushirInsideCandleInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<MushirInsideCandleInputs> = {}): Result {
  return fullResult(createRun(_inputs).update(bars));
}

export const MushirInsideCandle = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
