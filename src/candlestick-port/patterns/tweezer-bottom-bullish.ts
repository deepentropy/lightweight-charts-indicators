/**
 * Port of "Tweezer Bottom - Bullish.pine".
 */
import { low, math, Series } from 'oakscriptjs/script';
import type { PatternDef } from '../pattern-runner';

export const tweezerBottomBullish: PatternDef = {
  name: 'Tweezer Bottom - Bullish',
  shortName: 'Tweezer Bottom - Bull',
  direction: 'bullish',
  labelText: 'TB',
  candles: 2,
  needsTrend: true,
  tooltip:
    'Tweezer Bottom\nTweezer Bottom is a two-candle pattern that signifies a potential bullish reversal. The pattern is found during a downtrend. The first candle is long and red, the second candle is green, its lows nearly identical to the low of the previous candle. The virtually identical lows together with the inverted directions hint that bulls might be taking over the market.',
  // if C_DownTrend[1] and (not C_IsDojiBody or (C_HasUpShadow and C_HasDnShadow))
  //    and math.abs(low-low[1]) <= C_BodyAvg*0.05 and C_BlackBody[1] and C_WhiteBody and C_LongBody[1]
  detect: (c, t) =>
    t.downTrend
      .offset(1)
      .and(c.isDojiBody.not().or(c.hasUpShadow.and(c.hasDnShadow)))
      .and((math.abs(low.sub(low.offset(1))) as Series).lte(c.bodyAvg.mul(0.05)))
      .and(c.blackBody.offset(1))
      .and(c.whiteBody)
      .and(c.longBody.offset(1)),
};
