/**
 * Support & Resistance Pro Toolkit [LuxAlgo]
 *
 * Support and resistance levels from swing points, with their life statistics.
 *
 * Swing points come from one of four methods: "Pivots" (pivot highs / lows with "Swing Sensitivity" bars on each
 * side), "Donchian" (the extreme reached while the highest high / lowest low of the last bars keeps moving one way;
 * a swing is confirmed when the other side moves), "CSID" (after that many up / down bars in a row, the highest
 * high / lowest low of the same number of bars) and "ZigZag" (a reversal of "Swing Sensitivity" percent). A swing
 * high gives a resistance from the high down to high - ATR x "Zone Depth"; a swing low gives a support from the low
 * up to low + ATR x "Zone Depth" (the "Breakout Buffer" widens the other side). A new level that overlaps an active
 * level of the same side is dropped, merged into it, or hides it ("Overlap Handling"). The last 100 levels are
 * followed.
 *
 * A level is broken (mitigated) when a bar closes beyond it. While it is active the script counts the bars that
 * enter it, the sweeps (a wick through it with the body back inside) and the volume traded in it. The newest
 * active levels (up to "Max Active") and the broken ones are drawn as a line at the swing price and a zone box, up
 * to the current bar or the breaking bar; active levels are extended 25 bars to the right with a label of their
 * statistics. Labels mark the swings (triangles), the sweeps (dots) and the breakouts (crosses). A table gives the
 * totals per side. At most 500 lines, 500 boxes and 500 labels are kept.
 *
 * Reference: "Support & Resistance Pro Toolkit [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  ta, str, color, Series, line, box, label, resetDrawings, setDrawingBar,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar,
} from 'oakscriptjs';
import type { BoxData, LabelData, LineDrawingData, PineSize, TableCellData, TableData, TablePosition } from '../types';
import { barInterval, barTime } from '../bar-time';

type Method = 'Pivots' | 'Donchian' | 'CSID' | 'ZigZag';
type OverlapMode = 'None' | 'Merge Overlapping' | 'Hide Overlapping (Oldest Precedence)' | 'Hide Overlapping (Youngest Precedence)';

export interface SupportResistanceProToolkitInputs {
  methodInput: Method;
  /** Lookback for Pivots / Donchian / CSID, deviation % for ZigZag */
  sensitivityInput: number;
  displayTypeInput: 'Levels' | 'Zones';
  atrPeriodInput: number;
  /** Zone Depth (ATR Mult) */
  atrMultInput: number;
  /** Breakout Buffer (ATR Mult) */
  securityMultInput: number;
  overlapModeInput: OverlapMode;
  /** Max Active (Unmitigated) */
  maxLevelsInput: number;
  showBrokenSRInput: boolean;
  extendUnmitigated: boolean;
  minEntriesInput: number;
  minStrengthInput: number;
  minSweepsInput: number;
  minVolumeInput: number;
  minDurationInput: number;
  supColorInput: string;
  resColorInput: string;
  sweepHighlight: boolean;
  breakHighlight: boolean;
  dashboardInput: boolean;
  dashboardPositionInput: 'Top Right' | 'Bottom Right' | 'Bottom Left';
  dashboardSizeInput: 'Tiny' | 'Small' | 'Normal' | 'Large' | 'Huge';
}

export const defaultInputs: SupportResistanceProToolkitInputs = {
  methodInput: 'Donchian',
  sensitivityInput: 10,
  displayTypeInput: 'Zones',
  atrPeriodInput: 200,
  atrMultInput: 0.5,
  securityMultInput: 0,
  overlapModeInput: 'Hide Overlapping (Oldest Precedence)',
  maxLevelsInput: 5,
  showBrokenSRInput: true,
  extendUnmitigated: true,
  minEntriesInput: 0,
  minStrengthInput: 0,
  minSweepsInput: 0,
  minVolumeInput: 0,
  minDurationInput: 0,
  supColorInput: '#089981',
  resColorInput: '#F23645',
  sweepHighlight: true,
  breakHighlight: true,
  dashboardInput: true,
  dashboardPositionInput: 'Top Right',
  dashboardSizeInput: 'Small',
};

