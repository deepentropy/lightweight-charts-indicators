/**
 * Commodity Channel Index (CCI) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Measures the variation of a security's price from its statistical mean.
 * High values show the price is unusually high compared to average, low values show it's unusually low.
 */

import { Series, ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type FillData, type Bar, type SourceType } from 'oakscriptjs';

export interface CCIInputs {
  length: number;
  src: SourceType;
  maType: 'None' | 'SMA' | 'SMA + Bollinger Bands' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  maLength: number;
  bbMult: number;
}

export const defaultInputs: CCIInputs = {
  length: 20,
  src: 'hlc3',
  maType: 'SMA',
  maLength: 14,
  bbMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 20, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'hlc3' },
  { id: 'maType', type: 'string', title: 'Smoothing Type', defval: 'SMA', options: ['None', 'SMA', 'SMA + Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'maLength', type: 'int', title: 'Smoothing Length', defval: 14, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'CCI', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'CCI-based MA', color: '#E2CC00', lineWidth: 1 },
  { id: 'plot2', title: 'Upper Bollinger Band', color: '#089981', lineWidth: 1 },
  { id: 'plot3', title: 'Lower Bollinger Band', color: '#089981', lineWidth: 1 },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_upper', price: 100, color: '#787B86', linestyle: 'dashed', title: 'Upper Band' },
  { id: 'hline_mid',   price: 0, color: '#787B8680', linestyle: 'solid', title: 'Middle Band' },
  { id: 'hline_lower', price: -100, color: '#787B86', linestyle: 'dashed', title: 'Lower Band' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_band', plot1: 'hline_upper', plot2: 'hline_lower', color: '#2962FF1A' },
];

export const metadata = {
  title: 'Commodity Channel Index',
  shortTitle: 'CCI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<CCIInputs> = {}): IndicatorResult {
  const { length, src, maType, maLength, bbMult } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const cci = ta.cci(source, length);

  const plotData = cci.toArray().map((value: number | undefined, i: number) => ({
    time: bars[i].time,
    value: value ?? NaN,
  }));

  const enableMA = maType !== 'None';
  const isBB = maType === 'SMA + Bollinger Bands';
  let maData = bars.map(b => ({ time: b.time, value: NaN }));
  let bbUpperData = bars.map(b => ({ time: b.time, value: NaN }));
  let bbLowerData = bars.map(b => ({ time: b.time, value: NaN }));
  const fills: FillData[] = [];

  if (enableMA) {
    let maSeries: Series;
    switch (maType) {
      case 'EMA': maSeries = ta.ema(cci, maLength); break;
      case 'SMMA (RMA)': maSeries = ta.rma(cci, maLength); break;
      case 'WMA': maSeries = ta.wma(cci, maLength); break;
      case 'VWMA': maSeries = ta.vwma(cci, maLength, new Series(bars, b => b.volume ?? 0)); break;
      default: maSeries = ta.sma(cci, maLength); break;
    }
    const maArr = maSeries.toArray();
    maData = maArr.map((v, i) => ({ time: bars[i].time, value: v ?? NaN }));

    if (isBB) {
      const stdevArr = ta.stdev(cci, maLength).toArray();
      bbUpperData = maArr.map((v, i) => ({ time: bars[i].time, value: (v != null && stdevArr[i] != null) ? v + stdevArr[i]! * bbMult : NaN }));
      bbLowerData = maArr.map((v, i) => ({ time: bars[i].time, value: (v != null && stdevArr[i] != null) ? v - stdevArr[i]! * bbMult : NaN }));
      fills.push({ plot1: 'plot2', plot2: 'plot3', options: { color: '#089981', transp: 90, title: 'BB Background' } });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData, 'plot1': maData, 'plot2': bbUpperData, 'plot3': bbLowerData },
    fills,
  };
}

export const CCI = { calculate, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig };
