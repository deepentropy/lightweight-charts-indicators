/**
 * McGinley Dynamic Indicator
 *
 * An adaptive moving average that adjusts to market speed: it starts from the EMA of the source and then
 * follows MD = MD[1] + (src - MD[1]) / (length * (src / MD[1])^4).
 */

import { getSourceSeries, ta, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface McGinleyDynamicInputs {
  length: number;
}

export const defaultInputs: McGinleyDynamicInputs = {
  length: 14,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 14, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'McGinley Dynamic', color: '#2962FF', lineWidth: 1 },
];

export const metadata = {
  title: 'McGinley Dynamic',
  shortTitle: 'McGinley Dynamic',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<McGinleyDynamicInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };
  const sourceArr = getSourceSeries(bars, 'close').toArray().map((v) => v ?? NaN);

  // mg := na(mg[1]) ? ta.ema(source, length) : mg[1] + (source - mg[1]) / (length * math.pow(source / mg[1], 4))
  // ta.ema runs only on the bars where mg[1] is na: from bar 0 until its first value (the SMA of the first
  // `length` values), so it is the plain EMA there.
  const ema = ta.ema(getSourceSeries(bars, 'close'), length).toArray().map((v) => v ?? NaN);
  const mdArr: number[] = new Array(bars.length);
  let prev = NaN;
  for (let i = 0; i < bars.length; i++) {
    const s0 = sourceArr[i];
    prev = Number.isNaN(prev) ? ema[i] : prev + (s0 - prev) / (length * Math.pow(s0 / prev, 4));
    mdArr[i] = prev;
  }

  const plotData = mdArr.map((value, i) => ({
    time: bars[i].time,
    value: Number.isFinite(value) ? value : NaN,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData },
  };
}

export const McGinleyDynamic = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
