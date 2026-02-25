import { createPattern } from './candlestick-pattern';
import { C_Factor } from './candlestick-helpers';

export const InvertedHammer = createPattern({
  name: 'Inverted Hammer', shortName: 'IH', label: 'IH', signal: 'bullish', startIndex: 0,
  detect: (i, c) => c.smallBody[i] && c.body[i] > 0 && c.bodyHi[i] < c.hl2[i] &&
    c.upShadow[i] >= C_Factor * c.body[i] && !c.hasDnShadow[i] && c.downTrend[i],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = InvertedHammer;
