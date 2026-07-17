/**
 * Port of "Falling Three Methods - Bearish.pine".
 */
import { close, open, high, low } from 'oakscriptjs/script';
import type { PatternDef } from '../pattern-runner';

export const fallingThreeMethodsBearish: PatternDef = {
  name: 'Falling Three Methods - Bearish',
  shortName: 'Falling Three Methods - Bear',
  direction: 'bearish',
  labelText: 'FTM',
  candles: 5,
  needsTrend: true,
  tooltip:
    'Falling Three Methods\nFalling Three Methods is a five-candle bearish pattern that signifies a continuation of an existing downtrend. The first candle is long and red, followed by three short green candles with bodies inside the range of the first candle. The last candle is also red and long and it closes below the close of the first candle. This decisive fifth strongly bearish candle hints that bulls could not reverse the prior downtrend and that bears have regained control of the market.',
  // C_DownTrend[4] and (C_LongBody[4] and C_BlackBody[4])
  // and (C_SmallBody[3] and C_WhiteBody[3] and open[3]>low[4] and close[3]<high[4])
  // and (C_SmallBody[2] and C_WhiteBody[2] and open[2]>low[4] and close[2]<high[4])
  // and (C_SmallBody[1] and C_WhiteBody[1] and open[1]>low[4] and close[1]<high[4])
  // and (C_LongBody and C_BlackBody and close<close[4])
  detect: (c, t) =>
    t.downTrend
      .offset(4)
      .and(c.longBody.offset(4).and(c.blackBody.offset(4)))
      .and(
        c.smallBody
          .offset(3)
          .and(c.whiteBody.offset(3))
          .and(open.offset(3).gt(low.offset(4)))
          .and(close.offset(3).lt(high.offset(4)))
      )
      .and(
        c.smallBody
          .offset(2)
          .and(c.whiteBody.offset(2))
          .and(open.offset(2).gt(low.offset(4)))
          .and(close.offset(2).lt(high.offset(4)))
      )
      .and(
        c.smallBody
          .offset(1)
          .and(c.whiteBody.offset(1))
          .and(open.offset(1).gt(low.offset(4)))
          .and(close.offset(1).lt(high.offset(4)))
      )
      .and(c.longBody.and(c.blackBody).and(close.lt(close.offset(4)))),
};
