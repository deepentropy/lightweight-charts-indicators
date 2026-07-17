/**
 * Port of "Hanging Man - Bearish.pine".
 */
import { hl2 } from 'oakscriptjs/script';
import { C_FACTOR } from '../candle-props';
import type { PatternDef } from '../pattern-runner';

export const hangingManBearish: PatternDef = {
  name: 'Hanging Man - Bearish',
  shortName: 'Hanging Man - Bear',
  direction: 'bearish',
  labelText: 'HM',
  candles: 1,
  needsTrend: true,
  tooltip:
    'Hanging Man\nWhen a specified security notably moves lower after the open, but continues to rally to close above the intraday low, a Hanging Man candlestick will form. The candlestick will resemble a square, attached to a long stick-like figure. It is referred to as a Hanging Man if the candlestick forms during an advance.',
  // if C_SmallBody and C_Body > 0 and C_BodyLo > hl2 and C_DnShadow >= C_Factor * C_Body and not C_HasUpShadow
  //   if C_UpTrend
  detect: (c, t) =>
    c.smallBody
      .and(c.body.gt(0))
      .and(c.bodyLo.gt(hl2))
      .and(c.dnShadow.gte(c.body.mul(C_FACTOR)))
      .and(c.hasUpShadow.not())
      .and(t.upTrend),
};
