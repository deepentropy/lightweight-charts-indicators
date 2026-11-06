/**
 * Volume Gaps & Imbalances (Zeiierman)
 *
 * A volume profile of the last bars, drawn on the last bar with boxes.
 * - Range: the highest high and the lowest low of the lookback, cut in equal price rows. A dotted box frames the
 *   range from the start of the lookback to the right edge of the profile.
 * - Profile: the volume of each bar of the lookback goes to the row of its source price, as bull volume (close above
 *   open) or bear volume. Each row is drawn right-aligned at the profile placement, its length is its volume against
 *   the largest row, split in a bull part and a bear part.
 * - Zero-volume zones: rows without volume are shaded over the lookback; rows that touch are merged in one zone,
 *   and each zone starts at the first bar of the lookback whose range reaches it.
 * - Delta summary: the rows are grouped in sections; each section shows (bull - bear) / total volume as a bar in
 *   a panel at the right of the profile, with its percentage as text.
 *
 * Chart context (optional third argument):
 * - `chart.foregroundColor`: the chart foreground colour of the box borders. Without it the dark theme value.
 *
 * As the original, the port stops with an error when the bars do not cover the lookback (no price row can be
 * built).
 *
 * Reference: "Volume Gaps & Imbalances (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Zeiierman
 */

import {
  math, str, color, barInterval, barTime,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type SourceType,
} from 'oakscriptjs';
import type { BoxData } from '../types';
import { foregroundColorOf, type ChartContext } from '../chart-context';
import { barSource, createBarRun, fullResult, isBarSource, WindowExtreme, type BarRunState, type BarStudy, type IndicatorRun } from '../live-run';

export interface VolumeGapsImbalancesInputs {
  /** Number of bars of the profile */
  prd: number;
  /** Number of price rows */
  rows: number;
  /** Price of a bar for its row */
  src: SourceType;
  /** Width of the profile in bars */
  width: number;
  bullColor: string;
  bearColor: string;
  zoneColor: string;
  /** Number of sections of the delta panel */
  sumSections: number;
  /** Width of the delta panel in bars */
  sumPanelW: number;
  /** Gap in bars between the profile and the delta panel */
  sumGapX: number;
  /** Show the delta percentage in each delta bar */
  sumShowLabel: boolean;
  deltaPosColor: string;
  deltaNegColor: string;
  deltaNeutralBg: string;
  deltaTextColor: string;
  /** Smallest length of a non-zero delta bar, as a fraction of the panel width */
  deltaMinFrac: number;
}

export const defaultInputs: VolumeGapsImbalancesInputs = {
  prd: 200,
  rows: 50,
  src: 'hlc3',
  width: 100,
  bullColor: 'rgba(41, 98, 255, 0.7)',
  bearColor: 'rgba(255, 152, 0, 0.7)',
  zoneColor: 'rgba(49, 27, 146, 0.5)',
  sumSections: 20,
  sumPanelW: 40,
  sumGapX: 4,
  sumShowLabel: true,
  deltaPosColor: 'rgba(0, 230, 118, 0.8)',
  deltaNegColor: 'rgba(242, 54, 69, 0.8)',
  deltaNeutralBg: 'rgba(120, 123, 134, 0.1)',
  deltaTextColor: '#FFFFFF',
  deltaMinFrac: 0.2,
};

