import { createPattern } from './candlestick-pattern';

export const MarubozuBlack = createPattern({
  name: 'Marubozu Black', shortName: 'MB', label: 'MB', signal: 'bearish', startIndex: 0,
  detect: (i, c) => c.blackBody[i] && c.longBody[i] &&
    c.upShadow[i] <= 5 / 100 * c.body[i] && c.dnShadow[i] <= 5 / 100 * c.body[i],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = MarubozuBlack;
