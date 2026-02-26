import { createPattern } from './candlestick-pattern';

export const TweezerBottom = createPattern({
  name: 'Tweezer Bottom', shortName: 'TB', label: 'TB', signal: 'bullish', startIndex: 1,
  detect: (i, c, bars) => c.downTrend[i - 1] &&
    (!c.isDojiBody[i] || (c.hasUpShadow[i] && c.hasDnShadow[i])) &&
    Math.abs(bars[i].low - bars[i - 1].low) <= c.bodyAvg[i] * 0.05 &&
    c.blackBody[i - 1] && c.whiteBody[i] && c.longBody[i - 1],
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = TweezerBottom;
