import { createPattern } from './candlestick-pattern';

export const AbandonedBabyBullish = createPattern({
  name: 'Abandoned Baby Bullish', shortName: 'AB', label: 'AB', signal: 'bullish', startIndex: 2,
  detect: (i, c, bars) => c.downTrend[i - 2] && c.blackBody[i - 2] && c.isDojiBody[i - 1] &&
    bars[i - 2].low > bars[i - 1].high && c.whiteBody[i] && bars[i - 1].high < bars[i].low,
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = AbandonedBabyBullish;
