/**
 * POCs and VAHs VALs - All and Non-Broken
 *
 * Builds a volume profile of each period ("Time Frame", one day by default) from the chart bars: the volume of a bar
 * is spread evenly over the price steps between its low and its high (steps of the larger of the symbol tick and
 * "Resolution"). The point of control (POC) is the step with the most volume; the value area grows from it, two
 * steps at a time towards the side with more volume, until it holds the "Value Area" share of the volume; its top is
 * the value area high (VAH) and its bottom the value area low (VAL). At the start of each new period the POC, VAH and
 * VAL of the period that ended are drawn as lines extended to the right:
 * - "Unbroken" lines: one line below the price (removed when a later low goes under it) and one above the price
 *   (removed when a later high goes over it), so only the levels that price has not traded through remain;
 * - "All" lines (off by default): every level, without removal (the 50 newest lines are kept).
 * As in the original, the lines are drawn only on a 5-minute chart.
 *
 * Reference: "POCs and VAHs VALs - All and Non-Broken" by Frien_dd-DisDev
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 */

import {
  math, line, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type Line, type PlotConfig,
} from 'oakscriptjs';
import { mintickOf, type ChartContext } from '../chart-context';
import { chartTimeframe, periodChanges } from '../anchor-period';
import type { StudyDrawingKind } from '../style-outputs';

export interface PocsAndVahsValsAllAndNonBrokenInputs {
  /** POCs line colour */
  pocsColor: string;
  /** VAHs line colour */
  vahsColor: string;
  /** VALs line colour */
  valsColor: string;
  /** All POCs */
  pocs: boolean;
  /** All value area highs */
  vah: boolean;
  /** All value area lows */
  val: boolean;
  /** Unbroken POCs */
  nonPocs: boolean;
  /** Unbroken value area highs */
  nonVah: boolean;
  /** Unbroken value area lows */
  nonVal: boolean;
  /** Value Area (share of the volume) */
  vaPercent: number;
  /** Time Frame of the profiles */
  dtf: string;
  /** Price step of the profile (at least the symbol tick) */
  resolution: number;
}

export const defaultInputs: PocsAndVahsValsAllAndNonBrokenInputs = {
  pocsColor: '#FF5252',
  vahsColor: '#2196F3',
  valsColor: '#00BCD4',
  pocs: false,
  vah: false,
  val: false,
  nonPocs: true,
  nonVah: true,
  nonVal: true,
  vaPercent: 0.7,
  dtf: 'D',
  resolution: 1,
};

const ALL = 'All POCs, VALs, VAHs';
const UNBROKEN = 'Unbroken POCs, VALs, VAHs';

