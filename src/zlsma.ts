/**
 * ZLSMA - Zero Lag Least Squares Moving Average
 *
 * Double linear regression to cancel LSMA lag.
 * zlsma = lsma + (lsma - linreg(lsma))
 *
 * Reference: TradingView "ZLSMA - Zero Lag LSMA" by veryfid
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface ZLSMAInputs {
  length: number;
  offset: number;
  src: SourceType;
}

export const defaultInputs: ZLSMAInputs = {
  length: 32,
  offset: 0,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 32, min: 1 },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'ZLSMA', color: '#FFEB3B', lineWidth: 3 },
];

export const metadata = {
  title: 'Zero Lag LSMA',
  shortTitle: 'ZLSMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<ZLSMAInputs> = {}): IndicatorResult {
  const { length, offset, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  const lsma = ta.linreg(source, length, offset);
  const lsma2 = ta.linreg(lsma, length, offset);
  const eq = lsma.sub(lsma2);
  const zlsma = lsma.add(eq);

  const data = zlsma.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': data },
  };
}

export const ZLSMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
