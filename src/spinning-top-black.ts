import { createPattern } from './candlestick-pattern';

export const SpinningTopBlack = createPattern({
  name: 'Spinning Top Black', shortName: 'STB', label: 'STB', signal: 'neutral', startIndex: 0,
  detect: (i, c) => c.dnShadow[i] >= c.range[i] / 100 * 34 &&
    c.upShadow[i] >= c.range[i] / 100 * 34 && !c.isDojiBody[i] && c.blackBody[i],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = SpinningTopBlack;
