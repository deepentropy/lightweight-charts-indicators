/**
 * Port of "Marubozu Black - Bearish.pine" (no trend detection input).
 */
import type { PatternDef } from '../pattern-runner';

const C_MARUBOZU_SHADOW_PERCENT_BEARISH = 5.0;

export const marubozuBlackBearish: PatternDef = {
  name: 'Marubozu Black - Bearish',
  shortName: 'Marubozu Black - Bear',
  direction: 'bearish',
  labelText: 'MB',
  candles: 1,
  needsTrend: false,
  tooltip:
    'Marubozu Black\nThis is a candlestick that has no shadow, which extends from the red-bodied candle at the open, the close, or even at both. In Japanese, the name means “close-cropped” or “close-cut.” The candlestick can also be referred to as Bald or Shaven Head.',
  // C_MarubozuBlackBearish = C_BlackBody and C_LongBody
  //   and C_UpShadow <= C_MarubozuShadowPercentBearish/100*C_Body
  //   and C_DnShadow <= C_MarubozuShadowPercentBearish/100*C_Body
  //   and C_BlackBody
  // (the original repeats C_BlackBody; the duplicate is redundant and dropped)
  detect: (c) =>
    c.blackBody
      .and(c.longBody)
      .and(c.upShadow.lte(c.body.mul(C_MARUBOZU_SHADOW_PERCENT_BEARISH / 100)))
      .and(c.dnShadow.lte(c.body.mul(C_MARUBOZU_SHADOW_PERCENT_BEARISH / 100))),
};
