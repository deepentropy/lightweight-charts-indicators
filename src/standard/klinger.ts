/**
 * Klinger Oscillator Indicator
 *
 * Volume-based oscillator that measures long-term money flow trends.
 * Uses the difference between two EMAs of signed volume.
 *
 * Based on the standard Klinger Oscillator indicator.
 */

import { taStep, type Bar, type IndicatorResult, type InputConfig, type PlotConfig } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

/** The original has no inputs: the EMA lengths 34, 55 and 13 are fixed. */
export type KlingerInputs = Record<string, never>;

export const defaultInputs: KlingerInputs = {};

export const inputConfig: InputConfig[] = [];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Klinger Oscillator', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Signal', color: '#43A047', lineWidth: 1 },
];

export const metadata = {
  title: 'Klinger Oscillator',
  shortTitle: 'KVO',
  overlay: false,
};

type Point = { time: number; value: number };

interface KlingerRun extends BarRunState<Record<string, never>> {
  change: ReturnType<typeof taStep.change>;
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  sig: ReturnType<typeof taStep.ema>;
  plotData0: Point[];
  plotData1: Point[];
}

/**
 * Klinger Oscillator, bar by bar
 *
 * Algorithm from PineScript:
 * sv = ta.change(hlc3) >= 0 ? volume : -volume
 * kvo = ta.ema(sv, 34) - ta.ema(sv, 55)
 * sig = ta.ema(kvo, 13)
 */
function study(): BarStudy<KlingerRun, IndicatorResult> {
  const fastLength = 34;
  const slowLength = 55;
  const signalLength = 13;
  return {
    init() {
      const change = taStep.change(1);
      const fast = taStep.ema(fastLength);
      const slow = taStep.ema(slowLength);
      const sig = taStep.ema(signalLength);
      const s: KlingerRun = {
        change, fast, slow, sig, plotData0: [], plotData1: [],
        steps: [change, fast, slow, sig], vars: {}, lists: [], series: [],
      };
      s.series = [s.plotData0, s.plotData1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      // Calculate HLC3 and its change
      const change = s.change.step((b.high + b.low + b.close) / 3);
      // Calculate signed volume: sv = ta.change(hlc3) >= 0 ? volume : -volume
      // Pine float comparison: change >= 0 unless 0 - change > 1e-10; na (first bar) compares false
      const volume = b.volume ?? NaN;
      const up = change != null && !isNaN(change) && !(0 - change > 1e-10);
      const sv = up ? volume : -volume;
      // Calculate KVO = fast EMA - slow EMA
      const kvo = s.fast.step(sv) - s.slow.step(sv);
      // Calculate signal line
      const signal = s.sig.step(kvo);
      s.plotData0[i] = { time: b.time, value: kvo };
      s.plotData1[i] = { time: b.time, value: signal };
    },
    result(s) {
      return {
        metadata: {
          title: metadata.title,
          shorttitle: metadata.shortTitle,
          overlay: metadata.overlay,
        },
        plots: {
          'plot0': s.plotData0.slice(),
          'plot1': s.plotData1.slice(),
        },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(_inputs: Partial<KlingerInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(), chart);
}

/** Calculate Klinger Oscillator */
export function calculate(bars: Bar[], _inputs: Partial<KlingerInputs> = {}): IndicatorResult {
  return fullResult(createRun(_inputs).update(bars));
}

export const KlingerOscillator = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
