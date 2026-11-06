/**
 * RSI Divergence
 *
 * Plots the difference between fast RSI and slow RSI as a single colored line.
 * divergence = RSI(fast) - RSI(slow)
 * Colored lime when positive, red when negative.
 *
 * Reference: "RSI Divergence"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RSIDivergenceInputs {
  lenFast: number;
  lenSlow: number;
  src: SourceType;
}

export const defaultInputs: RSIDivergenceInputs = {
  lenFast: 5,
  lenSlow: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'lenFast', type: 'int', title: 'Length Fast RSI', defval: 5, min: 1 },
  { id: 'lenSlow', type: 'int', title: 'Length Slow RSI', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Divergence', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'RSI Divergence',
  shortTitle: 'RSIDiv',
  overlay: false,
};

type Point = { time: number; value: number; color?: string };

interface RsiDivRun extends BarRunState<Record<string, never>> {
  fast: ReturnType<typeof taStep.rsi>;
  slow: ReturnType<typeof taStep.rsi>;
  plot0: Point[];
}

function study(inputs: Partial<RSIDivergenceInputs>): BarStudy<RsiDivRun, IndicatorResult> {
  const { lenFast, lenSlow, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = Math.max(lenFast, lenSlow);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const fast = taStep.rsi(lenFast);
      const slow = taStep.rsi(lenSlow);
      const s: RsiDivRun = { fast, slow, plot0: [], steps: [fast, slow], vars: {}, lists: [], series: [] };
      s.series = [s.plot0];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = value(b);
      const f = s.fast.step(v);
      const sl = s.slow.step(v);
      if (i < warmup || f == null || sl == null) {
        s.plot0[i] = { time: b.time, value: NaN };
        return;
      }
      const div = f - sl;
      s.plot0[i] = { time: b.time, value: div, color: div > 0 ? '#00FF00' : '#FF0000' };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice() },
        hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Zero' } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RSIDivergenceInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RSIDivergenceInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RSIDivergence = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
