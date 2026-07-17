/**
 * Port of "Doji.pine" (neutral, no trend detection input).
 */
import type { PatternDef } from '../pattern-runner';

export const doji: PatternDef = {
  name: 'Doji',
  shortName: 'Doji',
  direction: 'neutral',
  labelText: 'D',
  candles: 1,
  needsTrend: false,
  tooltip:
    'Doji\nWhen the open and close of a security are essentially equal to each other, a doji candle forms. The length of both upper and lower shadows may vary, causing the candlestick you are left with to either resemble a cross, an inverted cross, or a plus sign. Doji candles show the playout of buyer-seller indecision in a tug-of-war of sorts. As price moves either above or below the opening level during the session, the close is either at or near the opening level.',
  // C_Doji and not C_DragonflyDoji and not C_GravestoneDojiOne
  // C_DragonflyDoji = C_IsDojiBody and C_UpShadow <= C_Body
  // C_GravestoneDojiOne = C_IsDojiBody and C_DnShadow <= C_Body
  detect: (c) => {
    const dragonfly = c.isDojiBody.and(c.upShadow.lte(c.body));
    const gravestone = c.isDojiBody.and(c.dnShadow.lte(c.body));
    return c.doji.and(dragonfly.not()).and(gravestone.not());
  },
};
