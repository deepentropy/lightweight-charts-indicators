/**
 * Port of "Long Upper Shadow - Bearish.pine" (no trend detection input).
 */
import type { PatternDef } from '../pattern-runner';

const C_LONG_SHADOW_PERCENT = 75.0;

export const longUpperShadowBearish: PatternDef = {
  name: 'Long Upper Shadow - Bearish',
  shortName: 'Long Upper Shadow - Bear',
  direction: 'bearish',
  labelText: 'LUS',
  candles: 1,
  needsTrend: false,
  tooltip:
    'Long Upper Shadow\nTo indicate buyer domination of the first part of a session, candlesticks will present with long upper shadows, as well as short lower shadows, consequently raising bidding prices.',
  // C_LongUpperShadowBearish = C_UpShadow > C_Range/100*C_LongShadowPercent
  detect: (c) => c.upShadow.gt(c.range.div(100).mul(C_LONG_SHADOW_PERCENT)),
};
