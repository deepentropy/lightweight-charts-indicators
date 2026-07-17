/**
 * Port of "Harami Cross - Bullish.pine".
 */
import { high, low } from 'oakscriptjs/script';
import type { PatternDef } from '../pattern-runner';

export const haramiCrossBullish: PatternDef = {
  name: 'Harami Cross - Bullish',
  shortName: 'Harami Cross - Bull',
  direction: 'bullish',
  labelText: 'HC',
  candles: 2,
  needsTrend: true,
  tooltip:
    'Harami Cross\nThis candlestick pattern is a variation of the Harami Bullish pattern. It is found during a downtrend. The two-day candlestick pattern consists of a Doji candle that is entirely encompassed within the body of what was once a red-bodied candle.',
  // C_LongBody[1] and C_BlackBody[1] and C_DownTrend[1] and C_IsDojiBody
  // and high <= C_BodyHi[1] and low >= C_BodyLo[1]
  detect: (c, t) =>
    c.longBody
      .offset(1)
      .and(c.blackBody.offset(1))
      .and(t.downTrend.offset(1))
      .and(c.isDojiBody)
      .and(high.lte(c.bodyHi.offset(1)))
      .and(low.gte(c.bodyLo.offset(1))),
};