const G1 = 'Detection Settings';
const G2 = 'Zone & Level Sizing';
const G3 = 'Filtering & Visibility';
const G4 = 'Minimum Requirements';
const G5 = 'Visuals & Styles';
const G6 = 'Dashboard';

export const inputConfig: InputConfig[] = [
  { id: 'methodInput', type: 'string', title: 'Detection Method', defval: 'Donchian', options: ['Pivots', 'Donchian', 'CSID', 'ZigZag'], group: G1 },
  { id: 'sensitivityInput', type: 'float', title: 'Swing Sensitivity', defval: 10, min: 0.1, group: G1, tooltip: 'Lookback for Pivots/Donchian/CSID, Deviation % for ZigZag.' },
  { id: 'displayTypeInput', type: 'string', title: 'Display Style', defval: 'Zones', options: ['Levels', 'Zones'], group: G2 },
  { id: 'atrPeriodInput', type: 'int', title: 'ATR Period', defval: 200, min: 1, group: G2 },
  { id: 'atrMultInput', type: 'float', title: 'Zone Depth (ATR Mult)', defval: 0.5, min: 0, group: G2 },
  { id: 'securityMultInput', type: 'float', title: 'Breakout Buffer (ATR Mult)', defval: 0, min: 0, group: G2 },
  { id: 'overlapModeInput', type: 'string', title: 'Overlap Handling', defval: 'Hide Overlapping (Oldest Precedence)', options: ['None', 'Merge Overlapping', 'Hide Overlapping (Oldest Precedence)', 'Hide Overlapping (Youngest Precedence)'], group: G3 },
  { id: 'maxLevelsInput', type: 'int', title: 'Max Active (Unmitigated)', defval: 5, min: 1, max: 50, group: G3 },
  { id: 'showBrokenSRInput', type: 'bool', title: 'Show Broken S&R', defval: true, group: G3 },
  { id: 'extendUnmitigated', type: 'bool', title: 'Extend Active S&R', defval: true, group: G3 },
  { id: 'minEntriesInput', type: 'int', title: 'Min Price Entries', defval: 0, min: 0, group: G4 },
  { id: 'minStrengthInput', type: 'int', title: 'Min Overall Strength', defval: 0, min: 0, group: G4 },
  { id: 'minSweepsInput', type: 'int', title: 'Min Sweeps', defval: 0, min: 0, group: G4 },
  { id: 'minVolumeInput', type: 'float', title: 'Min Traded Volume', defval: 0, min: 0, group: G4 },
  { id: 'minDurationInput', type: 'int', title: 'Min Duration (Bars)', defval: 0, min: 0, group: G4 },
  { id: 'supColorInput', type: 'color', title: 'Support Color', defval: '#089981', group: G5 },
  { id: 'resColorInput', type: 'color', title: 'Resistance Color', defval: '#F23645', group: G5 },
  { id: 'sweepHighlight', type: 'bool', title: 'Highlight Sweeps', defval: true, group: G5 },
  { id: 'breakHighlight', type: 'bool', title: 'Highlight Breakouts', defval: true, group: G5 },
  { id: 'dashboardInput', type: 'bool', title: 'Dashboard', defval: true, group: G6 },
  { id: 'dashboardPositionInput', type: 'string', title: 'Position', defval: 'Top Right', options: ['Top Right', 'Bottom Right', 'Bottom Left'], group: G6 },
  { id: 'dashboardSizeInput', type: 'string', title: 'Size', defval: 'Small', options: ['Tiny', 'Small', 'Normal', 'Large', 'Huge'], group: G6 },
];

// No plot(): the outputs are lines, boxes, labels and a table
export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Support & Resistance Pro Toolkit [LuxAlgo]',
  shortTitle: 'LuxAlgo - S&R Pro Toolkit',
  overlay: true,
};

/** indicator(max_lines_count = 500, max_boxes_count = 500, max_labels_count = 500) */
const MAX_OBJECTS = 500;
const NONE_COLOR = '#00000000';
const DATA = '#DBDBDB';
const HEADERS = '#808080';
const BACKGROUND = '#161616';
const BORDERS = '#2E2E2E';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

