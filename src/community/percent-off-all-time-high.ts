/**
 * Percent Off All-time High (% Off High)
 *
 * The all-time high is the highest bar high seen so far (it starts at the high of the first bar). The line is the
 * distance of the close from it in percent: (close / ATH - 1) * 100 (0 on a new high, negative below it).
 *
 * Reference: "Percent Off All-time High (% Off High)" by xHmmmmm
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © xHmmmmm
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// The Pine script has no inputs
export interface PercentOffAllTimeHighInputs {}

export const defaultInputs: PercentOffAllTimeHighInputs = {};

export const inputConfig: InputConfig[] = [];

/** Pine default plot colour */
const PLOT_COLOR = '#2962FF';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: '% Off High', color: PLOT_COLOR, lineWidth: 1 },
];

export const metadata = {
  title: '% off high',
  shortTitle: '% off high',
  overlay: false,
  format: 'percent',
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

interface AthRun extends BarRunState<{ ath: number }> {
  plot0: { time: number; value: number; color: string }[];
}

function study(): BarStudy<AthRun, IndicatorResult> {
  return {
    init() {
      const s: AthRun = { plot0: [], steps: [], vars: { ath: NaN }, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = s.vars;
      // GetATH(high): var ATH = high (first bar); if high > nz(ATH, -1e10) then ATH := high
      if (i === 0) v.ath = b.high;
      if (gt(b.high, isNaN(v.ath) ? -1e10 : v.ath)) v.ath = b.high;
      // A plain division: x / 0 is +-infinity (0 / 0 NaN); the plot shows na for both
      const val = (b.close / v.ath - 1) * 100;
      s.plot0[i] = { time: b.time, value: Number.isFinite(val) ? val : NaN, color: PLOT_COLOR };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay, format: metadata.format },
        plots: { plot0: s.plot0.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<PercentOffAllTimeHighInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<PercentOffAllTimeHighInputs> = {}): IndicatorResult {
  return fullResult(createRun().update(bars));
}

export const PercentOffAllTimeHigh = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
