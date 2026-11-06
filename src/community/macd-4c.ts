/**
 * MACD 4C (Four Color MACD)
 *
 * Standard MACD histogram with 4-color coding:
 * - Lime: positive and rising
 * - Green: positive and falling
 * - Maroon: negative and falling
 * - Red: negative and rising
 *
 * Reference: "MACD 4C" by vkno422
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface MACD4CInputs {
  fastLength: number;
  slowLength: number;
  signalLength: number;
  src: SourceType;
}

export const defaultInputs: MACD4CInputs = {
  fastLength: 12,
  slowLength: 26,
  signalLength: 9,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLength', type: 'int', title: 'Fast MA', defval: 12, min: 1 },
  { id: 'slowLength', type: 'int', title: 'Slow MA', defval: 26, min: 1 },
  { id: 'signalLength', type: 'int', title: 'Signal Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MACD 4C', color: '#26A69A', lineWidth: 3, style: 'histogram' },
];

export const metadata = {
  title: 'MACD 4C',
  shortTitle: 'MACD4C',
  overlay: false,
};

type Point = { time: number; value: number; color: string };

interface Macd4cRun extends BarRunState<Record<string, never>> {
  fast: ReturnType<typeof taStep.ema>;
  slow: ReturnType<typeof taStep.ema>;
  macdArr: number[];
  data: Point[];
}

function study(inputs: Partial<MACD4CInputs>): BarStudy<Macd4cRun, IndicatorResult> {
  const { fastLength, slowLength, src } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const fast = taStep.ema(fastLength);
      const slow = taStep.ema(slowLength);
      const s: Macd4cRun = { fast, slow, macdArr: [], data: [], steps: [fast, slow], vars: {}, lists: [], series: [] };
      s.series = [s.macdArr, s.data];
      return s;
    },
    bar(s, i, bars) {
      const x = value(bars[i]);
      const v = s.fast.step(x) - s.slow.step(x);
      s.macdArr[i] = v;
      const prev = i > 0 ? (s.macdArr[i - 1] ?? NaN) : NaN;
      let color: string;
      if (v > 0) {
        color = v > prev ? '#00FF00' : '#008000'; // lime : green
      } else {
        color = v < prev ? '#800000' : '#FF0000'; // maroon : red
      }
      s.data[i] = { time: bars[i].time as number, value: v, color };
    },
    result(s) {
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': s.data.slice() },
        hlines: [{ value: 0, options: { color: '#787B86', linestyle: 'solid', title: 'Zero' } }],
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<MACD4CInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<MACD4CInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const MACD4C = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
