import { createPattern } from './candlestick-pattern';

export const TweezerTop = createPattern({
  name: 'Tweezer Top', shortName: 'TT', label: 'TT', signal: 'bearish', startIndex: 1,
  detect: (i, c, bars) => c.upTrend[i - 1] &&
    (!c.isDojiBody[i] || (c.hasUpShadow[i] && c.hasDnShadow[i])) &&
    Math.abs(bars[i].high - bars[i - 1].high) <= c.bodyAvg[i] * 0.05 &&
    c.whiteBody[i - 1] && c.blackBody[i] && c.longBody[i - 1],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = TweezerTop;
