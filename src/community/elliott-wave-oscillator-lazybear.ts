/**
 * Elliot Wave Oscillator [LazyBear]
 *
 * EMA(close, 5) - EMA(close, 35), drawn as a histogram: lime above zero, red at zero and below.
 *
 * Reference: "Elliot Wave Oscillator [LazyBear]" by LazyBear
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

// The original has no input
export type ElliottWaveOscillatorLazybearInputs = Record<string, never>;

export const defaultInputs: ElliottWaveOscillatorLazybearInputs = {};

export const inputConfig: InputConfig[] = [];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const RED = V1('#FF0000');
const LIME = V1('#00FF00');

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EWO', color: LIME, lineWidth: 2, style: 'histogram' },
];

export const metadata = {
  title: 'Elliot Wave Oscillator [LazyBear]',
  shortTitle: 'EWO_LB',
  overlay: false,
};

type Point = { time: number; value: number; color: string };

interface EwoRun extends BarRunState<Record<string, never>> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  plot0: Point[];
}

function study(): BarStudy<EwoRun, IndicatorResult> {
  return {
    init() {
      const fast = taStep.ema(5);
      const slow = taStep.ema(35);
      const s: EwoRun = { fast, slow, plot0: [], steps: [fast, slow], vars: {}, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const s2 = (s.fast.step(b.close) ?? NaN) - (s.slow.step(b.close) ?? NaN);
      // c_color = s2 <= 0 ? red : lime (Pine float comparison: within 1e-10 of zero counts as zero; na gives lime)
      s.plot0[i] = { time: b.time as number, value: s2, color: !isNaN(s2) && !(s2 > 1e-10) ? RED : LIME };
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
export function createRun(_inputs: Partial<ElliottWaveOscillatorLazybearInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(), chart);
}

export function calculate(bars: Bar[], _inputs: Partial<ElliottWaveOscillatorLazybearInputs> = {}): IndicatorResult {
  return fullResult(createRun(_inputs).update(bars));
}

export const ElliottWaveOscillatorLazybear = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
