/**
 * SWING TRADE SIGNALS
 *
 * Swing trading signals using SMA with 3-color RSI-based coloring.
 * Single SMA plot colored: yellow when RSI extreme (>=85 or <=15),
 * lime when low > SMA (uptrend), red when high < SMA (downtrend), yellow otherwise.
 * Buy/Sell signals on SMA/EMA crossover.
 * RSI exit markers on overbought/oversold crossback.
 *
 * Reference: TradingView "SWING CALLS" by nicks1008
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { MarkerData } from '../types';

export interface SwingTradeSignalsInputs {
  emaValue: number;
  smaValue: number;
  rsiLen: number;
  overbought: number;
  oversold: number;
  src: SourceType;
}

export const defaultInputs: SwingTradeSignalsInputs = {
  emaValue: 5,
  smaValue: 50,
  rsiLen: 14,
  overbought: 80,
  oversold: 20,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'emaValue', type: 'int', title: 'EMA Length', defval: 5, min: 1 },
  { id: 'smaValue', type: 'int', title: 'SMA Length', defval: 50, min: 1 },
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 14, min: 1 },
  { id: 'overbought', type: 'int', title: 'Overbought limit of RSI', defval: 80, min: 50, max: 100 },
  { id: 'oversold', type: 'int', title: 'Oversold limit of RSI', defval: 20, min: 0, max: 50 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Long SMA', color: '#26A69A', lineWidth: 2 },
];

export const metadata = {
  title: 'Swing Trade Signals',
  shortTitle: 'STS',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<SwingTradeSignalsInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { emaValue, smaValue, rsiLen, overbought, oversold, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const ema1 = ta.ema(source, emaValue).toArray();
  const sma2 = ta.sma(source, smaValue).toArray();
  const rsi = ta.rsi(source, rsiLen).toArray();

  const warmup = Math.max(smaValue, rsiLen);
  const markers: MarkerData[] = [];

  // Pine: mycolor = iff(rs>=85 or rs<=15, yellow, iff(low>sma2, lime, iff(high<sma2, red, yellow)))
  const plot0 = bars.map((b, i) => {
    const s = sma2[i];
    if (i < warmup || s == null || isNaN(s)) {
      return { time: b.time, value: NaN };
    }
    const rs = rsi[i] ?? 50;
    let color: string;
    if (rs >= 85 || rs <= 15) {
      color = '#FFFF00'; // yellow
    } else if (b.low > s) {
      color = '#00FF00'; // lime
    } else if (b.high < s) {
      color = '#FF0000'; // red
    } else {
      color = '#FFFF00'; // yellow
    }
    return { time: b.time, value: s, color };
  });

  for (let i = warmup + 1; i < bars.length; i++) {
    const rs = rsi[i] ?? 50;
    const prevRs = rsi[i - 1] ?? 50;
    const currSma = sma2[i] ?? 0;
    const prevSma = sma2[i - 1] ?? 0;
    const currEma = ema1[i] ?? 0;
    const prevEma = ema1[i - 1] ?? 0;

    // Pine: buyexit = crossunder(rs, hl) - RSI crosses below overbought
    if (prevRs >= overbought && rs < overbought) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'triangleDown', color: '#008080', text: '\u2193\n\u2193' });
    }
    // Pine: sellexit = crossover(rs, ll) - RSI crosses above oversold
    if (prevRs <= oversold && rs > oversold) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'triangleUp', color: '#008080', text: '\u2191\n\u2191' });
    }

    // Pine: buycall = crossunder(sma2, ema1) and high > sma2
    if (prevSma >= prevEma && currSma < currEma && bars[i].high > currSma) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'labelUp', color: '#00FFFF', text: 'B' });
    }
    // Pine: sellcall = crossover(sma2, ema1) and open > close
    if (prevSma <= prevEma && currSma > currEma && bars[i].open > bars[i].close) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'labelDown', color: '#EF5350', text: 'S' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0 },
    markers,
  };
}

export const SwingTradeSignals = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
