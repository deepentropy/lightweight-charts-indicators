import { createPattern } from './candlestick-pattern';

export const DojiStarBearish = createPattern({
  name: 'Doji Star Bearish', shortName: 'DS', label: 'DS', signal: 'bearish', startIndex: 1,
  detect: (i, c) => c.upTrend[i] && c.whiteBody[i - 1] && c.longBody[i - 1] &&
    c.isDojiBody[i] && c.bodyLo[i] > c.bodyHi[i - 1],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = DojiStarBearish;
