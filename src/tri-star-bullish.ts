import { createPattern } from './candlestick-pattern';

export const TriStarBullish = createPattern({
  name: 'Tri-Star Bullish', shortName: '3S', label: '3S', signal: 'bullish', startIndex: 2,
  detect: (i, c) => c.doji[i - 2] && c.doji[i - 1] && c.doji[i] &&
    c.downTrend[i - 2] &&
    c.bodyLo[i - 2] > c.bodyHi[i - 1] && // gap down from 1st to 2nd
    c.bodyHi[i - 1] < c.bodyLo[i],        // gap up from 2nd to 3rd
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = TriStarBullish;
