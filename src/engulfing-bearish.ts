import { createPattern } from './candlestick-pattern';

export const EngulfingBearish = createPattern({
  name: 'Engulfing Bearish', shortName: 'BE', label: 'BE', signal: 'bearish', startIndex: 1,
  detect: (i, c, bars) => c.upTrend[i] && c.blackBody[i] && c.longBody[i] &&
    c.whiteBody[i - 1] && c.smallBody[i - 1] &&
    bars[i].close <= bars[i - 1].open && bars[i].open >= bars[i - 1].close &&
    (bars[i].close < bars[i - 1].open || bars[i].open > bars[i - 1].close),
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = EngulfingBearish;
