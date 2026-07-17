/**
 * Port of "Morning Doji Star - Bullish.pine".
 */
import type { PatternDef } from '../pattern-runner';

export const morningDojiStarBullish: PatternDef = {
  name: 'Morning Doji Star - Bullish',
  shortName: 'Morning Doji Star - Bull',
  direction: 'bullish',
  labelText: 'MDS',
  candles: 3,
  needsTrend: true,
  tooltip:
    'Morning Doji Star\nThis candlestick pattern is a variation of the Morning Star pattern. A three-day bullish reversal pattern, which consists of three candlesticks will look something like this: The first being a long-bodied red candle that extends the current downtrend. Next comes a Doji that gaps down on the open. After that comes a long-bodied green candle, which gaps up on the open and closes above the midpoint of the body of the first day. It is more bullish than the regular morning star pattern because of the existence of the Doji.',
  // if C_LongBody[2] and C_IsDojiBody[1] and C_LongBody and C_DownTrend and C_BlackBody[2]
  //   and C_BodyHi[1] < C_BodyLo[2] and C_WhiteBody and C_BodyHi >= C_BodyMiddle[2]
  //   and C_BodyHi < C_BodyHi[2] and C_BodyHi[1] < C_BodyLo
  detect: (c, t) =>
    c.longBody
      .offset(2)
      .and(c.isDojiBody.offset(1))
      .and(c.longBody)
      .and(t.downTrend)
      .and(c.blackBody.offset(2))
      .and(c.bodyHi.offset(1).lt(c.bodyLo.offset(2)))
      .and(c.whiteBody)
      .and(c.bodyHi.gte(c.bodyMiddle.offset(2)))
      .and(c.bodyHi.lt(c.bodyHi.offset(2)))
      .and(c.bodyHi.offset(1).lt(c.bodyLo)),
};
