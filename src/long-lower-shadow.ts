import { createPattern } from './candlestick-pattern';

export const LongLowerShadow = createPattern({
  name: 'Long Lower Shadow', shortName: 'LLS', label: 'LLS', signal: 'bullish', startIndex: 0,
  detect: (i, c) => c.dnShadow[i] > c.range[i] / 100 * 75,
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = LongLowerShadow;
