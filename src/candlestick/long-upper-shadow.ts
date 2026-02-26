import { createPattern } from './candlestick-pattern';

export const LongUpperShadow = createPattern({
  name: 'Long Upper Shadow', shortName: 'LUS', label: 'LUS', signal: 'bearish', startIndex: 0,
  detect: (i, c) => c.upShadow[i] > c.range[i] / 100 * 75,
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = LongUpperShadow;
