/**
 * Port of "Dark Cloud Cover - Bearish.pine".
 */
import { close, open, high } from 'oakscriptjs/script';
import type { PatternDef } from '../pattern-runner';

export const darkCloudCoverBearish: PatternDef = {
  name: 'Dark Cloud Cover - Bearish',
  shortName: 'Dark Cloud Cover - Bear',
  direction: 'bearish',
  labelText: 'DCC',
  candles: 2,
  needsTrend: true,
  tooltip:
    'Dark Cloud Cover\nDark Cloud Cover is a two-candle bearish reversal candlestick pattern found in an uptrend. The first candle is green and has a larger than average body. The second candle is red and opens above the high of the prior candle, creating a gap, and then closes below the midpoint of the first candle. The pattern shows a possible shift in the momentum from the upside to the downside, indicating that a reversal might happen soon.',
  // if (C_UpTrend[1] and C_WhiteBody[1] and C_LongBody[1]) and
  //    (C_BlackBody and open >= high[1] and close < C_BodyMiddle[1] and close > open[1])
  detect: (c, t) =>
    t.upTrend
      .offset(1)
      .and(c.whiteBody.offset(1))
      .and(c.longBody.offset(1))
      .and(c.blackBody)
      .and(open.gte(high.offset(1)))
      .and(close.lt(c.bodyMiddle.offset(1)))
      .and(close.gt(open.offset(1))),
};
