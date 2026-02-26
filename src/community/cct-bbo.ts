/**
 * CCT Bollinger Band Oscillator
 *
 * Normalizes price position within Bollinger Bands to 0-100 scale.
 * cctbbo = 100 * (src + 2*stdev - sma) / (4 * stdev)
 *
 * Reference: TradingView "CCT Bollinger Band Oscillator" by LazyBear
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface CCTBBOInputs {
  length: number;
  lengthMA: number;
  src: SourceType;
}

export const defaultInputs: CCTBBOInputs = {
  length: 21,
  lengthMA: 13,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 21, min: 1 },
  { id: 'lengthMA', type: 'int', title: 'EMA Length', defval: 13, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CCTBBO', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'EMA', color: '#FF6D00', lineWidth: 2 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 100, color: '#787B86', linestyle: 'solid' },
  { id: 'hline_mid', price: 50, color: '#787B86', linestyle: 'dashed' },
  { id: 'hline_lower', price: 0, color: '#787B86', linestyle: 'solid' },
];

export const fillConfig = [
  { id: 'fill0', plot1: 'hline_upper', plot2: 'hline_lower', color: '#2962FF20' },
];

export const metadata = {
  title: 'CCT Bollinger Band Oscillator',
  shortTitle: 'CCTBBO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<CCTBBOInputs> = {}): IndicatorResult {
  const { length, lengthMA, src } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);

  const sd = ta.stdev(source, length);
  const sma = ta.sma(source, length);
  // cctbbo = 100 * (src + 2*stdev - sma) / (4 * stdev)
  const cctbbo = source.add(sd.mul(2)).sub(sma).div(sd.mul(4)).mul(100);
  const emaLine = ta.ema(cctbbo, lengthMA);

  const cctData = cctbbo.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const emaData = emaLine.toArray().map((value, i) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': cctData, 'plot1': emaData },
  };
}

export const CCTBBO = { calculate, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig };
