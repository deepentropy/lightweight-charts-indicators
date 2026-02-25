/**
 * RCI Ribbon Indicator
 *
 * Displays three Rank Correlation Index (RCI) lines with different lengths.
 * RCI measures the directional consistency of price movements using Spearman's
 * rank correlation coefficient, scaled to -100 to 100.
 *
 * Based on TradingView's RCI Ribbon indicator.
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';

export interface RCIRibbonInputs {
  /** Source for calculation */
  source: SourceType;
  /** Short RCI length */
  shortLength: number;
  /** Middle RCI length */
  middleLength: number;
  /** Long RCI length */
  longLength: number;
}

export const defaultInputs: RCIRibbonInputs = {
  source: 'close',
  shortLength: 10,
  middleLength: 30,
  longLength: 50,
};

export const inputConfig: InputConfig[] = [
  { id: 'source', type: 'source', title: 'Source', defval: 'close' },
  { id: 'shortLength', type: 'int', title: 'Short RCI Length', defval: 10, min: 1 },
  { id: 'middleLength', type: 'int', title: 'Middle RCI Length', defval: 30, min: 1 },
  { id: 'longLength', type: 'int', title: 'Long RCI Length', defval: 50, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Short RCI', color: '#2962FF', lineWidth: 1 },
  { id: 'plot1', title: 'Middle RCI', color: '#F23645', lineWidth: 1 },
  { id: 'plot2', title: 'Long RCI', color: '#089981', lineWidth: 1 },
];

export const metadata = {
  title: 'RCI Ribbon',
  shortTitle: 'RCI Ribbon',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<RCIRibbonInputs> = {}): IndicatorResult {
  const { source, shortLength, middleLength, longLength } = { ...defaultInputs, ...inputs };

  const srcSeries = getSourceSeries(bars, source);

  const shortArr = ta.rci(srcSeries, shortLength).toArray();
  const middleArr = ta.rci(srcSeries, middleLength).toArray();
  const longArr = ta.rci(srcSeries, longLength).toArray();

  const shortData = shortArr.map((v, i) => ({ time: bars[i].time, value: v ?? NaN }));
  const middleData = middleArr.map((v, i) => ({ time: bars[i].time, value: v ?? NaN }));
  const longData = longArr.map((v, i) => ({ time: bars[i].time, value: v ?? NaN }));

  return {
    metadata: {
      title: metadata.title,
      shorttitle: metadata.shortTitle,
      overlay: metadata.overlay,
    },
    plots: {
      'plot0': shortData,
      'plot1': middleData,
      'plot2': longData,
    },
  };
}

export const RCIRibbon = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
