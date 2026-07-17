/**
 * Port of "Upside Tasuki Gap - Bullish.pine".
 */
import type { PatternDef } from '../pattern-runner';

export const upsideTasukiGapBullish: PatternDef = {
  name: 'Upside Tasuki Gap - Bullish',
  shortName: 'Upside Tasuki Gap - Bull',
  direction: 'bullish',
  labelText: 'UTG',
  candles: 3,
  needsTrend: true,
  tooltip:
    'Upside Tasuki Gap\nUpside Tasuki Gap is a three-candle pattern found in an uptrend that usually hints at the continuation of the uptrend. The first candle is long and green, followed by a smaller green candle with its opening price that gaps above the body of the previous candle. The third candle is red and it closes inside the gap created by the first two candles, unable to close it fully. The bear’s inability to close the gap hints that the uptrend might continue.',
  // if C_LongBody[2] and C_SmallBody[1] and C_UpTrend and C_WhiteBody[2]
  //    and C_BodyLo[1] > C_BodyHi[2] and C_WhiteBody[1] and C_BlackBody
  //    and C_BodyLo >= C_BodyHi[2] and C_BodyLo <= C_BodyLo[1]
  detect: (c, t) =>
    c.longBody
      .offset(2)
      .and(c.smallBody.offset(1))
      .and(t.upTrend)
      .and(c.whiteBody.offset(2))
      .and(c.bodyLo.offset(1).gt(c.bodyHi.offset(2)))
      .and(c.whiteBody.offset(1))
      .and(c.blackBody)
      .and(c.bodyLo.gte(c.bodyHi.offset(2)))
      .and(c.bodyLo.lte(c.bodyLo.offset(1))),
};
