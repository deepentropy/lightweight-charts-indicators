import { createPattern } from './candlestick-pattern';

export const EngulfingBullish = createPattern({
  name: 'Engulfing Bullish', shortName: 'BE', label: 'BE', signal: 'bullish', startIndex: 1,
  detect: (i, c, bars) => c.downTrend[i] && c.whiteBody[i] && c.longBody[i] &&
    c.blackBody[i - 1] && c.smallBody[i - 1] &&
    bars[i].close >= bars[i - 1].open && bars[i].open <= bars[i - 1].close &&
    (bars[i].close > bars[i - 1].open || bars[i].open < bars[i - 1].close),
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = EngulfingBullish;
