/**
 * HawkEye Volume Indicator [LazyBear]
 *
 * Volume histogram coloured by the bar against the bar before: mid1 = hl2[1], u1 / d1 = mid1 +- (high[1] - low[1]) /
 * divisor, rangeAvg = sma(high - low, length), volumeA = sma(volume, length).
 * - gray when the range is wide (above rangeAvg) with a close inside [d1, u1] and a volume between volumeA and
 *   1.5 * volumeA rising from the bar before, or the range and the volume are small (below rangeAvg / 1.5 and
 *   volumeA / 1.5), or the close is inside (d1, u1);
 * - else green when the close is above mid1, or a wide range closes above u1 on high volume, or a new high on a small
 *   range and low volume, or a new low on a small range and high volume;
 * - else red when the close is below mid1, or a wide range closes below d1 on high volume;
 * - else blue.
 *
 * Reference: "HawkEye Volume Indicator [LazyBear]" by LazyBear
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: @author LazyBear. If you use this code, in its original or modified form, do drop me a note. Thx.
 */

import { ta, Series, color, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface IndicatorHawkeyeVolumeIndicatorInputs {
  length: number;
  divisor: number;
}

export const defaultInputs: IndicatorHawkeyeVolumeIndicatorInputs = {
  length: 200,
  divisor: 3.6,
};

export const inputConfig: InputConfig[] = [
  { id: 'length', type: 'int', title: 'length', defval: 200 },
  { id: 'divisor', type: 'float', title: 'divisor', defval: 3.6 },
];

// Colour constants of Pine version 1, with the default plot transparency of that version (35)
const V1 = (hex: string) => String(color.new(hex, 35));
const GRAY = V1('#808080');
const GREEN = V1('#008000');
const RED = V1('#FF0000');
const BLUE = V1('#0000FF');

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'Plot', color: GRAY, lineWidth: 5, style: 'histogram', palette: [GRAY, GREEN, RED, BLUE] },
];

export const metadata = {
  title: 'HawkEye Volume Indicator [LazyBear]',
  shortTitle: 'HVI_LB',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(bars: Bar[], inputs: Partial<IndicatorHawkeyeVolumeIndicatorInputs> = {}): IndicatorResult {
  const { length, divisor } = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const vol = bars.map((b) => b.volume ?? NaN);
  const range = bars.map((b) => b.high - b.low);
  const rangeAvg = A(ta.sma(Series.fromArray(bars, range), length));
  const volumeA = A(ta.sma(Series.fromArray(bars, vol), length));

  const plot0 = bars.map((b, i) => {
    const p = i > 0 ? bars[i - 1] : undefined;
    const high1 = p ? p.high : NaN;
    const low1 = p ? p.low : NaN;
    const mid1 = p ? (p.high + p.low) / 2 : NaN;
    const u1 = mid1 + (high1 - low1) / divisor;
    const d1 = mid1 - (high1 - low1) / divisor;
    const r = range[i];
    const ra = rangeAvg[i];
    const v = vol[i];
    const va = volumeA[i];
    const c = b.close;

    const rEnabled = (gt(r, ra) && lt(c, d1) && gt(v, va)) || lt(c, mid1);
    const gEnabled = gt(c, mid1)
      || (gt(r, ra) && gt(c, u1) && gt(v, va))
      || (gt(b.high, high1) && lt(r, ra / 1.5) && lt(v, va))
      || (lt(b.low, low1) && lt(r, ra / 1.5) && gt(v, va));
    const grEnabled = (gt(r, ra) && gt(c, d1) && lt(c, u1) && gt(v, va) && lt(v, va * 1.5) && gt(v, i > 0 ? vol[i - 1] : NaN))
      || (lt(r, ra / 1.5) && lt(v, va / 1.5))
      || (gt(c, d1) && lt(c, u1));
    const vColor = grEnabled ? GRAY : gEnabled ? GREEN : rEnabled ? RED : BLUE;
    return { time: b.time, value: v, color: vColor };
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0 },
  };
}

export const IndicatorHawkeyeVolumeIndicator = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
