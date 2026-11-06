/**
 * Premier Stochastic Oscillator
 *
 * Stochastic → normalize to [-5,5] → double EMA smoothing → exp sigmoid (IFT).
 * Output oscillates between -1 and +1.
 *
 * Reference: "Premier Stochastic Oscillator [LazyBear]"
 */

import { taStep, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface PremierStochasticInputs {
  stochLength: number;
  smoothLength: number;
  src: SourceType;
}

export const defaultInputs: PremierStochasticInputs = {
  stochLength: 8,
  smoothLength: 25,
  src: 'close' as SourceType,
};

export const inputConfig: InputConfig[] = [
  { id: 'stochLength', type: 'int', title: 'Stoch Length', defval: 8, min: 1 },
  { id: 'smoothLength', type: 'int', title: 'Smooth Length', defval: 25, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'PSO', color: '#000000', lineWidth: 2 },
  { id: 'plot1', title: 'PSO Histogram', color: '#2196F3', lineWidth: 1, style: 'histogram' },
];

export const metadata = {
  title: 'Premier Stochastic Oscillator',
  shortTitle: 'PSO',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };

interface PsoRun extends BarRunState<Record<string, never>> {
  stoch: ReturnType<typeof taStep.stoch>;
  ema1: ReturnType<typeof taStep.ema>;
  ema2: ReturnType<typeof taStep.ema>;
  /** The source values of another study (null: read from the bars) */
  ext: number[] | null;
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<PremierStochasticInputs>): BarStudy<PsoRun, IndicatorResult> {
  const { stochLength, smoothLength, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = stochLength + smoothLength * 2;

  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init(bars) {
      const stoch = taStep.stoch(stochLength);
      const ema1 = taStep.ema(smoothLength);
      const ema2 = taStep.ema(smoothLength);
      const s: PsoRun = {
        stoch, ema1, ema2, ext: isBarSource(src) ? null : getSourceSeries(bars, src).toArray(), plot0: [], plot1: [],
        steps: [stoch, ema1, ema2], vars: {}, lists: [], series: [],
      };
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const rawStoch = s.stoch.step(s.ext ? s.ext[i] : value(b), b.high, b.low);

      // Normalize: nStoch = 0.1 * (rawStoch - 50)
      const nStoch = isNaN(rawStoch) ? 0 : 0.1 * (rawStoch - 50);
      const ss1 = s.ema1.step(nStoch);
      const ss = s.ema2.step(isNaN(ss1) ? 0 : ss1);

      // IFT: PSO = (exp(2*ss) - 1) / (exp(2*ss) + 1)
      const v = isNaN(ss) ? 0 : ss;
      const e = Math.exp(2 * v);
      const pso = (e - 1) / (e + 1);

      const time = b.time;
      if (i < warmup) {
        s.plot0[i] = { time, value: NaN };
        s.plot1[i] = { time, value: NaN };
      } else {
        // Pine: plot(pso, title="Premier Stoch", color=black, linewidth=2) -- line
        s.plot0[i] = { time, value: pso };
        // Pine: plot(pso, color=iff(pso < 0, red, blue), style=histogram) -- histogram with conditional color
        s.plot1[i] = { time, value: pso, color: pso < 0 ? '#EF5350' : '#2196F3' };
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice() },
        hlines: [
          { value: 0, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Zero' } },
          { value: 0.2, options: { color: '#2196F3', linestyle: 'dashed' as const, title: 'Upper Trigger' } },
          { value: 0.9, options: { color: '#2196F3', linestyle: 'solid' as const, title: 'Upper' } },
          { value: -0.2, options: { color: '#EF5350', linestyle: 'dashed' as const, title: 'Lower Trigger' } },
          { value: -0.9, options: { color: '#EF5350', linestyle: 'solid' as const, title: 'Lower' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<PremierStochasticInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<PremierStochasticInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const PremierStochastic = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
