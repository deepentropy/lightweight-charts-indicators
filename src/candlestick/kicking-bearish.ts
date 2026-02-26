import { createPattern } from './candlestick-pattern';

const isMarubozu = (i: number, c: any) =>
  c.longBody[i] && c.upShadow[i] <= 5 / 100 * c.body[i] && c.dnShadow[i] <= 5 / 100 * c.body[i];

export const KickingBearish = createPattern({
  name: 'Kicking Bearish', shortName: 'K', label: 'K', signal: 'bearish', startIndex: 1,
  detect: (i, c, bars) => isMarubozu(i - 1, c) && c.whiteBody[i - 1] &&
    isMarubozu(i, c) && c.blackBody[i] && bars[i - 1].low > bars[i].high,
});
export const { calculate, metadata, defaultInputs, inputConfig, plotConfig } = KickingBearish;
