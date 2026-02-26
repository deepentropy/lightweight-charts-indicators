/**
 * Shared candlestick pattern helper computations.
 * Ports all PineScript helper variables from TradingView's "All Candlestick Patterns" indicator.
 */

import type { Bar } from 'oakscriptjs';

// PineScript constants
const C_Len = 14;
const C_ShadowPercent = 5.0;
const C_ShadowEqualsPercent = 100.0;
const C_DojiBodyPercent = 5.0;
export const C_Factor = 2.0;

export interface CandleContext {
  bodyHi: number[];
  bodyLo: number[];
  body: number[];
  bodyAvg: number[];
  smallBody: boolean[];
  longBody: boolean[];
  upShadow: number[];
  dnShadow: number[];
  hasUpShadow: boolean[];
  hasDnShadow: boolean[];
  whiteBody: boolean[];
  blackBody: boolean[];
  range: number[];
  bodyMiddle: number[];
  hl2: number[];
  isDojiBody: boolean[];
  shadowEquals: boolean[];
  doji: boolean[];
  upTrend: boolean[];
  downTrend: boolean[];
}

function ema(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length);
  const alpha = 2 / (period + 1);
  result[0] = values[0];
  for (let i = 1; i < values.length; i++) {
    result[i] = alpha * values[i] + (1 - alpha) * result[i - 1];
  }
  return result;
}

function sma(values: number[], period: number): number[] {
  const result: number[] = new Array(values.length);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    result[i] = i >= period - 1 ? sum / period : NaN;
  }
  return result;
}

export function computeCandles(bars: Bar[]): CandleContext {
  const n = bars.length;
  const bodyHi = new Array<number>(n);
  const bodyLo = new Array<number>(n);
  const body = new Array<number>(n);
  const upShadow = new Array<number>(n);
  const dnShadow = new Array<number>(n);
  const whiteBody = new Array<boolean>(n);
  const blackBody = new Array<boolean>(n);
  const range = new Array<number>(n);
  const bodyMiddle = new Array<number>(n);
  const hl2 = new Array<number>(n);

  for (let i = 0; i < n; i++) {
    const { open, high, low, close } = bars[i];
    bodyHi[i] = Math.max(close, open);
    bodyLo[i] = Math.min(close, open);
    body[i] = bodyHi[i] - bodyLo[i];
    upShadow[i] = high - bodyHi[i];
    dnShadow[i] = bodyLo[i] - low;
    whiteBody[i] = open < close;
    blackBody[i] = open > close;
    range[i] = high - low;
    bodyMiddle[i] = body[i] / 2 + bodyLo[i];
    hl2[i] = (high + low) / 2;
  }

  const bodyAvg = ema(body, C_Len);
  const sma50 = sma(bars.map(b => b.close), 50);

  const smallBody = body.map((b, i) => b < bodyAvg[i]);
  const longBody = body.map((b, i) => b > bodyAvg[i]);
  const hasUpShadow = upShadow.map((s, i) => s > C_ShadowPercent / 100 * body[i]);
  const hasDnShadow = dnShadow.map((s, i) => s > C_ShadowPercent / 100 * body[i]);
  const isDojiBody = range.map((r, i) => r > 0 && body[i] <= r * C_DojiBodyPercent / 100);

  const shadowEquals = upShadow.map((us, i) => {
    const ds = dnShadow[i];
    if (us === ds) return true;
    if (ds === 0 || us === 0) return false;
    return (Math.abs(us - ds) / ds * 100) < C_ShadowEqualsPercent &&
           (Math.abs(ds - us) / us * 100) < C_ShadowEqualsPercent;
  });

  const doji = isDojiBody.map((d, i) => d && shadowEquals[i]);
  const upTrend = sma50.map((s, i) => !isNaN(s) && bars[i].close > s);
  const downTrend = sma50.map((s, i) => !isNaN(s) && bars[i].close < s);

  return {
    bodyHi, bodyLo, body, bodyAvg, smallBody, longBody,
    upShadow, dnShadow, hasUpShadow, hasDnShadow,
    whiteBody, blackBody, range, bodyMiddle, hl2,
    isDojiBody, shadowEquals, doji, upTrend, downTrend,
  };
}
