/**
 * Port of "Evening Doji Star - Bearish.pine".
 */
import type { PatternDef } from '../pattern-runner';

export const eveningDojiStarBearish: PatternDef = {
  name: 'Evening Doji Star - Bearish',
  shortName: 'Evening Doji Star - Bear',
  direction: 'bearish',
  labelText: 'EDS',
  candles: 3,
  needsTrend: true,
  tooltip:
    'Evening Doji Star\nThis candlestick pattern is a variation of the Evening Star pattern. It is bearish and continues an uptrend with a long-bodied, green candle day. It is then followed by a gap and a Doji candle and concludes with a downward close. The close would be below the first day’s midpoint. It is more bearish than the regular evening star pattern because of the existence of the Doji.',
  // if C_LongBody[2] and C_IsDojiBody[1] and C_LongBody and C_UpTrend and C_WhiteBody[2]
  //    and C_BodyLo[1] > C_BodyHi[2] and C_BlackBody and C_BodyLo <= C_BodyMiddle[2]
  //    and C_BodyLo > C_BodyLo[2] and C_BodyLo[1] > C_BodyHi
  detect: (c, t) =>
    c.longBody
      .offset(2)
      .and(c.isDojiBody.offset(1))
      .and(c.longBody)
      .and(t.upTrend)
      .and(c.whiteBody.offset(2))
      .and(c.bodyLo.offset(1).gt(c.bodyHi.offset(2)))
      .and(c.blackBody)
      .and(c.bodyLo.lte(c.bodyMiddle.offset(2)))
      .and(c.bodyLo.gt(c.bodyLo.offset(2)))
      .and(c.bodyLo.offset(1).gt(c.bodyHi)),
};
