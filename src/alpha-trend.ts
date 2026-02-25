/**
 * AlphaTrend
 *
 * ATR-based adaptive trend indicator.
 * Uses RSI (or MFI if volume available) to determine trend direction,
 * then builds trailing stop levels that only ratchet in trend direction.
 *
 * Reference: TradingView "AlphaTrend" by KivancOzbilgic
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { MarkerData } from './index';

export interface AlphaTrendInputs {
  coeff: number;
  period: number;
  useRSI: boolean;
}

export const defaultInputs: AlphaTrendInputs = {
  coeff: 1,
  period: 14,
  useRSI: false,
};

export const inputConfig: InputConfig[] = [
  { id: 'coeff', type: 'float', title: 'Multiplier', defval: 1, min: 0.1, step: 0.1 },
  { id: 'period', type: 'int', title: 'Common Period', defval: 14, min: 1 },
  { id: 'useRSI', type: 'bool', title: 'Use RSI instead of MFI', defval: false },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'AlphaTrend', color: '#0022FC', lineWidth: 3 },
  { id: 'plot1', title: 'AlphaTrend[2]', color: '#FC0400', lineWidth: 3 },
];

export const metadata = {
  title: 'AlphaTrend',
  shortTitle: 'AT',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<AlphaTrendInputs> = {}): IndicatorResult & { markers: MarkerData[] } {
  const { coeff, period, useRSI } = { ...defaultInputs, ...inputs };

  const close = new Series(bars, (b) => b.close);
  const high = new Series(bars, (b) => b.high);
  const low = new Series(bars, (b) => b.low);
  const hlc3 = new Series(bars, (b) => (b.high + b.low + b.close) / 3);

  // ATR = SMA of TR (PineScript uses ta.sma(ta.tr, AP) here)
  const trSeries = ta.tr(bars);
  const atrArr = ta.sma(trSeries, period).toArray();

  // Momentum filter
  const filterArr = useRSI
    ? ta.rsi(close, period).toArray()
    : ta.mfi(hlc3, period, new Series(bars, (b) => b.volume!)).toArray();

  const lowArr = low.toArray();
  const highArr = high.toArray();

  const at: number[] = new Array(bars.length);

  for (let i = 0; i < bars.length; i++) {
    const atr = atrArr[i] ?? 0;
    const upT = (lowArr[i] ?? 0) - atr * coeff;
    const downT = (highArr[i] ?? 0) + atr * coeff;
    const filt = filterArr[i] ?? 0;
    const prev = i > 0 ? (at[i - 1] ?? 0) : 0;

    if (filt >= 50) {
      at[i] = upT < prev ? prev : upT;
    } else {
      at[i] = downT > prev ? prev : downT;
    }
  }

  const warmup = period;
  const plot0 = at.map((v, i) => ({ time: bars[i].time, value: i < warmup ? NaN : v }));
  const plot1 = at.map((v, i) => ({ time: bars[i].time, value: i < warmup + 2 ? NaN : at[i - 2] }));

  // Markers: buy when AT crosses above AT[2], sell when AT crosses below AT[2]
  const markers: MarkerData[] = [];
  for (let i = warmup + 2; i < bars.length; i++) {
    const cur = at[i];
    const lag = at[i - 2];
    const prevCur = at[i - 1];
    const prevLag = at[i - 3];
    if (prevCur <= prevLag && cur > lag) {
      markers.push({ time: bars[i].time, position: 'belowBar', shape: 'arrowUp', color: '#2962FF', text: 'Buy' });
    } else if (prevCur >= prevLag && cur < lag) {
      markers.push({ time: bars[i].time, position: 'aboveBar', shape: 'arrowDown', color: '#FF6D00', text: 'Sell' });
    }
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    fills: [{ plot1: 'plot0', plot2: 'plot1', options: { color: '#2962FF' } }],
    markers,
  };
}

export const AlphaTrend = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
