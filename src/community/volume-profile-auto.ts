/**
 * Volume Profile Auto [line] v2
 *
 * A volume profile per higher-timeframe period, drawn with lines. At the start of each period (1 week on daily
 * charts, 1 day on 1-12 hour charts, 1 hour on minute charts, 1 month on weekly, 1 year on monthly; or the
 * "Higher Timeframe" input when the automatic settings are off) the range of the first bar is split into "parts"
 * slices, each drawn as a line at the period's first bar. The slices follow the period's high and low as they grow;
 * every bar that covers a whole slice adds its volume to it and the line width is that volume. The slice with the
 * most volume is coloured "color vol max" and a POC line is drawn at the middle of it (to 100 bars after the
 * period start; the POC of each finished period stays on the chart up to the start of the next one). A box with
 * a faint background covers the high / low range of each period. On the last bar the widths of all slices are
 * rescaled to "max width" times the slice volume over the highest bar volume of the last "max lines" bars.
 * The bars are drawn fully transparent unless "Visible Barcolor" is on.
 *
 * Kept as in the original: the POC price is the average of the top of the POC slice and the top of the next line of
 * the array (for the last slice that is the top line of the period before); a slice gets the volume of a bar only
 * when the bar covers the whole slice.
 *
 * Chart values (optional third argument of calculate): the periods follow the exchange calendar of the symbol.
 *
 * Reference: "Volume Profile Auto [line]" by fikira
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © fikira
 */

import {
  ta, color, line, box, resetDrawings, setDrawingBar, drawingOutputs, getSourceSeries, timeframe,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type BarColorConfig, type Line, type Box,
} from 'oakscriptjs';
import type { BarColorData } from '../types';
import type { ChartContext } from '../chart-context';
import { chartTimeframe, periodChanges } from '../anchor-period';
import type { StudyDrawingKind } from '../style-outputs';

export interface VolumeProfileAutoInputs {
  /** Number of slices of each profile */
  i_size: number;
  /** Width of the largest slice on the last bar */
  i_width: number;
  /** Maximum number of slice lines (and length of the highest-volume window) */
  aMax: number;
  /** Colour of the slice with the most volume */
  c_volH: string;
  /** Colour of the slices (and, at 95 transparency, of the period boxes) */
  c_vol: string;
  /** Colour of the POC lines */
  c_POC: string;
  /** Automatic Settings: the higher timeframe follows the chart timeframe */
  i_auto: boolean;
  /** Lower Timeframe (not used by the drawings) */
  periodL1: string;
  /** Higher Timeframe of the profiles when the automatic settings are off */
  periodH1: string;
  /** Visible Barcolor: off draws the bars transparent */
  visibleBarcolor: boolean;
}

export const defaultInputs: VolumeProfileAutoInputs = {
  i_size: 25,
  i_width: 15,
  aMax: 500,
  c_volH: 'rgba(255, 152, 0, 0.6)',
  c_vol: 'rgba(41, 98, 255, 0.35)',
  c_POC: 'rgba(255, 0, 0, 0.6)',
  i_auto: true,
  periodL1: '60',
  periodH1: 'D',
  visibleBarcolor: false,
};

const AUTO_TOOLTIP = 'Lower Timeframe = Monthly -> Higher Timeframe = 1 Year \nLower Timeframe = Weekly -> Higher Timeframe = 1 Month \nLower Timeframe = Daily -> Higher Timeframe = 1 Week \nLower Timeframe = Hourly -> Higher Timeframe = 1 Day \nLower Timeframe = Minutes -> Higher Timeframe = 1 Hour \nLower Timeframe = Seconds -> Higher Timeframe = 1 Minute';

