import { createPattern } from './candlestick-pattern';

export const Doji = createPattern({
  name: 'Doji', shortName: 'Doji', label: 'D', signal: 'neutral', startIndex: 0,
  detect: (i, c) => c.doji[i] &&
    !(c.isDojiBody[i] && c.upShadow[i] <= c.body[i]) &&
    !(c.isDojiBody[i] && c.dnShadow[i] <= c.body[i]),
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = Doji;
