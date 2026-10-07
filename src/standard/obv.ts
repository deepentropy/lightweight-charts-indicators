/**
 * On Balance Volume (OBV) Indicator
 *
 * Cumulative volume indicator that adds volume on up bars and subtracts it on down bars:
 * obv = ta.cum(math.sign(ta.change(close)) * volume). The first bar has no change, so it is na.
 * Optional smoothing MA of the OBV (None by default), with Bollinger Bands for 'SMA + Bollinger Bands'.
 */

import { Series, ta, type IndicatorResult, type InputConfig, type PlotConfig, type FillData, type Bar } from 'oakscriptjs';

export interface OBVInputs {
  maType: 'None' | 'SMA' | 'SMA + Bollinger Bands' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  maLength: number;
  bbMult: number;
}

export const defaultInputs: OBVInputs = {
  maType: 'None',
  maLength: 14,
  bbMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'maType', type: 'string', title: 'Type', defval: 'None', options: ['None', 'SMA', 'SMA + Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'], group: 'Smoothing', display: 'none' },
  { id: 'maLength', type: 'int', title: 'Length', defval: 14, group: 'Smoothing', display: 'none', active: { input: 'maType', ne: 'None' } },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50, step: 0.5, group: 'Smoothing', tooltip: 'Only applies when \'SMA + Bollinger Bands\' is selected. Determines the distance between the SMA and the bands.', display: 'none', active: { input: 'maType', eq: 'SMA + Bollinger Bands' } },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'OnBalanceVolume', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'OBV-based MA', color: '#FDD835', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Upper Bollinger Band', color: '#4CAF50', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Lower Bollinger Band', color: '#4CAF50', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'On Balance Volume',
  shortTitle: 'OBV',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<OBVInputs> = {}): IndicatorResult {
  const { maType, maLength, bbMult } = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const close = new Series(bars, (bar) => bar.close);
  const volume = new Series(bars, (bar) => bar.volume ?? NaN);
  const volumeArr = A(volume);

  // obv = ta.cum(math.sign(ta.change(src)) * volume)
  const change = A(ta.change(close));
  const obvSeries = ta.cum(Series.fromArray(bars, change.map((c, i) => Math.sign(c) * volumeArr[i])));
  const obvArr = A(obvSeries);
  const plotData = obvArr.map((value, i) => ({ time: bars[i].time, value }));

  const enableMA = maType !== 'None';
  const isBB = maType === 'SMA + Bollinger Bands';
  let maData = bars.map(b => ({ time: b.time, value: NaN }));
  let bbUpperData = bars.map(b => ({ time: b.time, value: NaN }));
  let bbLowerData = bars.map(b => ({ time: b.time, value: NaN }));
  const fills: FillData[] = [];

  if (enableMA) {
    let maSeries: Series;
    switch (maType) {
      case 'EMA': maSeries = ta.ema(obvSeries, maLength); break;
      case 'SMMA (RMA)': maSeries = ta.rma(obvSeries, maLength); break;
      case 'WMA': maSeries = ta.wma(obvSeries, maLength); break;
      case 'VWMA': maSeries = ta.vwma(obvSeries, maLength, volume); break;
      default: maSeries = ta.sma(obvSeries, maLength); break;
    }
    const maArr = A(maSeries);
    maData = maArr.map((v, i) => ({ time: bars[i].time, value: v }));

    if (isBB) {
      // smoothingStDev = ta.stdev(obv, maLengthInput) * bbMultInput
      const stdevArr = A(ta.stdev(obvSeries, maLength));
      bbUpperData = maArr.map((v, i) => ({ time: bars[i].time, value: v + stdevArr[i] * bbMult }));
      bbLowerData = maArr.map((v, i) => ({ time: bars[i].time, value: v - stdevArr[i] * bbMult }));
      // color.new(color.green, 90)
      fills.push({ plot1: 'plot2', plot2: 'plot3', options: { color: '#4CAF501A', title: 'Bollinger Bands Background Fill' } });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plotData, 'plot1': maData, 'plot2': bbUpperData, 'plot3': bbLowerData },
    fills,
  };
}

export const OBV = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
