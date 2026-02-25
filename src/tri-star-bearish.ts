import { createPattern } from './candlestick-pattern';

export const TriStarBearish = createPattern({
  name: 'Tri-Star Bearish', shortName: '3S', label: '3S', signal: 'bearish', startIndex: 2,
  detect: (i, c) => c.doji[i - 2] && c.doji[i - 1] && c.doji[i] &&
    c.upTrend[i - 2] &&
    c.bodyHi[i - 2] < c.bodyLo[i - 1] && // gap up from 1st to 2nd
    c.bodyLo[i - 1] > c.bodyHi[i],        // gap down from 2nd to 3rd
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = TriStarBearish;
