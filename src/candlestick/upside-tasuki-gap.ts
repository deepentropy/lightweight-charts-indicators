import { createPattern } from './candlestick-pattern';

export const UpsideTasukiGap = createPattern({
  name: 'Upside Tasuki Gap', shortName: 'UTG', label: 'UTG', signal: 'bullish', startIndex: 2,
  detect: (i, c) => c.longBody[i - 2] && c.smallBody[i - 1] && c.upTrend[i] &&
    c.whiteBody[i - 2] && c.bodyLo[i - 1] > c.bodyHi[i - 2] &&
    c.whiteBody[i - 1] && c.blackBody[i] &&
    c.bodyLo[i] >= c.bodyHi[i - 2] && c.bodyLo[i] <= c.bodyLo[i - 1],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = UpsideTasukiGap;
