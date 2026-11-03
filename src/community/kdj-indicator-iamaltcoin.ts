/**
 * KDJ Indicator - @iamaltcoin
 *
 * RSV = 100 * (close - lowest low) / (highest high - lowest low) over "period" bars. K is a running average of RSV
 * and D a running average of K: avg = (RSV + (signal - 1) * previous avg) / signal, the previous value taken as 0 when
 * it is na. J = 3 * K - 2 * D. The background is green while J is above D, red otherwise. The original is a Pine v1
 * study: the plot colours carry the default plot transparency 35 of that version.
 *
 * Reference: "KDJ Indicator - @iamaltcoin" by iamaltcoin
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: This script is released free of charge with no warranty. Please leave a not to the author of this
 * script if it is used whole or in part.
 */

import {
  ta, color, Series,
  type Bar, type BarColorConfig, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import type { BgColorData } from '../types';

export interface KdjIndicatorIamaltcoinInputs {
  /** Bars of the highest high / lowest low */
  ilong: number;
  /** Length of the K and D averages */
  isig: number;
}

export const defaultInputs: KdjIndicatorIamaltcoinInputs = {
  ilong: 9,
  isig: 3,
};

export const inputConfig: InputConfig[] = [
  { id: 'ilong', type: 'int', title: 'period', defval: 9 },
  { id: 'isig', type: 'int', title: 'signal', defval: 3 },
];

/** Pine v1 orange / lime / fuchsia with the default plot transparency 35 */
const ORANGE = String(color.new('#FF7F00', 35));
const LIME = String(color.new('#00FF00', 35));
const FUCHSIA = String(color.new('#FF00FF', 35));
/** Pine v1 green / red with transp = 70 */
const BG_GREEN = String(color.new('#008000', 70));
const BG_RED = String(color.new('#FF0000', 70));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'K', color: ORANGE, lineWidth: 1 },
  { id: 'plot1', title: 'D', color: LIME, lineWidth: 1 },
  { id: 'plot2', title: 'J', color: FUCHSIA, lineWidth: 1 },
];

export const barColorConfig: BarColorConfig[] = [{ id: 'bgcolor0', kind: 'bgcolor', title: 'Background Color' }];

export const metadata = {
  title: 'KDJ Indicator - @iamaltcoin',
  shortTitle: 'GM_V2_KDJ',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const gt = (a: number, b: number) => a - b > 1e-10;

/** bcwsma(s, l, m): (m * s + (l - m) * nz(prev)) / l */
function bcwsma(src: number[], l: number, m: number): number[] {
  const out: number[] = new Array(src.length);
  let prev = NaN;
  for (let i = 0; i < src.length; i++) {
    const v = (m * src[i] + (l - m) * (Number.isNaN(prev) ? 0 : prev)) / l;
    out[i] = Number.isFinite(v) ? v : NaN;
    prev = out[i];
  }
  return out;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<KdjIndicatorIamaltcoinInputs> = {},
): Omit<IndicatorResult, 'bgColors'> & { bgColors: BgColorData[] } {
  const { ilong, isig } = { ...defaultInputs, ...inputs };
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const h = A(ta.highest(new Series(bars, (b) => b.high), ilong));
  const l = A(ta.lowest(new Series(bars, (b) => b.low), ilong));
  // 0 / 0 is na; x / 0 cannot happen (a zero range means close = low)
  const rsv = bars.map((b, i) => 100 * ((b.close - l[i]) / (h[i] - l[i])));
  const pK = bcwsma(rsv, isig, 1);
  const pD = bcwsma(pK, isig, 1);
  const pJ = pK.map((k, i) => 3 * k - 2 * pD[i]);

  const pts = (v: number[], c: string) => bars.map((b, i) => ({ time: b.time, value: v[i], color: c }));
  const bgColors: BgColorData[] = bars.map((b, i) => ({
    id: 'bgcolor0', time: b.time, color: gt(pJ[i], pD[i]) ? BG_GREEN : BG_RED,
  }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: pts(pK, ORANGE), plot1: pts(pD, LIME), plot2: pts(pJ, FUCHSIA) },
    bgColors,
  };
}

export const KdjIndicatorIamaltcoin = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  barColorConfig,
};
