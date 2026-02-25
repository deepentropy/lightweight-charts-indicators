/**
 * SSL Channel
 *
 * Simple crossover channel: SMA of highs and SMA of lows.
 * When close > SMA(high): uptrend → sslUp = SMA(high), sslDown = SMA(low).
 * When close < SMA(low): downtrend → sslUp = SMA(low), sslDown = SMA(high).
 *
 * Reference: TradingView "SSL channel"
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface SSLChannelInputs {
  period: number;
}

export const defaultInputs: SSLChannelInputs = {
  period: 10,
};

export const inputConfig: InputConfig[] = [
  { id: 'period', type: 'int', title: 'Period', defval: 10, min: 1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SSL Down', color: '#EF5350', lineWidth: 2 },
  { id: 'plot1', title: 'SSL Up', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'SSL Channel',
  shortTitle: 'SSL',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<SSLChannelInputs> = {}): IndicatorResult {
  const { period } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const smaHighArr = ta.sma(new Series(bars, (b) => b.high), period).toArray();
  const smaLowArr = ta.sma(new Series(bars, (b) => b.low), period).toArray();

  const sslDown: number[] = new Array(n);
  const sslUp: number[] = new Array(n);
  let hlv = 0;

  for (let i = 0; i < n; i++) {
    const smaH = smaHighArr[i] ?? 0;
    const smaL = smaLowArr[i] ?? 0;
    const c = bars[i].close;

    if (c > smaH) hlv = 1;
    else if (c < smaL) hlv = -1;

    sslDown[i] = hlv < 0 ? smaH : smaL;
    sslUp[i] = hlv < 0 ? smaL : smaH;
  }

  const warmup = period;
  const plot0 = sslDown.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));
  const plot1 = sslUp.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
  };
}

export const SSLChannel = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
