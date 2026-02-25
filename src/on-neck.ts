import { createPattern } from './candlestick-pattern';

export const OnNeck = createPattern({
  name: 'On Neck', shortName: 'ON', label: 'ON', signal: 'bearish', startIndex: 1,
  detect: (i, c, bars) => c.downTrend[i] && c.blackBody[i - 1] && c.longBody[i - 1] &&
    c.whiteBody[i] && bars[i].open < bars[i - 1].close && c.smallBody[i] &&
    c.range[i] !== 0 && Math.abs(bars[i].close - bars[i - 1].low) <= c.bodyAvg[i] * 0.05,
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = OnNeck;
