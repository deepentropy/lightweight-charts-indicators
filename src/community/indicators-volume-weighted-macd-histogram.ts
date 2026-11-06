/**
 * Volume Weighted MACD [LazyBear]
 *
 * A MACD histogram built on volume-weighted averages: each average is ema(volume * close, n) / ema(volume, n).
 * d = average(12) - average(26), signal = ema(d, 9), histogram = d - signal. The histogram is green when it is at or
 * above 0 and rising, red when it is below 0 and falling, orange otherwise.
 *
 * As in the original, the input titled "Short period" (12) is named `slow` and "Long period" (26) is named `fast`.
 *
 * Reference: "Volume Weighted MACD [LazyBear]" by LazyBear
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { createBarRun, fullResult, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface IndicatorsVolumeWeightedMacdHistogramInputs {
  /** "Short period" */
  slow: number;
  /** "Long period" */
  fast: number;
  /** "Smoothing period" */
  signal: number;
}

export const defaultInputs: IndicatorsVolumeWeightedMacdHistogramInputs = {
  slow: 12,
  fast: 26,
  signal: 9,
};

export const inputConfig: InputConfig[] = [
  { id: 'slow', type: 'int', title: 'Short period', defval: 12 },
  { id: 'fast', type: 'int', title: 'Long period', defval: 26 },
  { id: 'signal', type: 'int', title: 'Smoothing period', defval: 9 },
];

// Colour constants of Pine v1
const GREEN = '#008000';
const ORANGE = '#FF7F00';
const RED = '#FF0000';

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: GREEN, lineWidth: 3, style: 'histogram' },
];

export const metadata = {
  title: 'Volume Weighted MACD [LazyBear]',
  shortTitle: 'VWMACD_LB',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);

interface VwMacdRun extends BarRunState<Record<string, never>> {
  fastNum: ReturnType<typeof taStep.ema>;
  fastDen: ReturnType<typeof taStep.ema>;
  slowNum: ReturnType<typeof taStep.ema>;
  slowDen: ReturnType<typeof taStep.ema>;
  sig: ReturnType<typeof taStep.ema>;
  dm: number[];
  plot0: { time: number; value: number; color: string }[];
}

function study(inputs: Partial<IndicatorsVolumeWeightedMacdHistogramInputs>): BarStudy<VwMacdRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    init() {
      const fastNum = taStep.ema(cfg.fast);
      const fastDen = taStep.ema(cfg.fast);
      const slowNum = taStep.ema(cfg.slow);
      const slowDen = taStep.ema(cfg.slow);
      const sig = taStep.ema(cfg.signal);
      const s: VwMacdRun = {
        fastNum, fastDen, slowNum, slowDen, sig, dm: [], plot0: [],
        steps: [fastNum, fastDen, slowNum, slowDen, sig], vars: {}, lists: [], series: [],
      };
      s.series = [s.dm, s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const volume = b.volume ?? NaN;
      const volClose = (b.volume ?? NaN) * b.close;
      // average(n) = ema(volume * close, n) / ema(volume, n)
      const maFast = s.fastNum.step(volClose) / s.fastDen.step(volume);
      const maSlow = s.slowNum.step(volClose) / s.slowDen.step(volume);
      const d = maSlow - maFast;
      const maSignal = s.sig.step(d);
      const dm = d - maSignal;
      s.dm[i] = dm;
      const prev = i > 0 ? s.dm[i - 1] : NaN;
      const c = ge(dm, 0) ? (gt(dm, prev) ? GREEN : ORANGE) : (lt(dm, prev) ? RED : ORANGE);
      s.plot0[i] = { time: b.time, value: Number.isFinite(dm) ? dm : NaN, color: c };
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
export function createRun(inputs: Partial<IndicatorsVolumeWeightedMacdHistogramInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<IndicatorsVolumeWeightedMacdHistogramInputs> = {},
): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const IndicatorsVolumeWeightedMacdHistogram = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
