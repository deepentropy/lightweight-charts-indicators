/**
 * Port of "Morning Star - Bullish.pine".
 */
import type { PatternDef } from '../pattern-runner';

export const morningStarBullish: PatternDef = {
  name: 'Morning Star - Bullish',
  shortName: 'Morning Star - Bull',
  direction: 'bullish',
  labelText: 'MS',
  candles: 3,
  needsTrend: true,
  tooltip:
    'Morning Star\nA three-day bullish reversal pattern, which consists of three candlesticks will look something like this: The first being a long-bodied red candle that extends the current downtrend. Next comes a short, middle candle that gaps down on the open. After comes a long-bodied green candle, which gaps up on the open and closes above the midpoint of the body of the first day.',
  // if C_LongBody[2] and C_SmallBody[1] and C_LongBody
  //   if C_DownTrend and C_BlackBody[2] and C_BodyHi[1] < C_BodyLo[2] and C_WhiteBody
  //      and C_BodyHi >= C_BodyMiddle[2] and C_BodyHi < C_BodyHi[2] and C_BodyHi[1] < C_BodyLo
  detect: (c, t) =>
    c.longBody
      .offset(2)
      .and(c.smallBody.offset(1))
      .and(c.longBody)
      .and(t.downTrend)
      .and(c.blackBody.offset(2))
      .and(c.bodyHi.offset(1).lt(c.bodyLo.offset(2)))
      .and(c.whiteBody)
      .and(c.bodyHi.gte(c.bodyMiddle.offset(2)))
      .and(c.bodyHi.lt(c.bodyHi.offset(2)))
      .and(c.bodyHi.offset(1).lt(c.bodyLo)),
};