type Ln = ReturnType<typeof line.new>;
type Bx = ReturnType<typeof box.new>;
type Lb = ReturnType<typeof label.new>;
interface Level {
  top: number;
  btm: number;
  basePrice: number;
  startBar: number;
  startTime: number;
  mitigationBar: number;
  mitigationTime: number;
  isSupport: boolean;
  isMitigated: boolean;
  isUserHidden: boolean;
  entries: number;
  strength: number;
  sweeps: number;
  tradedVolume: number;
  lineId: Ln | null;
  boxId: Bx | null;
  extLineId: Ln | null;
  extBoxId: Bx | null;
  statsLabel: Lb | null;
}

/** format_val(): the volume in B / M / K with one decimal */
function formatVal(val: number): string {
  if (ge(val, 1000000000)) return str.format('{0,number,#.#}B', val / 1000000000);
  if (ge(val, 1000000)) return str.format('{0,number,#.#}M', val / 1000000);
  if (ge(val, 1000)) return str.format('{0,number,#.#}K', val / 1000);
  return str.tostring(val, '#.#');
}

export function calculate(
  bars: Bar[],
  inputs: Partial<SupportResistanceProToolkitInputs> = {},
): Omit<IndicatorResult, 'boxes' | 'labels' | 'lines' | 'tables'> & {
  boxes: BoxData[];
  labels: LabelData[];
  lines: LineDrawingData[];
  tables: TableData[];
} {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const A = (s: Series) => s.toArray().map((v) => v ?? NaN);
  const method = cfg.methodInput;
  const zones = cfg.displayTypeInput === 'Zones';
  const { supColorInput: supColor, resColorInput: resColor } = cfg;

  // Global ta.* calls
  const sensInt = Math.max(1, Math.trunc(cfg.sensitivityInput));
  const high = new Series(bars, (b) => b.high);
  const low = new Series(bars, (b) => b.low);
  const globalAtr = A(ta.atr(bars, cfg.atrPeriodInput));
  const highest = A(ta.highest(high, sensInt));
  const lowest = A(ta.lowest(low, sensInt));
  const hbars = method === 'CSID' ? A(ta.highestbars(high, sensInt)) : [];
  const lbars = method === 'CSID' ? A(ta.lowestbars(low, sensInt)) : [];
  const pivotHigh = method === 'Pivots' ? A(ta.pivothigh(high, sensInt, sensInt)) : [];
  const pivotLow = method === 'Pivots' ? A(ta.pivotlow(low, sensInt, sensInt)) : [];

  // Drawings live in the library registry (max_lines_count, max_boxes_count, max_labels_count = 500), which applies
  // the count limit with its rules (also those of the last bar). An x is a bar time (xloc.bar_time, in the unit of
  // the bar times) or a bar index (xloc.bar_index).
  resetDrawings({ line: MAX_OBJECTS, box: MAX_OBJECTS, label: MAX_OBJECTS });
  const xlocOf = (byTime: boolean) => (byTime ? 'bar_time' : 'bar_index');
  const newLine = (x1: number, x2: number, y: number, byTime: boolean, c: string): Ln =>
    line.new(x1, y, x2, y, xlocOf(byTime), 'none', c);
  const newBox = (left: number, top: number, right: number, bottom: number, byTime: boolean, c: string): Bx =>
    box.new(left, top, right, bottom, NONE_COLOR, undefined, undefined, undefined, xlocOf(byTime), String(color.new(c, 85)));
  const newLabel = (
    x: number, y: number, byTime: boolean, text: string, textColor: string, style: 'label_center' | 'label_left', size: PineSize,
  ): Lb => label.new(x, y, text, xlocOf(byTime), 'price', NONE_COLOR, style, textColor, size);
  /** x.delete(); the field becomes na */
  const drop = (o: Ln | Bx | Lb | null): null => {
    if (o) {
      if ('x1' in o) line.delete(o);
      else if ('left' in o) box.delete(o);
      else label.delete(o);
    }
    return null;
  };

  // var level[] levelsArray: the newest level first
  const levels: Level[] = [];

  // Stats tracking
  let totalSupCount = 0;
  let totalResCount = 0;
  let supMitigated = 0;
  let resMitigated = 0;
  let supDuration = 0;
  let resDuration = 0;
  let supSweepsCount = 0;
  let resSweepsCount = 0;
  let supCumVolume = 0;
  let resCumVolume = 0;
  let activeSupCount = 0;
  let activeResCount = 0;
  let activeTotal = 0;

  // Method state
  let donchOs = 0;
  let donchVal = NaN;
  let donchValLoc = NaN;
  let bullCount = 0;
  let bearCount = 0;
  let zzHigh = NaN;
  let zzLow = NaN;
  let zzHighBar = NaN;
  let zzLowBar = NaN;
  let zzDir = 0;
  let cumRange = 0;

  /** handle_structure(): adds the level unless the overlap rule drops it */
  const handleStructure = (top: number, btm: number, base: number, start: number, isSup: boolean): boolean => {
    let shouldAdd = true;
    // from the oldest level to the newest
    for (let k = levels.length - 1; k >= 0; k--) {
      const l = levels[k];
      if (l.isMitigated || l.isUserHidden || l.isSupport !== isSup) continue;
      const overlaps = lt(Math.max(btm, l.btm), Math.min(top, l.top));
      if (!overlaps) continue;
      if (cfg.overlapModeInput === 'Hide Overlapping (Oldest Precedence)') {
        shouldAdd = false;
        break;
      } else if (cfg.overlapModeInput === 'Hide Overlapping (Youngest Precedence)') {
        l.isUserHidden = true;
      } else if (cfg.overlapModeInput === 'Merge Overlapping') {
        l.top = Math.max(l.top, top);
        l.btm = Math.min(l.btm, btm);
        shouldAdd = false;
        break;
      }
    }
    if (!shouldAdd) return false;
    levels.unshift({
      top, btm, basePrice: base, startBar: start, startTime: bars[start]?.time ?? NaN, mitigationBar: 0, mitigationTime: 0,
      isSupport: isSup, isMitigated: false, isUserHidden: false, entries: 0, strength: 0, sweeps: 0, tradedVolume: 0,
      lineId: null, boxId: null, extLineId: null, extBoxId: null, statsLabel: null,
    });
    return true;
  };

  // The stats labels are written again on every bar, mostly with the same numbers: each number is formatted once (an
  // argument given as its text gives the same label text)
  const memo = (format: (v: number) => string) => {
    const texts = new Map<number, string>();
    return (v: number) => {
      let text = texts.get(v);
      if (text === undefined) texts.set(v, (text = format(v)));
      return text;
    };
  };
  const volumeText = memo(formatVal);
  const countText = memo((v) => str.format('{0}', v));

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const volume = b.volume ?? NaN;
    // get_atr(): the ATR, or the average bar range while the ATR is na
    cumRange += Math.abs(b.high - b.low);
    const currentAtr = isNaN(globalAtr[i]) ? cumRange / (i + 1) : globalAtr[i];

    let ph = NaN;
    let pl = NaN;
    let phBar = NaN;
    let plBar = NaN;

    if (method === 'Pivots') {
      // Method 1: Pivots
      ph = pivotHigh[i];
      pl = pivotLow[i];
      if (!isNaN(ph)) phBar = i - sensInt;
      if (!isNaN(pl)) plBar = i - sensInt;
    } else if (method === 'Donchian') {
      // Method 2: Donchian (alternating)
      const before = donchOs;
      const prevHighest = i > 0 ? highest[i - 1] : NaN;
      const prevLowest = i > 0 ? lowest[i - 1] : NaN;
      donchOs = gt(highest[i], prevHighest) ? 1 : lt(lowest[i], prevLowest) ? -1 : donchOs;
      // donchOs != donchOs[1]: false on the first bar (na)
      if (i > 0 && donchOs !== before) {
        if (donchOs === 1) {
          pl = donchVal;
          plBar = donchValLoc;
          donchVal = b.high;
          donchValLoc = i;
        } else {
          ph = donchVal;
          phBar = donchValLoc;
          donchVal = b.low;
          donchValLoc = i;
        }
      } else if (donchOs === 1) {
        if (ge(b.high, isNaN(donchVal) ? -1.0e10 : donchVal)) {
          donchVal = b.high;
          donchValLoc = i;
        }
      } else if (donchOs === -1) {
        if (le(b.low, isNaN(donchVal) ? 1.0e10 : donchVal)) {
          donchVal = b.low;
          donchValLoc = i;
        }
      }
    } else if (method === 'CSID') {
      // Method 3: CSID
      bullCount = gt(b.close, b.open) ? bullCount + 1 : 0;
      bearCount = lt(b.close, b.open) ? bearCount + 1 : 0;
      if (bullCount === sensInt) {
        ph = highest[i];
        phBar = i + hbars[i];
      }
      if (bearCount === sensInt) {
        pl = lowest[i];
        plBar = i + lbars[i];
      }
    } else if (method === 'ZigZag') {
      // Method 4: ZigZag
      const dev = (b.close * cfg.sensitivityInput) / 100;
      if (zzDir === 0) {
        zzHigh = b.high;
        zzLow = b.low;
        zzHighBar = i;
        zzLowBar = i;
        zzDir = gt(b.close, b.open) ? 1 : -1;
      } else if (zzDir === 1) {
        if (gt(b.high, zzHigh)) {
          zzHigh = b.high;
          zzHighBar = i;
        } else if (lt(b.low, zzHigh - dev)) {
          ph = zzHigh;
          phBar = zzHighBar;
          zzLow = b.low;
          zzLowBar = i;
          zzDir = -1;
        }
      } else if (lt(b.low, zzLow)) {
        zzLow = b.low;
        zzLowBar = i;
      } else if (gt(b.high, zzLow + dev)) {
        pl = zzLow;
        plBar = zzLowBar;
        zzHigh = b.high;
        zzHighBar = i;
        zzDir = 1;
      }
    }

    // Highlight swings: time[bar_index - phBar] is the time of the swing bar
    if (!isNaN(ph)) newLabel(bars[phBar]?.time ?? NaN, ph, true, '▼', resColor, 'label_center', 'small');
    if (!isNaN(pl)) newLabel(bars[plBar]?.time ?? NaN, pl, true, '▲', supColor, 'label_center', 'small');

    // Creation and overlap logic
    if (!isNaN(ph)) {
      if (handleStructure(ph + currentAtr * cfg.securityMultInput, ph - currentAtr * cfg.atrMultInput, ph, phBar, false)) totalResCount += 1;
    }
    if (!isNaN(pl)) {
      if (handleStructure(pl + currentAtr * cfg.atrMultInput, pl - currentAtr * cfg.securityMultInput, pl, plBar, true)) totalSupCount += 1;
    }

    // Mitigation loop: the level that leaves the array keeps its drawings
    if (levels.length > 100) levels.pop();

    activeSupCount = 0;
    activeResCount = 0;
    activeTotal = 0;
    for (const l of levels) {
      if (!l.isMitigated) {
        if (l.isSupport) {
          if (lt(b.close, l.btm)) {
            l.isMitigated = true;
            l.mitigationBar = i;
            l.mitigationTime = b.time;
            supMitigated += 1;
            supDuration += l.mitigationBar - l.startBar;
            supCumVolume += l.tradedVolume;
            if (cfg.breakHighlight) newLabel(b.time, b.low, true, '✖', supColor, 'label_center', 'tiny');
          }
        } else if (gt(b.close, l.top)) {
          l.isMitigated = true;
          l.mitigationBar = i;
          l.mitigationTime = b.time;
          resMitigated += 1;
          resDuration += l.mitigationBar - l.startBar;
          resCumVolume += l.tradedVolume;
          if (cfg.breakHighlight) newLabel(b.time, b.high, true, '✖', resColor, 'label_center', 'tiny');
        }

        if (!l.isMitigated) {
          if (ge(b.high, l.btm) && le(b.low, l.top)) l.tradedVolume += volume;
          if (l.isSupport) {
            if (le(b.low, l.top) && ge(b.close, l.btm)) l.entries += 1;
            if (lt(b.low, l.btm) && gt(Math.min(b.close, b.open), l.btm)) {
              l.sweeps += 1;
              supSweepsCount += 1;
              if (cfg.sweepHighlight) newLabel(b.time, b.low, true, '●', supColor, 'label_center', 'small');
            }
          } else {
            if (ge(b.high, l.btm) && le(b.close, l.top)) l.entries += 1;
            if (gt(b.high, l.top) && lt(Math.max(b.close, b.open), l.top)) {
              l.sweeps += 1;
              resSweepsCount += 1;
              if (cfg.sweepHighlight) newLabel(b.time, b.high, true, '●', resColor, 'label_center', 'small');
            }
          }
        }
      }

      const curD = l.isMitigated ? l.mitigationBar - l.startBar : i - l.startBar;
      const meets = l.entries >= cfg.minEntriesInput && l.strength >= cfg.minStrengthInput && l.sweeps >= cfg.minSweepsInput
        && ge(l.tradedVolume, cfg.minVolumeInput) && curD >= cfg.minDurationInput && !l.isUserHidden;
      let show = false;
      if (meets) {
        if (!l.isMitigated && activeTotal < cfg.maxLevelsInput) {
          show = true;
          activeTotal += 1;
          if (l.isSupport) activeSupCount += 1;
          else activeResCount += 1;
        } else if (l.isMitigated && cfg.showBrokenSRInput) {
          show = true;
        }
      }

      if (show) {
        const endT = l.isMitigated ? l.mitigationTime : b.time;
        const c = l.isSupport ? supColor : resColor;
        const avgY = (l.top + l.btm) / 2;

        // Primary line / box, by bar time
        if (!l.lineId) {
          l.lineId = newLine(l.startTime, endT, l.basePrice, true, c);
        } else {
          line.set_xy1(l.lineId, l.startTime, l.basePrice);
          line.set_xy2(l.lineId, endT, l.basePrice);
        }
        if (zones) {
          if (!l.boxId) {
            l.boxId = newBox(l.startTime, l.top, endT, l.btm, true, c);
          } else {
            box.set_lefttop(l.boxId, l.startTime, l.top);
            box.set_rightbottom(l.boxId, endT, l.btm);
          }
        } else if (l.boxId) {
          l.boxId = drop(l.boxId);
        }

        // Extension objects, by bar index
        if (!l.isMitigated && cfg.extendUnmitigated) {
          const endExt = i + 25;
          if (!l.extLineId) {
            l.extLineId = newLine(i, endExt, l.basePrice, false, c);
          } else {
            line.set_xy1(l.extLineId, i, l.basePrice);
            line.set_xy2(l.extLineId, endExt, l.basePrice);
          }
          if (zones) {
            if (!l.extBoxId) {
              l.extBoxId = newBox(i, l.top, endExt, l.btm, false, c);
            } else {
              box.set_lefttop(l.extBoxId, i, l.top);
              box.set_rightbottom(l.extBoxId, endExt, l.btm);
            }
          } else if (l.extBoxId) {
            l.extBoxId = drop(l.extBoxId);
          }

          // Stats label
          const txt = str.format('E:{0} | S:{1} | SW:{2} | V:{3} | D:{4}', countText(l.entries), countText(l.strength),
            countText(l.sweeps), volumeText(l.tradedVolume), countText(curD));
          if (!l.statsLabel) {
            l.statsLabel = newLabel(endExt, avgY, false, txt, c, 'label_left', 'tiny');
          } else {
            label.set_xy(l.statsLabel, endExt, avgY);
            label.set_text(l.statsLabel, txt);
          }
        } else {
          l.extLineId = drop(l.extLineId);
          l.extBoxId = drop(l.extBoxId);
          l.statsLabel = drop(l.statsLabel);
        }
      } else {
        l.lineId = drop(l.lineId);
        l.boxId = drop(l.boxId);
        l.extLineId = drop(l.extLineId);
        l.extBoxId = drop(l.extBoxId);
        l.statsLabel = drop(l.statsLabel);
      }
    }
  }
  setDrawingBar(null);

  // Dashboard (last bar)
  const tables: TableData[] = [];
  if (cfg.dashboardInput && n > 0) {
    const positions: Record<string, TablePosition> = {
      'Top Right': 'top_right', 'Bottom Right': 'bottom_right', 'Bottom Left': 'bottom_left',
    };
    const sizes: Record<string, PineSize> = { Tiny: 'tiny', Small: 'small', Normal: 'normal', Large: 'large', Huge: 'huge' };
    const size = sizes[cfg.dashboardSizeInput];
    const cells: TableCellData[] = [];
    const cell = (column: number, row: number, text: string, textColor: string, align: 'left' | 'center' | 'right' = 'right') => {
      cells.push({ column, row, text, textColor, textSize: size, textHAlign: align, bgColor: 'transparent', height: 0 });
    };
    const div = (a: number, b: number) => a / Math.max(1, b);
    cell(0, 0, 'Support & Resistance Pro Statistics', DATA, 'center');
    cell(1, 1, 'Support', HEADERS, 'center');
    cell(2, 1, 'Resistance', HEADERS, 'center');
    cell(3, 1, 'Total', HEADERS, 'center');

    cell(0, 2, 'Active / Total', HEADERS, 'left');
    cell(1, 2, str.format('{0} / {1}', activeSupCount, totalSupCount), DATA);
    cell(2, 2, str.format('{0} / {1}', activeResCount, totalResCount), DATA);
    cell(3, 2, str.format('{0} / {1}', activeTotal, totalSupCount + totalResCount), DATA);

    cell(0, 3, 'Mitigated %', HEADERS, 'left');
    cell(1, 3, str.format('{0,number,#.#}%', div(supMitigated * 100, totalSupCount)), DATA);
    cell(2, 3, str.format('{0,number,#.#}%', div(resMitigated * 100, totalResCount)), DATA);
    cell(3, 3, str.format('{0,number,#.#}%', div((supMitigated + resMitigated) * 100, totalSupCount + totalResCount)), DATA);

    cell(0, 4, 'Avg Duration', HEADERS, 'left');
    cell(1, 4, str.format('{0,number,#}b', div(supDuration, supMitigated)), DATA);
    cell(2, 4, str.format('{0,number,#}b', div(resDuration, resMitigated)), DATA);
    cell(3, 4, str.format('{0,number,#}b', div(supDuration + resDuration, supMitigated + resMitigated)), DATA);

    cell(0, 5, 'Avg Volume', HEADERS, 'left');
    cell(1, 5, formatVal(div(supCumVolume, supMitigated)), DATA);
    cell(2, 5, formatVal(div(resCumVolume, resMitigated)), DATA);
    cell(3, 5, formatVal(div(supCumVolume + resCumVolume, supMitigated + resMitigated)), DATA);

    cell(0, 6, 'Total Sweeps', HEADERS, 'left');
    cell(1, 6, str.tostring(supSweepsCount), DATA);
    cell(2, 6, str.tostring(resSweepsCount), DATA);
    cell(3, 6, str.tostring(supSweepsCount + resSweepsCount), DATA);
    tables.push({
      position: positions[cfg.dashboardPositionInput], columns: 4, rows: 7, cells,
      merges: [{ startColumn: 0, startRow: 0, endColumn: 3, endRow: 0 }],
      bgColor: BACKGROUND, frameColor: BORDERS, frameWidth: 1, borderColor: BORDERS, borderWidth: 1,
    });
  }

  const interval = barInterval(bars);
  const T = (x: number, xloc: 'bar_index' | 'bar_time') => (xloc === 'bar_time' ? x : barTime(bars, x, interval));
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    // an object with an na coordinate is not drawn
    lines: line.all().filter((l) => !isNaN(l.y1) && !isNaN(l.x1) && !isNaN(l.x2)).map((l) => ({
      time1: T(l.x1, l.xloc), price1: l.y1, time2: T(l.x2, l.xloc), price2: l.y2, color: String(l.color),
    })),
    boxes: box.all().filter((b) => !isNaN(b.top) && !isNaN(b.bottom) && !isNaN(b.left) && !isNaN(b.right)).map((b) => ({
      time1: T(b.left, b.xloc), price1: b.top, time2: T(b.right, b.xloc), price2: b.bottom, bgColor: String(b.bgcolor),
      borderColor: NONE_COLOR,
    })),
    labels: label.all().filter((l) => !isNaN(l.y) && !isNaN(l.x)).map((l) => ({
      time: T(l.x, l.xloc), price: l.y, text: l.text ?? '', color: NONE_COLOR, textColor: String(l.textcolor),
      style: l.style as 'label_center' | 'label_left', size: l.size as PineSize,
    })),
    tables,
  };
}

export const SupportResistanceProToolkit = { calculate, metadata, defaultInputs, inputConfig, plotConfig };
