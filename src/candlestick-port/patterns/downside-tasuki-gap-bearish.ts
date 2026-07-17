/**
 * Port of "Downside Tasuki Gap - Bearish.pine".
 */
import type { PatternDef } from '../pattern-runner';

export const downsideTasukiGapBearish: PatternDef = {
  name: 'Downside Tasuki Gap - Bearish',
  shortName: 'Downside Tasuki Gap - Bear',
  direction: 'bearish',
  labelText: 'DTG',
  candles: 3,
  needsTrend: true,
  tooltip:
    'Downside Tasuki Gap\nDownside Tasuki Gap is a three-candle pattern found in a downtrend that usually hints at the continuation of the downtrend. The first candle is long and red, followed by a smaller red candle with its opening price that gaps below the body of the previous candle. The third candle is green and it closes inside the gap created by the first two candles, unable to close it fully. The bull’s inability to close that gap hints that the downtrend might continue.',
  // if C_LongBody[2] and C_SmallBody[1] and C_DownTrend and C_BlackBody[2]
  //    and C_BodyHi[1] < C_BodyLo[2] and C_BlackBody[1] and C_WhiteBody
  //    and C_BodyHi <= C_BodyLo[2] and C_BodyHi >= C_BodyHi[1]
  detect: (c, t) =>
    c.longBody
      .offset(2)
      .and(c.smallBody.offset(1))
      .and(t.downTrend)
      .and(c.blackBody.offset(2))
      .and(c.bodyHi.offset(1).lt(c.bodyLo.offset(2)))
      .and(c.blackBody.offset(1))
      .and(c.whiteBody)
      .and(c.bodyHi.lte(c.bodyLo.offset(2)))
      .and(c.bodyHi.gte(c.bodyHi.offset(1))),
};