const T1 = 'Number of historical bars used to build the volume profile and zero-volume gaps.\nHigher = smoother, more stable profile but heavier on performance.';
const T2 = 'Number of price rows (bins) between the highest and lowest price in the lookback range.\nHigher = more detailed profile, lower = more compact.';
const T3 = 'Price source used when assigning each bar to a price row in the profile (e.g. HLC3, Close).';
const T4 = 'Horizontal width in bars for the main volume profile drawn to the right of price.';
const T5 = 'Fill color for the bullish portion of each price row (bars where Close > Open).';
const T6 = 'Fill color for the bearish portion of each price row (bars where Close <= Open).';
const T7 = 'Background color used to highlight zero-volume price gaps (no traded volume in that row).';
const T8 = 'Number of stacked sections in the delta panel.\nEach section aggregates Buy/Sell delta for a vertical slice of the full profile.';
const T9 = 'Horizontal width in bars of the delta summary panel.';
const T10 = 'Horizontal gap, in bars, between the main volume profile and the delta panel.';
const T11 = 'Show or hide the Δ (delta) percentage text inside each delta bar.';
const T12 = 'Color used when delta is positive in a section (Buy volume > Sell volume).';
const T13 = 'Color used when delta is negative in a section (Sell volume > Buy volume).';
const T14 = 'Background color of the delta panel and neutral areas when there is little or no delta.';
const T15 = 'Text color for the Δ percentage labels inside the delta bars.';
const T16 = 'Minimum visual size of any non-zero delta bar as a fraction of the panel width.\nUse a larger value to keep small deltas visible.';

export const inputConfig: InputConfig[] = [
  { id: 'prd', type: 'int', title: 'Lookback', defval: 200, min: 50, max: 2000, tooltip: T1, group: 'Profile Settings' },
  { id: 'rows', type: 'int', title: 'Rows', defval: 50, min: 10, max: 100, inline: 'a', tooltip: T2, group: 'Profile Settings' },
  { id: 'src', type: 'source', title: '', defval: 'hlc3', inline: 'a', tooltip: T1 + '\n\n' + T2 + '\n\n' + T3, group: 'Profile Settings' },

  { id: 'width', type: 'int', title: 'Profile Placement', defval: 100, min: 1, max: 500, tooltip: T4, group: 'Profile Styling' },
  { id: 'bullColor', type: 'color', title: 'Bull Color', defval: 'rgba(41, 98, 255, 0.7)', inline: 'prof_set', tooltip: T5, group: 'Profile Styling' },
  { id: 'bearColor', type: 'color', title: 'Bear Color', defval: 'rgba(255, 152, 0, 0.7)', inline: 'prof_set', tooltip: T6, group: 'Profile Styling' },
  { id: 'zoneColor', type: 'color', title: 'Zero-Volume Zone', defval: 'rgba(49, 27, 146, 0.5)', inline: 'prof_set', tooltip: T5 + '\n\n' + T6 + '\n\n' + T7, group: 'Profile Styling' },

  { id: 'sumSections', type: 'int', title: 'Summary Sections', defval: 20, min: 1, max: 100, tooltip: T8, group: 'Delta Summary' },
  { id: 'sumPanelW', type: 'int', title: 'Summary Width', defval: 40, min: 10, max: 200, tooltip: T9, group: 'Delta Summary' },
  { id: 'sumGapX', type: 'int', title: 'Gap From Profile', defval: 4, min: 1, max: 50, tooltip: T10, group: 'Delta Summary' },
  { id: 'sumShowLabel', type: 'bool', title: 'Show Delta Text', defval: true, tooltip: T11, group: 'Delta Summary' },

  { id: 'deltaPosColor', type: 'color', title: 'Delta Buy Color', defval: 'rgba(0, 230, 118, 0.8)', tooltip: T12, group: 'Delta Styling' },
  { id: 'deltaNegColor', type: 'color', title: 'Delta Sell Color', defval: 'rgba(242, 54, 69, 0.8)', tooltip: T13, group: 'Delta Styling' },
  { id: 'deltaNeutralBg', type: 'color', title: 'Delta Neutral BG', defval: 'rgba(120, 123, 134, 0.1)', tooltip: T14, group: 'Delta Styling' },
  { id: 'deltaTextColor', type: 'color', title: 'Delta Text Color', defval: '#FFFFFF', tooltip: T15, group: 'Delta Styling' },
  { id: 'deltaMinFrac', type: 'float', title: 'Delta Min Size (fraction of width)', defval: 0.2, min: 0.0, max: 1.0, step: 0.1, tooltip: T16, group: 'Delta Styling' },
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Volume Gaps & Imbalances (Zeiierman)',
  shortTitle: 'Volume Gaps & Imbalances (Zeiierman)',
  overlay: true,
};

/** Pine float comparisons: a > b only when a - b > 1e-10, a == b within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !Number.isNaN(a) && !Number.isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => Math.abs(a - b) <= EPS;
const ne = (a: number, b: number) => Math.abs(a - b) > EPS;

/** A box as the script handles it: left and right are bar indexes */
interface Bx {
  left: number;
  top: number;
  right: number;
  bottom: number;
  borderColor: string;
  borderWidth?: number;
  borderStyle?: 'dotted';
  bgColor: string;
  text?: string;
  textColor?: string;
}

type Result = IndicatorResult & { boxes: BoxData[] };

interface VolumeGapsVars {
  /** ta.highest(high, prd) / ta.lowest(low, prd) of the last bar */
  hi: number;
  lo: number;
}

interface VolumeGapsRun extends BarRunState<VolumeGapsVars> {
  highest: WindowExtreme | null;
  lowest: WindowExtreme | null;
  /** The runtime error of ta.highest / ta.lowest for an invalid lookback (thrown on the first bar) */
  error: unknown;
}

function study(inputs: Partial<VolumeGapsImbalancesInputs>): BarStudy<VolumeGapsRun, Result> {
  const cfg = { ...defaultInputs, ...inputs };
  return {
    fullRunReason: () => (isBarSource(cfg.src) ? null : 'source of another study'),
    init() {
      let highest: WindowExtreme | null = null;
      let lowest: WindowExtreme | null = null;
      let error: unknown = null;
      try {
        highest = new WindowExtreme(false, cfg.prd);
        lowest = new WindowExtreme(true, cfg.prd);
      } catch (e) {
        error = e;
      }
      const steps = highest && lowest ? [highest, lowest] : [];
      return { highest, lowest, error, steps, vars: { hi: NaN, lo: NaN }, lists: [], series: [] };
    },
    bar(s, i, bars) {
      if (!s.highest || !s.lowest) throw s.error;
      s.vars.hi = s.highest.step(bars[i].high);
      s.vars.lo = s.lowest.step(bars[i].low);
    },
    // Everything is drawn on the last bar, from the lookback's bars
    result(s, bars, chart) {
      return drawProfile(bars, cfg, chart, s.vars.hi, s.vars.lo);
    },
  };
}

/** A live run: each update calculates the bars from the forming bar of the previous one (see live-run.ts) */
export function createRun(inputs: Partial<VolumeGapsImbalancesInputs> = {}, chart: ChartContext = {}): IndicatorRun<Result> {
  return createBarRun(study(inputs), chart);
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeGapsImbalancesInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { boxes: BoxData[] } {
  return fullResult(createRun(inputs, chart).update(bars));
}

/** The boxes of the last bar; `hi` / `lo`: ta.highest(high, prd) / ta.lowest(low, prd) of that bar */
function drawProfile(
  bars: Bar[],
  cfg: VolumeGapsImbalancesInputs,
  chart: ChartContext | undefined,
  hi: number,
  lo: number,
): Result {
  const { prd, rows, width } = cfg;
  const n = bars.length;
  const result = (boxes: BoxData[]) => ({
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    boxes,
  });
  if (n === 0) return result([]);

  // chart.fg_color
  const fg = foregroundColorOf(chart);
  const b = n - 1;
  const source = barSource(cfg.src);

  // Everything is drawn on the last bar (barstate.islast)
  const boxes: Bx[] = [];
  const newBox = (o: Bx): Bx => {
    boxes.push(o);
    return o;
  };
  const deleteBox = (o: Bx): void => {
    const k = boxes.indexOf(o);
    if (k >= 0) boxes.splice(k, 1);
  };

  // Profile range box
  newBox({
    left: b - prd, top: hi, right: b + width, bottom: lo,
    borderColor: String(color.new(fg, 50)), borderWidth: 2, borderStyle: 'dotted', bgColor: 'transparent',
  });

  // Build levels: for i = lo to hi by step
  const step = (hi - lo) / rows;
  if (eq(step, 0)) throw new Error('The highest high and the lowest low of the lookback are equal: no price row can be built');
  const lvls: number[] = [];
  const bullVols: number[] = [];
  const bearVols: number[] = [];
  for (let level = lo; le(level, hi); level += step) {
    lvls.push(level);
    bullVols.push(0.0);
    bearVols.push(0.0);
  }
  // The loops below read lvls.get(0) and lvls.get(1)
  if (lvls.length < 2) throw new Error(`In 'array.get()' function. Index ${lvls.length} is out of bounds, array size is ${lvls.length}.`);
  const rowsUsed = lvls.length - 1;

  // Volume assignment: for i = prd to 0
  for (let i = prd; i >= 0; i--) {
    const k = b - i;
    if (k < 0) continue;
    const price = source(bars[k]);
    const isBull = gt(bars[k].close, bars[k].open);
    const volume = bars[k].volume ?? NaN;
    for (let j = 0; j < rowsUsed; j++) {
      if (gt(price, lvls[j]) && le(price, lvls[j + 1])) {
        if (isBull) bullVols[j] += volume;
        else bearVols[j] += volume;
        break;
      }
    }
  }

  // maxVol based on total volumes
  let maxVol = 0.0;
  for (let i = 0; i < rowsUsed; i++) {
    const vol = bullVols[i] + bearVols[i];
    if (gt(vol, maxVol)) maxVol = vol;
  }

  // Create profile
  const profileBorder = String(color.new(fg, 90));
  const zone: Bx[] = [];
  for (let i = 0; i < rowsUsed; i++) {
    const bull = bullVols[i];
    const bear = bearVols[i];
    const vol = bull + bear;
    const normV = gt(maxVol, 0) ? (math.round((vol / maxVol) * width) as number) : 0;
    if (gt(normV, 0)) {
      const normBull = gt(bull, 0) ? (math.round((bull / vol) * normV) as number) : 0;
      const normBear = normV - normBull;
      const leftStart = b + width - normV;
      if (gt(normBull, 0)) {
        newBox({ left: leftStart, top: lvls[i + 1], right: leftStart + normBull, bottom: lvls[i], borderColor: profileBorder, bgColor: cfg.bullColor });
      }
      if (gt(normBear, 0)) {
        newBox({ left: leftStart + normBull, top: lvls[i + 1], right: b + width, bottom: lvls[i], borderColor: profileBorder, bgColor: cfg.bearColor });
      }
    }
    // Zero-volume zone
    if (eq(vol, 0)) {
      zone.push(newBox({ left: b - prd, top: lvls[i + 1], right: b, bottom: lvls[i], borderColor: 'transparent', bgColor: cfg.zoneColor }));
    }
  }

  // Zone merge: consecutive zones that touch become one box
  if (zone.length > 1) {
    let i = 0;
    while (i < zone.length) {
      let currentTop = zone[i].top;
      let j = i + 1;
      while (j < zone.length) {
        const next = zone[j];
        if (gt(Math.abs(next.bottom - currentTop), 1e-10)) break;
        currentTop = next.top;
        j += 1;
      }
      if (j - i > 1) {
        const merged = newBox({
          left: b - prd, top: zone[j - 1].top, right: b, bottom: zone[i].bottom, borderColor: 'transparent', bgColor: cfg.zoneColor,
        });
        for (let k = j - 1; k >= i; k--) {
          deleteBox(zone[k]);
          zone.splice(k, 1);
        }
        zone.splice(i, 0, merged);
      }
      i += 1;
    }
  }

  // Left edge of each zone: the first bar of the lookback whose range reaches it
  const epsilon = 1e-10;
  for (const z of zone) {
    let leftIdx = b - prd;
    for (let off = prd; off >= 0; off--) {
      const k = b - off;
      if (k < 0) continue;
      const low = bars[k].low;
      const high = bars[k].high;
      if ((le(low, z.top + epsilon) && ge(high, z.bottom - epsilon))
        || (ge(high, z.bottom - epsilon) && le(low, z.bottom + epsilon))
        || (le(low, z.bottom + epsilon) && ge(high, z.top - epsilon))) {
        leftIdx = b - off;
        break;
      }
    }
    z.left = leftIdx;
  }

  // Delta summary
  if (rowsUsed > 0 && cfg.sumSections > 0) {
    const secRows = Math.max(1, Math.floor(rowsUsed / cfg.sumSections));
    const baseLeft = b + width + cfg.sumGapX;
    const baseRight = baseLeft + cfg.sumPanelW;
    const panelBorder = String(color.new(fg, 70));
    const barBorder = String(color.new(fg, 20));
    for (let s = 0; s < cfg.sumSections; s++) {
      const startIdx = s * secRows;
      const endIdx = s === cfg.sumSections - 1 ? rowsUsed - 1 : Math.min(rowsUsed - 1, (s + 1) * secRows - 1);
      if (startIdx > endIdx) continue;
      let segBull = 0.0;
      let segBear = 0.0;
      for (let j = startIdx; j <= endIdx; j++) {
        segBull += bullVols[j];
        segBear += bearVols[j];
      }
      const segTot = segBull + segBear;
      if (le(segTot, 0)) continue;

      // vertical range of this section
      const segTop = lvls[endIdx + 1];
      const segBottom = lvls[startIdx];
      newBox({ left: baseLeft, top: segTop, right: baseRight, bottom: segBottom, borderColor: panelBorder, bgColor: cfg.deltaNeutralBg });

      // Delta: (bull - bear) as % of the total; bar length: abs(delta) with a minimum size
      const deltaPct = ((segBull - segBear) / segTot) * 100.0;
      let barLen = 0.0;
      if (ne(deltaPct, 0)) {
        const norm = Math.abs(deltaPct) / 100.0;
        barLen = cfg.sumPanelW * Math.max(cfg.deltaMinFrac, Math.min(1.0, norm));
      }
      let dRight = baseLeft + barLen;
      let colDelta = cfg.deltaNeutralBg;
      if (gt(deltaPct, 0)) colDelta = cfg.deltaPosColor;
      else if (lt(deltaPct, 0)) colDelta = cfg.deltaNegColor;
      // a delta of exactly 0 still draws a very small neutral bar
      if (eq(deltaPct, 0)) dRight = baseLeft + 1;

      const deltaBox = newBox({
        left: baseLeft, top: segTop, right: math.round(dRight) as number, bottom: segBottom, borderColor: barBorder, bgColor: colDelta,
      });
      if (cfg.sumShowLabel) {
        deltaBox.text = 'Δ ' + str.tostring(deltaPct, '#.0') + '%';
        deltaBox.textColor = cfg.deltaTextColor;
      }
    }
  }

  const interval = barInterval(bars);
  const X = (index: number) => barTime(bars, index, interval);
  return result(boxes.map((o) => ({
    time1: X(o.left), price1: o.top, time2: X(o.right), price2: o.bottom,
    bgColor: o.bgColor, borderColor: o.borderColor,
    ...(o.borderWidth !== undefined ? { borderWidth: o.borderWidth } : {}),
    ...(o.borderStyle !== undefined ? { borderStyle: o.borderStyle } : {}),
    ...(o.text !== undefined ? { text: o.text, textColor: o.textColor, textHAlign: 'center' as const, textVAlign: 'center' as const } : {}),
  })));
}

export const VolumeGapsImbalances = { calculate, createRun, metadata, defaultInputs, inputConfig, plotConfig };
