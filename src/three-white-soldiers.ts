import { createPattern } from './candlestick-pattern';

export const ThreeWhiteSoldiers = createPattern({
  name: 'Three White Soldiers', shortName: '3WS', label: '3WS', signal: 'bullish', startIndex: 2,
  detect: (i, c, bars) => {
    const noUpShadow = (j: number) => c.range[j] * 5 / 100 > c.upShadow[j];
    return c.longBody[i] && c.longBody[i - 1] && c.longBody[i - 2] &&
      c.whiteBody[i] && c.whiteBody[i - 1] && c.whiteBody[i - 2] &&
      bars[i].close > bars[i - 1].close && bars[i - 1].close > bars[i - 2].close &&
      bars[i].open < bars[i - 1].close && bars[i].open > bars[i - 1].open &&
      bars[i - 1].open < bars[i - 2].close && bars[i - 1].open > bars[i - 2].open &&
      noUpShadow(i) && noUpShadow(i - 1) && noUpShadow(i - 2);
  },
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = ThreeWhiteSoldiers;
