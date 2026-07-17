/**
 * Port of "Evening Star - Bearish.pine".
 */
import type { PatternDef } from '../pattern-runner';

export const eveningStarBearish: PatternDef = {
  name: 'Evening Star - Bearish',
  shortName: 'Evening Star - Bear',
  direction: 'bearish',
  labelText: 'ES',
  candles: 3,
  needsTrend: true,
  tooltip:
    'Evening Star\nThis candlestick pattern is bearish and continues an uptrend with a long-bodied, green candle day. It is then followed by a gapped and small-bodied candle day, and concludes with a downward close. The close would be below the first day’s midpoint.',
  // if C_LongBody[2] and C_SmallBody[1] and C_LongBody
  //   if C_UpTrend and C_WhiteBody[2] and C_BodyLo[1] > C_BodyHi[2] and C_BlackBody
  //      and C_BodyLo <= C_BodyMiddle[2] and C_BodyLo > C_BodyLo[2] and C_BodyLo[1] > C_BodyHi
  detect: (c, t) =>
    c.longBody
      .offset(2)
      .and(c.smallBody.offset(1))
      .and(c.longBody)
      .and(t.upTrend)
      .and(c.whiteBody.offset(2))
      .and(c.bodyLo.offset(1).gt(c.bodyHi.offset(2)))
      .and(c.blackBody)
      .and(c.bodyLo.lte(c.bodyMiddle.offset(2)))
      .and(c.bodyLo.gt(c.bodyLo.offset(2)))
      .and(c.bodyLo.offset(1).gt(c.bodyHi)),
};
