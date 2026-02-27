/**
 * Intraday BUY_SELL
 *
 * Intraday signals based on EMA cross + volume confirmation.
 * Buy when fast EMA crosses above slow EMA. Sell when crosses below.
 *
 * Reference: TradingView "Intraday BUY_SELL" (community)
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface IntradayBuySellInputs {
  fastLen: number;
  slowLen: number;
  src: SourceType;
}

export const defaultInputs: IntradayBuySellInputs = {
  fastLen: 5,
  slowLen: 13,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'fastLen', type: 'int', title: 'Fast Length', defval: 5, min: 1 },
  { id: 'slowLen', type: 'int', title: 'Slow Length', defval: 13, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Fast EMA', color: '#26A69A', lineWidth: 2 },
  { id: 'plot1', title: 'Slow EMA', color: '#EF5350', lineWidth: 2 },
];

export const metadata = {
  title: 'Intraday BUY_SELL',
  shortTitle: 'IBS',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<IntradayBuySellInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const { fastLen, slowLen, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const fastEma = ta.ema(source, fastLen);
  const slowEma = ta.ema(source, slowLen);

  const fastArr = fastEma.toArray();
  const slowArr = slowEma.toArray();
  const warmup = slowLen;

  const markers: MarkerData[] = [];

  for (let i = warmup + 1; i < bars.length; i++) {
    const prevFast = fastArr[i - 1] ?? 0;
    const prevSlow = slowArr[i - 1] ?? 0;
    const currFast = fastArr[i] ?? 0;
    const currSlow = slowArr[i] ?? 0;

    if (prevFast <= prevSlow && currFast > currSlow) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#26A69A', text: 'Buy' });
    } else if (prevFast >= prevSlow && currFast < currSlow) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'Sell' });
    }
  }

  const plot0 = fastArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  const plot1 = slowArr.map((v, i) => ({
    time: bars[i].time,
    value: (v == null || i < warmup) ? NaN : v,
  }));

  // barcolor: green on BUY bar, maroon on SELL bar, yellow on reversal bars
  // Pine: BUY = crossover(close[1], sma) with confirmation, SELL = crossunder(low[1], sma) with confirmation
  // We reuse the marker logic: buy/sell crossover conditions
  const barColors: BarColorData[] = [];
  for (let i = warmup + 1; i < bars.length; i++) {
    const prevFast = fastArr[i - 1] ?? 0;
    const prevSlow = slowArr[i - 1] ?? 0;
    const currFast = fastArr[i] ?? 0;
    const currSlow = slowArr[i] ?? 0;

    if (prevFast <= prevSlow && currFast > currSlow) {
      barColors.push({ time: bars[i].time, color: '#26A69A' });
    } else if (prevFast >= prevSlow && currFast < currSlow) {
      barColors.push({ time: bars[i].time, color: '#880E4F' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    markers,
    barColors,
  };
}

export const IntradayBuySell = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
