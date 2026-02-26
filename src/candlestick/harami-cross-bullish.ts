import { createPattern } from './candlestick-pattern';

export const HaramiCrossBullish = createPattern({
  name: 'Harami Cross Bullish', shortName: 'HC', label: 'HC', signal: 'bullish', startIndex: 1,
  detect: (i, c, bars) => c.longBody[i - 1] && c.blackBody[i - 1] && c.downTrend[i - 1] &&
    c.isDojiBody[i] && bars[i].high <= c.bodyHi[i - 1] && bars[i].low >= c.bodyLo[i - 1],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = HaramiCrossBullish;
