/**
 * EMA Cross Signals
 *
 * A fast EMA (20) and a slow EMA (50) of the close. A BUY triangle below the bar when the fast EMA crosses over the
 * slow EMA, a SELL triangle above the bar when it crosses under.
 *
 * Reference: "EMA Cross Signals" by Jos-ProTrader
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Jos-ProTrader
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// The Pine script has no inputs
export interface EmaCrossSignalsInputs {}

export const defaultInputs: EmaCrossSignalsInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA', color: color.green, lineWidth: 1 },
  { id: 'plot1', title: 'Slow EMA', color: color.red, lineWidth: 1 },
];

export const metadata = {
  title: 'EMA Cross Signals',
  shortTitle: 'EMA Cross Signals',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };
type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface EmaCrossRun extends BarRunState<Record<string, never>> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  over: ReturnType<typeof taStep.crossover>;
  under: ReturnType<typeof taStep.crossunder>;
  fastData: Point[];
  slowData: Point[];
  markers: MarkerData[];
}

function study(_inputs: Partial<EmaCrossSignalsInputs>): BarStudy<EmaCrossRun, Result> {
  return {
    init() {
      const fast = taStep.ema(20);
      const slow = taStep.ema(50);
      const over = taStep.crossover();
      const under = taStep.crossunder();
      const s: EmaCrossRun = {
        fast, slow, over, under, fastData: [], slowData: [], markers: [],
        steps: [fast, slow, over, under], vars: {}, lists: [], series: [],
      };
      s.lists = [s.markers];
      s.series = [s.fastData, s.slowData];
      return s;
    },
    bar(s, i, bars) {
      const t = bars[i].time;
      const close = bars[i].close;
      const fast = s.fast.step(close) ?? NaN;
      const slow = s.slow.step(close) ?? NaN;
      // ta.crossover / ta.crossunder: exact comparisons with the last bar where both values were not na
      const buy = s.over.step(fast, slow);
      const sell = s.under.step(fast, slow);
      // plotshape(buy, style = shape.triangleup, location = location.belowbar, color = color.lime, text = "BUY")
      // (Pine default text colour #2962FF)
      if (buy) {
        s.markers.push({ time: t, position: 'belowBar', shape: 'triangleUp', color: color.lime, text: 'BUY', textColor: '#2962FF' });
      }
      // plotshape(sell, style = shape.triangledown, location = location.abovebar, color = color.red, text = "SELL")
      if (sell) {
        s.markers.push({ time: t, position: 'aboveBar', shape: 'triangleDown', color: color.red, text: 'SELL', textColor: '#2962FF' });
      }
      // plot(fast, color = color.green); plot(slow, color = color.red)
      s.fastData[i] = { time: t, value: fast, color: color.green };
      s.slowData[i] = { time: t, value: slow, color: color.red };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.fastData.slice(), plot1: s.slowData.slice() },
        markers: s.markers.slice(),
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EmaCrossSignalsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<EmaCrossSignalsInputs> = {},
): Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] } {
  return fullResult(createRun(inputs).update(bars));
}

export const EmaCrossSignals = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
