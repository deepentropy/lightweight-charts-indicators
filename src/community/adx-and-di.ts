/**
 * ADX and DI
 *
 * Directional movement with Wilder sums: the true range, the plus and the minus directional movement are summed
 * with `s = s[1] - s[1] / len + x` (the first bar uses 0 for the missing previous close, high and low).
 * DI+ = 100 * smoothed DM+ / smoothed TR, DI- = 100 * smoothed DM- / smoothed TR,
 * DX = 100 * |DI+ - DI-| / (DI+ + DI-) and ADX = sma(DX, len). A horizontal line marks the threshold.
 *
 * Reference: "ADX and DI for v4" by BeikabuOyaji
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © BeikabuOyaji
 */

import { ta, Series, type IndicatorResult, type InputConfig, type PlotConfig, type Bar } from 'oakscriptjs';

export interface AdxAndDiInputs {
  /** Length of the Wilder sums and of the ADX average */
  len: number;
  /** Level of the horizontal line */
  th: number;
}

export const defaultInputs: AdxAndDiInputs = {
  len: 14,
  th: 20,
};

export const inputConfig: InputConfig[] = [
  { id: 'len', type: 'int', title: 'len', defval: 14 },
  { id: 'th', type: 'int', title: 'th', defval: 20 },
];

// Pine v4 colours: color.green, color.red, color.navy
export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'DI+', color: '#4CAF50', lineWidth: 1 },
  { id: 'plot1', title: 'DI-', color: '#FF5252', lineWidth: 1 },
  { id: 'plot2', title: 'ADX', color: '#311B92', lineWidth: 1 },
];

export const metadata = {
  title: 'ADX and DI for v4',
  shortTitle: 'ADX and DI for v4',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;

export function calculate(bars: Bar[], inputs: Partial<AdxAndDiInputs> = {}): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const { len, th } = cfg;
  const n = bars.length;

  const diPlus: number[] = new Array(n);
  const diMinus: number[] = new Array(n);
  const dx: number[] = new Array(n);
  let sTr = 0;
  let sPlus = 0;
  let sMinus = 0;
  for (let i = 0; i < n; i++) {
    const { high, low } = bars[i];
    // nz(close[1]), nz(high[1]), nz(low[1]): 0 on the first bar
    const pc = i > 0 ? bars[i - 1].close : 0;
    const ph = i > 0 ? bars[i - 1].high : 0;
    const pl = i > 0 ? bars[i - 1].low : 0;
    const tr = Math.max(Math.max(high - low, Math.abs(high - pc)), Math.abs(low - pc));
    const up = high - ph;
    const down = pl - low;
    const dmPlus = gt(up, down) ? Math.max(up, 0) : 0;
    const dmMinus = gt(down, up) ? Math.max(down, 0) : 0;
    sTr = sTr - sTr / len + tr;
    sPlus = sPlus - sPlus / len + dmPlus;
    sMinus = sMinus - sMinus / len + dmMinus;
    // Plain divisions, as Pine: x / 0 is +-infinity, 0 / 0 is na
    diPlus[i] = (sPlus / sTr) * 100;
    diMinus[i] = (sMinus / sTr) * 100;
    dx[i] = (Math.abs(diPlus[i] - diMinus[i]) / (diPlus[i] + diMinus[i])) * 100;
  }
  const adx = ta.sma(Series.fromArray(bars, dx), len).toArray().map((v) => v ?? NaN);

  const out = (a: number[]) => bars.map((b, i) => ({ time: b.time, value: Number.isFinite(a[i]) ? a[i] : NaN }));

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0: out(diPlus), plot1: out(diMinus), plot2: out(adx) },
    // Pine v4 color.black; hline default style: dashed
    hlines: [{ value: th, options: { color: '#363A45', linestyle: 'dashed', linewidth: 1 } }],
  };
}

export const AdxAndDi = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
};
