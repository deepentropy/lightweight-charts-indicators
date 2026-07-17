/**
 * Port of "Three Black Crows - Bearish.pine" (no trend detection input).
 */
import { close, open } from 'oakscriptjs/script';
import type { PatternDef } from '../pattern-runner';

const C_3BCRW_SHADOW_PERCENT = 5.0;

export const threeBlackCrowsBearish: PatternDef = {
  name: 'Three Black Crows - Bearish',
  shortName: 'Three Black Crows - Bear',
  direction: 'bearish',
  labelText: '3BC',
  candles: 3,
  needsTrend: false,
  tooltip:
    'Three Black Crows\nThis is a bearish reversal pattern that consists of three long, red-bodied candles in immediate succession. For each of these candles, each day opens within the body of the day before and closes either at or near its low.',
  // C_3BCrw_HaveNotDnShadow = C_Range * C_3BCrw_ShadowPercent / 100 > C_DnShadow
  // if C_LongBody and C_LongBody[1] and C_LongBody[2]
  //   if C_BlackBody and C_BlackBody[1] and C_BlackBody[2]
  //     C_ThreeBlackCrowsBearish := close < close[1] and close[1] < close[2]
  //       and open > close[1] and open < open[1] and open[1] > close[2] and open[1] < open[2]
  //       and C_3BCrw_HaveNotDnShadow and C_3BCrw_HaveNotDnShadow[1] and C_3BCrw_HaveNotDnShadow[2]
  detect: (c) => {
    const haveNotDnShadow = c.range.mul(C_3BCRW_SHADOW_PERCENT / 100).gt(c.dnShadow);
    return c.longBody
      .and(c.longBody.offset(1))
      .and(c.longBody.offset(2))
      .and(c.blackBody)
      .and(c.blackBody.offset(1))
      .and(c.blackBody.offset(2))
      .and(close.lt(close.offset(1)))
      .and(close.offset(1).lt(close.offset(2)))
      .and(open.gt(close.offset(1)))
      .and(open.lt(open.offset(1)))
      .and(open.offset(1).gt(close.offset(2)))
      .and(open.offset(1).lt(open.offset(2)))
      .and(haveNotDnShadow)
      .and(haveNotDnShadow.offset(1))
      .and(haveNotDnShadow.offset(2));
  },
};
