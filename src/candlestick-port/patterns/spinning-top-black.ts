/**
 * Port of "Spinning Top Black.pine" (neutral, no trend detection input).
 */
import type { PatternDef } from '../pattern-runner';

const C_SPINNING_TOP_BLACK_PERCENT = 34.0;

export const spinningTopBlack: PatternDef = {
  name: 'Spinning Top Black',
  shortName: 'Spinning Top Black',
  direction: 'neutral',
  labelText: 'STB',
  candles: 1,
  needsTrend: false,
  tooltip:
    'Spinning Top Black\nBlack spinning tops are candlestick lines that are small, red-bodied, and possess shadows (upper and lower) that end up exceeding the length of candle bodies. They often signal indecision.',
  // C_IsSpinningTop = C_DnShadow >= C_Range / 100 * C_SpinningTopBlackPercent
  //   and C_UpShadow >= C_Range / 100 * C_SpinningTopBlackPercent and not C_IsDojiBody
  // C_SpinningTopBlack = C_IsSpinningTop and C_BlackBody
  detect: (c) => {
    const isSpinningTop = c.dnShadow
      .gte(c.range.div(100).mul(C_SPINNING_TOP_BLACK_PERCENT))
      .and(c.upShadow.gte(c.range.div(100).mul(C_SPINNING_TOP_BLACK_PERCENT)))
      .and(c.isDojiBody.not());
    return isSpinningTop.and(c.blackBody);
  },
};
