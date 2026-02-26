import { createPattern } from './candlestick-pattern';

export const MarubozuWhite = createPattern({
  name: 'Marubozu White', shortName: 'MW', label: 'MW', signal: 'bullish', startIndex: 0,
  detect: (i, c) => c.whiteBody[i] && c.longBody[i] &&
    c.upShadow[i] <= 5 / 100 * c.body[i] && c.dnShadow[i] <= 5 / 100 * c.body[i],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = MarubozuWhite;
