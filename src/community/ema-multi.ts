/**
 * EMA 20/50/100/200
 *
 * Four EMA lines at common periods: 20, 50, 100, 200.
 *
 * Reference: "EMA 20/50/100/200" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface EMAMultiInputs {
  src: SourceType;
}

export const defaultInputs: EMAMultiInputs = {
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA 20', color: '#FF6D00', lineWidth: 1 },
  { id: 'plot1', title: 'EMA 50', color: '#2962FF', lineWidth: 1 },
  { id: 'plot2', title: 'EMA 100', color: '#00E676', lineWidth: 1 },
  { id: 'plot3', title: 'EMA 200', color: '#E91E63', lineWidth: 2 },
];

export const metadata = {
  title: 'EMA 20/50/100/200',
  shortTitle: 'EMA4',
  overlay: true,
};

type Point = { time: number; value: number };

const lengths = [20, 50, 100, 200];

interface EmaMultiRun extends BarRunState<Record<string, never>> {
  emas: ReturnType<typeof taStep.ema>[];
  plots: Point[][];
  fillColors: string[][];
}

function study(inputs: Partial<EMAMultiInputs>): BarStudy<EmaMultiRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const emas = lengths.map((len) => taStep.ema(len));
      const s: EmaMultiRun = {
        emas, plots: [[], [], [], []], fillColors: [[], [], []], steps: [...emas], vars: {}, lists: [], series: [],
      };
      s.series = [...s.plots, ...s.fillColors];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i]!;
      const time = b.time as number;
      const v = value(b);
      const e20 = s.emas[0]!.step(v);
      const e50 = s.emas[1]!.step(v);
      const e100 = s.emas[2]!.step(v);
      const e200 = s.emas[3]!.step(v);
      s.plots[0]![i] = { time, value: i < 20 ? NaN : e20 };
      s.plots[1]![i] = { time, value: i < 50 ? NaN : e50 };
      s.plots[2]![i] = { time, value: i < 100 ? NaN : e100 };
      s.plots[3]![i] = { time, value: i < 200 ? NaN : e200 };

      // Dynamic fills between adjacent EMAs: green when shorter EMA > longer EMA, red otherwise
      const [fillColors01, fillColors12, fillColors23] = s.fillColors as [string[], string[], string[]];
      if (i < 200 || isNaN(e20) || isNaN(e50) || isNaN(e100) || isNaN(e200)) {
        fillColors01[i] = 'rgba(0,0,0,0)';
        fillColors12[i] = 'rgba(0,0,0,0)';
        fillColors23[i] = 'rgba(0,0,0,0)';
      } else {
        fillColors01[i] = e20 > e50 ? 'rgba(0,230,118,0.15)' : 'rgba(255,109,0,0.15)';
        fillColors12[i] = e50 > e100 ? 'rgba(0,230,118,0.15)' : 'rgba(255,109,0,0.15)';
        fillColors23[i] = e100 > e200 ? 'rgba(0,230,118,0.15)' : 'rgba(255,109,0,0.15)';
      }
    },
    result(s) {
      const plots: Record<string, Array<{ time: number; value: number }>> = {};
      for (let idx = 0; idx < lengths.length; idx++) plots[`plot${idx}`] = s.plots[idx]!.slice();
      const fills = [
        { plot1: 'plot0', plot2: 'plot1', options: { color: 'rgba(0,230,118,0.15)' }, colors: s.fillColors[0]!.slice() },
        { plot1: 'plot1', plot2: 'plot2', options: { color: 'rgba(0,230,118,0.15)' }, colors: s.fillColors[1]!.slice() },
        { plot1: 'plot2', plot2: 'plot3', options: { color: 'rgba(0,230,118,0.15)' }, colors: s.fillColors[2]!.slice() },
      ];
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
        fills,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<EMAMultiInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<EMAMultiInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const EMAMulti = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
