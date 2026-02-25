import { createPattern } from './candlestick-pattern';

export const ThreeBlackCrows = createPattern({
  name: 'Three Black Crows', shortName: '3BC', label: '3BC', signal: 'bearish', startIndex: 2,
  detect: (i, c, bars) => {
    const noDnShadow = (j: number) => c.range[j] * 5 / 100 > c.dnShadow[j];
    return c.longBody[i] && c.longBody[i - 1] && c.longBody[i - 2] &&
      c.blackBody[i] && c.blackBody[i - 1] && c.blackBody[i - 2] &&
      bars[i].close < bars[i - 1].close && bars[i - 1].close < bars[i - 2].close &&
      bars[i].open > bars[i - 1].close && bars[i].open < bars[i - 1].open &&
      bars[i - 1].open > bars[i - 2].close && bars[i - 1].open < bars[i - 2].open &&
      noDnShadow(i) && noDnShadow(i - 1) && noDnShadow(i - 2);
  },
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = ThreeBlackCrows;
