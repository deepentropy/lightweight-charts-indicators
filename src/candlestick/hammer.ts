import { createPattern } from './candlestick-pattern';
import { C_Factor } from './candlestick-helpers';

export const Hammer = createPattern({
  name: 'Hammer', shortName: 'Hammer', label: 'H', signal: 'bullish', startIndex: 0,
  detect: (i, c) => c.smallBody[i] && c.body[i] > 0 && c.bodyLo[i] > c.hl2[i] &&
    c.dnShadow[i] >= C_Factor * c.body[i] && !c.hasUpShadow[i] && c.downTrend[i],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = Hammer;
export type HammerInputs = Record<string, unknown>;
