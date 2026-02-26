import { createPattern } from './candlestick-pattern';

export const RisingWindow = createPattern({
  name: 'Rising Window', shortName: 'RW', label: 'RW', signal: 'bullish', startIndex: 1,
  detect: (i, c, bars) => c.upTrend[i - 1] && c.range[i] !== 0 && c.range[i - 1] !== 0 &&
    bars[i].low > bars[i - 1].high,
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = RisingWindow;
