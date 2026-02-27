/**
 * Chandelier Stop
 *
 * ATR trailing stop with direction-colored circles.
 * Ratcheting trailing stop that flips direction when price crosses.
 *
 * Reference: TradingView "Chandelier Stop" (community)
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface ChandelierStopInputs {
  lookback: number;
  atrPeriod: number;
  atrMult: number;
}

export const defaultInputs: ChandelierStopInputs = {
  lookback: 22,
  atrPeriod: 22,
  atrMult: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'lookback', type: 'int', title: 'Lookback', defval: 22, min: 1 },
  { id: 'atrPeriod', type: 'int', title: 'ATR Period', defval: 22, min: 1 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 3, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Stop Dots', color: '#2962FF', lineWidth: 2, style: 'circles' },
  { id: 'plot1', title: 'Stop Line', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Chandelier Stop',
  shortTitle: 'CStop',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<ChandelierStopInputs> = {}): IndicatorResult {
  const { lookback, atrPeriod, atrMult } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const highSeries = new Series(bars, (b) => b.high);
  const lowSeries = new Series(bars, (b) => b.low);
  const hh = ta.highest(highSeries, lookback).toArray();
  const ll = ta.lowest(lowSeries, lookback).toArray();
  const atrArr = ta.atr(bars, atrPeriod).toArray();

  const stopArr: number[] = new Array(n);
  const dirArr: number[] = new Array(n); // 1 = up, -1 = down

  for (let i = 0; i < n; i++) {
    const atr = (atrArr[i] ?? 0) * atrMult;
    const longStop = (hh[i] ?? bars[i].high) - atr;
    const shortStop = (ll[i] ?? bars[i].low) + atr;

    if (i === 0) {
      stopArr[i] = isNaN(longStop) ? bars[i].high : longStop;
      dirArr[i] = 1;
      continue;
    }

    const prevStop = stopArr[i - 1];
    const prevDir = dirArr[i - 1];
    const close = bars[i].close;

    if (prevDir === 1) {
      // Long: ratchet up
      const ls = isNaN(longStop) ? prevStop : longStop;
      stopArr[i] = isNaN(prevStop) ? ls : Math.max(ls, prevStop);
      dirArr[i] = close < stopArr[i] ? -1 : 1;
    } else {
      // Short: ratchet down
      const ss = isNaN(shortStop) ? prevStop : shortStop;
      stopArr[i] = isNaN(prevStop) ? ss : Math.min(ss, prevStop);
      dirArr[i] = close > stopArr[i] ? 1 : -1;
    }
  }

  const warmup = Math.max(lookback, atrPeriod);
  const plot0 = stopArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const color = dirArr[i] === 1 ? '#00BCD4' : '#FF00FF';
    return { time: bars[i].time, value: v, color };
  });

  // Second plot: same values as line (Pine plots pc twice: circles + line)
  const plot1 = stopArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const color = dirArr[i] === 1 ? '#00BCD4' : '#FF00FF';
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
  };
}

export const ChandelierStop = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
