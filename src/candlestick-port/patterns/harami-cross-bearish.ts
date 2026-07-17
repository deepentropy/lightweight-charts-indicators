/**
 * Port of "Harami Cross - Bearish.pine".
 */
import { high, low } from 'oakscriptjs/script';
import type { PatternDef } from '../pattern-runner';

export const haramiCrossBearish: PatternDef = {
  name: 'Harami Cross - Bearish',
  shortName: 'Harami Cross - Bear',
  direction: 'bearish',
  labelText: 'HC',
  candles: 2,
  needsTrend: true,
  tooltip:
    'Harami Cross\nThis candlestick pattern is a variation of the Harami Bearish pattern. It is found during an uptrend. This is a two-day candlestick pattern with a Doji candle that is entirely encompassed within the body that was once a green-bodied candle. The Doji shows that some indecision has entered the minds of sellers, and the pattern hints that the trend might reverse.',
  // C_LongBody[1] and C_WhiteBody[1] and C_UpTrend[1] and C_IsDojiBody
  // and high <= C_BodyHi[1] and low >= C_BodyLo[1]
  detect: (c, t) =>
    c.longBody
      .offset(1)
      .and(c.whiteBody.offset(1))
      .and(t.upTrend.offset(1))
      .and(c.isDojiBody)
      .and(high.lte(c.bodyHi.offset(1)))
      .and(low.gte(c.bodyLo.offset(1))),
};
