/**
 * Candle State (The Strat)
 *
 * Compares each bar with the previous one. A higher high gives a green up triangle, a lower low a red down triangle
 * (both above the bar). A bar with both (outside bar, "type 3") gets the two triangles, the one of the candle colour
 * drawn last (on top): red on a red candle, green on a green candle.
 *
 * Reference: "Candle State (The Strat)" by Crinklebine
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: (c) 2026 Crinklebine
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type CandleStateInputs = Record<string, never>;

export const defaultInputs: CandleStateInputs = {};

export const inputConfig: InputConfig[] = [];

// No plot(): the outputs are six plotshape markers
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Candle State (The Strat)',
  shortTitle: 'Candle State (The Strat)',
  overlay: true,
  precision: 0,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface CandleStateRun extends BarRunState<Record<string, never>> {
  markers: MarkerData[];
}

function study(): BarStudy<CandleStateRun, Result> {
  return {
    init() {
      const s: CandleStateRun = { markers: [], steps: [], vars: {}, lists: [], series: [] };
      s.lists = [s.markers];
      return s;
    },
    bar(s, i, bars) {
      const markers = s.markers;
      const b = bars[i];
      // plotshape(..., location = location.abovebar), default size (size.auto); id: shape<k> of the k-th plotshape
      const up = (time: number, id: string) =>
        markers.push({ id, time, position: 'aboveBar', shape: 'triangleUp', color: color.green, size: 'auto' });
      const down = (time: number, id: string) =>
        markers.push({ id, time, position: 'aboveBar', shape: 'triangleDown', color: color.red, size: 'auto' });
      // high[1] / low[1] are na on the first bar: the comparisons are false
      const barResult1 = i > 0 && gt(b.high, bars[i - 1].high);
      const barResult2 = i > 0 && lt(b.low, bars[i - 1].low);
      const isGreenCandle = gt(b.close, b.open);
      const isRedCandle = lt(b.close, b.open);
      const isType3 = barResult1 && barResult2;
      // Pine plotshape order: Bar State Up, Bar State Down, Type 3 Red Base / Top, Type 3 Green Base / Top
      if (barResult1 && !isType3) up(b.time, 'shape0');
      if (barResult2 && !isType3) down(b.time, 'shape1');
      if (isType3 && isRedCandle) {
        up(b.time, 'shape2');
        down(b.time, 'shape3');
      }
      if (isType3 && isGreenCandle) {
        down(b.time, 'shape4');
        up(b.time, 'shape5');
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, precision: metadata.precision },
        plots: {},
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<CandleStateInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(), chart);
}

export function calculate(
  bars: Bar[],
  _inputs: Partial<CandleStateInputs> = {},
): Result {
  return fullResult(createRun(_inputs).update(bars));
}

export const CandleState = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
