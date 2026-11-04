/**
 * Fibonacci Optimal Entry Zone [OTE] (Zeiierman)
 *
 * Market structure with Fibonacci retracement levels of the current swing.
 * - Swing points: the pivot highs and pivot lows of "Structure Period" bars on each side. The tracked high `Up`
 *   follows the highest high since the last pivot high taken (a pivot high is taken while the structure is not
 *   bullish), the tracked low `Dn` the lowest low in the same way.
 * - A new high above the tracked high while the structure is bearish (or neutral) is a bullish change of character:
 *   a "CHoCH" label and a line at the broken high, the retracement levels of the swing from the tracked low to the
 *   new high (from the low bar to the current bar), a dotted swing line and a price label at the high. Further new
 *   highs move the levels and the swing line ("Swing tracker": from the latest tracked low, else from the low of the
 *   change of character) and the price labels. The bearish side is the mirror image.
 * - "Extend" keeps the levels up to the current bar; "Previous" keeps the old levels and swing lines; "Fill Golden
 *   Zone" fills between the first two levels (one linefill per bar, as the original).
 * - Price labels use the chart foreground colour (`chart.fg_color`, from the chart context).
 *
 * The two levels keep the order of the original: the colours are taken in reverse order of the levels, and the
 * update of an existing swing gives each line the value of the other level, as in the original.
 * At most 500 lines and 500 labels are kept (drawing registry of oakscriptjs).
 *
 * Reference: "Fibonacci Optimal Entry Zone [OTE] (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Zeiierman
 */

import {
  ta, line, label, linefill, str, Series, resetDrawings, setDrawingBar, varDrawing,
  type Bar, type IndicatorResult, type InputConfig, type Label, type Line, type PlotConfig,
} from 'oakscriptjs';
import type { LabelData, LineDrawingData, LinefillData } from '../types';
import type { StudyDrawingKind } from '../style-outputs';
import { barTime } from '../bar-time';
import { foregroundColorOf, type ChartContext } from '../chart-context';

export interface FibonacciOptimalEntryZoneInputs {
  prd: number;
  bull: boolean;
  bullColor: string;
  bear: boolean;
  bearColor: string;
  sWidth: number;
  follow: boolean;
  swingline: boolean;
  swlineWidth: number;
  swinglab: boolean;
  showOld: boolean;
  extend: boolean;
  golden: boolean;
  goldZone: string;
  level1On: boolean;
  level2On: boolean;
  level1: number;
  level2: number;
  level1Color: string;
  level2Color: string;
  fibbWidth: number;
}

export const defaultInputs: FibonacciOptimalEntryZoneInputs = {
  prd: 10,
  bull: true,
  bullColor: '#08EC32',
  bear: true,
  bearColor: 'rgba(255, 34, 34, 1)',
  sWidth: 1,
  follow: true,
  swingline: true,
  swlineWidth: 2,
  swinglab: true,
  showOld: false,
  extend: true,
  golden: false,
  goldZone: 'rgba(8, 153, 129, 0.5)',
  level1On: true,
  level2On: true,
  level1: 0.5,
  level2: 0.618,
  level1Color: '#4CAF50',
  level2Color: '#009688',
  fibbWidth: 1,
};

const T1 = 'Defines how many bars back the pivot high/low is calculated from. Higher values detect stronger swing structures.';
const T11 = 'Show previous (historical) Fibonacci levels instead of clearing them each time new structure forms.';
const T15 = 'Enable or disable individual Fibonacci levels. Checked levels will be drawn on the chart.';
const T16 = 'Customize the specific Fibonacci retracement level value. 0.50 is midpoint, 0.618 is golden ratio.';
const T17 = 'Choose the color for each Fibonacci level line. Use contrasting colors for clarity.';

