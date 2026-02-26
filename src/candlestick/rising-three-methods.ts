import { createPattern } from './candlestick-pattern';

export const RisingThreeMethods = createPattern({
  name: 'Rising Three Methods', shortName: 'RTM', label: 'RTM', signal: 'bullish', startIndex: 4,
  detect: (i, c, bars) =>
    c.upTrend[i - 4] && c.longBody[i - 4] && c.whiteBody[i - 4] &&
    c.smallBody[i - 3] && c.blackBody[i - 3] && bars[i - 3].open < bars[i - 4].high && bars[i - 3].close > bars[i - 4].low &&
    c.smallBody[i - 2] && c.blackBody[i - 2] && bars[i - 2].open < bars[i - 4].high && bars[i - 2].close > bars[i - 4].low &&
    c.smallBody[i - 1] && c.blackBody[i - 1] && bars[i - 1].open < bars[i - 4].high && bars[i - 1].close > bars[i - 4].low &&
    c.longBody[i] && c.whiteBody[i] && bars[i].close > bars[i - 4].close,
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = RisingThreeMethods;
