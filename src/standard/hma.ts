/**
 * Hull Moving Average (HMA) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Reduces lag while maintaining smoothness using weighted moving averages.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface HMAInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: HMAInputs = {
  length: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 9, min: 2 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'HMA', color: '#00897B', lineWidth: 1 },
];

export const metadata = {
  title: 'Hull Moving Average',
  shortTitle: 'HMA',
  overlay: true,
};

type Point = { time: number; value: number };

interface HmaRun extends BarRunState<Record<string, never>> {
  wma1: ReturnType<typeof taStep.wma>;
  wma2: ReturnType<typeof taStep.wma>;
  hma: ReturnType<typeof taStep.wma>;
  plotData: Point[];
}

function study(inputs: Partial<HMAInputs>): BarStudy<HmaRun, IndicatorResult> {
  const { length, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);

  // HMA = WMA(2*WMA(n/2) - WMA(n), sqrt(n))
  const halfLength = Math.max(1, Math.floor(length / 2));
  const sqrtLength = Math.max(1, Math.floor(Math.sqrt(length)));
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const wma1 = taStep.wma();
      const wma2 = taStep.wma();
      const hma = taStep.wma();
      const s: HmaRun = { wma1, wma2, hma, plotData: [], steps: [wma1, wma2, hma], vars: {}, lists: [], series: [] };
      s.series = [s.plotData];
      return s;
    },
    bar(s, i, bars) {
      const v = value(bars[i]);
      const diff = s.wma1.step(v, halfLength) * 2 - s.wma2.step(v, length);
      s.plotData[i] = { time: bars[i].time as number, value: s.hma.step(diff, sqrtLength) };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.plotData.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<HMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<HMAInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const HMA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
