import { createPattern } from './candlestick-pattern';

export const AbandonedBabyBearish = createPattern({
  name: 'Abandoned Baby Bearish', shortName: 'AB', label: 'AB', signal: 'bearish', startIndex: 2,
  detect: (i, c, bars) => c.upTrend[i - 2] && c.whiteBody[i - 2] && c.isDojiBody[i - 1] &&
    bars[i - 2].high < bars[i - 1].low && c.blackBody[i] && bars[i - 1].low > bars[i].high,
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = AbandonedBabyBearish;
