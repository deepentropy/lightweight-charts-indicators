/**
 * Port of "Dragonfly Doji - Bullish.pine" (no trend detection input).
 */
import type { PatternDef } from '../pattern-runner';

export const dragonflyDojiBullish: PatternDef = {
  name: 'Dragonfly Doji - Bullish',
  shortName: 'Dragonfly Doji - Bull',
  direction: 'bullish',
  labelText: 'DD',
  candles: 1,
  needsTrend: false,
  tooltip:
    'Dragonfly Doji\nSimilar to other Doji days, this particular Doji also regularly appears at pivotal market moments. This is a specific Doji where both the open and close price are at the high of a given day.',
  // C_IsDojiBody and C_UpShadow <= C_Body
  detect: (c) => c.isDojiBody.and(c.upShadow.lte(c.body)),
};
