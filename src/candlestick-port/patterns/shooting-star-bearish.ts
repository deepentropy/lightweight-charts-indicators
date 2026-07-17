/**
 * Port of "Shooting Star - Bearish.pine".
 */
import { hl2 } from 'oakscriptjs/script';
import { C_FACTOR } from '../candle-props';
import type { PatternDef } from '../pattern-runner';

export const shootingStarBearish: PatternDef = {
  name: 'Shooting Star - Bearish',
  shortName: 'Shooting Star - Bear',
  direction: 'bearish',
  labelText: 'SS',
  candles: 1,
  needsTrend: true,
  tooltip:
    'Shooting Star\nThis single day pattern can appear during an uptrend and opens high, while it closes near its open. It trades much higher as well. It is bearish in nature, but looks like an Inverted Hammer.',
  // if C_SmallBody and C_Body > 0 and C_BodyHi < hl2 and C_UpShadow >= C_Factor * C_Body and not C_HasDnShadow
  //   if C_UpTrend
  detect: (c, t) =>
    c.smallBody
      .and(c.body.gt(0))
      .and(c.bodyHi.lt(hl2))
      .and(c.upShadow.gte(c.body.mul(C_FACTOR)))
      .and(c.hasDnShadow.not())
      .and(t.upTrend),
};
