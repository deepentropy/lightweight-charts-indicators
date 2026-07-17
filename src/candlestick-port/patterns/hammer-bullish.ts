/**
 * Port of "Hammer - Bullish.pine".
 */
import { hl2 } from 'oakscriptjs/script';
import { C_FACTOR } from '../candle-props';
import type { PatternDef } from '../pattern-runner';

export const hammerBullish: PatternDef = {
  name: 'Hammer - Bullish',
  shortName: 'Hammer - Bull',
  direction: 'bullish',
  labelText: 'H',
  candles: 1,
  needsTrend: true,
  tooltip:
    'Hammer\nHammer candlesticks form when a security moves lower after the open, but continues to rally into close above the intraday low. The candlestick that you are left with will look like a square attached to a long stick-like figure. This candlestick is called a Hammer if it happens to form during a decline.',
  // if C_SmallBody and C_Body > 0 and C_BodyLo > hl2 and C_DnShadow >= C_Factor * C_Body and not C_HasUpShadow
  //   if C_DownTrend
  detect: (c, t) =>
    c.smallBody
      .and(c.body.gt(0))
      .and(c.bodyLo.gt(hl2))
      .and(c.dnShadow.gte(c.body.mul(C_FACTOR)))
      .and(c.hasUpShadow.not())
      .and(t.downTrend),
};
