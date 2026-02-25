import { createPattern } from './candlestick-pattern';

export const EveningDojiStar = createPattern({
  name: 'Evening Doji Star', shortName: 'EDS', label: 'EDS', signal: 'bearish', startIndex: 2,
  detect: (i, c) => c.longBody[i - 2] && c.isDojiBody[i - 1] && c.longBody[i] &&
    c.upTrend[i] && c.whiteBody[i - 2] && c.bodyLo[i - 1] > c.bodyHi[i - 2] &&
    c.blackBody[i] && c.bodyLo[i] <= c.bodyMiddle[i - 2] &&
    c.bodyLo[i] > c.bodyLo[i - 2] && c.bodyLo[i - 1] > c.bodyHi[i],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = EveningDojiStar;
