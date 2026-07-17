/**
 * Port of "Long Lower Shadow - Bullish.pine" (no trend detection input).
 */
import type { PatternDef } from '../pattern-runner';

const C_LONG_LOWER_SHADOW_PERCENT = 75.0;

export const longLowerShadowBullish: PatternDef = {
  name: 'Long Lower Shadow - Bullish',
  shortName: 'Long Lower Shadow - Bull',
  direction: 'bullish',
  labelText: 'LLS',
  candles: 1,
  needsTrend: false,
  tooltip:
    'Long Lower Shadow\nTo indicate seller domination of the first part of a session, candlesticks will present with long lower shadows and short upper shadows, consequently lowering prices.',
  // C_LongLowerShadowBullish = C_DnShadow > C_Range/100*C_LongLowerShadowPercent
  detect: (c) => c.dnShadow.gt(c.range.div(100).mul(C_LONG_LOWER_SHADOW_PERCENT)),
};
