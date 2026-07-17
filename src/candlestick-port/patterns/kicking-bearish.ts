/**
 * Port of "Kicking - Bearish.pine" (no trend detection input).
 */
import { high, low } from 'oakscriptjs/script';
import type { PatternDef } from '../pattern-runner';

const C_MARUBOZU_BULLISH_SHADOW_PERCENT = 5.0;

export const kickingBearish: PatternDef = {
  name: 'Kicking - Bearish',
  shortName: 'Kicking - Bear',
  direction: 'bearish',
  labelText: 'K',
  candles: 2,
  needsTrend: false,
  tooltip:
    'Kicking\nA bearish kicking pattern will occur, subsequently signaling a reversal for a new downtrend. The first day candlestick is a bullish marubozu. The second day gaps down extensively and opens below the opening price of the day before. There is a gap between day one and two’s bearish candlesticks.',
  // C_MarubozuBearishKicking = C_LongBody and C_UpShadow <= C_MarubozuBullishShadowPercent/100*C_Body
  //   and C_DnShadow <= C_MarubozuBullishShadowPercent/100*C_Body
  // C_MarubozuWhiteBearish = C_MarubozuBearishKicking and C_WhiteBody
  // C_MarubozuBlackBearishKicking = C_MarubozuBearishKicking and C_BlackBody
  // C_KickingBearish = C_MarubozuWhiteBearish[1] and C_MarubozuBlackBearishKicking and low[1] > high
  detect: (c) => {
    const marubozu = c.longBody
      .and(c.upShadow.lte(c.body.mul(C_MARUBOZU_BULLISH_SHADOW_PERCENT / 100)))
      .and(c.dnShadow.lte(c.body.mul(C_MARUBOZU_BULLISH_SHADOW_PERCENT / 100)));
    const marubozuWhite = marubozu.and(c.whiteBody);
    const marubozuBlack = marubozu.and(c.blackBody);
    return marubozuWhite.offset(1).and(marubozuBlack).and(low.offset(1).gt(high));
  },
};
