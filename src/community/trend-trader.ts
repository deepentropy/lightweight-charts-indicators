/**
 * Trend Trader Strategy
 *
 * Trend-following with MA + ATR trailing stop.
 * When close > MA: long mode, trail with close - atrMult*ATR.
 * When close < MA: short mode, trail with close + atrMult*ATR.
 *
 * Reference: TradingView "Trend Trader Strategy" (community)
 */

import { ta, getSourceSeries, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface TrendTraderInputs {
  maLen: number;
  atrLen: number;
  atrMult: number;
}

export const defaultInputs: TrendTraderInputs = {
  maLen: 50,
  atrLen: 14,
  atrMult: 2.0,
};

export const inputConfig: InputConfig[] = [
  { id: 'maLen', type: 'int', title: 'MA Length', defval: 50, min: 1 },
  { id: 'atrLen', type: 'int', title: 'ATR Length', defval: 14, min: 1 },
  { id: 'atrMult', type: 'float', title: 'ATR Multiplier', defval: 2.0, min: 0.1, step: 0.1 },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'MA', color: '#787B86', lineWidth: 1 },
  { id: 'plot1', title: 'Trail Stop', color: '#2962FF', lineWidth: 2 },
];

export const metadata = {
  title: 'Trend Trader Strategy',
  shortTitle: 'TrendTrader',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<TrendTraderInputs> = {}): IndicatorResult & { barColors: BarColorData[] } {
  const { maLen, atrLen, atrMult } = { ...defaultInputs, ...inputs };
  const n = bars.length;

  const closeSeries = getSourceSeries(bars, 'close');
  const maArr = ta.sma(closeSeries, maLen).toArray();
  const atrArr = ta.atr(bars, atrLen).toArray();

  const trailArr: number[] = new Array(n);
  const dirArr: number[] = new Array(n);

  for (let i = 0; i < n; i++) {
    const close = bars[i].close;
    const ma = maArr[i] ?? 0;
    const atrVal = (atrArr[i] ?? 0) * atrMult;

    if (i === 0) {
      dirArr[i] = close > ma ? 1 : -1;
      trailArr[i] = dirArr[i] === 1 ? close - atrVal : close + atrVal;
      continue;
    }

    // Determine direction from MA
    if (close > ma) {
      dirArr[i] = 1;
    } else if (close < ma) {
      dirArr[i] = -1;
    } else {
      dirArr[i] = dirArr[i - 1];
    }

    // Trail stop
    if (dirArr[i] === 1) {
      const newTrail = close - atrVal;
      trailArr[i] = dirArr[i - 1] === 1 ? Math.max(newTrail, trailArr[i - 1]) : newTrail;
    } else {
      const newTrail = close + atrVal;
      trailArr[i] = dirArr[i - 1] === -1 ? Math.min(newTrail, trailArr[i - 1]) : newTrail;
    }
  }

  const warmup = Math.max(maLen, atrLen);

  const maPlot = maArr.map((v, i) => ({
    time: bars[i].time,
    value: i < warmup || isNaN(v) ? NaN : v,
  }));

  const trailPlot = trailArr.map((v, i) => {
    if (i < warmup) return { time: bars[i].time, value: NaN };
    const color = dirArr[i] === 1 ? '#26A69A' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  // barcolor: green when close > trail (pos=1), red when close < trail (pos=-1), blue otherwise
  // Pine: pos = close > ret ? 1 : close < ret ? -1 : nz(pos[1], 0)
  const barColors: BarColorData[] = [];
  let pos = 0;
  for (let i = warmup; i < n; i++) {
    const close = bars[i].close;
    const trail = trailArr[i];
    if (close > trail) pos = 1;
    else if (close < trail) pos = -1;
    if (pos === 1) barColors.push({ time: bars[i].time, color: '#26A69A' });
    else if (pos === -1) barColors.push({ time: bars[i].time, color: '#EF5350' });
    else barColors.push({ time: bars[i].time, color: '#2196F3' });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': maPlot, 'plot1': trailPlot },
    barColors,
  };
}

export const TrendTrader = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
