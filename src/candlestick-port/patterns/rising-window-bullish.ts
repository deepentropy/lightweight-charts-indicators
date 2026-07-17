/**
 * Port of "Rising Window - Bullish.pine".
 */
import { high, low } from 'oakscriptjs/script';
import type { PatternDef } from '../pattern-runner';

export const risingWindowBullish: PatternDef = {
  name: 'Rising Window - Bullish',
  shortName: 'Rising Window - Bull',
  direction: 'bullish',
  labelText: 'RW',
  candles: 2,
  needsTrend: true,
  tooltip:
    "Rising Window\nRising Window is a two-candle bullish continuation pattern that forms during an uptrend. Both candles in the pattern can be of any type with the exception of the Four-Price Doji. The most important characteristic of the pattern is a price gap between the first candle's high and the second candle's low. That gap (window) between two bars signifies support against the selling pressure.",
  // if C_UpTrend[1] and (C_Range!=0 and C_Range[1]!=0) and low > high[1]
  detect: (c, t) =>
    t.upTrend
      .offset(1)
      .and(c.range.neq(0))
      .and(c.range.offset(1).neq(0))
      .and(low.gt(high.offset(1))),
};
