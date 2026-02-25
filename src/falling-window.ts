import { createPattern } from './candlestick-pattern';

export const FallingWindow = createPattern({
  name: 'Falling Window', shortName: 'FW', label: 'FW', signal: 'bearish', startIndex: 1,
  detect: (i, c, bars) => c.downTrend[i - 1] && c.range[i] !== 0 && c.range[i - 1] !== 0 &&
    bars[i].high < bars[i - 1].low,
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = FallingWindow;
