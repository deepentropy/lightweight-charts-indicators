/**
 * Port of "Harami - Bearish.pine".
 */
import { high, low } from 'oakscriptjs/script';
import type { PatternDef } from '../pattern-runner';

export const haramiBearish: PatternDef = {
  name: 'Harami - Bearish',
  shortName: 'Harami - Bear',
  direction: 'bearish',
  labelText: 'BH',
  candles: 2,
  needsTrend: true,
  tooltip:
    'Harami\nThis is a two-day candlestick pattern with a small, red-bodied candle that is entirely encompassed within the body that was once a green-bodied candle.',
  // C_LongBody[1] and C_WhiteBody[1] and C_UpTrend[1] and C_BlackBody and C_SmallBody
  // and high <= C_BodyHi[1] and low >= C_BodyLo[1]
  detect: (c, t) =>
    c.longBody
      .offset(1)
      .and(c.whiteBody.offset(1))
      .and(t.upTrend.offset(1))
      .and(c.blackBody)
      .and(c.smallBody)
      .and(high.lte(c.bodyHi.offset(1)))
      .and(low.gte(c.bodyLo.offset(1))),
};
