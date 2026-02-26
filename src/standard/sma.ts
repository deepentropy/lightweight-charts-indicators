/**
 * Simple Moving Average (SMA) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Matches TradingView's built-in SMA indicator.
 */

import { Series, ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type FillData, type Bar, type SourceType } from 'oakscriptjs';

/**
 * SMA indicator input parameters
 */
export interface SMAInputs {
  len: number;
  src: SourceType;
  offset: number;
  maType: 'None' | 'SMA' | 'SMA + Bollinger Bands' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  maLength: number;
  bbMult: number;
}

export const defaultInputs: SMAInputs = {
  len: 9,
  src: 'close',
  offset: 0,
  maType: 'None',
  maLength: 14,
  bbMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'Length', defval: 9, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
  { id: 'offset', type: 'int', title: 'Offset', defval: 0, min: -500, max: 500 },
  { id: 'maType', type: 'string', title: 'Smoothing Type', defval: 'None', options: ['None', 'SMA', 'SMA + Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'maLength', type: 'int', title: 'Smoothing Length', defval: 14, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50 },
];

/**
 * Plot configuration
 */
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'SMA-based MA', color: '#E2CC00', lineWidth: 1 },
  { id: 'plot2', title: 'Upper Bollinger Band', color: '#089981', lineWidth: 1 },
  { id: 'plot3', title: 'Lower Bollinger Band', color: '#089981', lineWidth: 1 },
];

/**
 * Indicator metadata
 */
export const metadata = {
  title: 'Simple Moving Average',
  shortTitle: 'SMA',
  overlay: true,
};

/**
 * Calculate SMA indicator
 *
 * @param bars - OHLCV bar data
 * @param inputs - Indicator parameters (optional, uses defaults)
 * @returns Indicator result with plot data
 */
export function calculate(bars: Bar[], inputs: Partial<SMAInputs> = {}): IndicatorResult {
  const { len, src, maType, maLength, bbMult } = { ...defaultInputs, ...inputs };
  const source = getSourceSeries(bars, src);
  const smaResult = ta.sma(source, len);

  const plotData = smaResult.toArray().map((value, i) => ({
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
      case 'EMA': maSeries = ta.ema(smaResult, maLength); break;
      case 'SMMA (RMA)': maSeries = ta.rma(smaResult, maLength); break;
      case 'WMA': maSeries = ta.wma(smaResult, maLength); break;
      case 'VWMA': maSeries = ta.vwma(smaResult, maLength, new Series(bars, b => b.volume ?? 0)); break;
      default: maSeries = ta.sma(smaResult, maLength); break;
    }
    const maArr = maSeries.toArray();
    maData = maArr.map((v, i) => ({ time: bars[i].time, value: v ?? NaN }));

    if (isBB) {
      const stdevArr = ta.stdev(smaResult, maLength).toArray();
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

/**
 * SMA indicator module
 */
export const SMA = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
