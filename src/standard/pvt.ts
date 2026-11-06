/**
 * Price Volume Trend (PVT) Indicator
 *
 * Cumulative volume indicator that relates volume to price change:
 * vt = ta.cum(ta.change(close) / close[1] * volume). The first bar has no change, so it is na.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PVTInputs {
  // No inputs needed
}

export const defaultInputs: PVTInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PVT', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Price Volume Trend',
  shortTitle: 'PVT',
  overlay: false,
};

type Point = { time: number; value: number };

interface PvtRun extends BarRunState<Record<string, never>> {
  cum: ReturnType<typeof taStep.cum>;
  pvtData: Point[];
}

function study(): BarStudy<PvtRun, IndicatorResult> {
  return {
    init() {
      const cum = taStep.cum();
      const s: PvtRun = { cum, pvtData: [], steps: [cum], vars: {}, lists: [], series: [] };
      s.series = [s.pvtData];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      // vt = ta.cum(ta.change(src) / src[1] * volume); x / 0 is +-infinity (0 / 0 na): ta.cum skips it (na on that bar)
      const term = i > 0 ? (b.close - bars[i - 1]!.close) / bars[i - 1]!.close * (b.volume ?? NaN) : NaN;
      s.pvtData[i] = { time: b.time as number, value: s.cum.step(term) };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.pvtData.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<PVTInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<PVTInputs> = {}): IndicatorResult {
  return fullResult(createRun(_inputs).update(bars));
}

export const PVT = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
