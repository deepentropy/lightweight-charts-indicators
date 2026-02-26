import { createPattern } from './candlestick-pattern';

export const FallingThreeMethods = createPattern({
  name: 'Falling Three Methods', shortName: 'FTM', label: 'FTM', signal: 'bearish', startIndex: 4,
  detect: (i, c, bars) =>
    c.downTrend[i - 4] && c.longBody[i - 4] && c.blackBody[i - 4] &&
    c.smallBody[i - 3] && c.whiteBody[i - 3] && bars[i - 3].open > bars[i - 4].low && bars[i - 3].close < bars[i - 4].high &&
    c.smallBody[i - 2] && c.whiteBody[i - 2] && bars[i - 2].open > bars[i - 4].low && bars[i - 2].close < bars[i - 4].high &&
    c.smallBody[i - 1] && c.whiteBody[i - 1] && bars[i - 1].open > bars[i - 4].low && bars[i - 1].close < bars[i - 4].high &&
    c.longBody[i] && c.blackBody[i] && bars[i].close < bars[i - 4].close,
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = FallingThreeMethods;
