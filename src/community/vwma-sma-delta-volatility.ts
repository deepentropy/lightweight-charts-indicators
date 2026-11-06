/**
 * VWMA/SMA Delta Volatility (Statistical Anomaly Detector)
 *
 * delta = vwma(source, length) - sma(source, length). The last `sampleSize` deltas give a mean and a population
 * standard deviation (na values skipped); the filters are mean -+ zScore * stdev. The delta and the two filters are
 * scaled to -100..100 with the lowest / highest delta of the last `sampleSize` bars. The histogram is red when the
 * delta is negative and below the lower filter, green when it is positive and above the upper filter, faint silver
 * otherwise. Optional lines draw the scaled filters (Z-score channel).
 *
 * Reference: "VWMA/SMA Delta Volatility (Statistical Anomaly Detector)" by tkarolak
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © tkarolak
 */

import {
  taStep, color,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import {
  barSource, createBarRun, fullResult, isBarSource, WindowExtreme, WindowSma,
  type BarRunState, type BarStudy, type IndicatorRun,
} from '../live-run';

export interface VwmaSmaDeltaVolatilityInputs {
  /** Source for the MA delta */
  source: SourceType;
  /** Length of the VWMA and of the SMA */
  length: number;
  /** Number of deltas of the statistics and of the scaling */
  sampleSize: number;
  /** Standard deviation multiplier of the filters */
  zScore: number;
  /** Show the Z-score channel */
  showChannel: boolean;
}

export const defaultInputs: VwmaSmaDeltaVolatilityInputs = {
  source: 'close',
  length: 14,
  sampleSize: 100,
  zScore: 2.0,
  showChannel: true,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'int', title: 'MAs Length', defval: 14, min: 3 },
  { id: 'sampleSize', type: 'int', title: 'Statistical sample size', defval: 100, min: 20, max: 2000, step: 1 },
  { id: 'zScore', type: 'float', title: 'Z-score', defval: 2.0, min: 1.0, max: 3.0, step: 0.1 },
  { id: 'showChannel', type: 'bool', title: 'Z-score channel', defval: true },
];

const CHANNEL_COLOR = String(color.new(color.gray, 70));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Delta', color: '#2962FF', lineWidth: 1, style: 'histogram' },
  { id: 'plot1', title: 'Lower Filter', color: CHANNEL_COLOR, lineWidth: 1, display: 'pane' },
  { id: 'plot2', title: 'Upper Filter', color: CHANNEL_COLOR, lineWidth: 1, display: 'pane' },
];

export const metadata = {
  title: 'VWMA/SMA Delta Volatility (Statistical Anomaly Detector)',
  shortTitle: 'SAD',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

type Point = { time: number; value: number; color?: string };

interface DeltaRun extends BarRunState<Record<string, never>> {
  vwma: ReturnType<typeof taStep.vwma>;
  sma: WindowSma;
  lo: WindowExtreme;
  hi: WindowExtreme;
  delta: number[];
  plot0: Point[];
  plot1: Point[];
  plot2: Point[];
}

function study(inputs: Partial<VwmaSmaDeltaVolatilityInputs>): BarStudy<DeltaRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const { length, sampleSize, zScore, showChannel } = cfg;
  const value = barSource(cfg.source);
  const silver = String(color.new(color.silver, 80));
  return {
    fullRunReason: () => (isBarSource(cfg.source) ? null : 'source of another study'),
    init() {
      const s: DeltaRun = {
        vwma: taStep.vwma(length), sma: new WindowSma(length), lo: new WindowExtreme(true, sampleSize),
        hi: new WindowExtreme(false, sampleSize), delta: [], plot0: [], plot1: [], plot2: [],
        steps: [], vars: {}, lists: [], series: [],
      };
      s.steps = [s.vwma, s.sma, s.lo, s.hi];
      s.series = [s.delta, s.plot0, s.plot1, s.plot2];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const src = value(b);
      // delta = ta.vwma(source, lenght) - ta.sma(source, lenght)
      const d = s.vwma.step(src, b.volume ?? NaN) - s.sma.step(src);
      s.delta[i] = d;

      // var array<float> data = array.new_float(sampleSize, na); push(delta); shift(): the last sampleSize deltas
      // (na before the first bar); array.avg / array.stdev (biased): na values skipped, na when the array has no value
      const delta = s.delta;
      const first = i - sampleSize + 1;
      let count = 0;
      let sum = 0;
      for (let k = first; k <= i; k++) {
        const v = k >= 0 ? delta[k] : NaN;
        if (!Number.isNaN(v)) {
          count++;
          sum += v;
        }
      }
      const mean = count ? sum / count : NaN;
      let sq = 0;
      for (let k = first; k <= i; k++) {
        const v = k >= 0 ? delta[k] : NaN;
        if (!Number.isNaN(v)) sq += (v - mean) * (v - mean);
      }
      const stdev = count ? Math.sqrt(sq / count) : NaN;
      const lowerFilter = mean - zScore * stdev;
      const upperFilter = mean + zScore * stdev;

      // Scaling to -100..100 with the lowest / highest delta of the last sampleSize bars
      const lo = s.lo.step(d);
      const hi = s.hi.step(d);
      const scale = (x: number) => -100 + (200.0 * (x - lo)) / Math.max(hi - lo, 10e-10);

      const c = lt(d, 0) && lt(d, lowerFilter) ? color.red : gt(d, 0) && gt(d, upperFilter) ? color.green : silver;
      const v0 = scale(d);
      s.plot0[i] = { time: b.time, value: Number.isFinite(v0) ? v0 : NaN, color: c };
      const v1 = scale(lowerFilter);
      s.plot1[i] = { time: b.time, value: showChannel && Number.isFinite(v1) ? v1 : NaN, color: CHANNEL_COLOR };
      const v2 = scale(upperFilter);
      s.plot2[i] = { time: b.time, value: showChannel && Number.isFinite(v2) ? v2 : NaN, color: CHANNEL_COLOR };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plot0.slice(), plot1: s.plot1.slice(), plot2: s.plot2.slice() },
        hlines: [
          { value: 0, options: { title: 'Base Line', color: String(color.new(color.orange, 50)), linestyle: 'dotted' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VwmaSmaDeltaVolatilityInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VwmaSmaDeltaVolatilityInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VwmaSmaDeltaVolatility = {
  calculate,
  createRun,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
