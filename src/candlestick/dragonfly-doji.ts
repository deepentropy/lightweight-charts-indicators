import { createPattern } from './candlestick-pattern';

export const DragonflyDoji = createPattern({
  name: 'Dragonfly Doji', shortName: 'DD', label: 'DD', signal: 'bullish', startIndex: 0,
  detect: (i, c) => c.isDojiBody[i] && c.upShadow[i] <= c.body[i],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = DragonflyDoji;
