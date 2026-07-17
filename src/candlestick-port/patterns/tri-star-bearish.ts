/**
 * Port of "Tri-Star - Bearish.pine".
 */
import type { PatternDef } from '../pattern-runner';

export const triStarBearish: PatternDef = {
  name: 'Tri-Star - Bearish',
  shortName: 'Tri-Star - Bear',
  direction: 'bearish',
  labelText: '3S',
  candles: 3,
  needsTrend: true,
  tooltip:
    'Tri-Star\nThis particular pattern can form when three doji candlesticks appear in immediate succession at the end of an extended uptrend. The first doji candle marks indecision between bull and bear. The second doji gaps in the direction of the leading trend. The third changes the attitude of the market once the candlestick opens in the direction opposite to the trend. Each doji candle has a shadow, all comparatively shallow, which signify an interim cutback in volatility.',
  // C_3Dojis = C_Doji[2] and C_Doji[1] and C_Doji
  // C_BodyGapUp = C_BodyHi[1] < C_BodyLo
  // C_BodyGapDn = C_BodyLo[1] > C_BodyHi
  // C_TriStarBearish = C_3Dojis and C_UpTrend[2] and C_BodyGapUp[1] and C_BodyGapDn
  detect: (c, t) => {
    const bodyGapUp = c.bodyHi.offset(1).lt(c.bodyLo);
    const bodyGapDn = c.bodyLo.offset(1).gt(c.bodyHi);
    return c.doji
      .offset(2)
      .and(c.doji.offset(1))
      .and(c.doji)
      .and(t.upTrend.offset(2))
      .and(bodyGapUp.offset(1))
      .and(bodyGapDn);
  },
};
