/**
 * Simple Moving Averages
 *
 * Ten configurable SMA lines matching Pine source periods: 20,50,100,150,200,250,300,400,500,600.
 * SMAs #1-#5 use blue/orange coloring, #6-#10 use green/red coloring in Pine.
 *
 * Reference: "Simple Moving Averages" (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface SimpleMovingAveragesInputs {
  src: SourceType;
}

export const defaultInputs: SimpleMovingAveragesInputs = {
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

const lengths = [20, 50, 100, 150, 200, 250, 300, 400, 500, 600];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMA #1 (20)', color: '#2196F3', lineWidth: 1 },
  { id: 'plot1', title: 'SMA #2 (50)', color: '#2196F3', lineWidth: 2 },
  { id: 'plot2', title: 'SMA #3 (100)', color: '#2196F3', lineWidth: 1 },
  { id: 'plot3', title: 'SMA #4 (150)', color: '#2196F3', lineWidth: 1 },
  { id: 'plot4', title: 'SMA #5 (200)', color: '#2196F3', lineWidth: 4 },
  { id: 'plot5', title: 'SMA #6 (250)', color: '#4CAF50', lineWidth: 1 },
  { id: 'plot6', title: 'SMA #7 (300)', color: '#4CAF50', lineWidth: 2 },
  { id: 'plot7', title: 'SMA #8 (400)', color: '#4CAF50', lineWidth: 1 },
  { id: 'plot8', title: 'SMA #9 (500)', color: '#4CAF50', lineWidth: 1 },
  { id: 'plot9', title: 'SMA #10 (600)', color: '#4CAF50', lineWidth: 4 },
];

export const metadata = {
  title: 'Simple Moving Averages',
  shortTitle: 'SMAs',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

const ABOVE = lengths.map((_l, idx) => (idx < 5 ? '#2196F3' : '#4CAF50'));
const BELOW = lengths.map((_l, idx) => (idx < 5 ? '#FF9800' : '#EF5350'));

interface SmasRun extends BarRunState<Record<string, never>> {
  smas: WindowSma[];
  plots: Point[][];
}

function study(inputs: Partial<SimpleMovingAveragesInputs>): BarStudy<SmasRun, IndicatorResult> {
  const cfg = { ...defaultInputs, ...inputs };
  const value = barSource(cfg.src);
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      const smas = lengths.map((len) => new WindowSma(len));
      const plots: Point[][] = lengths.map(() => []);
      return { smas, plots, steps: smas, vars: {}, lists: [], series: plots };
    },
    bar(s, i, bars) {
      const b = bars[i];
      const time = b.time;
      const close = b.close;
      const v = value(b);
      // Pine: SMAs #1-#5 use close >= sma ? blue : orange, #6-#10 use close >= sma ? green : red
      for (let idx = 0; idx < lengths.length; idx++) {
        const sma = s.smas[idx].step(v);
        s.plots[idx][i] = i < lengths[idx] || sma == null
          ? { time, value: NaN }
          : { time, value: sma, color: close >= sma ? ABOVE[idx] : BELOW[idx] };
      }
    },
    result(s) {
      const plots: Record<string, Point[]> = {};
      s.plots.forEach((p, idx) => { plots[`plot${idx}`] = p.slice(); });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots,
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<SimpleMovingAveragesInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<SimpleMovingAveragesInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const SimpleMovingAverages = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
