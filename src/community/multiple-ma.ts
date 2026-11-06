/**
 * Multiple Moving Averages
 *
 * Six MAs at periods 10, 20, 50, 100, 150, 200 with selectable type.
 *
 * Reference: "Multiple Moving Averages" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MultipleMAInputs {
  maType: string;
  src: SourceType;
}

export const defaultInputs: MultipleMAInputs = {
  maType: 'ema',
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'ema', options: ['ema', 'sma', 'wma'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA 10', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot1', title: 'MA 20', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'MA 50', color: '#00E676', lineWidth: 1 },
  { id: 'plot3', title: 'MA 100', color: '#E91E63', lineWidth: 1 },
  { id: 'plot4', title: 'MA 150', color: '#9C27B0', lineWidth: 1 },
  { id: 'plot5', title: 'MA 200', color: '#FFEB3B', lineWidth: 2 },
];

export const metadata = {
  title: 'Multiple Moving Averages',
  shortTitle: 'MMA',
  overlay: true,
};

type Point = { time: number; value: number };
type Ma = { step(v: number): number; commit(): void };

function maStep(length: number, maType: string): Ma {
  switch (maType) {
    case 'sma': return new WindowSma(length);
    case 'wma': { const m = taStep.wma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
    default: return taStep.ema(length);
  }
}

const LENGTHS = [10, 20, 50, 100, 150, 200];

interface MmaRun extends BarRunState<Record<string, never>> {
  mas: Ma[];
  data: Point[][];
}

function study(inputs: Partial<MultipleMAInputs>): BarStudy<MmaRun, IndicatorResult> {
  const { maType, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const mas = LENGTHS.map((len) => maStep(len, maType));
      const data = LENGTHS.map((): Point[] => []);
      return { mas, data, steps: mas, vars: {}, lists: [], series: data };
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = value(b);
      for (let idx = 0; idx < LENGTHS.length; idx++) {
        const m = s.mas[idx].step(v);
        s.data[idx][i] = { time: b.time, value: i < LENGTHS[idx] ? NaN : (m ?? NaN) };
      }
    },
    result(s) {
      const plots: Record<string, Array<{ time: number; value: number }>> = {};
      for (let idx = 0; idx < LENGTHS.length; idx++) plots[`plot${idx}`] = s.data[idx].slice();
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MultipleMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MultipleMAInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MultipleMA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
