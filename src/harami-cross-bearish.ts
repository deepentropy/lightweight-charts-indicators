import { createPattern } from './candlestick-pattern';

export const HaramiCrossBearish = createPattern({
  name: 'Harami Cross Bearish', shortName: 'HC', label: 'HC', signal: 'bearish', startIndex: 1,
  detect: (i, c, bars) => c.longBody[i - 1] && c.whiteBody[i - 1] && c.upTrend[i - 1] &&
    c.isDojiBody[i] && bars[i].high <= c.bodyHi[i - 1] && bars[i].low >= c.bodyLo[i - 1],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = HaramiCrossBearish;
