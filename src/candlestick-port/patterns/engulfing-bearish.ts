/**
 * Port of "Engulfing - Bearish.pine".
 */
import { close, open } from 'oakscriptjs/script';
import type { PatternDef } from '../pattern-runner';

export const engulfingBearish: PatternDef = {
  name: 'Engulfing - Bearish',
  shortName: 'Engulfing - Bear',
  direction: 'bearish',
  labelText: 'BE',
  candles: 2,
  needsTrend: true,
  tooltip:
    'Engulfing\nAt the end of a given uptrend, a reversal pattern will most likely appear. During the first day, this candlestick pattern uses a small body. It is then followed by a day where the candle body fully overtakes the body from the day before it and closes in the trend’s opposite direction. Although similar to the outside reversal chart pattern, it is not essential for this pattern to fully overtake the range (high to low), rather only the open and the close.',
  // C_UpTrend and C_BlackBody and C_LongBody and C_WhiteBody[1] and C_SmallBody[1]
  // and close <= open[1] and open >= close[1] and (close < open[1] or open > close[1])
  detect: (c, t) =>
    t.upTrend
      .and(c.blackBody)
      .and(c.longBody)
      .and(c.whiteBody.offset(1))
      .and(c.smallBody.offset(1))
      .and(close.lte(open.offset(1)))
      .and(open.gte(close.offset(1)))
      .and(close.lt(open.offset(1)).or(open.gt(close.offset(1)))),
};
