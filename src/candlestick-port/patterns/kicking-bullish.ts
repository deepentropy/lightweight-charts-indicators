/**
 * Port of "Kicking - Bullish.pine" (no trend detection input).
 */
import { high, low } from 'oakscriptjs/script';
import type { PatternDef } from '../pattern-runner';

const C_MARUBOZU_SHADOW_PERCENT = 5.0;

export const kickingBullish: PatternDef = {
  name: 'Kicking - Bullish',
  shortName: 'Kicking - Bull',
  direction: 'bullish',
  labelText: 'K',
  candles: 2,
  needsTrend: false,
  tooltip:
    'Kicking\nThe first day candlestick is a bearish marubozu candlestick with next to no upper or lower shadow and where the price opens at the day’s high and closes at the day’s low. The second day is a bullish marubozu pattern, with next to no upper or lower shadow and where the price opens at the day’s low and closes at the day’s high. Additionally, the second day gaps up extensively and opens above the opening price of the day before. This gap or window, as the Japanese call it, lies between day one and day two’s bullish candlesticks.',
  // C_Marubozu = C_LongBody and C_UpShadow <= C_MarubozuShadowPercent/100*C_Body
  //   and C_DnShadow <= C_MarubozuShadowPercent/100*C_Body
  // C_MarubozuWhiteBullishKicking = C_Marubozu and C_WhiteBody
  // C_MarubozuBlackBullish = C_Marubozu and C_BlackBody
  // C_KickingBullish = C_MarubozuBlackBullish[1] and C_MarubozuWhiteBullishKicking and high[1] < low
  detect: (c) => {
    const marubozu = c.longBody
      .and(c.upShadow.lte(c.body.mul(C_MARUBOZU_SHADOW_PERCENT / 100)))
      .and(c.dnShadow.lte(c.body.mul(C_MARUBOZU_SHADOW_PERCENT / 100)));
    const marubozuWhite = marubozu.and(c.whiteBody);
    const marubozuBlack = marubozu.and(c.blackBody);
    return marubozuBlack.offset(1).and(marubozuWhite).and(high.offset(1).lt(low));
  },
};
