import { createPattern } from './candlestick-pattern';
import { C_Factor } from './candlestick-helpers';

export const ShootingStar = createPattern({
  name: 'Shooting Star', shortName: 'SS', label: 'SS', signal: 'bearish', startIndex: 0,
  detect: (i, c) => c.smallBody[i] && c.body[i] > 0 && c.bodyHi[i] < c.hl2[i] &&
    c.upShadow[i] >= C_Factor * c.body[i] && !c.hasDnShadow[i] && c.upTrend[i],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = ShootingStar;
export type ShootingStarInputs = Record<string, unknown>;