export const inputConfig: InputConfig[] = [
  { id: 'prd', type: 'int', title: 'Structure Period', defval: 10, min: 1, group: 'Structure', tooltip: T1 },
  {
    id: 'bull', type: 'bool', title: 'Bullish Structure     ', defval: true, group: 'Structure',
    inline: 'Bullish', tooltip: 'Enable to display bullish market structure (higher highs and higher lows).',
  },
  {
    id: 'bullColor', type: 'color', title: '', defval: '#08EC32', group: 'Structure', inline: 'Bullish',
    tooltip: 'Select the color of bullish structure lines and labels.',
  },
  {
    id: 'bear', type: 'bool', title: 'Bearish Structure    ', defval: true, group: 'Structure',
    inline: 'Bearish', tooltip: 'Enable to display bearish market structure (lower highs and lower lows).',
  },
  {
    id: 'bearColor', type: 'color', title: '', defval: 'rgba(255, 34, 34, 1)', group: 'Structure', inline: 'Bearish',
    tooltip: 'Select the color of bearish structure lines and labels.',
  },
  {
    id: 'sWidth', type: 'int', title: 'BoS Width', defval: 1, min: 1, max: 10, group: 'Structure', inline: 'width',
    tooltip: 'Width of the Break of Structure (BoS) line to make it more visible on the chart.',
  },
  {
    id: 'follow', type: 'bool', title: 'Swing tracker', defval: true, group: 'Fibonacci Mode', inline: 'fibbinput',
    tooltip: 'Enable automatic tracking of recent swing points. Adjusts Fibonacci levels in real-time as new swings form.',
  },
  {
    id: 'swingline', type: 'bool', title: 'Swing Line', defval: true, group: 'Fibonacci Mode', inline: 'fibbinput1',
    tooltip: 'Enable to draw dotted lines connecting swing highs/lows (the swing trend line).',
  },
  {
    id: 'swlineWidth', type: 'int', title: ' ', defval: 2, min: 1, max: 10, group: 'Fibonacci Mode', inline: 'fibbinput1',
    tooltip: 'Adjust the thickness of the swing trend line. Useful for emphasizing or de-emphasizing swing connections.',
  },
  {
    id: 'swinglab', type: 'bool', title: 'Swing Lables', defval: true, group: 'Fibonacci Mode', inline: 'fibbinput2',
    tooltip: 'Enable to show price labels at swing highs/lows. Helps visualize turning points with exact prices.',
  },
  { id: 'showOld', type: 'bool', title: 'Previous', defval: false, group: 'Fibonacci', inline: 'fibbinput', tooltip: T11 },
  {
    id: 'extend', type: 'bool', title: 'Extend', defval: true, group: 'Fibonacci', inline: 'fibbinput',
    tooltip: `${T11}\n\nEnable to keep Fibonacci levels extended forward to the current bar. Helps maintain context while trading.`,
  },
  {
    id: 'golden', type: 'bool', title: 'Fill Golden Zone', defval: false, group: 'Fibonacci', inline: 'golden',
    tooltip: 'Enable to fill the Golden Zone (typically 0.5 - 0.618 retracement) between the first two Fibonacci levels.',
  },
  {
    id: 'goldZone', type: 'color', title: '', defval: 'rgba(8, 153, 129, 0.5)', group: 'Fibonacci', inline: 'golden',
    tooltip: 'Select the fill color for the Golden Zone. Softer transparency is ideal to avoid chart clutter.',
  },
  { id: 'level1On', type: 'bool', title: '', defval: true, inline: '1', tooltip: T15 },
  { id: 'level2On', type: 'bool', title: '', defval: true, inline: '2', tooltip: T15 },
  { id: 'level1', type: 'float', title: '', defval: 0.5, step: 0.1, inline: '1', tooltip: T16 },
  { id: 'level2', type: 'float', title: '', defval: 0.618, step: 0.1, inline: '2', tooltip: T16 },
  { id: 'level1Color', type: 'color', title: '', defval: '#4CAF50', inline: '1', tooltip: T17 },
  { id: 'level2Color', type: 'color', title: '', defval: '#009688', inline: '2', tooltip: T17 },
  {
    id: 'fibbWidth', type: 'int', title: 'Fibb Width', defval: 1, min: 1, max: 10, inline: 'width_',
    tooltip: 'Sets the thickness of the Fibonacci level lines. Increase for better visibility.',
  },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'linefill'];

export const metadata = {
  title: 'Fibonacci Optimal Entry Zone [OTE] (Zeiierman)',
  shortTitle: 'Fibonacci Optimal Entry Zone [OTE] (Zeiierman)',
  overlay: true,
};

/** indicator(max_lines_count = 500, max_labels_count = 500) */
const MAX_LINES = 500;
const MAX_LABELS = 500;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