export const inputConfig: InputConfig[] = [
  { id: 'i_size', type: 'int', title: 'parts', defval: 25, min: 5, max: 50 },
  { id: 'i_width', type: 'int', title: 'max width', defval: 15 },
  { id: 'aMax', type: 'int', title: 'max lines', defval: 500, max: 500 },
  { id: 'c_volH', type: 'color', title: 'color vol max', defval: 'rgba(255, 152, 0, 0.6)' },
  { id: 'c_vol', type: 'color', title: 'color vol', defval: 'rgba(41, 98, 255, 0.35)' },
  { id: 'c_POC', type: 'color', title: 'color POC', defval: 'rgba(255, 0, 0, 0.6)' },
  { id: 'i_auto', type: 'bool', title: 'Automatic Settings', defval: true, tooltip: AUTO_TOOLTIP },
  { id: 'periodL1', type: 'timeframe', title: 'Lower Timeframe', defval: '60', active: { not: 'i_auto' } },
  { id: 'periodH1', type: 'timeframe', title: 'Higher Timeframe', defval: 'D', active: { not: 'i_auto' } },
  { id: 'visibleBarcolor', type: 'bool', title: 'Visible Barcolor', defval: false },
];

export const plotConfig: PlotConfig[] = [];

export const barColorConfig: BarColorConfig[] = [{ id: 'barcolor0', kind: 'barcolor', title: 'Bar Color' }];

export const drawingKinds: StudyDrawingKind[] = ['line', 'box'];

export const metadata = {
  title: 'Volume Profile Auto [line] v2',
  shortTitle: 'VPa [line] v2',
  overlay: true,
};

// color.new(color.black, 100) in Pine v5
const HIDDEN_BAR = String(color.new('#363A45', 100));
// box text colour of Pine v5
const BOX_TEXT = '#363A45';

// Pine float comparisons (1e-10); na compares false
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b > -EPS;
const le = (a: number, b: number) => b - a > -EPS;

/** periodH2 of the original: the higher timeframe of the automatic settings */
function autoPeriod(chartTf: string): string {
  if (chartTf === '') return '1';
  const info = timeframe.info(chartTf);
  if (info.ismonthly) return '12M';
  if (info.isweekly) return '1M';
  if (info.isdaily) return '1W';
  if (['60', '120', '180', '240', '360', '480', '720'].includes(info.period)) return '1D';
  if (info.isminutes) return '60';
  return '1';
}

