/**
 * RCI 3 Lines
 *
 * Three Rank Correlation Index (Spearman rank correlation) lines
 * at different periods. Oscillates between -100 and +100.
 *
 * Reference: TradingView "RCI 3 Lines" (community)
 */

import { type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface RCI3LinesInputs {
  shortLen: number;
  midLen: number;
  longLen: number;
}

export const defaultInputs: RCI3LinesInputs = {
  shortLen: 9,
  midLen: 26,
  longLen: 52,
};

export const inputConfig: InputConfig[] = [
  { id: 'shortLen', type: 'int', title: 'Short Length', defval: 9, min: 2 },
  { id: 'midLen', type: 'int', title: 'Mid Length', defval: 26, min: 2 },
  { id: 'longLen', type: 'int', title: 'Long Length', defval: 52, min: 2 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Short', color: '#FF6D00', lineWidth: 2 },
  { id: 'plot1', title: 'Mid', color: '#2962FF', lineWidth: 2 },
  { id: 'plot2', title: 'Long', color: '#00E676', lineWidth: 2 },
];

export const metadata = {
  title: 'RCI 3 Lines',
  shortTitle: 'RCI3',
  overlay: false,
};

function calcRCI(closes: number[], startIdx: number, period: number): number {
  // Extract the last 'period' values ending at startIdx
  const values: { price: number; timeRank: number }[] = [];
  for (let j = 0; j < period; j++) {
    values.push({ price: closes[startIdx - period + 1 + j], timeRank: j + 1 });
  }

  // Rank by price (ascending: lowest price = rank 1)
  const sorted = [...values].sort((a, b) => a.price - b.price);
  const priceRanks: number[] = new Array(period);
  for (let j = 0; j < sorted.length; j++) {
    const idx = values.indexOf(sorted[j]);
    priceRanks[idx] = j + 1;
  }

  // Sum of squared rank differences
  let sumD2 = 0;
  for (let j = 0; j < period; j++) {
    const d = priceRanks[j] - values[j].timeRank;
    sumD2 += d * d;
  }

  // Spearman formula * 100
  return (1 - (6 * sumD2) / (period * (period * period - 1))) * 100;
}

export function calculate(bars: Bar[], inputs: Partial<RCI3LinesInputs> = {}): IndicatorResult {
  const { shortLen, midLen, longLen } = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const closes = bars.map((b) => b.close);

  const shortArr: number[] = new Array(n).fill(NaN);
  const midArr: number[] = new Array(n).fill(NaN);
  const longArr: number[] = new Array(n).fill(NaN);

  for (let i = 0; i < n; i++) {
    if (i >= shortLen - 1) shortArr[i] = calcRCI(closes, i, shortLen);
    if (i >= midLen - 1) midArr[i] = calcRCI(closes, i, midLen);
    if (i >= longLen - 1) longArr[i] = calcRCI(closes, i, longLen);
  }

  const plot0 = shortArr.map((v, i) => ({ time: bars[i].time, value: v }));
  const plot1 = midArr.map((v, i) => ({ time: bars[i].time, value: v }));
  const plot2 = longArr.map((v, i) => ({ time: bars[i].time, value: v }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1, 'plot2': plot2 },
    hlines: [
      { value: 80, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Overbought' } },
      { value: -80, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Oversold' } },
    ],
  };
}

export const RCI3Lines = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
