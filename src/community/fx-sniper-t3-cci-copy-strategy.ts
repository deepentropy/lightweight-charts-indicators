/**
 * FX Sniper: T3-CCI Strategy
 *
 * The CCI of the close (CCI_Period) smoothed by a Tillson T3: six exponential stages
 * `e_k = w1 * e_(k-1) + w2 * nz(e_k[1])` with w1 = 2 / (nr + 1), nr = 1 + 0.5 * (T3_Period - 1), w2 = 1 - w1 (each
 * stage starts from 0), then T3 = c1 * e6 + c2 * e5 + c3 * e4 + c4 * e3 with the factor b. The value is drawn as a
 * blue line and as a histogram (green when >= 0, red below 0). The price bars are coloured from the position: 1
 * (green) when T3-CCI is above 0, -1 (red) below 0, else the position of the bar before (0 at the start: blue).
 * A purple level at 0.
 *
 * Colours are those of Pine version 1; version 1 plots have a default transparency of 35.
 *
 * Reference: "FX Sniper:  T3-CCI Strategy" by HPotter
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: Copyright by HPotter v1.0 25/07/2014
 */

import {
  ta, Series, color,
  type BarColorConfig, type Bar, type IndicatorResult, type InputConfig, type PlotConfig,
} from 'oakscriptjs';
import type { BarColorData } from '../types';

export interface FxSniperT3CciCopyStrategyInputs {
  /** CCI_Period */
  cciPeriod: number;
  /** T3_Period */
  t3Period: number;
  /** b: T3 volume factor */
  b: number;
}

export const defaultInputs: FxSniperT3CciCopyStrategyInputs = {
  cciPeriod: 14,
  t3Period: 5,
  b: 0.618,
};

export const inputConfig: InputConfig[] = [
  { id: 'cciPeriod', type: 'int', title: 'CCI_Period', defval: 14, min: 1 },
  { id: 't3Period', type: 'int', title: 'T3_Period', defval: 5, min: 1 },
  { id: 'b', type: 'float', title: 'b', defval: 0.618 },
];

/** Pine version 1 colour constants */
const GREEN = '#008000';
const RED = '#FF0000';
const BLUE = '#0000FF';
const BLACK = '#000000';
const PURPLE = '#800080';
/** Version 1 plots: default transparency 35 */
const V1 = (hex: string) => String(color.new(hex, 35));

export const plotConfig: PlotConfig[] = [
  { id: 'plot0', title: 'T3-CCI', color: V1(BLUE), lineWidth: 1 },
  { id: 'plot1', title: 'CCIH', color: V1(GREEN), lineWidth: 1, style: 'histogram' },
];

/** barcolor() */
export const barColorConfig: BarColorConfig[] = [{ id: 'barcolor0', kind: 'barcolor', title: 'Bar Color' }];

export const metadata = {
  title: 'FX Sniper:  T3-CCI Strategy',
  shortTitle: 'T3-CCI',
  overlay: false,
};

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !lt(a, b);
const nz = (x: number) => (Number.isNaN(x) ? 0 : x);

export function calculate(
  bars: Bar[],
  inputs: Partial<FxSniperT3CciCopyStrategyInputs> = {},
): Omit<IndicatorResult, 'markers'> & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const b = cfg.b;
  const b2 = b * b;
  const b3 = b2 * b;
  const c1 = -b3;
  const c2 = 3 * (b2 + b3);
  const c3 = -3 * (2 * b2 + b + b3);
  const c4 = 1 + 3 * b + b3 + 3 * b2;
  // nn = iff(T3_Period < 1, 1, T3_Period)
  const nn = cfg.t3Period < 1 ? 1 : cfg.t3Period;
  const nr = 1 + 0.5 * (nn - 1);
  const w1 = 2 / (nr + 1);
  const w2 = 1 - w1;

  // xcci = cci(xPrice, CCI_Period), xPrice = close
  const xcci = ta.cci(new Series(bars, (bar) => bar.close), cfg.cciPeriod)
    .toArray().map((v) => (v === null || v === undefined ? NaN : (v as number)));

  const plot0: { time: number; value: number }[] = [];
  const plot1: { time: number; value: number; color: string }[] = [];
  const barColors: BarColorData[] = [];
  const e = [NaN, NaN, NaN, NaN, NaN, NaN];
  let pos = 0;
  for (let i = 0; i < n; i++) {
    const time = bars[i].time as number;
    // e1 = w1*xcci + w2*nz(e1[1]), e2 = w1*e1 + w2*nz(e2[1]), ...
    let input = xcci[i];
    for (let k = 0; k < 6; k++) {
      e[k] = w1 * input + w2 * nz(e[k]);
      input = e[k];
    }
    const x = c1 * e[5] + c2 * e[4] + c3 * e[3] + c4 * e[2];
    // cciHcolor = iff(xccir >= 0, green, iff(xccir < 0, red, black))
    const hColor = ge(x, 0) ? GREEN : lt(x, 0) ? RED : BLACK;
    // pos = iff(xccir > 0, 1, iff(xccir < 0, -1, nz(pos[1], 0)))
    pos = gt(x, 0) ? 1 : lt(x, 0) ? -1 : pos;
    // barcolor(pos == -1 ? red : pos == 1 ? green : blue)
    barColors.push({ id: 'barcolor0', time, color: pos === -1 ? RED : pos === 1 ? GREEN : BLUE });
    const value = Number.isFinite(x) ? x : NaN;
    plot0.push({ time, value });
    plot1.push({ time, value, color: V1(hColor) });
  }

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: { plot0, plot1 },
    // hline(0, color=purple, linestyle=line)
    hlines: [{ id: 'hline0', value: 0, options: { title: 'Level', color: PURPLE, linestyle: 'solid', linewidth: 1 } }],
    barColors,
  };
}

export const FxSniperT3CciCopyStrategy = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, barColorConfig,
};
