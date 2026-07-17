/**
 * Port of "Spinning Top White.pine" (neutral, no trend detection input).
 */
import type { PatternDef } from '../pattern-runner';

const C_SPINNING_TOP_WHITE_PERCENT = 34.0;

export const spinningTopWhite: PatternDef = {
  name: 'Spinning Top White',
  shortName: 'Spinning Top White',
  direction: 'neutral',
  labelText: 'STW',
  candles: 1,
  needsTrend: false,
  tooltip:
    'Spinning Top White\nWhite spinning tops are candlestick lines that are small, green-bodied, and possess shadows (upper and lower) that end up exceeding the length of candle bodies. They often signal indecision between buyer and seller.',
  // C_IsSpinningTopWhite = C_DnShadow >= C_Range / 100 * C_SpinningTopWhitePercent
  //   and C_UpShadow >= C_Range / 100 * C_SpinningTopWhitePercent and not C_IsDojiBody
  // C_SpinningTopWhite = C_IsSpinningTopWhite and C_WhiteBody
  detect: (c) => {
    const isSpinningTopWhite = c.dnShadow
      .gte(c.range.div(100).mul(C_SPINNING_TOP_WHITE_PERCENT))
      .and(c.upShadow.gte(c.range.div(100).mul(C_SPINNING_TOP_WHITE_PERCENT)))
      .and(c.isDojiBody.not());
    return isSpinningTopWhite.and(c.whiteBody);
  },
};
