/**
 * Moving Average Colored EMA/SMA
 *
 * Single MA line colored by direction: green when rising, red when falling.
 *
 * Reference: "Moving Average Colored EMA/SMA" (community)
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowSma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MAColoredInputs {
  emaLength: number;
  smaLength: number;
  src: SourceType;
}

export const defaultInputs: MAColoredInputs = {
  emaLength: 8,
  smaLength: 8,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'emaLength', type: 'int', title: 'EMA Length', defval: 8, min: 1 },
  { id: 'smaLength', type: 'int', title: 'SMA Length', defval: 8, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: '#26A69A', lineWidth: 3 },
  { id: 'plot1', title: 'SMA', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Moving Average Colored',
  shortTitle: 'MAC',
  overlay: true,
};

type Point = { time: number; value: number; color?: string };

interface MacRun extends BarRunState<Record<string, never>> {
  ema: ReturnType<typeof taStep.ema>;
  sma: WindowSma;
  emaArr: number[];
  smaArr: number[];
  emaPlot: Point[];
  smaPlot: Point[];
}

function study(inputs: Partial<MAColoredInputs>): BarStudy<MacRun, IndicatorResult> {
  const { emaLength, smaLength, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const point = (arr: number[], i: number, length: number, time: number): Point => {
    if (i < length) return { time, value: NaN };
    const val = arr[i] ?? NaN;
    const prev = i > 0 ? (arr[i - 1] ?? val) : val;
    const color = val > prev ? '#26A69A' : val < prev ? '#EF5350' : '#2962FF';
    return { time, value: val, color };
  };
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const ema = taStep.ema(emaLength);
      const sma = new WindowSma(smaLength);
      const s: MacRun = {
        ema, sma, emaArr: [], smaArr: [], emaPlot: [], smaPlot: [], steps: [ema, sma], vars: {}, lists: [], series: [],
      };
      s.series = [s.emaArr, s.smaArr, s.emaPlot, s.smaPlot];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      const v = value(b);
      s.emaArr[i] = s.ema.step(v);
      s.smaArr[i] = s.sma.step(v);
      s.emaPlot[i] = point(s.emaArr, i, emaLength, b.time);
      s.smaPlot[i] = point(s.smaArr, i, smaLength, b.time);
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.emaPlot.slice(), 'plot1': s.smaPlot.slice() },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MAColoredInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MAColoredInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MAColored = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
