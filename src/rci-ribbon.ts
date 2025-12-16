/**
 * RCI Ribbon Indicator
 *
 * Displays three Rank Correlation Index (RCI) lines with different lengths.
 * RCI measures the directional consistency of price movements using Spearman's
 * rank correlation coefficient, scaled to -100 to 100.
 *
 * Based on TradingView's RCI Ribbon indicator.
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RCIRibbonInputs {
  /** Source for calculation */
  source: 'close' | 'open' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4';
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

function getSourceValue(bar: Bar, source: string): number {
  switch (source) {
    case 'open': return bar.open;
    case 'high': return bar.high;
    case 'low': return bar.low;
    case 'close': return bar.close;
    case 'hl2': return (bar.high + bar.low) / 2;
    case 'hlc3': return (bar.high + bar.low + bar.close) / 3;
    case 'ohlc4': return (bar.open + bar.high + bar.low + bar.close) / 4;
    default: return bar.close;
  }
}

/**
 * Calculate RCI (Rank Correlation Index) for a single bar
 * Uses Spearman's rank correlation coefficient, scaled to -100 to 100
 *
 * @param values Array of source values (oldest to newest, ending at current bar)
 * @param length Number of bars to use
 * @returns RCI value between -100 and 100
 */
function calculateRCI(values: number[], length: number): number {
  if (values.length < length) {
    return NaN;
  }

  // Get the last 'length' values
  const window = values.slice(-length);

  // Create an array of [value, originalIndex] pairs for ranking
  const indexed = window.map((val, idx) => ({ value: val, originalIndex: idx }));

  // Sort by value to assign price ranks
  const sortedByValue = [...indexed].sort((a, b) => a.value - b.value);

  // Assign ranks (handling ties with average rank)
  const priceRanks = new Array(length).fill(0);
  let i = 0;
  while (i < length) {
    let j = i;
    // Find all tied values
    while (j < length - 1 && sortedByValue[j].value === sortedByValue[j + 1].value) {
      j++;
    }
    // Assign average rank to all tied values
    const avgRank = (i + j) / 2 + 1; // +1 because ranks are 1-based
    for (let k = i; k <= j; k++) {
      priceRanks[sortedByValue[k].originalIndex] = avgRank;
    }
    i = j + 1;
  }

  // Time ranks are simply 1, 2, 3, ..., length (oldest to newest)
  // Calculate sum of squared rank differences
  let sumD2 = 0;
  for (let idx = 0; idx < length; idx++) {
    const timeRank = idx + 1;
    const d = priceRanks[idx] - timeRank;
    sumD2 += d * d;
  }

  // Spearman's formula: rho = 1 - (6 * sumD2) / (n * (n^2 - 1))
  // Scaled to -100 to 100
  const n = length;
  const rci = (1 - (6 * sumD2) / (n * (n * n - 1))) * 100;

  return rci;
}

/**
 * Calculate RCI for all bars in the series
 */
function calculateRCISeries(sourceValues: number[], length: number): number[] {
  const result: number[] = [];

  for (let i = 0; i < sourceValues.length; i++) {
    if (i < length - 1) {
      result.push(NaN);
    } else {
      const window = sourceValues.slice(i - length + 1, i + 1);
      result.push(calculateRCI(window, length));
    }
  }

  return result;
}

export function calculate(bars: Bar[], inputs: Partial<RCIRibbonInputs> = {}): IndicatorResult {
  const { source, shortLength, middleLength, longLength } = { ...defaultInputs, ...inputs };

  // Extract source values
  const sourceValues = bars.map(b => getSourceValue(b, source));

  // Calculate three RCI lines
  const shortArr = calculateRCISeries(sourceValues, shortLength);
  const middleArr = calculateRCISeries(sourceValues, middleLength);
  const longArr = calculateRCISeries(sourceValues, longLength);

  const shortData = shortArr.map((value, i) => ({
    time: bars[i].time,
    value: value,
  }));

  const middleData = middleArr.map((value, i) => ({
    time: bars[i].time,
    value: value,
  }));

  const longData = longArr.map((value, i) => ({
    time: bars[i].time,
    value: value,
  }));

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
