/**
 * Port of "Marubozu White - Bullish.pine" (no trend detection input).
 */
import type { PatternDef } from '../pattern-runner';

const C_MARUBOZU_SHADOW_PERCENT_WHITE = 5.0;

export const marubozuWhiteBullish: PatternDef = {
  name: 'Marubozu White - Bullish',
  shortName: 'Marubozu White - Bull',
  direction: 'bullish',
  labelText: 'MW',
  candles: 1,
  needsTrend: false,
  tooltip:
    'Marubozu White\nA Marubozu White Candle is a candlestick that does not have a shadow that extends from its candle body at either the open or the close. Marubozu is Japanese for “close-cropped” or “close-cut.” Other sources may call it a Bald or Shaven Head Candle.',
  // C_MarubozuWhiteBullish = C_WhiteBody and C_LongBody
  //   and C_UpShadow <= C_MarubozuShadowPercentWhite/100*C_Body
  //   and C_DnShadow <= C_MarubozuShadowPercentWhite/100*C_Body
  //   and C_WhiteBody
  // (the original repeats C_WhiteBody; the duplicate is redundant and dropped)
  detect: (c) =>
    c.whiteBody
      .and(c.longBody)
      .and(c.upShadow.lte(c.body.mul(C_MARUBOZU_SHADOW_PERCENT_WHITE / 100)))
      .and(c.dnShadow.lte(c.body.mul(C_MARUBOZU_SHADOW_PERCENT_WHITE / 100))),
};
