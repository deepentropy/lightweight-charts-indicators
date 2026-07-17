/**
 * Port of "On Neck - Bearish.pine".
 */
import { math, Series, close, open, low } from 'oakscriptjs/script';
import type { PatternDef } from '../pattern-runner';

export const onNeckBearish: PatternDef = {
  name: 'On Neck - Bearish',
  shortName: 'On Neck - Bear',
  direction: 'bearish',
  labelText: 'ON',
  candles: 2,
  needsTrend: true,
  tooltip:
    "On Neck\nOn Neck is a two-line continuation pattern found in a downtrend. The first candle is long and red, the second candle is short and has a green body. The closing price of the second candle is close or equal to the first candle's low price. The pattern hints at a continuation of a downtrend, and penetrating the low of the green candlestick is sometimes considered a confirmation. ",
  // if C_DownTrend and C_BlackBody[1] and C_LongBody[1] and C_WhiteBody and open < close[1]
  //   and C_SmallBody and C_Range!=0 and math.abs(close-low[1])<=C_BodyAvg*0.05
  detect: (c, t) =>
    t.downTrend
      .and(c.blackBody.offset(1))
      .and(c.longBody.offset(1))
      .and(c.whiteBody)
      .and(open.lt(close.offset(1)))
      .and(c.smallBody)
      .and(c.range.neq(0))
      .and((math.abs(close.sub(low.offset(1))) as Series).lte(c.bodyAvg.mul(0.05))),
};
