/**
 * Scalping Line Indicator
 *
 * Fast EMA for scalping. Line colored green when price is above, red when below.
 *
 * Reference: TradingView "Scalping Line Indicator" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface ScalpingLineInputs {
  length: number;
  src: SourceType;
}

export const defaultInputs: ScalpingLineInputs = {
  length: 5,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 5, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Scalping Line', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Scalping Line',
  shortTitle: 'SL',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<ScalpingLineInputs> = {}): IndicatorResult {
  const { length, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const emaLine = ta.ema(source, length);
  const emaArr = emaLine.toArray();

  const plot0 = emaArr.map((v, i) => {
    if (v == null || i < length) return { time: bars[i].time, value: NaN };
    const color = bars[i].close > v ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
  };
}

export const ScalpingLine = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
