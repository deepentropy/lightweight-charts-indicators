/**
 * Port of "Rising Three Methods - Bullish.pine".
 */
import { close, open, high, low } from 'oakscriptjs/script';
import type { PatternDef } from '../pattern-runner';

export const risingThreeMethodsBullish: PatternDef = {
  name: 'Rising Three Methods - Bullish',
  shortName: 'Rising Three Methods - Bull',
  direction: 'bullish',
  labelText: 'RTM',
  candles: 5,
  needsTrend: true,
  tooltip:
    'Rising Three Methods\nRising Three Methods is a five-candle bullish pattern that signifies a continuation of an existing uptrend. The first candle is long and green, followed by three short red candles with bodies inside the range of the first candle. The last candle is also green and long and it closes above the close of the first candle. This decisive fifth strongly bullish candle hints that bears could not reverse the prior uptrend and that bulls have regained control of the market.',
  // if C_UpTrend[4] and (C_LongBody[4] and C_WhiteBody[4])
  //   and (C_SmallBody[3] and C_BlackBody[3] and open[3]<high[4] and close[3]>low[4])
  //   and (C_SmallBody[2] and C_BlackBody[2] and open[2]<high[4] and close[2]>low[4])
  //   and (C_SmallBody[1] and C_BlackBody[1] and open[1]<high[4] and close[1]>low[4])
  //   and (C_LongBody and C_WhiteBody and close>close[4])
  detect: (c, t) =>
    t.upTrend
      .offset(4)
      .and(c.longBody.offset(4))
      .and(c.whiteBody.offset(4))
      .and(c.smallBody.offset(3))
      .and(c.blackBody.offset(3))
      .and(open.offset(3).lt(high.offset(4)))
      .and(close.offset(3).gt(low.offset(4)))
      .and(c.smallBody.offset(2))
      .and(c.blackBody.offset(2))
      .and(open.offset(2).lt(high.offset(4)))
      .and(close.offset(2).gt(low.offset(4)))
      .and(c.smallBody.offset(1))
      .and(c.blackBody.offset(1))
      .and(open.offset(1).lt(high.offset(4)))
      .and(close.offset(1).gt(low.offset(4)))
      .and(c.longBody)
      .and(c.whiteBody)
      .and(close.gt(close.offset(4))),
};
