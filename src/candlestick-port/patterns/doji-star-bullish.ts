/**
 * Port of "Doji Star - Bullish.pine".
 */
import type { PatternDef } from '../pattern-runner';

export const dojiStarBullish: PatternDef = {
  name: 'Doji Star - Bullish',
  shortName: 'Doji Star - Bull',
  direction: 'bullish',
  labelText: 'DS',
  candles: 2,
  needsTrend: true,
  tooltip:
    'Doji Star\nThis is a bullish reversal candlestick pattern that is found in a downtrend and consists of two candles. First comes a long red candle, followed by a Doji candle (except 4-Price Doji) that opens below the body of the first one, creating a gap. It is considered a reversal signal with confirmation during the next trading day.',
  // if C_DownTrend and C_BlackBody[1] and C_LongBody[1] and C_IsDojiBody
  //    and C_BodyHi < C_BodyLo[1]
  detect: (c, t) =>
    t.downTrend
      .and(c.blackBody.offset(1))
      .and(c.longBody.offset(1))
      .and(c.isDojiBody)
      .and(c.bodyHi.lt(c.bodyLo.offset(1))),
};
