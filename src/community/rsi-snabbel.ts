/**
 * RSI Snabbel
 *
 * Dual-period RSI comparison. Fast RSI and slow RSI plotted together.
 * Signals when fast RSI crosses slow RSI.
 *
 * Reference: "RSI Snabbel"
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface RSISnabbelInputs {
  rsiLen1: number;
  rsiLen2: number;
  src: SourceType;
}

export const defaultInputs: RSISnabbelInputs = {
  rsiLen1: 7,
  rsiLen2: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen1', type: 'int', title: 'Fast RSI Length', defval: 7, min: 1 },
  { id: 'rsiLen2', type: 'int', title: 'Slow RSI Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RSI Fast', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'RSI Slow', color: '#FF6D00', lineWidth: 1 },
];

export const metadata = {
  title: 'RSI Snabbel',
  shortTitle: 'RSISnab',
  overlay: false,
};

type Point = { time: number; value: number };

interface SnabbelRun extends BarRunState<Record<string, never>> {
  fast: ReturnType<typeof taStep.rsi>;
  slow: ReturnType<typeof taStep.rsi>;
  plot0: Point[];
  plot1: Point[];
}

function study(inputs: Partial<RSISnabbelInputs>): BarStudy<SnabbelRun, IndicatorResult> {
  const { rsiLen1, rsiLen2, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = Math.max(rsiLen1, rsiLen2);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const fast = taStep.rsi(rsiLen1);
      const slow = taStep.rsi(rsiLen2);
      const s: SnabbelRun = { fast, slow, plot0: [], plot1: [], steps: [fast, slow], vars: {}, lists: [], series: [] };
      s.series = [s.plot0, s.plot1];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const v = value(b);
      const f = s.fast.step(v);
      const sl = s.slow.step(v);
      s.plot0[i] = { time: b.time as number, value: (f == null || i < warmup) ? NaN : f };
      s.plot1[i] = { time: b.time as number, value: (sl == null || i < warmup) ? NaN : sl };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice() },
        hlines: [
          { value: 80, options: { color: '#EF5350', linestyle: 'dashed' as const, title: 'Overbought' } },
          { value: 55, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Upper Mid' } },
          { value: 50, options: { color: '#000000', linestyle: 'dashed' as const, title: 'Midline' } },
          { value: 45, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Lower Mid' } },
          { value: 20, options: { color: '#4CAF50', linestyle: 'dashed' as const, title: 'Oversold' } },
        ],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<RSISnabbelInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<RSISnabbelInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const RSISnabbel = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
