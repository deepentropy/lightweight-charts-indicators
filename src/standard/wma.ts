/**
 * Weighted Moving Average (WMA) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * A moving average that assigns linearly increasing weights to more recent data.
 */

import { taStep, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface WMAInputs {
  length: number;
  src: SourceType;
  offset: number;
}

export const defaultInputs: WMAInputs = {
  length: 9,
  src: 'close',
  offset: 0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500, display: 'none' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'WMA', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Moving Average Weighted',
  shortTitle: 'WMA',
  overlay: true,
};

type Point = { time: number; value: number };

interface WmaRun extends BarRunState<Record<string, never>> {
  wma: ReturnType<typeof taStep.wma>;
  wmaArr: number[];
  plotData: Point[];
}

function study(inputs: Partial<WMAInputs>): BarStudy<WmaRun, IndicatorResult> {
  const { length, src, offset } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  const intOffset = Number.isInteger(offset);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const wma = taStep.wma();
      const s: WmaRun = { wma, wmaArr: [], plotData: [], steps: [wma], vars: {}, lists: [], series: [] };
      s.series = [s.wmaArr, s.plotData];
      return s;
    },
    bar(s, i, bars) {
      const bar = bars[i];
      const w = s.wma.step(value(bar), length) ?? NaN;
      s.wmaArr[i] = w;
      // the plot of bar i is the WMA of bar i - offset: a positive offset reads an earlier bar; a negative one is
      // written by bar i - offset (the only writer of that slot), na until then
      if (!intOffset) {
        s.plotData[i] = { time: bar.time as number, value: NaN };
      } else if (offset >= 0) {
        const srcIdx = i - offset;
        s.plotData[i] = { time: bar.time as number, value: srcIdx >= 0 ? s.wmaArr[srcIdx] : NaN };
      } else {
        s.plotData[i] = { time: bar.time as number, value: NaN };
        const k = i + offset;
        if (k >= 0) s.plotData[k] = { time: bars[k].time as number, value: w };
      }
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
export function createRun(inputs: Partial<WMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<WMAInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const WMA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
