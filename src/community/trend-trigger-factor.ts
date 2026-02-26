/**
 * Trend Trigger Factor (TTF)
 *
 * Measures buying/selling pressure by comparing current vs past high/low ranges.
 * TTF = 100 * (BP - SP) / (0.5 * (BP + SP))
 * BP = highest(high, len) - lowest(low, len)[len]
 * SP = highest(high, len)[len] - lowest(low, len)
 *
 * Reference: TradingView "Trend Trigger Factor [LazyBear]"
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface TrendTriggerFactorInputs {
  length: number;
  buyTrigger: number;
  sellTrigger: number;
}

export const defaultInputs: TrendTriggerFactorInputs = {
  length: 15,
  buyTrigger: 100,
  sellTrigger: -100,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 15, min: 1 },
  { id: 'buyTrigger', type: 'int', title: 'Buy Trigger', defval: 100 },
  { id: 'sellTrigger', type: 'int', title: 'Sell Trigger', defval: -100 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'TTF', color: '#800000', lineWidth: 2 },
];

export const metadata = {
  title: 'Trend Trigger Factor',
  shortTitle: 'TTF',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<TrendTriggerFactorInputs> = {}): IndicatorResult {
  const { length, buyTrigger, sellTrigger } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const hhArr = ta.highest(highSeries, length).toArray();
  const llArr = ta.lowest(lowSeries, length).toArray();

  const warmup = 2 * length;
  const ttfArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    if (i < warmup) {
      ttfArr[i] = NaN;
      continue;
    }
    const hh = hhArr[i] ?? 0;
    const ll = llArr[i] ?? 0;
    const hhPrev = hhArr[i - length] ?? 0;
    const llPrev = llArr[i - length] ?? 0;

    const bp = hh - llPrev; // current highest - past lowest
    const sp = hhPrev - ll; // past highest - current lowest
    const denom = 0.5 * (bp + sp);
    ttfArr[i] = denom !== 0 ? 100 * (bp - sp) / denom : 0;
  }

  const ttfPlot = ttfArr.map((v, i) => ({
    time: bars[i].time,
    value: isNaN(v) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': ttfPlot },
    hlines: [
      { value: buyTrigger, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Buy' } },
      { value: 0, options: { color: '#787B86', linestyle: 'dotted' as const, title: 'Zero' } },
      { value: sellTrigger, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Sell' } },
    ],
  };
}

export const TrendTriggerFactor = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
