/**
 * Almost Zero Lag EMA
 *
 * ema1 = ema(close, length), ema2 = ema(ema1, length); the line is ema1 + (ema1 - ema2), a double EMA that takes
 * back most of the EMA lag.
 *
 * Reference: "Almost Zero Lag EMA [LazyBear]" by LazyBear
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: @author LazyBear
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ZeroLagEMAInputs {
  /** EMA length */
  length: number;
}

export const defaultInputs: ZeroLagEMAInputs = {
  length: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 10 },
];

// Pine v1 default plot colour (blue #0000FF) with the v1 default plot transparency of 35
const LINE = String(color.new('#0000FF', 35));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: LINE, lineWidth: 1 },
];

export const metadata = {
  title: 'Almost Zero Lag EMA [LazyBear]',
  shortTitle: 'ZeroLagEMA_LB',
  overlay: true,
};

type Point = { time: number; value: number };

interface ZlemaRun extends BarRunState<Record<string, never>> {
  ema1: ReturnType<typeof taStep.ema>;
  ema2: ReturnType<typeof taStep.ema>;
  plot0: Point[];
}

function study(inputs: Partial<ZeroLagEMAInputs>): BarStudy<ZlemaRun, IndicatorResult> {
  const { length } = { ...defaultInputs, ...inputs };
  return {
    init() {
      const ema1 = taStep.ema(length);
      const ema2 = taStep.ema(length);
      const s: ZlemaRun = { ema1, ema2, plot0: [], steps: [ema1, ema2], vars: {}, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const e1 = s.ema1.step(b.close);
      const e2 = s.ema2.step(e1);
      const zlema = e1 + (e1 - e2);
      s.plot0[i] = { time: b.time as number, value: Number.isFinite(zlema) ? zlema : NaN };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ZeroLagEMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ZeroLagEMAInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ZeroLagEMA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
