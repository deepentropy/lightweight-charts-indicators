/**
 * Three Moving Averages
 *
 * Three configurable MAs with selectable type (EMA/SMA/WMA).
 *
 * Reference: "Three Moving Averages" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface ThreeMovingAveragesInputs {
  len1: number;
  len2: number;
  len3: number;
  maType: string;
  src: SourceType;
}

export const defaultInputs: ThreeMovingAveragesInputs = {
  len1: 9,
  len2: 21,
  len3: 55,
  maType: 'ema',
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'len1', type: 'int', title: 'Length 1', defval: 9, min: 1 },
  { id: 'len2', type: 'int', title: 'Length 2', defval: 21, min: 1 },
  { id: 'len3', type: 'int', title: 'Length 3', defval: 55, min: 1 },
  { id: 'maType', type: 'string', title: 'MA Type', defval: 'ema', options: ['ema', 'sma', 'wma'] },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA 1', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot1', title: 'MA 2', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'MA 3', color: '#00E676', lineWidth: 1 },
];

export const metadata = {
  title: 'Three Moving Averages',
  shortTitle: '3MA',
  overlay: true,
};

type Point = { time: number; value: number };
type Ma = { step(v: number): number; commit(): void };

/** One moving average stepped bar by bar (EMA, SMA or WMA) */
function maStep(length: number, maType: string): Ma {
  switch (maType) {
    case 'sma': return new WindowSma(length);
    case 'wma': { const m = taStep.wma(); return { step: (v) => m.step(v, length), commit: () => m.commit() }; }
    default: return taStep.ema(length);
  }
}

interface TmaRun extends BarRunState<Record<string, never>> {
  mas: Ma[];
  plots: Point[][];
}

function study(inputs: Partial<ThreeMovingAveragesInputs>): BarStudy<TmaRun, IndicatorResult> {
  const { len1, len2, len3, maType, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const lengths = [len1, len2, len3];
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const mas = lengths.map((len) => maStep(len, maType));
      const plots: Point[][] = [[], [], []];
      return { mas, plots, steps: mas, vars: {}, lists: [], series: plots };
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = value(b);
      for (let idx = 0; idx < 3; idx++) {
        const ma = s.mas[idx].step(v);
        s.plots[idx][i] = { time: b.time, value: i < lengths[idx] ? NaN : (ma ?? NaN) };
      }
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { plot0: s.plots[0].slice(), plot1: s.plots[1].slice(), plot2: s.plots[2].slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<ThreeMovingAveragesInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<ThreeMovingAveragesInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const ThreeMovingAverages = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
