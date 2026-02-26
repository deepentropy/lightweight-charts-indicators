/**
 * Average Sentiment Oscillator
 *
 * Measures bull/bear sentiment based on intrabar and group candle analysis.
 * Bulls = bullish candle count / total * 100, Bears = bearish / total * 100.
 * Smoothed with SMA.
 *
 * Reference: TradingView "Average Sentiment Oscillator" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AverageSentimentOscInputs {
  length: number;
}

export const defaultInputs: AverageSentimentOscInputs = {
  length: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'Length', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Bulls', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Bears', color: '#EF5350', lineWidth: 2 },
];

export const hlineConfig = [
  { value: 50, options: { color: '#787B86', linestyle: 'dashed' as const, title: 'Midline' } },
];

export const metadata = {
  title: 'Average Sentiment Oscillator',
  shortTitle: 'ASO',
  overlay: false,
};

export function calculate(bars: Bar[], inputs: Partial<AverageSentimentOscInputs> = {}): IndicatorResult {
  const { length } = { ...defaultInputs, ...inputs };

  // Raw bull/bear per bar: bull if close > open, bear if close < open
  const rawBull: number[] = [];
  const rawBear: number[] = [];
  for (let i = 0; i < bars.length; i++) {
    rawBull.push(bars[i].close >= bars[i].open ? 1 : 0);
    rawBear.push(bars[i].close < bars[i].open ? 1 : 0);
  }

  // SMA of raw signals * 100 to get percentage
  const bullSeries = new Series(bars, (_b, i) => rawBull[i]);
  const bearSeries = new Series(bars, (_b, i) => rawBear[i]);
  const bullSMA = ta.sma(bullSeries, length).mul(100);
  const bearSMA = ta.sma(bearSeries, length).mul(100);
  const bullArr = bullSMA.toArray();
  const bearArr = bearSMA.toArray();

  const warmup = length;
  const bullPlot = bullArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null) ? NaN : v,
  }));
  const bearPlot = bearArr.map((v, i) => ({
    time: bars[i].time,
    value: (i < warmup || v == null) ? NaN : v,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': bullPlot, 'plot1': bearPlot },
    hlines: hlineConfig.map(h => ({ value: h.value, options: h.options })),
  };
}

export const AverageSentimentOscillator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