export function calculate(
  bars: Bar[],
  inputs: Partial<VolumeProfileAutoInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { barColors: BarColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const size = cfg.i_size;
  const aMax = cfg.aMax;
  const maxVol = ta.highest(getSourceSeries(bars, 'volume'), aMax).toArray().map((v) => v ?? NaN);
  const periodH = cfg.i_auto ? autoPeriod(chartTimeframe(bars, chart)) : cfg.periodH1;
  // chT_H = ta.change(time(periodH)) != 0 (false on the first bar)
  const chT_H = periodChanges(bars, periodH, chart);

  // getters of an na object give na
  const x1 = (l: Line | null) => (l ? line.get_x1(l) : NaN);
  const x2 = (l: Line | null) => (l ? line.get_x2(l) : NaN);
  const y1 = (l: Line | null) => (l ? line.get_y1(l) : NaN);
  const y2 = (l: Line | null) => (l ? line.get_y2(l) : NaN);
  const avg = (a: number, b: number) => (a + b) / 2;
  const at = <T>(arr: T[], k: number): T => {
    if (k < 0 || k >= arr.length) throw new Error(`Index ${k} is out of bounds, array size is ${arr.length}`);
    return arr[k];
  };

  resetDrawings({ line: 500, box: 500 });
  const aLines: (Line | null)[] = Array(size).fill(null);
  const aVol: number[] = Array(size).fill(0);
  const aBox: (Box | null)[] = Array(size).fill(null);
  const tempArray: number[] = Array(size).fill(0);
  let index = 0;
  let lPOC: Line | null = null;
  const barColors: BarColorData[] = [];
  const pocLine = (k: number) => {
    const y = avg(y1(at(aLines, k)), y1(at(aLines, k + 1)));
    return line.new(x1(at(aLines, k)), y, x2(at(aLines, k)) + 100, y, 'bar_index', 'none', cfg.c_POC);
  };

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const { high, low } = bars[i];
    const volume = bars[i].volume ?? NaN;
    if (lPOC) line.delete(lPOC);

    if (chT_H[i]) {
      // wrap up the profile of the period before: its POC line stays
      lPOC = pocLine(index);
      if (aBox.length > 0 && aBox[0]) box.set_right(aBox[0], i);
      aBox.unshift(box.new(i, high, i, low, 'transparent', 1, 'solid', 'none', 'bar_index', String(color.new(cfg.c_vol, 95)),
        '', 'auto', BOX_TEXT));
      if (aBox.length > Math.ceil(aMax / size)) {
        const last = aBox[aBox.length - 1];
        if (last) box.delete(last);
        aBox.pop();
      }
      for (let k = 0; k < size; k++) {
        aLines.unshift(line.new(i, high - ((high - low) / size) * k, i, high - ((high - low) / size) * (k + 1), 'bar_index',
          'none', cfg.c_vol, 'solid', 1));
        aVol.unshift(0);
        if (aLines.length > aMax) {
          const last = aLines[aLines.length - 1];
          if (last) line.delete(last);
          aLines.pop();
          aVol.pop();
        }
      }
    }

    if (aLines.length > 0) {
      const box0 = at(aBox, 0);
      if (box0) box.set_right(box0, i);
      if (lPOC) line.set_x2(lPOC, i);
      let hi = y1(at(aLines, 0));
      let lo = y2(at(aLines, size - 1));
      if (gt(high, hi)) {
        for (let k = 0; k < size; k++) {
          const top = at(aLines, 0);
          if (top) line.set_y1(top, high);
          hi = y1(top);
          const l = at(aLines, k);
          if (l) {
            line.set_y1(l, hi - ((hi - lo) / size) * k);
            line.set_y2(l, hi - ((hi - lo) / size) * (k + 1));
          }
          if (aBox[0]) box.set_top(aBox[0], hi);
        }
      }
      if (lt(low, lo)) {
        for (let k = 0; k < size; k++) {
          const bottom = at(aLines, size - 1);
          if (bottom) line.set_y2(bottom, low);
          lo = y2(bottom);
          const l = at(aLines, k);
          if (l) {
            line.set_y1(l, hi - ((hi - lo) / size) * k);
            line.set_y2(l, hi - ((hi - lo) / size) * (k + 1));
          }
          if (aBox[0]) box.set_bottom(aBox[0], lo);
        }
      }
      for (let k = 0; k < size; k++) {
        const l = at(aLines, k);
        if (ge(high, y1(l)) && le(low, y2(l))) {
          aVol[k] = at(aVol, k) + volume;
          if (l) line.set_width(l, Math.round(aVol[k]));
        }
      }
    }

    if (aVol.length > 0) {
      for (let k = 0; k < tempArray.length; k++) {
        const l = at(aLines, k);
        if (l) line.set_color(l, cfg.c_vol);
        tempArray[k] = at(aVol, k);
      }
      // array.max skips na; array.indexof compares within 1e-10
      let mx = NaN;
      for (const v of tempArray) if (!Number.isNaN(v) && (Number.isNaN(mx) || v > mx)) mx = v;
      index = tempArray.findIndex((v) => Math.abs(v - mx) <= 1e-10);
      const hl = at(aLines, index);
      if (hl) line.set_color(hl, cfg.c_volH);
      lPOC = pocLine(index);
    }

    if (i === n - 1) {
      for (let k = 0; k < aLines.length; k++) {
        const l = aLines[k];
        if (l) line.set_width(l, Math.round((cfg.i_width / maxVol[i]) * aVol[k]));
        if (lPOC) line.set_x2(lPOC, i + 200);
      }
    }

    if (!cfg.visibleBarcolor) barColors.push({ id: 'barcolor0', time: bars[i].time, color: HIDDEN_BAR });
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    barColors,
    ...drawingOutputs(bars),
  };
}

export const VolumeProfileAuto = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, barColorConfig, drawingKinds,
};
