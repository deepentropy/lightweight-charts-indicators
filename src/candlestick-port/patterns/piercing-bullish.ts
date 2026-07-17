/**
 * Port of "Piercing - Bullish.pine".
 */
import { close, open, low } from 'oakscriptjs/script';
import type { PatternDef } from '../pattern-runner';

export const piercingBullish: PatternDef = {
  name: 'Piercing - Bullish',
  shortName: 'Piercing - Bull',
  direction: 'bullish',
  labelText: 'P',
  candles: 2,
  needsTrend: true,
  tooltip:
    'Piercing\nPiercing is a two-candle bullish reversal candlestick pattern found in a downtrend. The first candle is red and has a larger than average body. The second candle is green and opens below the low of the prior candle, creating a gap, and then closes above the midpoint of the first candle. The pattern shows a possible shift in the momentum from the downside to the upside, indicating that a reversal might happen soon.',
  // if (C_DownTrend[1] and C_BlackBody[1] and C_LongBody[1])
  //   and (C_WhiteBody and open <= low[1] and close > C_BodyMiddle[1] and close < open[1])
  detect: (c, t) =>
    t.downTrend
      .offset(1)
      .and(c.blackBody.offset(1))
      .and(c.longBody.offset(1))
      .and(c.whiteBody)
      .and(open.lte(low.offset(1)))
      .and(close.gt(c.bodyMiddle.offset(1)))
      .and(close.lt(open.offset(1))),
};
