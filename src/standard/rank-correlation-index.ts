/**
 * Rank Correlation Index (RCI) Indicator
 *
 * Measures directional consistency using Spearman's rank correlation,
 * scaled to -100 to 100 (ta.rci). Includes SMA smoothing (enabled by default),
 * with Bollinger Bands for 'SMA + Bollinger Bands'.
 */

import { Series, ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type HLineConfig, type FillConfig, type FillData, type Bar, type SourceType } from 'oakscriptjs';

export interface RCIInputs {
  source: SourceType;
  length: number;
  maType: 'None' | 'SMA' | 'SMA + Bollinger Bands' | 'EMA' | 'SMMA (RMA)' | 'WMA' | 'VWMA';
  maLength: number;
  bbMult: number;
}

export const defaultInputs: RCIInputs = {
  source: 'close',
  length: 10,
  maType: 'SMA',
  maLength: 14,
  bbMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'length', type: 'int', title: 'RCI Length', defval: 10, min: 1 },
  { id: 'maType', type: 'string', title: 'Type', defval: 'SMA', options: ['None', 'SMA', 'SMA + Bollinger Bands', 'EMA', 'SMMA (RMA)', 'WMA', 'VWMA'], group: 'Smoothing', display: 'none' },
  { id: 'maLength', type: 'int', title: 'Length', defval: 14, group: 'Smoothing', display: 'none', active: { input: 'maType', ne: 'None' } },
  { id: 'bbMult', type: 'float', title: 'BB StdDev', defval: 2.0, min: 0.001, max: 50, step: 0.5, group: 'Smoothing', tooltip: 'Only applies when \'SMA + Bollinger Bands\' is selected. Determines the distance between the SMA and the bands.', display: 'none', active: { input: 'maType', eq: 'SMA + Bollinger Bands' } },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'RCI', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'RCI-based MA', color: '#FDD835', lineWidth: 1 },
  { id: 'plot2', title: 'Upper Bollinger Band', color: '#4CAF50', lineWidth: 1, display: 'none' },
  { id: 'plot3', title: 'Lower Bollinger Band', color: '#4CAF50', lineWidth: 1, display: 'none' },
];

export const hlineConfig: HLineConfig[] = [
  { id: 'hline_mid',   price: 0, color: '#787B86', linestyle: 'dashed', title: 'Middle band' },
  { id: 'hline_upper', price: 80, color: '#787B86', linestyle: 'dashed', title: 'Upper band' },
  { id: 'hline_lower', price: -80, color: '#787B86', linestyle: 'dashed', title: 'Lower band' },
];

export const fillConfig: FillConfig[] = [
  { id: 'fill_band', plot1: 'hline_upper', plot2: 'hline_lower', color: '#2962FF1A' },
  { id: 'fill_bb', plot1: 'plot2', plot2: 'plot3', color: '#4CAF501A', title: 'Bollinger Bands Background Fill' },
];

export const metadata = {
  title: 'Rank Correlation Index',
  shortTitle: 'RCI',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RCIInputs> = {}): IndicatorResult {
  const { source, length, maType, maLength, bbMult } = { ...defaultInputs, ...inputs };

  const srcSeries = getSourceSeries(bars, source);
  const rciSeries = ta.rci(srcSeries, length);
  const enableMA = maType !== 'None';
  const isBB = maType === 'SMA + Bollinger Bands';

  let smoothingArr: (number | null)[] = bars.map(() => null);
  let bbUpperArr: (number | null)[] = bars.map(() => null);
  let bbLowerArr: (number | null)[] = bars.map(() => null);

  if (enableMA) {
    let maSeries: Series;
    switch (maType) {
      case 'EMA': maSeries = ta.ema(rciSeries, maLength); break;
      case 'SMMA (RMA)': maSeries = ta.rma(rciSeries, maLength); break;
      case 'WMA': maSeries = ta.wma(rciSeries, maLength); break;
      case 'VWMA': {
        const vol = new Series(bars, b => b.volume ?? 0);
        maSeries = ta.vwma(rciSeries, maLength, vol);
        break;
      }
      default: maSeries = ta.sma(rciSeries, maLength); break;
    }
    smoothingArr = maSeries.toArray();

    if (isBB) {
      const stdevArr = ta.stdev(rciSeries, maLength).toArray();
      bbUpperArr = smoothingArr.map((v, i) => (v != null && stdevArr[i] != null) ? v + stdevArr[i]! * bbMult : null);
      bbLowerArr = smoothingArr.map((v, i) => (v != null && stdevArr[i] != null) ? v - stdevArr[i]! * bbMult : null);
    }
  }

  const rciArr = rciSeries.toArray();
  const rciData = rciArr.map((v, i) => ({ time: bars[i].time, value: v ?? NaN }));
  const maData = smoothingArr.map((v, i) => ({ time: bars[i].time, value: v ?? NaN }));
  const bbUpperData = bbUpperArr.map((v, i) => ({ time: bars[i].time, value: v ?? NaN }));
  const bbLowerData = bbLowerArr.map((v, i) => ({ time: bars[i].time, value: v ?? NaN }));

  const fills: FillData[] = [];
  if (isBB) {
    // color.new(color.green, 90)
    fills.push({ plot1: 'plot2', plot2: 'plot3', options: { color: '#4CAF501A', title: 'Bollinger Bands Background Fill' } });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {
      'plot0': rciData,
      'plot1': maData,
      'plot2': bbUpperData,
      'plot3': bbLowerData,
    },
    fills,
  };
}

export const RankCorrelationIndex = { calculate, metadata, defaultInputs, inputConfig, plotConfig, hlineConfig, fillConfig };
