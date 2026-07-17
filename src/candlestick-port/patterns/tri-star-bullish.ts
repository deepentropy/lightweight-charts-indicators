/**
 * Port of "Tri-Star - Bullish.pine".
 */
import type { PatternDef } from '../pattern-runner';

export const triStarBullish: PatternDef = {
  name: 'Tri-Star - Bullish',
  shortName: 'Tri-Star - Bull',
  direction: 'bullish',
  labelText: '3S',
  candles: 3,
  needsTrend: true,
  tooltip:
    'Tri-Star\nA bullish TriStar candlestick pattern can form when three doji candlesticks materialize in immediate succession at the tail-end of an extended downtrend. The first doji candle marks indecision between bull and bear. The second doji gaps in the direction of the leading trend. The third changes the attitude of the market once the candlestick opens in the direction opposite to the trend. Each doji candle has a shadow, all comparatively shallow, which signify an interim cutback in volatility.',
  // C_3DojisBullish = C_Doji[2] and C_Doji[1] and C_Doji
  // C_BodyGapUpBullish = C_BodyHi[1] < C_BodyLo
  // C_BodyGapDnBullish = C_BodyLo[1] > C_BodyHi
  // C_TriStarBullish = C_3DojisBullish and C_DownTrend[2] and C_BodyGapDnBullish[1] and C_BodyGapUpBullish
  detect: (c, t) => {
    const bodyGapUp = c.bodyHi.offset(1).lt(c.bodyLo);
    const bodyGapDn = c.bodyLo.offset(1).gt(c.bodyHi);
    return c.doji
      .offset(2)
      .and(c.doji.offset(1))
      .and(c.doji)
      .and(t.downTrend.offset(2))
      .and(bodyGapDn.offset(1))
      .and(bodyGapUp);
  },
};
