/**
 * Port of "Falling Window - Bearish.pine".
 */
import { high, low } from 'oakscriptjs/script';
import type { PatternDef } from '../pattern-runner';

export const fallingWindowBearish: PatternDef = {
  name: 'Falling Window - Bearish',
  shortName: 'Falling Window - Bear',
  direction: 'bearish',
  labelText: 'FW',
  candles: 2,
  needsTrend: true,
  tooltip:
    'Falling Window\nFalling Window is a two-candle bearish continuation pattern that forms during a downtrend. Both candles in the pattern can be of any type, with the exception of the Four-Price Doji. The most important characteristic of the pattern is a price gap between the first candle\'s low and the second candle\'s high. The existence of this gap (window) means that the bearish trend is expected to continue.',
  // C_DownTrend[1] and (C_Range!=0 and C_Range[1]!=0) and high < low[1]
  detect: (c, t) =>
    t.downTrend
      .offset(1)
      .and(c.range.neq(0).and(c.range.offset(1).neq(0)))
      .and(high.lt(low.offset(1))),
};
