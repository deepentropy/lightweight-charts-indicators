/**
 * Moving Average Shaded Fill Area Crossover
 *
 * Two EMAs with fill between them. Fast line colored green when above slow, red when below.
 *
 * Reference: "Moving Average Shaded Fill Area Crossover" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MAShadedFillInputs {
  fastLen: number;
  slowLen: number;
  src: SourceType;
}

export const defaultInputs: MAShadedFillInputs = {
  fastLen: 9,
  slowLen: 21,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLen', type: 'int', title: 'Fast Length', defval: 9, min: 1 },
  { id: 'slowLen', type: 'int', title: 'Slow Length', defval: 21, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA', color: '#00E676', lineWidth: 1 },
  { id: 'plot1', title: 'Slow EMA', color: '#FF5252', lineWidth: 1 },
];

export const metadata = {
  title: 'MA Shaded Fill Crossover',
  shortTitle: 'MASF',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

interface MasfRun extends BarRunState<Record<string, never>> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  plot0: Point[];
  plot1: Point[];
  fillColors: string[];
}

function study(inputs: Partial<MAShadedFillInputs>): BarStudy<MasfRun, IndicatorResult> {
  const { fastLen, slowLen, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const warmup = Math.max(fastLen, slowLen);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const fast = taStep.ema(fastLen);
      const slow = taStep.ema(slowLen);
      const s: MasfRun = { fast, slow, plot0: [], plot1: [], fillColors: [], steps: [fast, slow], vars: {}, lists: [], series: [] };
      s.series = [s.plot0, s.plot1, s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const time = bars[i].time as number;
      const x = value(bars[i]);
      const f = s.fast.step(x);
      const v = s.slow.step(x);
      if (i < warmup) {
        s.plot0[i] = { time, value: NaN };
        s.plot1[i] = { time, value: NaN };
        s.fillColors[i] = 'transparent';
        return;
      }
      const fv = f ?? 0;
      const sv = v ?? 0;
      s.plot0[i] = { time, value: fv, color: fv > sv ? '#00E676' : '#FF5252' };
      s.plot1[i] = { time, value: v ?? NaN };
      s.fillColors[i] = fv > sv ? '#00E67640' : '#FF525240';
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plot0.slice(), 'plot1': s.plot1.slice() },
        fills: [{ plot1: 'plot0', plot2: 'plot1', colors: s.fillColors.slice() }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MAShadedFillInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MAShadedFillInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MAShadedFill = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
