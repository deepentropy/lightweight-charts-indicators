import { createPattern } from './candlestick-pattern';

export const DarkCloudCover = createPattern({
  name: 'Dark Cloud Cover', shortName: 'DCC', label: 'DCC', signal: 'bearish', startIndex: 1,
  detect: (i, c, bars) => c.upTrend[i - 1] && c.whiteBody[i - 1] && c.longBody[i - 1] &&
    c.blackBody[i] && bars[i].open >= bars[i - 1].high &&
    bars[i].close < c.bodyMiddle[i - 1] && bars[i].close > bars[i - 1].open,
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = DarkCloudCover;
