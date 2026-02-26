import { createPattern } from './candlestick-pattern';

export const HaramiBearish = createPattern({
  name: 'Harami Bearish', shortName: 'BH', label: 'BH', signal: 'bearish', startIndex: 1,
  detect: (i, c, bars) => c.longBody[i - 1] && c.whiteBody[i - 1] && c.upTrend[i - 1] &&
    c.blackBody[i] && c.smallBody[i] &&
    bars[i].high <= c.bodyHi[i - 1] && bars[i].low >= c.bodyLo[i - 1],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = HaramiBearish;
