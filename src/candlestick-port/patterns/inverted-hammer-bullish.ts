/**
 * Port of "Inverted Hammer - Bullish.pine".
 */
import { hl2 } from 'oakscriptjs/script';
import { C_FACTOR } from '../candle-props';
import type { PatternDef } from '../pattern-runner';

export const invertedHammerBullish: PatternDef = {
  name: 'Inverted Hammer - Bullish',
  shortName: 'Inverted Hammer - Bull',
  direction: 'bullish',
  labelText: 'IH',
  candles: 1,
  needsTrend: true,
  tooltip:
    'Inverted Hammer\nIf in a downtrend, then the open is lower. When it eventually trades higher, but closes near its open, it will look like an inverted version of the Hammer Candlestick. This is a one-day bullish reversal pattern.',
  // if C_SmallBody and C_Body > 0 and C_BodyHi < hl2 and C_UpShadow >= C_Factor * C_Body and not C_HasDnShadow
  //   if C_DownTrend
  detect: (c, t) =>
    c.smallBody
      .and(c.body.gt(0))
      .and(c.bodyHi.lt(hl2))
      .and(c.upShadow.gte(c.body.mul(C_FACTOR)))
      .and(c.hasDnShadow.not())
      .and(t.downTrend),
};
