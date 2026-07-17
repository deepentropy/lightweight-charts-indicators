/**
 * Port of "Gravestone Doji - Bearish.pine" (no trend detection input).
 */
import type { PatternDef } from '../pattern-runner';

export const gravestoneDojiBearish: PatternDef = {
  name: 'Gravestone Doji - Bearish',
  shortName: 'Gravestone Doji - Bear',
  direction: 'bearish',
  labelText: 'GD',
  candles: 1,
  needsTrend: false,
  tooltip:
    'Gravestone Doji\nWhen a doji is at or is close to the day’s low point, a doji line will develop.',
  // C_IsDojiBody and C_DnShadow <= C_Body
  detect: (c) => c.isDojiBody.and(c.dnShadow.lte(c.body)),
};
