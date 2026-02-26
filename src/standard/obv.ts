/**
 * On Balance Volume (OBV) Indicator
 *
 * Hand-optimized implementation using oakscriptjs.
 * Cumulative volume indicator that adds volume on up days and subtracts on down days.
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
  { id: 'maType', type: 'string', title: 'Smoothing Type', defval: 'None', options: ['None', 'SMA', 'SMA + Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'] },
  { id: 'maLength', type: 'int', title: 'Smoothing Length', defval: 14, min: 1 },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'OBV', color: '#2962FF', lineWidth: 2 },
  { id: 'plot1', title: 'OBV-based MA', color: '#E2CC00', lineWidth: 1, display: 'none' },
  { id: 'plot2', title: 'Upper Bollinger Band', color: '#089981', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Lower Bollinger Band', color: '#089981', lineWidth: 1, display: 'none' },
];

export const metadata = {
  title: 'On Balance Volume',
  shortTitle: 'OBV',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<OBVInputs> = {}): IndicatorResult {
  const { maType, maLength, bbMult } = { ...defaultInputs, ...inputs };
  const close = new Series(bars, (bar) => bar.close);
  const volume = new Series(bars, (bar) => bar.volume ?? 0);

  const closeArr = close.toArray();
  const volumeArr = volume.toArray();

  const obvArr: number[] = [];
  let cumOBV = 0;

  for (let i = 0; i < bars.length; i++) {
    if (i === 0) {
      obvArr.push(0);
    } else {
      const currClose = closeArr[i] ?? 0;
      const prevClose = closeArr[i - 1] ?? 0;
      const vol = volumeArr[i] ?? 0;

      if (currClose > prevClose) {
        cumOBV += vol;
      } else if (currClose < prevClose) {
        cumOBV -= vol;
      }
      obvArr.push(cumOBV);
    }
  }

  const plotData = obvArr.map((value, i) => ({
    time: bars[i].time,
    value: value,
  }));

  const enableMA = maType !== 'None';
  const isBB = maType === 'SMA + Bollinger Bands';
  let maData = bars.map(b => ({ time: b.time, value: NaN }));
  let bbUpperData = bars.map(b => ({ time: b.time, value: NaN }));
  let bbLowerData = bars.map(b => ({ time: b.time, value: NaN }));
  const fills: FillData[] = [];

  if (enableMA) {
    const obvSeries = new Series(bars, (_, i) => obvArr[i]);
    let maSeries: Series;
    switch (maType) {
      case 'EMA': maSeries = ta.ema(obvSeries, maLength); break;
      case 'SMMA (RMA)': maSeries = ta.rma(obvSeries, maLength); break;
      case 'WMA': maSeries = ta.wma(obvSeries, maLength); break;
      case 'VWMA': maSeries = ta.vwma(obvSeries, maLength, volume); break;
      default: maSeries = ta.sma(obvSeries, maLength); break;
    }
    const maArr = maSeries.toArray();
    maData = maArr.map((v, i) => ({ time: bars[i].time, value: v ?? NaN }));

    if (isBB) {
      const stdevArr = ta.stdev(obvSeries, maLength).toArray();
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

export const OBV = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
