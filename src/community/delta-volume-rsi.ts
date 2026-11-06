/**
 * Delta Volume RSI
 *
 * RSI of the tick-rule volume delta: the delta is +volume on an up close, -volume on a down close and 0 otherwise.
 * gains = rma(positive delta, period), losses = rma(-negative delta, period) (0.0001 when losses is 0);
 * RSI = 100 - 100 / (1 + gains / losses). The line is green at 50 and above, red below. Lines at 70, 50 and 30.
 *
 * Reference: "Delta Volume RSI" by destrobr0685
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface DeltaVolumeRsiInputs {
  /** RSI period */
  period: number;
}

export const defaultInputs: DeltaVolumeRsiInputs = {
  period: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'RSI Period', defval: 14 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Delta Volume RSI', color: color.green, lineWidth: 2 },
];

export const metadata = {
  title: 'Delta Volume RSI',
  shortTitle: 'Delta Volume RSI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;

interface DvrRun extends BarRunState<Record<string, never>> {
  gains: ReturnType<typeof taStep.rma>;
  losses: ReturnType<typeof taStep.rma>;
  plot0: { time: number; value: number; color: string }[];
}

function study(inputs: Partial<DeltaVolumeRsiInputs>): BarStudy<DvrRun, IndicatorResult> {
  const { period } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const gains = taStep.rma(period);
      const losses = taStep.rma(period);
      const s: DvrRun = { gains, losses, plot0: [], steps: [gains, losses], vars: {}, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // deltaVolume = close > close[1] ? volume : close < close[1] ? -volume : 0
      const prev = i > 0 ? bars[i - 1].close : NaN;
      const v = b.volume ?? NaN;
      const d = gt(b.close, prev) ? v : lt(b.close, prev) ? -v : 0;
      const gains = s.gains.step(gt(d, 0) ? d : 0);
      const lossesRaw = s.losses.step(lt(d, 0) ? -d : 0);
      const losses = eq(lossesRaw, 0) ? 0.0001 : lossesRaw;
      const fr = gains / losses;
      const rsi = 100 - 100 / (1 + fr);
      s.plot0[i] = { time: b.time, value: Number.isFinite(rsi) ? rsi : NaN, color: ge(rsi, 50) ? color.green : color.red };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
        hlines: [
          { value: 70, options: { title: 'Overbought', color: color.red, linestyle: 'dashed' } },
          { value: 50, options: { title: 'Middle', color: color.gray, linestyle: 'dashed' } },
          { value: 30, options: { title: 'Oversold', color: color.green, linestyle: 'dashed' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<DeltaVolumeRsiInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<DeltaVolumeRsiInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const DeltaVolumeRsi = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
