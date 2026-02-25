import { createPattern } from './candlestick-pattern';

export const EveningStar = createPattern({
  name: 'Evening Star', shortName: 'ES', label: 'ES', signal: 'bearish', startIndex: 2,
  detect: (i, c) => c.longBody[i - 2] && c.smallBody[i - 1] && c.longBody[i] &&
    c.upTrend[i] && c.whiteBody[i - 2] && c.bodyLo[i - 1] > c.bodyHi[i - 2] &&
    c.blackBody[i] && c.bodyLo[i] <= c.bodyMiddle[i - 2] &&
    c.bodyLo[i] > c.bodyLo[i - 2] && c.bodyLo[i - 1] > c.bodyHi[i],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = EveningStar;
