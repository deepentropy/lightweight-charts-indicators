import { createPattern } from './candlestick-pattern';

const isMarubozu = (i: number, c: any) =>
  c.longBody[i] && c.upShadow[i] <= 5 / 100 * c.body[i] && c.dnShadow[i] <= 5 / 100 * c.body[i];

export const KickingBullish = createPattern({
  name: 'Kicking Bullish', shortName: 'K', label: 'K', signal: 'bullish', startIndex: 1,
  detect: (i, c, bars) => isMarubozu(i - 1, c) && c.blackBody[i - 1] &&
    isMarubozu(i, c) && c.whiteBody[i] && bars[i - 1].high < bars[i].low,
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = KickingBullish;
