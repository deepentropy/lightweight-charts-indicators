/**
 * Port of "Harami - Bullish.pine".
 */
import { high, low } from 'oakscriptjs/script';
import type { PatternDef } from '../pattern-runner';

export const haramiBullish: PatternDef = {
  name: 'Harami - Bullish',
  shortName: 'Harami - Bull',
  direction: 'bullish',
  labelText: 'BH',
  candles: 2,
  needsTrend: true,
  tooltip:
    'Harami\nThis two-day candlestick pattern consists of a small-bodied green candle that is entirely encompassed within the body of what was once a red-bodied candle.',
  // C_LongBody[1] and C_BlackBody[1] and C_DownTrend[1] and C_WhiteBody and C_SmallBody
  // and high <= C_BodyHi[1] and low >= C_BodyLo[1]
  detect: (c, t) =>
    c.longBody
      .offset(1)
      .and(c.blackBody.offset(1))
      .and(t.downTrend.offset(1))
      .and(c.whiteBody)
      .and(c.smallBody)
      .and(high.lte(c.bodyHi.offset(1)))
      .and(low.gte(c.bodyLo.offset(1))),
};
