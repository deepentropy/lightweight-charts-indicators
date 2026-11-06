/**
 * Intraday vs Overnight Change Tracker
 *
 * Two synthetic prices that start at the close of the second bar (bar_index 1). The intraday price is then multiplied
 * on each bar by close / open (the change during the bar), the overnight price by open / close[1] (the gap from the
 * prior close to the open). A choice shows one line or both.
 *
 * Reference: "Intraday vs Overnight Change Tracker" by TheUltimator5
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © TheUltimator5
 */

import { color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export type IntradayVsOvernightPlotChoice = 'Both Intraday and Overnight' | 'Intraday' | 'Overnight';

export interface IntradayVsOvernightChangeTrackerInputs {
  /** Synthetic price type */
  plotChoice: IntradayVsOvernightPlotChoice;
}

export const defaultInputs: IntradayVsOvernightChangeTrackerInputs = {
  plotChoice: 'Both Intraday and Overnight',
};

export const inputConfig: InputConfig[] = [
  {
    id: 'plotChoice', type: 'string', title: 'Synthetic Price Type', defval: 'Both Intraday and Overnight',
    options: ['Both Intraday and Overnight', 'Intraday', 'Overnight'],
  },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Intraday', color: color.orange, lineWidth: 2 },
  { id: 'plot1', title: 'Overnight', color: color.fuchsia, lineWidth: 2 },
];

export const metadata = {
  title: 'Intraday vs Overnight Change Tracker',
  shortTitle: 'Intraday vs Overnight Change Tracker',
  overlay: false,
};

type Point = { time: number; value: number; color: string };

interface IntradayVars {
  /** var float intradayPrice = na; var float overnightPrice = na */
  intradayPrice: number;
  overnightPrice: number;
}

interface IntradayRun extends BarRunState<IntradayVars> {
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<IntradayVsOvernightChangeTrackerInputs>): BarStudy<IntradayRun, IndicatorResult> {
  const { plotChoice } = { ...defaultInputs, ...inputs };
  const showIntra = plotChoice === 'Intraday' || plotChoice === 'Both Intraday and Overnight';
  const showOver = plotChoice === 'Overnight' || plotChoice === 'Both Intraday and Overnight';
  return {
    init() {
      const s: IntradayRun = {
        plot0: [], plot1: [], steps: [], vars: { intradayPrice: NaN, overnightPrice: NaN }, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      const intradayChange = b.close / b.open;
      const overnightChange = i > 0 ? b.open / bars[i - 1].close : NaN;
      if (i === 1) {
        v.intradayPrice = b.close;
        v.overnightPrice = b.close;
      } else {
        v.intradayPrice = v.intradayPrice * intradayChange;
        v.overnightPrice = v.overnightPrice * overnightChange;
      }
      const intra = showIntra ? v.intradayPrice : NaN;
      const over = showOver ? v.overnightPrice : NaN;
      s.plot0[i] = { time: b.time, value: Number.isFinite(intra) ? intra : NaN, color: color.orange };
      s.plot1[i] = { time: b.time, value: Number.isFinite(over) ? over : NaN, color: color.fuchsia };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(
  inputs: Partial<IntradayVsOvernightChangeTrackerInputs> = {},
  chart: ChartContext = {},
): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<IntradayVsOvernightChangeTrackerInputs> = {},
): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const IntradayVsOvernightChangeTracker = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
