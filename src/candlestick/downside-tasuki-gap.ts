import { createPattern } from './candlestick-pattern';

export const DownsideTasukiGap = createPattern({
  name: 'Downside Tasuki Gap', shortName: 'DTG', label: 'DTG', signal: 'bearish', startIndex: 2,
  detect: (i, c) => c.longBody[i - 2] && c.smallBody[i - 1] && c.downTrend[i] &&
    c.blackBody[i - 2] && c.bodyHi[i - 1] < c.bodyLo[i - 2] &&
    c.blackBody[i - 1] && c.whiteBody[i] &&
    c.bodyHi[i] <= c.bodyLo[i - 2] && c.bodyHi[i] >= c.bodyHi[i - 1],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = DownsideTasukiGap;
