import { createPattern } from './candlestick-pattern';

export const MorningDojiStar = createPattern({
  name: 'Morning Doji Star', shortName: 'MDS', label: 'MDS', signal: 'bullish', startIndex: 2,
  detect: (i, c) => c.longBody[i - 2] && c.isDojiBody[i - 1] && c.longBody[i] &&
    c.downTrend[i] && c.blackBody[i - 2] && c.bodyHi[i - 1] < c.bodyLo[i - 2] &&
    c.whiteBody[i] && c.bodyHi[i] >= c.bodyMiddle[i - 2] &&
    c.bodyHi[i] < c.bodyHi[i - 2] && c.bodyHi[i - 1] < c.bodyLo[i],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = MorningDojiStar;
