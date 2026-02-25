import { createPattern } from './candlestick-pattern';

export const SpinningTopWhite = createPattern({
  name: 'Spinning Top White', shortName: 'STW', label: 'STW', signal: 'neutral', startIndex: 0,
  detect: (i, c) => c.dnShadow[i] >= c.range[i] / 100 * 34 &&
    c.upShadow[i] >= c.range[i] / 100 * 34 && !c.isDojiBody[i] && c.whiteBody[i],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = SpinningTopWhite;
