/**
 * CM RSI-2 Strategy Upper
 *
 * RSI(2) based overlay. When RSI(2) < 10, bar is green (buy).
 * When RSI(2) > 90, bar is red (sell). Shows SMA(200) for trend filter.
 *
 * Reference: TradingView "CM_RSI-2 Strategy" by ChrisMoody
 */

import { ta, getSourceSeries, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType } from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface CMRSI2UpperInputs {
  rsiLen: number;
  smaLen: number;
  src: SourceType;
}

export const defaultInputs: CMRSI2UpperInputs = {
  rsiLen: 2,
  smaLen: 200,
  src: 'close',
};

export const inputConfig: InputConfig[] = [
  { id: 'rsiLen', type: 'int', title: 'RSI Length', defval: 2, min: 1 },
  { id: 'smaLen', type: 'int', title: 'SMA Length', defval: 200, min: 1 },
  { id: 'src', type: 'source', title: 'Source', defval: 'close' },
];

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'SMA 200', color: '#787B86', lineWidth: 2 },
  { id: 'plot1', title: 'SMA 5', color: '#26A69A', lineWidth: 3 },
];

export const metadata = {
  title: 'CM RSI-2 Strategy Upper',
  shortTitle: 'CMRSI2',
  overlay: true,
};

export function calculate(bars: Bar[], inputs: Partial<CMRSI2UpperInputs> = {}): IndicatorResult {
  const { rsiLen, smaLen, src } = { ...defaultInputs, ...inputs };

  const source = getSourceSeries(bars, src);
  const rsi = ta.rsi(source, rsiLen);
  const rsiArr = rsi.toArray();
  const sma200 = ta.sma(source, smaLen);
  const sma200Arr = sma200.toArray();
  const sma5 = ta.sma(source, 5);
  const sma5Arr = sma5.toArray();

  const warmup = Math.max(rsiLen, smaLen);
  const barColors: BarColorData[] = [];
  const closeArr = bars.map(b => b.close);

  // Pine: barcolor(isLongEntry() ? lime : na) -- green when close>ma200 & close<ma5 & rsi<10
  // Pine: barcolor(isLongExit() ? yellow : na) -- yellow on crossunder(rsi, 90-level equivalent exit)
  // Pine: barcolor(isShortEntry() ? red : na) -- red when close<ma200 & close>ma5 & rsi>90
  // Pine: barcolor(isShortExit() ? yellow : na) -- yellow on crossover(rsi, 10-level equivalent exit)
  for (let i = warmup; i < bars.length; i++) {
    const r = rsiArr[i];
    const c = closeArr[i];
    const m5 = sma5Arr[i];
    const m200 = sma200Arr[i];
    if (r == null || m5 == null || m200 == null) continue;

    const isLongEntry = c > m200 && c < m5 && r < 10;
    const isShortEntry = c < m200 && c > m5 && r > 90;

    // Long exit: close > ma200, close[1] < ma5[1], high > ma5, and any of previous 4 bars had long entry condition
    let isLongExit = false;
    if (c > m200 && i > 0 && (closeArr[i - 1] ?? 0) < (sma5Arr[i - 1] ?? 0) && bars[i].high > m5) {
      for (let k = 1; k <= 4 && i - k >= 0; k++) {
        const pk = i - k;
        const rk = rsiArr[pk]; const ck = closeArr[pk]; const m5k = sma5Arr[pk]; const m200k = sma200Arr[pk];
        if (rk != null && m5k != null && m200k != null && ck > m200k && ck < m5k && rk < 10) { isLongExit = true; break; }
      }
    }

    // Short exit: close < ma200, close[1] > ma5[1], low < ma5, and any of previous 4 bars had short entry condition
    let isShortExit = false;
    if (c < m200 && i > 0 && (closeArr[i - 1] ?? 0) > (sma5Arr[i - 1] ?? 0) && bars[i].low < m5) {
      for (let k = 1; k <= 4 && i - k >= 0; k++) {
        const pk = i - k;
        const rk = rsiArr[pk]; const ck = closeArr[pk]; const m5k = sma5Arr[pk]; const m200k = sma200Arr[pk];
        if (rk != null && m5k != null && m200k != null && ck < m200k && ck > m5k && rk > 90) { isShortExit = true; break; }
      }
    }

    if (isLongEntry) barColors.push({ time: bars[i].time as number, color: '#00E676' });
    else if (isShortEntry) barColors.push({ time: bars[i].time as number, color: '#EF5350' });
    else if (isLongExit || isShortExit) barColors.push({ time: bars[i].time as number, color: '#FFFF00' });
  }

  // Pine: plot(ma200, color=col, style=circles) -- per-bar color based on ma5 >= ma200
  const plot0 = sma200Arr.map((v, i) => {
    if (v == null || i < smaLen) return { time: bars[i].time, value: NaN };
    const m5 = sma5Arr[i];
    const color = (m5 != null && m5 >= v) ? '#00E676' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  // Pine: plot(ma5, color=col) -- per-bar color based on ma5 >= ma200
  const plot1 = sma5Arr.map((v, i) => {
    if (v == null || i < 5) return { time: bars[i].time, value: NaN };
    const s200 = sma200Arr[i];
    const color = (s200 != null && v >= s200) ? '#00E676' : '#EF5350';
    return { time: bars[i].time, value: v, color };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { 'plot0': plot0, 'plot1': plot1 },
    barColors,
  } as IndicatorResult & { barColors: BarColorData[] };
}

export const CMRSI2Upper = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
