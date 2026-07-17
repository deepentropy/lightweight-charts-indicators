/**
 * Port of "Abandoned Baby - Bearish.pine".
 */
import { high, low } from 'oakscriptjs/script';
import type { PatternDef } from '../pattern-runner';

export const abandonedBabyBearish: PatternDef = {
  name: 'Abandoned Baby - Bearish',
  shortName: 'Abandoned Baby - Bear',
  direction: 'bearish',
  labelText: 'AB',
  candles: 3,
  needsTrend: true,
  tooltip:
    'Abandoned Baby\nA bearish abandoned baby is a specific candlestick pattern that often signals a downward reversal trend in terms of security price. It is formed when a gap appears between the lowest price of a doji-like candle and the candlestick of the day before. The earlier candlestick is green, tall, and has small shadows. The doji candle is also tailed by a gap between its lowest price point and the highest price point of the candle that comes next, which is red, tall and also has small shadows. The doji candle shadows must completely gap either below or above the shadows of the first and third day in order to have the abandoned baby pattern effect.',
  // C_UpTrend[2] and C_WhiteBody[2] and C_IsDojiBody[1] and high[2] < low[1]
  // and C_BlackBody and low[1] > high
  detect: (c, t) =>
    t.upTrend
      .offset(2)
      .and(c.whiteBody.offset(2))
      .and(c.isDojiBody.offset(1))
      .and(high.offset(2).lt(low.offset(1)))
      .and(c.blackBody)
      .and(low.offset(1).gt(high)),
};
