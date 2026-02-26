/**
 * Weighted Moving Average (WMA) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * A moving average that assigns linearly increasing weights to more recent data.
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

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
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'WMA', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'Moving Average Weighted',
  shortTitle: 'WMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<WMAInputs> = {}): IndicatorResult {
  const { length, src, offset } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const wmaArr = ta.wma(source, length).toArray();

  const plotData = bars.map((bar, i) => {
    const srcIdx = i - offset;
    return { time: bar.time, value: (srcIdx >= 0 && srcIdx < bars.length) ? (wmaArr[srcIdx] ?? NaN) : NaN };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData },
  };
}

export const WMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
