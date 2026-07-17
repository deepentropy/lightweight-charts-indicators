/**
 * Port of "Three White Soldiers - Bullish.pine" (no trend detection input).
 */
import { close, open } from 'oakscriptjs/script';
import type { PatternDef } from '../pattern-runner';

const C_3WSLD_SHADOW_PERCENT = 5.0;

export const threeWhiteSoldiersBullish: PatternDef = {
  name: 'Three White Soldiers - Bullish',
  shortName: 'Three White Soldiers - Bull',
  direction: 'bullish',
  labelText: '3WS',
  candles: 3,
  needsTrend: false,
  tooltip:
    'Three White Soldiers\nThis bullish reversal pattern is made up of three long-bodied, green candles in immediate succession. Each one opens within the body before it and the close is near to the daily high.',
  // C_3WSld_HaveNotUpShadow = C_Range * C_3WSld_ShadowPercent / 100 > C_UpShadow
  // if C_LongBody and C_LongBody[1] and C_LongBody[2]
  //   if C_WhiteBody and C_WhiteBody[1] and C_WhiteBody[2]
  //     C_ThreeWhiteSoldiersBullish := close > close[1] and close[1] > close[2]
  //       and open < close[1] and open > open[1] and open[1] < close[2] and open[1] > open[2]
  //       and C_3WSld_HaveNotUpShadow and C_3WSld_HaveNotUpShadow[1] and C_3WSld_HaveNotUpShadow[2]
  detect: (c) => {
    const haveNotUpShadow = c.range.mul(C_3WSLD_SHADOW_PERCENT / 100).gt(c.upShadow);
    return c.longBody
      .and(c.longBody.offset(1))
      .and(c.longBody.offset(2))
      .and(c.whiteBody)
      .and(c.whiteBody.offset(1))
      .and(c.whiteBody.offset(2))
      .and(close.gt(close.offset(1)))
      .and(close.offset(1).gt(close.offset(2)))
      .and(open.lt(close.offset(1)))
      .and(open.gt(open.offset(1)))
      .and(open.offset(1).lt(close.offset(2)))
      .and(open.offset(1).gt(open.offset(2)))
      .and(haveNotUpShadow)
      .and(haveNotUpShadow.offset(1))
      .and(haveNotUpShadow.offset(2));
  },
};
