/**
 * Shared candle properties for the TradingView candlestick pattern indicators.
 * This is the C_* block that all 45 official .pine scripts repeat verbatim,
 * ported once. Every function here must run inside executeScript().
 */
import { Series, ta, math, input, close, open, high, low } from 'oakscriptjs/script';

export const C_LEN = 14; // ta.ema depth for bodyAvg
export const C_SHADOW_PERCENT = 5.0; // size of shadows
export const C_SHADOW_EQUALS_PERCENT = 100.0;
export const C_DOJI_BODY_PERCENT = 5.0;
export const C_FACTOR = 2.0; // times the shadow dominates the candlestick body

export interface CandleProps {
  bodyHi: Series; // math.max(close, open)
  bodyLo: Series; // math.min(close, open)
  body: Series;
  bodyAvg: Series;
  smallBody: Series;
  longBody: Series;
  upShadow: Series;
  dnShadow: Series;
  hasUpShadow: Series;
  hasDnShadow: Series;
  whiteBody: Series;
  blackBody: Series;
  range: Series;
  isInsideBar: Series;
  bodyMiddle: Series;
  shadowEquals: Series;
  isDojiBody: Series;
  doji: Series;
}

/** The candle property block shared by every pattern (Pine lines C_BodyHi..C_Doji). */
export function candleProps(): CandleProps {
  const bodyHi = math.max(close, open) as Series;
  const bodyLo = math.min(close, open) as Series;
  const body = bodyHi.sub(bodyLo);
  const bodyAvg = ta.ema(body, C_LEN);
  const smallBody = body.lt(bodyAvg);
  const longBody = body.gt(bodyAvg);
  const upShadow = high.sub(bodyHi);
  const dnShadow = bodyLo.sub(low);
  const hasUpShadow = upShadow.gt(body.mul(C_SHADOW_PERCENT / 100));
  const hasDnShadow = dnShadow.gt(body.mul(C_SHADOW_PERCENT / 100));
  const whiteBody = open.lt(close);
  const blackBody = open.gt(close);
  const range = high.sub(low);
  const isInsideBar = bodyHi.offset(1).gt(bodyHi).and(bodyLo.offset(1).lt(bodyLo));
  const bodyMiddle = body.div(2).add(bodyLo);
  // C_UpShadow == C_DnShadow or (|up-dn|/dn*100 < P and |dn-up|/up*100 < P)
  // Series.div returns NaN on division by zero, matching Pine's na, and NaN
  // comparisons are falsy like Pine's na.
  const shadowEquals = upShadow
    .eq(dnShadow)
    .or(
      (math.abs(upShadow.sub(dnShadow)) as Series)
        .div(dnShadow)
        .mul(100)
        .lt(C_SHADOW_EQUALS_PERCENT)
        .and(
          (math.abs(dnShadow.sub(upShadow)) as Series)
            .div(upShadow)
            .mul(100)
            .lt(C_SHADOW_EQUALS_PERCENT)
        )
    );
  const isDojiBody = range.gt(0).and(body.lte(range.mul(C_DOJI_BODY_PERCENT / 100)));
  const doji = isDojiBody.and(shadowEquals);
  return {
    bodyHi,
    bodyLo,
    body,
    bodyAvg,
    smallBody,
    longBody,
    upShadow,
    dnShadow,
    hasUpShadow,
    hasDnShadow,
    whiteBody,
    blackBody,
    range,
    isInsideBar,
    bodyMiddle,
    shadowEquals,
    isDojiBody,
    doji,
  };
}

export interface TrendFlags {
  downTrend: Series;
  upTrend: Series;
}

/** Trend flags that are always true (Pine's defaults before trend detection,
 *  and the "No detection" rule). */
export function noTrend(): TrendFlags {
  const ones = Series.constant(close.barData, 1);
  return { downTrend: ones, upTrend: ones };
}

/** Declares the "Detect Trend Based On" input and returns the trend flags
 *  (the block at the top of every trend-aware pattern script). */
export function trendInputs(): TrendFlags {
  const rule = input.string('SMA50', 'Detect Trend Based On', {
    options: ['SMA50', 'SMA50, SMA200', 'No detection'],
  });
  if (rule === 'SMA50') {
    const priceAvg = ta.sma(close, 50);
    return { downTrend: close.lt(priceAvg), upTrend: close.gt(priceAvg) };
  }
  if (rule === 'SMA50, SMA200') {
    const sma200 = ta.sma(close, 200);
    const sma50 = ta.sma(close, 50);
    return {
      downTrend: close.lt(sma50).and(sma50.lt(sma200)),
      upTrend: close.gt(sma50).and(sma50.gt(sma200)),
    };
  }
  return noTrend();
}
