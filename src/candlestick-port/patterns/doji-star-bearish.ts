/**
 * Port of "Doji Star - Bearish.pine".
 */
import type { PatternDef } from '../pattern-runner';

export const dojiStarBearish: PatternDef = {
  name: 'Doji Star - Bearish',
  shortName: 'Doji Star - Bear',
  direction: 'bearish',
  labelText: 'DS',
  candles: 2,
  needsTrend: true,
  tooltip:
    'Doji Star\nThis is a bearish reversal candlestick pattern that is found in an uptrend and consists of two candles. First comes a long green candle, followed by a Doji candle (except 4-Price Doji) that opens above the body of the first one, creating a gap. It is considered a reversal signal with confirmation during the next trading day.',
  // if C_UpTrend and C_WhiteBody[1] and C_LongBody[1] and C_IsDojiBody
  //    and C_BodyLo > C_BodyHi[1]
  detect: (c, t) =>
    t.upTrend
      .and(c.whiteBody.offset(1))
      .and(c.longBody.offset(1))
      .and(c.isDojiBody)
      .and(c.bodyLo.gt(c.bodyHi.offset(1))),
};
