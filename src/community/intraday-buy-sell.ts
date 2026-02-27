/**
 * Intraday BUY_SELL
 *
 * Pine-faithful intraday scalping indicator with SMA, RSI-based signals,
 * conditional SMA coloring, buy/sell markers, and RSI reversal markers.
 *
 * Reference: TradingView "Intraday BUY_SELL" (community) by nicks1008
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData, BarColorData } from '../types';

export interface IntradayBuySellInputs {
  rsiLength: number;
  rsiHL: number;
  rsiLL: number;
  smaLength: number;
}

export const defaultInputs: IntradayBuySellInputs = {
  rsiLength: 14,
  rsiHL: 80,
  rsiLL: 20,
  smaLength: 70,
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLength', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'rsiHL', type: 'int', title: 'RSI Higher Level', defval: 80, min: 1 },
  { id: 'rsiLL', type: 'int', title: 'RSI Lower Level', defval: 20, min: 1 },
  { id: 'smaLength', type: 'int', title: 'SMA Length', defval: 70, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'sma', title: 'SMA', color: '#00FF00', lineWidth: 1 },
];

export const metadata = {
  title: 'Intraday BUY_SELL',
  shortTitle: 'IBS',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<IntradayBuySellInputs> = {}): IndicatorResult & { markers: MarkerData[]; barColors: BarColorData[] } {
  const { rsiLength, rsiHL, rsiLL, smaLength } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = getSourceSeries(bars, 'close');
  const rsiArr = ta.rsi(closeSeries, rsiLength).toArray();
  const smaArr = ta.sma(closeSeries, smaLength).toArray();

  const warmup = Math.max(rsiLength, smaLength);

  // Pine: dist_SMA = 1, candle_length = 1
  const distSMA = 1;

  // Pine SMA plot with conditional color:
  // iff_1 = high < sma1 ? red : yellow
  // iff_2 = low > sma1 ? lime : iff_1
  // mycolor = rs >= hl or rs <= ll ? yellow : iff_2
  const smaPlot = bars.map((b, i) => {
    const sma = smaArr[i];
    const rs = rsiArr[i];
    if (sma == null || i < warmup) return { time: b.time, value: NaN };

    let color: string;
    if (rs != null && (rs >= rsiHL || rs <= rsiLL)) {
      color = 'rgba(255,255,0,0.7)'; // yellow with transp=30
    } else if (b.low > sma) {
      color = 'rgba(0,255,0,0.7)'; // lime with transp=30
    } else if (b.high < sma) {
      color = 'rgba(255,0,0,0.7)'; // red with transp=30
    } else {
      color = 'rgba(255,255,0,0.7)'; // yellow with transp=30
    }
    return { time: b.time, value: sma, color };
  });

  const markers: MarkerData[] = [];
  const barColors: BarColorData[] = [];

  for (let i = warmup + 1; i < n; i++) {
    const sma = smaArr[i] ?? 0;
    const rs = rsiArr[i] ?? 50;
    const rsPrev = rsiArr[i - 1] ?? 50;
    const gapvalue = bars[i].open / 100; // candle_length=1
    const gaps = sma + distSMA;
    const gapb = sma - distSMA;

    // Pine BUY: crossover(close[1], sma1) and close[1]>open[1] and high[0]>high[1] and close[0]>open[0]
    const prevCrossedAbove = i >= 2 && bars[i - 1].close > sma && bars[i - 2].close <= (smaArr[i - 1] ?? sma);
    const BUY = prevCrossedAbove && bars[i - 1].close > bars[i - 1].open && bars[i].high > bars[i - 1].high && bars[i].close > bars[i].open;

    // Pine SELL: crossunder(low[1], sma1) and close[1]<open[1] and low[0]<low[1] and close[0]<open[0]
    const prevCrossedBelow = i >= 2 && bars[i - 1].low < sma && bars[i - 2].low >= (smaArr[i - 1] ?? sma);
    const SELL = prevCrossedBelow && bars[i - 1].close < bars[i - 1].open && bars[i].low < bars[i - 1].low && bars[i].close < bars[i].open;

    // Pine: hlrev_s = crossunder(rs, hl)
    const hlrev_s = rsPrev >= rsiHL && rs < rsiHL;
    // Pine: llrev_b = crossover(rs, ll) and open < close
    const llrev_b = rsPrev <= rsiLL && rs > rsiLL && bars[i].open < bars[i].close;

    // BUY/SELL markers
    if (SELL) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: 'rgba(255,0,0,0.7)', text: 'S' });
    }
    if (BUY) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: 'rgba(0,255,255,0.7)', text: 'B' });
    }

    // RSI reversal markers (yellow "!")
    if (hlrev_s) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: 'rgba(255,255,0,0.8)', text: '!' });
    }
    if (llrev_b) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: 'rgba(255,255,0,0.8)', text: '!' });
    }

    // Pine barcolor: green on BUY, maroon on SELL, yellow on reversal
    if (BUY) {
      barColors.push({ time: bars[i].time, color: '#00FF00' });
    } else if (SELL) {
      barColors.push({ time: bars[i].time, color: '#800000' });
    } else if (hlrev_s || llrev_b) {
      barColors.push({ time: bars[i].time, color: '#FFFF00' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'sma': smaPlot },
    markers,
    barColors,
  };
}

export const IntradayBuySell = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
