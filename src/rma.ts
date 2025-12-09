/**
 * Smoothed Moving Average (RMA/SMMA) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Also known as Wilder's Smoothing or SMMA. Uses exponential smoothing with alpha = 1/length.
 * First value is SMA, subsequent values use: (prev * (len - 1) + src) / len
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface RMAInputs {
  len: number;
  src: SourceType;
}

export const defaultInputs: RMAInputs = {
  len: 7,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 7, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMMA', color: '#673AB7', lineWidth: 2 },
];

export const metadata = {
  title: 'Smoothed Moving Average',
  shortTitle: 'SMMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<RMAInputs> = {}): IndicatorResult {
  const { len, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const sourceArr = source.toArray();
  const sma = ta.sma(source, len);
  const smaArr = sma.toArray();

  // SMMA formula: first value = SMA, then (prev * (len - 1) + src) / len
  const smmaArr: (number | undefined)[] = [];

  for (let i = 0; i < bars.length; i++) {
    const prev = i > 0 ? smmaArr[i - 1] : undefined;
    const srcVal = sourceArr[i];

    if (prev === undefined || isNaN(prev as number)) {
      // Use SMA as initial value
      smmaArr.push(smaArr[i]);
    } else {
      // SMMA formula
      smmaArr.push(((prev as number) * (len - 1) + (srcVal ?? 0)) / len);
    }
  }

  const plotData = smmaArr.map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData },
  };
}

export const RMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
