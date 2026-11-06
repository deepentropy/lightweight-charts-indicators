/**
 * Entry Points
 *
 * Overlay indicator with buy/sell signals based on EMA touch logic.
 * No visible EMA plot on chart - only markers.
 *
 * Buy: close > ema AND low <= ema AND open > ema, OR open < ema AND close > ema
 *      (price touches EMA from above = buy signal)
 * Sell: close < ema AND high >= ema AND open < ema, OR open > ema AND close < ema
 *       (price touches EMA from below = sell signal)
 *
 * Reference: "Entry points" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from '../types';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EntryPointsInputs {
  period: number;
}

export const defaultInputs: EntryPointsInputs = {
  period: 100,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'Period', defval: 100, min: 1 },
];

// No visible plots - only markers on overlay
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Entry Points',
  shortTitle: 'EntryPts',
  overlay: true,
};

type Result = Omit<IndicatorResult, 'markers'> & { markers: MarkerData[] };

interface EntryPointsRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  markers: MarkerData[];
}

function study(inputs: Partial<EntryPointsInputs>): BarStudy<EntryPointsRun, Result> {
  const { period } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ema = taStep.ema(period);
      const s: EntryPointsRun = { ema, markers: [], steps: [ema], vars: {}, lists: [], series: [] };
      s.lists = [s.markers];
      return s;
    },
    bar(s, i, bars) {
      const ema = s.ema.step(bars[i].close);
      if (i < period) return;
      if (ema == null || isNaN(ema)) return;

      const { close, low, high, open } = bars[i];

      // Pine: buy = close > b and low <= b and open > b or open < b and close > b
      const buy = (close > ema && low <= ema && open > ema) || (open < ema && close > ema);
      // Pine: sell = close < b and high >= b and open < b or open > b and close < b
      const sell = (close < ema && high >= ema && open < ema) || (open > ema && close < ema);

      if (buy) {
        s.markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: 'rgba(0,128,0,0.9)', text: 'Buy' });
      }
      if (sell) {
        s.markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: 'rgba(255,0,0,0.9)', text: 'Sell' });
      }
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
export function createRun(inputs: Partial<EntryPointsInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EntryPointsInputs> = {}): Result {
  return fullResult(createRun(inputs).update(bars));
}

export const EntryPoints = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
