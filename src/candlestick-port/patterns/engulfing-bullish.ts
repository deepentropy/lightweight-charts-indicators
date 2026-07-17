/**
 * Port of "Engulfing - Bullish.pine".
 */
import { close, open } from 'oakscriptjs/script';
import type { PatternDef } from '../pattern-runner';

export const engulfingBullish: PatternDef = {
  name: 'Engulfing - Bullish',
  shortName: 'Engulfing - Bull',
  direction: 'bullish',
  labelText: 'BE',
  candles: 2,
  needsTrend: true,
  tooltip:
    'Engulfing\nAt the end of a given downward trend, there will most likely be a reversal pattern. To distinguish the first day, this candlestick pattern uses a small body, followed by a day where the candle body fully overtakes the body from the day before, and closes in the trend’s opposite direction. Although similar to the outside reversal chart pattern, it is not essential for this pattern to completely overtake the range (high to low), rather only the open and the close.',
  // C_DownTrend and C_WhiteBody and C_LongBody and C_BlackBody[1] and C_SmallBody[1]
  // and close >= open[1] and open <= close[1] and (close > open[1] or open < close[1])
  detect: (c, t) =>
    t.downTrend
      .and(c.whiteBody)
      .and(c.longBody)
      .and(c.blackBody.offset(1))
      .and(c.smallBody.offset(1))
      .and(close.gte(open.offset(1)))
      .and(open.lte(close.offset(1)))
      .and(close.gt(open.offset(1)).or(open.lt(close.offset(1)))),
};
