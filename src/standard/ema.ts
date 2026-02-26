/**
 * Exponential Moving Average (EMA) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * A weighted moving average that gives more weight to recent prices.
 */

import { Series, ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type FillData, type Bar, type SourceType } from 'oakscriptjs';

export interface EMAInputs {
  length: number;
  src: SourceType;
  offset: number;
  maType: 'None' | 'SMA' | 'SMA + Bollinger Bands' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  maLength: number;
  bbMult: number;
}

export const defaultInputs: EMAInputs = {
  length: 9,
  src: 'close',
  offset: 0,
  maType: 'None',
  maLength: 14,
  bbMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500 },
  { id: 'maType', type: 'string', title: 'Smoothing Type', defval: 'None', options: ['None', 'SMA', 'SMA + Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'maLength', type: 'int', title: 'Smoothing Length', defval: 14, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'EMA', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'EMA-based MA', color: '#E2CC00', lineWidth: 1 },
  { id: 'plot2', title: 'Upper Bollinger Band', color: '#089981', lineWidth: 1 },
  { id: 'plot3', title: 'Lower Bollinger Band', color: '#089981', lineWidth: 1 },
];

export const metadata = {
  title: 'Moving Average Exponential',
  shortTitle: 'EMA',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<EMAInputs> = {}): IndicatorResult {
  const { length, src, maType, maLength, bbMult } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const ema = ta.ema(source, length);

  const plotData = ema.toArray().map((value, i) => ({
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
      case 'EMA': maSeries = ta.ema(ema, maLength); break;
      case 'SMMA (RMA)': maSeries = ta.rma(ema, maLength); break;
      case 'WMA': maSeries = ta.wma(ema, maLength); break;
      case 'VWMA': maSeries = ta.vwma(ema, maLength, new Series(bars, b => b.volume ?? 0)); break;
      default: maSeries = ta.sma(ema, maLength); break;
    }
    const maArr = maSeries.toArray();
    maData = maArr.map((v, i) => ({ time: bars[i].time, value: v ?? NaN }));

    if (isBB) {
      const stdevArr = ta.stdev(ema, maLength).toArray();
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

export const EMA = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
