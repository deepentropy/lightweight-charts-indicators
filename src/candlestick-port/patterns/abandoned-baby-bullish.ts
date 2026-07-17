/**
 * Port of "Abandoned Baby - Bullish.pine".
 */
import { high, low } from 'oakscriptjs/script';
import type { PatternDef } from '../pattern-runner';

export const abandonedBabyBullish: PatternDef = {
  name: 'Abandoned Baby - Bullish',
  shortName: 'Abandoned Baby - Bull',
  direction: 'bullish',
  labelText: 'AB',
  candles: 3,
  needsTrend: true,
  tooltip:
    'Abandoned Baby\nThis candlestick pattern is quite rare as far as reversal patterns go. The first of the pattern is a large down candle. Next comes a doji candle that gaps below the candle before it. The doji candle is then followed by another candle that opens even higher and swiftly moves to the upside.',
  // C_DownTrend[2] and C_BlackBody[2] and C_IsDojiBody[1] and low[2] > high[1]
  // and C_WhiteBody and high[1] < low
  detect: (c, t) =>
    t.downTrend
      .offset(2)
      .and(c.blackBody.offset(2))
      .and(c.isDojiBody.offset(1))
      .and(low.offset(2).gt(high.offset(1)))
      .and(c.whiteBody)
      .and(high.offset(1).lt(low)),
};
