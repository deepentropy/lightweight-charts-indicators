/**
 * Stop/Take Bounds
 *
 * Stop loss and take profit levels around the close for a long and a short position. The stop distance is
 * close * stop % / 100; the take profit distance is the stop distance * the take profit multiplier.
 * Long: stop = close - distance, take = close + distance * multiplier. Short: stop = close + distance,
 * take = close - distance * multiplier (drawn as step lines).
 *
 * Reference: "Stop/Take Bounds" by Y_Goldman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface StopTakeBoundsInputs {
  /** Distance of the stop loss from the close, in % */
  stopDistancePercent: number;
  /** Multiplier of the stop distance for the take profit */
  takeProfitMultiplier: number;
}

export const defaultInputs: StopTakeBoundsInputs = {
  stopDistancePercent: 1.0,
  takeProfitMultiplier: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'stopDistancePercent', type: 'float', title: 'Stop Distance (%)', defval: 1.0 },
  { id: 'takeProfitMultiplier', type: 'float', title: 'Take Profit Multiplier', defval: 2.0 },
];

const STOP_COL = String(color.new(color.red, 60));
const TAKE_COL = String(color.new(color.green, 60));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Long Stop Loss', color: STOP_COL, lineWidth: 2 },
  { id: 'plot1', title: 'Long Take Profit', color: TAKE_COL, lineWidth: 2 },
  { id: 'plot2', title: 'Short Stop Loss', color: STOP_COL, lineWidth: 2, style: 'stepline' },
  { id: 'plot3', title: 'Short Take Profit', color: TAKE_COL, lineWidth: 2, style: 'stepline' },
];

export const metadata = {
  title: 'Stop/Take Bounds',
  shortTitle: 'Stop/Take Bounds',
  overlay: true,
};

type Point = { time: number; value: number; color: string };

interface StopTakeRun extends BarRunState<Record<string, never>> {
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
  plot3: Point[];
}

function study(inputs: Partial<StopTakeBoundsInputs>): BarStudy<StopTakeRun, IndicatorResult> {
  const { stopDistancePercent, takeProfitMultiplier } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const s: StopTakeRun = { plot0: [], plot1: [], plot2: [], plot3: [], steps: [], vars: {}, lists: [], series: [] };
      s.series = [s.plot0, s.plot1, s.plot2, s.plot3];
      return s;
    },
    bar(s, i, bars) {
      // The Pine script also computes a `direction` (ta.valuewhen of ta.cross(close, close[1])) that no output uses.
      const b = bars[i];
      const c = b.close;
      const d = c * (stopDistancePercent / 100);
      s.plot0[i] = { time: b.time, value: c - d, color: STOP_COL };
      s.plot1[i] = { time: b.time, value: c + d * takeProfitMultiplier, color: TAKE_COL };
      s.plot2[i] = { time: b.time, value: c + d, color: STOP_COL };
      s.plot3[i] = { time: b.time, value: c - d * takeProfitMultiplier, color: TAKE_COL };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice(), plot3: s.plot3.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<StopTakeBoundsInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<StopTakeBoundsInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const StopTakeBounds = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
