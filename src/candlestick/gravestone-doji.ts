import { createPattern } from './candlestick-pattern';

export const GravestoneDoji = createPattern({
  name: 'Gravestone Doji', shortName: 'GD', label: 'GD', signal: 'bearish', startIndex: 0,
  detect: (i, c) => c.isDojiBody[i] && c.dnShadow[i] <= c.body[i],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = GravestoneDoji;
