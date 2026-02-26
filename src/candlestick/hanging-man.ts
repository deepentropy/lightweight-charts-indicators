import { createPattern } from './candlestick-pattern';
import { C_Factor } from './candlestick-helpers';

export const HangingMan = createPattern({
  name: 'Hanging Man', shortName: 'HM', label: 'HM', signal: 'bearish', startIndex: 0,
  detect: (i, c) => c.smallBody[i] && c.body[i] > 0 && c.bodyLo[i] > c.hl2[i] &&
    c.dnShadow[i] >= C_Factor * c.body[i] && !c.hasUpShadow[i] && c.upTrend[i],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = HangingMan;
