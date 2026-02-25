import { createPattern } from './candlestick-pattern';

export const Piercing = createPattern({
  name: 'Piercing', shortName: 'P', label: 'P', signal: 'bullish', startIndex: 1,
  detect: (i, c, bars) => c.downTrend[i - 1] && c.blackBody[i - 1] && c.longBody[i - 1] &&
    c.whiteBody[i] && bars[i].open <= bars[i - 1].low &&
    bars[i].close > c.bodyMiddle[i - 1] && bars[i].close < bars[i - 1].open,
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = Piercing;
