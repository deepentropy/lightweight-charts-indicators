/**
 * Volume Weighted Moving Average (VWMA) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * A moving average weighted by volume.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowVwma, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VWMAInputs {
  length: number;
  src: SourceType;
  offset: number;
}

export const defaultInputs: VWMAInputs = {
  length: 20,
  src: 'close',
  offset: 0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'VWMA', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Volume Weighted Moving Average',
  shortTitle: 'VWMA',
  overlay: true,
};

interface VWMARun extends BarRunState<Record<string, never>> {
  vwma: WindowVwma;
  vwmaArr: number[];
}

function study(inputs: Partial<VWMAInputs>): BarStudy<VWMARun, IndicatorResult> {
  const { length, src, offset } = { ...defaultInputs, ...inputs };
  const value = barSource(src);
  return {
    fullRunReason: () => (isBarSource(src) ? null : 'source of another study'),
    init() {
      const vwma = new WindowVwma(length);
      const s: VWMARun = { vwma, vwmaArr: [], steps: [vwma], vars: {}, lists: [], series: [] };
      s.series = [s.vwmaArr];
      return s;
    },
    bar(s, i, bars) {
      const b = bars[i];
      s.vwmaArr[i] = s.vwma.step(value(b), b.volume ?? 0);
    },
    result(s, bars) {
      // plot(..., offset = offset): bar i shows the value of bar i - offset
      const vwmaArr = s.vwmaArr;
      const plotData = bars.map((bar, i) => {
        const srcIdx = i - offset;
        return { time: bar.time, value: (srcIdx >= 0 && srcIdx < bars.length) ? (vwmaArr[srcIdx] ?? NaN) : NaN };
      });
      return {
        metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
        plots: { 'plot0': plotData },
      };
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VWMAInputs> = {}, chart: ChartContext = {}): IndicatorRun<IndicatorResult> {
  return createBarRun(study(inputs), chart);
}

export function calculate(bars: Bar[], inputs: Partial<VWMAInputs> = {}): IndicatorResult {
  return fullResult(createRun(inputs).update(bars));
}

export const VWMA = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
