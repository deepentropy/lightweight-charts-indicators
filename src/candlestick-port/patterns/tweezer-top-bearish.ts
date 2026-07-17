/**
 * Port of "Tweezer Top - Bearish.pine".
 */
import { high, math, Series } from 'oakscriptjs/script';
import type { PatternDef } from '../pattern-runner';

export const tweezerTopBearish: PatternDef = {
  name: 'Tweezer Top - Bearish',
  shortName: 'Tweezer Top - Bear',
  direction: 'bearish',
  labelText: 'TT',
  candles: 2,
  needsTrend: true,
  tooltip:
    'Tweezer Top\nTweezer Top is a two-candle pattern that signifies a potential bearish reversal. The pattern is found during an uptrend. The first candle is long and green, the second candle is red, and its high is nearly identical to the high of the previous candle. The virtually identical highs, together with the inverted directions, hint that bears might be taking over the market.',
  // if C_UpTrend[1] and (not C_IsDojiBody or (C_HasUpShadow and C_HasDnShadow))
  //    and math.abs(high-high[1]) <= C_BodyAvg*0.05 and C_WhiteBody[1] and C_BlackBody and C_LongBody[1]
  detect: (c, t) =>
    t.upTrend
      .offset(1)
      .and(c.isDojiBody.not().or(c.hasUpShadow.and(c.hasDnShadow)))
      .and((math.abs(high.sub(high.offset(1))) as Series).lte(c.bodyAvg.mul(0.05)))
      .and(c.whiteBody.offset(1))
      .and(c.blackBody)
      .and(c.longBody.offset(1)),
};
