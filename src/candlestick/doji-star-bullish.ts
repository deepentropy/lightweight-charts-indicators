import { createPattern } from './candlestick-pattern';

export const DojiStarBullish = createPattern({
  name: 'Doji Star Bullish', shortName: 'DS', label: 'DS', signal: 'bullish', startIndex: 1,
  detect: (i, c) => c.downTrend[i] && c.blackBody[i - 1] && c.longBody[i - 1] &&
    c.isDojiBody[i] && c.bodyHi[i] < c.bodyLo[i - 1],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = DojiStarBullish;