export const inputConfig: InputConfig[] = [
  { id: 'pocsColor', type: 'color', title: 'POCs', defval: '#FF5252', inline: 'Input 0' },
  { id: 'vahsColor', type: 'color', title: 'VAHs', defval: '#2196F3', inline: 'Input 0' },
  { id: 'valsColor', type: 'color', title: 'VALs', defval: '#00BCD4', inline: 'Input 0' },
  { id: 'pocs', type: 'bool', title: 'Points of Controls', defval: false, group: ALL, inline: 'Input 0' },
  { id: 'vah', type: 'bool', title: 'Daily Value Area Highs', defval: false, group: ALL, inline: 'Input 1' },
  { id: 'val', type: 'bool', title: 'Daily Value Area Lows', defval: false, group: ALL, inline: 'Input 2' },
  { id: 'nonPocs', type: 'bool', title: 'Points of Controls', defval: true, group: UNBROKEN, inline: 'Input 0' },
  { id: 'nonVah', type: 'bool', title: 'Daily Value Area Highs', defval: true, group: UNBROKEN, inline: 'Input 1' },
  { id: 'nonVal', type: 'bool', title: 'Daily Value Area Lows', defval: true, group: UNBROKEN, inline: 'Input 2' },
  { id: 'vaPercent', type: 'float', title: 'Value Area', defval: 0.7, min: 0.1, max: 1, step: 0.1 },
  { id: 'dtf', type: 'timeframe', title: 'Time Frame', defval: 'D' },
  { id: 'resolution', type: 'float', title: 'Resolution (Change to decimal of pair for example 0.00001 for XRP)', defval: 1 },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line'];

export const metadata = {
  title: 'POCs and VAHs VALs - All and Non-Broken',
  shortTitle: 'POCs and VAHs VALs - All and Non-Broken',
  overlay: true,
};

/** Default max_lines_count of study() */
const MAX_LINES = 50;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && b - a <= EPS;

/** Unbroken lines of one level and one side: the lines and their prices, in creation order */
interface Side {
  lines: Line[];
  prices: number[];
  /** true: removed when a low goes under the price; false: when a high goes over it */
  below: boolean;
}

export function calculate(
  bars: Bar[],
  inputs: Partial<PocsAndVahsValsAllAndNonBrokenInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const period = chartTimeframe(bars, chart) === '5';
  const tick = Math.max(mintickOf(chart), cfg.resolution);
  const roundTo = (v: number, x: number) => math.round(v / x) * x;
  const newBar = n > 0 ? periodChanges(bars, cfg.dtf, chart) : [];

  resetDrawings({ line: MAX_LINES });

  const a: number[] = [];
  let aMin = NaN;
  let prevDPoc = NaN;
  let prevDVah = NaN;
  let prevDVal = NaN;
  let pPoc = NaN;
  let pVah = NaN;
  let pVal = NaN;
  const side = (below: boolean): Side => ({ lines: [], prices: [], below });
  const pocDown = side(true);
  const pocUp = side(false);
  const vahDown = side(true);
  const vahUp = side(false);
  const valDown = side(true);
  const valUp = side(false);

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const low = b.low;
    const high = b.high;
    // a_min := nz(a_min[1], round_to_nearest(low, tick_size))
    if (Number.isNaN(aMin)) aMin = roundTo(low, tick);
    const dSwitch = newBar[i];
    if (dSwitch) {
      aMin = low;
      a.length = 0;
    }

    // scaled range of the bar and its volume per step
    const vMin = Math.trunc(roundTo(low - aMin, tick) / tick);
    const vMax = Math.trunc(roundTo(high - aMin, tick) / tick);
    const ticks = vMax - vMin;
    const vol = (b.volume ?? NaN) / (ticks === 0 ? 1 : ticks);
    const end = Math.max(vMax - 1, vMin);
    for (let k = vMin; k <= end; k++) {
      if (k < 0) {
        a.splice(k - vMin, 0, vol);
        continue;
      }
      const offset = vMin < 0 ? Math.abs(vMin) : 0;
      const index = Math.trunc(k + offset);
      if (index >= a.length) {
        a.push(vol);
        continue;
      }
      a[index] = a[index] + vol;
    }
    aMin = Math.min(aMin, roundTo(low, tick));
    const size = a.length;

    // POC
    let pocIndex = -1;
    let pocPrev = -1;
    let sumVol = 0;
    for (let k = 0; k < size; k++) {
      const cur = a[k];
      sumVol = sumVol + cur;
      if (gt(cur, pocPrev)) {
        pocPrev = cur;
        pocIndex = k;
      }
    }
    if (pocIndex < 0 || pocIndex >= size) {
      throw new Error(`Index ${pocIndex} is out of bounds, array size is ${size}`);
    }

    // value area: `for i = 1 to a_size - 1` (counts down from 1 to 0 when the profile has one step)
    let vaHigh = pocIndex;
    let vaLow = pocIndex;
    const cap = sumVol * cfg.vaPercent;
    let sumVa = a[pocIndex];
    const iterations = Math.abs(size - 1 - 1) + 1;
    const nz = (v: number) => (Number.isNaN(v) ? 0 : v);
    for (let k = 0; k < iterations; k++) {
      let above = 0;
      if (vaHigh + 1 < size - 1) above = above + nz(a[vaHigh + 1]);
      if (vaHigh + 2 < size - 1) above = above + nz(a[vaHigh + 2]);
      let below = 0;
      if (vaLow - 1 > 0) below = below + nz(a[vaLow - 1]);
      if (vaLow - 2 > 0) below = below + nz(a[vaLow - 2]);
      if (gt(above, below)) {
        vaHigh = Math.min(vaHigh + 2, size - 1);
        sumVa = sumVa + above;
      } else {
        vaLow = Math.max(vaLow - 2, 0);
        sumVa = sumVa + below;
      }
      if (ge(sumVa, cap) || (vaLow <= 0 && vaHigh >= size - 1)) break;
    }

    const dPoc = pocIndex * tick + aMin;
    const dVah = vaHigh * tick + aMin;
    const dVal = vaLow * tick + aMin;
    if (dSwitch) {
      pPoc = prevDPoc;
      pVah = prevDVah;
      pVal = prevDVal;
    }
    prevDPoc = dPoc;
    prevDVah = dVah;
    prevDVal = dVal;

    // lines at the start of a period (xloc.bar_time, from time to time + 1)
    const t = b.time * 1000;
    const draw = period && dSwitch;
    const newLine = (price: number, col: string) => line.new(t, price, t + 1, price, 'bar_time', 'right', col);
    const unbroken = (s: Side, on: boolean, price: number, col: string) => {
      if (draw && on) {
        s.lines.push(newLine(price, col));
        s.prices.push(price);
      }
      for (let p = 0; p < s.prices.length; p++) {
        if (s.below ? gt(s.prices[p], low) : gt(high, s.prices[p])) line.delete(s.lines[p]);
      }
    };
    unbroken(pocDown, cfg.nonPocs, pPoc, cfg.pocsColor);
    unbroken(pocUp, cfg.nonPocs, pPoc, cfg.pocsColor);
    unbroken(vahDown, cfg.nonVah, pVah, cfg.vahsColor);
    unbroken(vahUp, cfg.nonVah, pVah, cfg.vahsColor);
    unbroken(valDown, cfg.nonVal, pVal, cfg.valsColor);
    unbroken(valUp, cfg.nonVal, pVal, cfg.valsColor);
    if (draw && cfg.pocs) newLine(pPoc, cfg.pocsColor);
    if (draw && cfg.vah) newLine(pVah, cfg.vahsColor);
    if (draw && cfg.val) newLine(pVal, cfg.valsColor);
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars),
  };
}

export const PocsAndVahsValsAllAndNonBroken = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
};