export function calculate(
  bars: Bar[],
  inputs: Partial<FibonacciOptimalEntryZoneInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { lines: LineDrawingData[]; labels: LabelData[]; linefills: LinefillData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const prd = Math.trunc(cfg.prd);
  const fg = foregroundColorOf(chart);
  const A = (s: Series) => s.toArray().map((v) => (v === null || v === undefined ? NaN : (v as number)));
  const pvtHi = A(ta.pivothigh(new Series(bars, (b) => b.high), prd, prd));
  const pvtLo = A(ta.pivotlow(new Series(bars, (b) => b.low), prd, prd));
  const levelsBool = [cfg.level1On, cfg.level2On];
  const inputLevels = [cfg.level1, cfg.level2];
  const levelsCol = [cfg.level1Color, cfg.level2Color];

  resetDrawings({ line: MAX_LINES, label: MAX_LABELS });
  try {
    setDrawingBar(0, n === 1);
    let pos = 0;
    let Up = NaN;
    let Dn = NaN;
    let iUp = NaN;
    let iDn = NaN;
    let swingLow = NaN;
    let swingHigh = NaN;
    let iswingLow = NaN;
    let iswingHigh = NaN;
    const levels: number[] = [];
    const colors: string[] = [];
    let flevels: Line[] = [];
    const trend = varDrawing<Line>();
    const labelStart = varDrawing<Label>();
    const labelEndu = varDrawing<Label>();
    const labelEndd = varDrawing<Label>();

    for (let b = 0; b < n; b++) {
      setDrawingBar(b, b === n - 1);
      const { high, low } = bars[b];
      if (levels.length === 0) {
        for (let k = 0; k < levelsBool.length; k++) {
          if (levelsBool[k]) {
            levels.push(inputLevels[k]);
            colors.unshift(levelsCol[k]);
          }
        }
      }

      // CreateLabel(x, y, txt, col, z): label.new(x, y, txt, textcolor = col, style, color = color(na))
      const createLabel = (x: number, y: number, txt: string, col: string, z: boolean): Label =>
        label.new(x, y, txt, 'bar_index', 'price', 'transparent', z ? 'label_down' : 'label_up', col);
      // CreateLine(x1, x2, y, col, w): line.new(x1, x2, b, y, color = col, width = w)
      const createLine = (x1: number, y1: number, y: number, col: string, w: number): Line =>
        line.new(x1, y1, b, y, 'bar_index', 'none', col, 'solid', w);
      // UpdateLine(l, y, i)
      const updateLine = (l: Line, y: number, i: number) => {
        line.set_xy1(l, i, y);
        line.set_xy2(l, b, y);
      };
      const fibb = (v: number, h: number, l: number, ih: number, il: number): number => {
        let f = NaN;
        if (il < ih) f = h - (h - l) * v;
        if (il > ih) f = l + (h - l) * v;
        return f;
      };
      const price = (x: number) => str.tostring(x, '#.##');
      const relabel = (v: { value: Label | undefined }, x: number, y: number, z: boolean) => {
        if (v.value) label.delete(v.value);
        v.value = createLabel(x, y, price(y), fg, z);
      };
      const clearLevels = () => {
        if (!cfg.showOld) {
          if (trend.value) line.delete(trend.value);
          for (const l of flevels) line.delete(l);
        }
        flevels = [];
      };

      // Pivots
      const prevUp = Up;
      const prevDn = Dn;
      const prevIUp = iUp;
      const prevIDn = iDn;
      Up = Math.max(prevUp, high);
      Dn = Math.min(prevDn, low);
      if (!Number.isNaN(pvtHi[b]) && pos <= 0) Up = pvtHi[b];
      if (!Number.isNaN(pvtLo[b]) && pos >= 0) Dn = pvtLo[b];

      // Structure: bullish side
      if (gt(Up, prevUp)) {
        iUp = b;
        const centerBull = Math.round((prevIUp + b) / 2);
        if (pos <= 0) {
          clearLevels();
          if (cfg.bull) {
            createLabel(centerBull, prevUp, 'CHoCH', cfg.bullColor, true);
            createLine(prevIUp, prevUp, prevUp, cfg.bullColor, cfg.sWidth);
            levels.forEach((l, i) => {
              const val = fibb(l, Up, Dn, iUp, iDn);
              flevels.unshift(createLine(iDn, val, val, colors[i], cfg.fibbWidth));
            });
            if (cfg.swingline) {
              trend.value = line.new(iDn, Dn, b, Up, 'bar_index', 'none', cfg.bullColor, 'dotted', cfg.swlineWidth);
            }
            if (cfg.swinglab) relabel(labelEndu, b, Up, true);
          }
          pos = 1;
          swingLow = Dn;
          iswingLow = iDn;
        } else if (pos === 1 || pos > 1) {
          if (flevels.length > 0 && cfg.bull) {
            levels.forEach((l, i) => {
              const val = cfg.follow ? fibb(l, Up, Dn, iUp, iDn) : fibb(l, Up, swingLow, iUp, iswingLow);
              updateLine(flevels[i], val, cfg.follow ? iDn : iswingLow);
            });
            if (cfg.follow && trend.value) line.set_xy1(trend.value, iDn, Dn);
            if (pos > 1 && cfg.swinglab) relabel(labelStart, iDn, Dn, false);
            if (trend.value) line.set_xy2(trend.value, b, Up);
            if (cfg.swinglab) relabel(labelEndu, b, Up, true);
          }
          pos = pos === 1 ? 2 : pos + 1;
        }
      } else if (lt(Up, prevUp)) {
        iUp = b - prd;
      }

      // Structure: bearish side
      if (lt(Dn, prevDn)) {
        iDn = b;
        const centerBear = Math.round((prevIDn + b) / 2);
        if (pos >= 0) {
          clearLevels();
          if (cfg.bear) {
            createLabel(centerBear, prevDn, 'CHoCH', cfg.bearColor, false);
            createLine(prevIDn, prevDn, prevDn, cfg.bearColor, cfg.sWidth);
            levels.forEach((l, i) => {
              const val = fibb(l, Dn, Up, iDn, iUp);
              flevels.unshift(createLine(iUp, val, val, colors[i], cfg.fibbWidth));
            });
            if (cfg.swingline) {
              trend.value = line.new(iUp, Up, b, Dn, 'bar_index', 'none', cfg.bearColor, 'dotted', cfg.swlineWidth);
            }
            if (cfg.swinglab) relabel(labelEndd, b, Dn, false);
          }
          pos = -1;
          swingHigh = Up;
          iswingHigh = iUp;
        } else if (pos === -1 || pos < -1) {
          if (flevels.length > 0 && cfg.bear) {
            levels.forEach((l, i) => {
              const val = cfg.follow ? fibb(l, Up, Dn, iUp, iDn) : fibb(l, Dn, swingHigh, iDn, iswingHigh);
              updateLine(flevels[i], val, cfg.follow ? iUp : iswingHigh);
            });
            if (cfg.follow && trend.value) line.set_xy1(trend.value, iUp, Up);
            // pos == -1: no price labels (as the original)
            if (pos < -1 && cfg.swinglab) relabel(labelStart, iUp, Up, true);
            if (trend.value) line.set_xy2(trend.value, b, Dn);
            if (pos < -1 && cfg.swinglab) relabel(labelEndd, b, Dn, false);
          }
          pos = pos === -1 ? -2 : pos - 1;
        }
      } else if (gt(Dn, prevDn)) {
        iDn = b - prd;
      }

      // Real-time fibb update
      if (cfg.extend) {
        if (pos >= 0 && cfg.bull && flevels.length > 0) for (const l of flevels) line.set_x2(l, b);
        if (pos <= 0 && cfg.bear && flevels.length > 0) for (const l of flevels) line.set_x2(l, b);
      }

      // Golden linefill
      if (cfg.golden && flevels.length > 1) linefill.new(flevels[0], flevels[1], cfg.goldZone);
    }
  } finally {
    setDrawingBar(null);
  }

  // xloc.bar_index drawings; one with an na coordinate is not drawn
  const T = (x: number) => barTime(bars, x);
  const drawn = (l: Line) => [l.x1, l.y1, l.x2, l.y2].every((v) => !Number.isNaN(v));
  const lineData = (l: Line): LineDrawingData => ({
    time1: T(l.x1), price1: l.y1, time2: T(l.x2), price2: l.y2, color: String(l.color), width: l.width,
    ...(l.style && l.style !== 'solid' ? { style: l.style as LineDrawingData['style'] } : {}),
  });
  const liveLines = line.all();
  const alive = new Set(liveLines);
  const lines = liveLines.filter(drawn).map(lineData);
  const labels: LabelData[] = label.all()
    .filter((l) => !Number.isNaN(l.x) && !Number.isNaN(l.y))
    .map((l) => ({
      time: T(l.x), price: l.y, text: l.text ?? '', color: 'transparent', textColor: String(l.textcolor),
      style: l.style as LabelData['style'],
    }));
  const linefills: LinefillData[] = linefill.all()
    .filter((f) => alive.has(f.line1) && alive.has(f.line2) && drawn(f.line1) && drawn(f.line2))
    .map((f) => ({ line1: lineData(f.line1), line2: lineData(f.line2), color: String(f.color) }));
  resetDrawings();

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines,
    labels,
    linefills,
  };
}

export const FibonacciOptimalEntryZone = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds,
};
