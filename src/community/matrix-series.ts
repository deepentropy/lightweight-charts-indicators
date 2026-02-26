/**
 * Matrix Series
 *
 * Series of oscillators in a matrix format.
 * Combines RSI and ROC (momentum) into a single normalized oscillator.
 *
 * Reference: TradingView "Matrix Series" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface MatrixSeriesInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: MatrixSeriesInputs = {
  length: 14,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 14, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Matrix', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Matrix Series',
  shortTitle: 'MTX',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<MatrixSeriesInputs> = {}): IndicatorResult {
  const { length, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, length);
  const roc = ta.roc(source, length);

  const rsiArr = rsi.toArray();
  const rocArr = roc.toArray();
  const warmup = length;

  const plot0 = bars.map((b, i) => {
    if (i < warmup || rsiArr[i] == null || rocArr[i] == null) {
      return { time: b.time, value: NaN };
    }
    const rsiCentered = (rsiArr[i]! - 50);
    const combined = (rsiCentered + rocArr[i]!) / 2;
    return { time: b.time, value: combined };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    hlines: [
      { value: 0, options: { color: '#787B86', linestyle: 'solid' as const, title: 'Zero' } },
    ],
  };
}

export const MatrixSeries = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
