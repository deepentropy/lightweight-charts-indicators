/**
 * Auto Fib Channels by DGT
 *
 * A zigzag of pivots (a high or low that no bar of the window around it exceeds, the window being twice half the
 * "Depth"; a new leg needs a move larger than "Deviation" times ATR(10) / close, in percent) gives three points:
 * Start, Mid and End (the last two zigzag legs, or older ones with "Historical Channels"). From them:
 * - Fib channel: parallel lines with the slope of Start -> End, placed at each Fibonacci level of the Start -> Mid
 *   move, extended to the right, with a label at the last bar (level and price) and a light background between
 *   neighbour lines. The lines and fills are drawn again on every bar.
 * - Fib retracement (or extension): horizontal levels of the Start -> Mid move (from Mid -> End for the extension)
 *   from Start (Mid) to the last pivot, with a label at the left end.
 * Two dashed grey lines join Start, Mid and End. "Zig Zag" draws the legs of the zigzag (at most 144 lines are kept).
 *
 * Chart context (optional third argument of calculate): the symbol tick of the prices in the labels
 * (`format.mintick`) and the ticker of the alert messages (`syminfo.ticker`); without a context the tick is 0.01 and
 * the ticker empty.
 *
 * Alerts (alert() calls, `alertCalls` of the result, once per bar): on every bar where the close crosses a shown
 * level (above it now and below it on the bar before, or the reverse), "AutoFibChannel: <ticker> crossing level
 * <level>" for a channel line (its price at the bar) and "Autofib: <ticker> crossing level <level>" for a
 * retracement / extension level, in the order of the levels.
 *
 * Reference: "Auto Fib Channels by DGT" by dgtrd
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © dgtrd
 */

import {
  ta, math, str, color, line, label, linefill, resetDrawings, setDrawingBar, varDrawing,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type Line, type Label, type Linefill,
} from 'oakscriptjs';
import type { AlertCall, LabelData, LineDrawingData, LinefillData, TableData } from '../types';
import { barInterval, barTime } from '../bar-time';
import { mintickOf, tickerOf, type ChartContext } from '../chart-context';

/** The original makes alert() calls */
export const hasAlertFunction = true;

/** The 22 levels in the order of the inputs: key, shown, value, colour, inline */
const LEVELS = [
  ['0', true, 0, '#787b86', 'Level0'],
  ['0236', true, 0.236, '#f44336', 'Level0'],
  ['0382', true, 0.382, '#81c784', 'Level1'],
  ['05', true, 0.5, '#4caf50', 'Level1'],
  ['0618', true, 0.618, '#009688', 'Level2'],
  ['065', false, 0.65, '#009688', 'Level2'],
  ['0786', true, 0.786, '#64b5f6', 'Level3'],
  ['1', true, 1, '#787b86', 'Level3'],
  ['1272', false, 1.272, '#81c784', 'Level4'],
  ['1414', false, 1.414, '#f44336', 'Level4'],
  ['1618', true, 1.618, '#2196f3', 'Level5'],
  ['165', false, 1.65, '#2196f3', 'Level5'],
  ['2618', false, 2.618, '#f44336', 'Level6'],
  ['265', false, 2.65, '#f44336', 'Level6'],
  ['3618', false, 3.618, '#9c27b0', 'Level7'],
  ['365', false, 3.65, '#9c27b0', 'Level7'],
  ['4236', false, 4.236, '#e91e63', 'Level8'],
  ['4618', false, 4.618, '#81c784', 'Level8'],
  ['Neg0236', false, -0.236, '#f44336', 'Level9'],
  ['Neg0382', false, -0.382, '#81c784', 'Level9'],
  ['Neg0618', true, -0.618, '#009688', 'Level10'],
  ['Neg065', false, -0.65, '#009688', 'Level10'],
] as const;

/** Order of the processLevel() calls */
const PROCESS_ORDER = ['Neg065', 'Neg0618', 'Neg0382', 'Neg0236', '0', '0236', '0382', '05', '0618', '065', '0786', '1',
  '1272', '1414', '1618', '165', '2618', '265', '3618', '365', '4236', '4618'] as const;

type LevelKey = (typeof LEVELS)[number][0];
type LevelInputs = { [K in LevelKey as `show${K}`]: boolean } & { [K in LevelKey as `value${K}`]: number } & {
  [K in LevelKey as `color${K}`]: string;
};

export interface AutoFibChannelsByDgtInputs extends LevelInputs {
  /** Multiplier of ATR(10) / close, in percent: smallest move that starts a new leg */
  thresholdMultiplier: number;
  depth: number;
  zigZag: boolean;
  zzColor: string;
  zzWidth: number;
  zzStyle: 'Dashed' | 'Dotted' | 'Solid';
  isFibChannel: boolean;
  fibExtRet: 'Fib Retracement' | 'Fib Extention';
  isFibRetOrExt: boolean;
  histPivot: number;
  extendL: boolean;
  reverse: boolean;
  bgChannel: boolean;
  channelLevels: boolean;
  retExtLevels: boolean;
  levelPrices: boolean;
  levelLevels: boolean;
  levelFormat: 'Values' | 'Percent';
  uniColor: boolean;
  uniColor1: string;
  uniColor2: string;
}

const levelDefaults = Object.fromEntries(
  LEVELS.flatMap(([k, show, value, css]) => [[`show${k}`, show], [`value${k}`, value], [`color${k}`, css]]),
) as unknown as LevelInputs;

export const defaultInputs: AutoFibChannelsByDgtInputs = {
  thresholdMultiplier: 3,
  depth: 11,
  zigZag: false,
  zzColor: '#FF9800',
  zzWidth: 1,
  zzStyle: 'Solid',
  isFibChannel: true,
  fibExtRet: 'Fib Retracement',
  isFibRetOrExt: true,
  histPivot: 0,
  extendL: false,
  reverse: false,
  bgChannel: true,
  channelLevels: true,
  retExtLevels: true,
  levelPrices: true,
  levelLevels: true,
  levelFormat: 'Values',
  uniColor: false,
  uniColor1: '#0ac9f0',
  uniColor2: '#ffa726',
  ...levelDefaults,
};

const G_ZZ = 'Zig Zag Settings';
const G_FIB = 'Channel / Retracement-Extention Settings';
const G_LEVELS = 'Channel / Retracement-Extention Levels';

export const inputConfig: InputConfig[] = [
  {
    id: 'thresholdMultiplier', type: 'float', title: 'Deviation', defval: 3, min: 0, inline: 'Pivots',
    tooltip: 'Deviation is a multiplier that affects how much the price should deviate from the previous pivot in order for the bar to become a new pivot'
      + '\n\nDepth affects the minimum number of bars that will be taken into account when building',
  },
  { id: 'depth', type: 'int', title: 'Depth', defval: 11, min: 1, inline: 'Pivots' },
  { id: 'zigZag', type: 'bool', title: 'Zig Zag', defval: false, inline: 'ZZ', group: G_ZZ },
  { id: 'zzColor', type: 'color', title: '', defval: '#FF9800', inline: 'ZZ', group: G_ZZ },
  { id: 'zzWidth', type: 'int', title: '', defval: 1, min: 1, inline: 'ZZ', group: G_ZZ },
  { id: 'zzStyle', type: 'string', title: '', defval: 'Solid', options: ['Dashed', 'Dotted', 'Solid'], inline: 'ZZ', group: G_ZZ },
  { id: 'isFibChannel', type: 'bool', title: 'Fib Channel     |   ', defval: true, inline: 'FIB', group: G_FIB },
  { id: 'fibExtRet', type: 'string', title: '', defval: 'Fib Retracement', options: ['Fib Retracement', 'Fib Extention'], inline: 'FIB', group: G_FIB },
  { id: 'isFibRetOrExt', type: 'bool', title: '', defval: true, inline: 'FIB', group: G_FIB },
  { id: 'histPivot', type: 'int', title: 'Historical Channels / Retracements-Extentions', defval: 0, min: 0, inline: 'hPVT', group: G_FIB },
  { id: 'extendL', type: 'bool', title: 'Extend Lines', defval: false, group: G_FIB },
  { id: 'reverse', type: 'bool', title: 'Reverse Retracement-Extention Levels', defval: false, group: G_FIB },
  { id: 'bgChannel', type: 'bool', title: 'Channel Background', defval: true, group: G_FIB },
  { id: 'channelLevels', type: 'bool', title: 'Level Labels : Channel | Retracement-Extention', defval: true, inline: 'Levels', group: G_FIB },
  { id: 'retExtLevels', type: 'bool', title: '', defval: true, inline: 'Levels', group: G_FIB },
  { id: 'levelPrices', type: 'bool', title: 'Prices    |    Levels', defval: true, inline: 'Levels2', group: G_FIB },
  { id: 'levelLevels', type: 'bool', title: '', defval: true, inline: 'Levels2', group: G_FIB },
  { id: 'levelFormat', type: 'string', title: '', defval: 'Values', options: ['Values', 'Percent'], inline: 'Levels2', group: G_FIB },
  { id: 'uniColor', type: 'bool', title: 'UniColor : Channels | Retracements-Extentions', defval: false, inline: 'uni', group: G_FIB },
  { id: 'uniColor1', type: 'color', title: '', defval: '#0ac9f0', inline: 'uni', group: G_FIB },
  { id: 'uniColor2', type: 'color', title: '', defval: '#ffa726', inline: 'uni', group: G_FIB },
  ...LEVELS.flatMap(([k, show, value, css, inline]): InputConfig[] => [
    { id: `show${k}`, type: 'bool', title: '', defval: show, inline, group: G_LEVELS },
    { id: `value${k}`, type: 'float', title: '', defval: value, inline, group: G_LEVELS },
    { id: `color${k}`, type: 'color', title: '', defval: css, inline, group: G_LEVELS },
  ]),
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Auto Fib Channels by DGT',
  shortTitle: 'FibChannels ʙʏ DGT ☼☾',
  overlay: true,
};

/** indicator(max_lines_count = 144); labels: the default 50 */
const MAX_LINES = 144;
/** color.gray and color.teal of this version of the language */
const GRAY = '#787B86';
const TEAL = '#00897B';
/** Text added under each label text so that the label sits beside its point */
const ALIGN_PAD = '\n' + ' ‏ '.repeat(35) + '\n';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

/** ta.valuewhen(ta.change(x), x, occurrence): the values of x on the bars where it changed */
function changeValues(): { update: (v: number) => void; get: (occurrence: number) => number } {
  const values: number[] = [];
  let prev = NaN;
  return {
    update: (v) => {
      if (Math.abs(v - prev) > EPS) values.push(v);
      prev = v;
    },
    get: (occurrence) => (occurrence >= 0 && values.length > occurrence ? values[values.length - 1 - occurrence] : NaN),
  };
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AutoFibChannelsByDgtInputs> = {},
  chart?: ChartContext,
): Omit<IndicatorResult, 'lines' | 'labels' | 'linefills' | 'tables'> & {
    lines: LineDrawingData[]; labels: LabelData[]; linefills: LinefillData[]; tables: TableData[]; alertCalls: AlertCall[];
  } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const tick = mintickOf(chart);
  const priceText = (v: number) => str.tostring(v, 'mintick', tick);
  const atr10 = ta.atr(bars, 10).toArray().map((v) => v ?? NaN);
  const ext = cfg.extendL ? 'both' : 'right';
  const alertCalls: AlertCall[] = [];
  const ticker = tickerOf(chart);
  /** Bar being calculated (bar_index) */
  let barIdx = 0;

  // pivots(src, depth / 2, isHigh): the division keeps its fraction (5.5 for a depth of 11); the history index is
  // truncated and the loop runs from 0 to twice the length
  const half = cfg.depth / 2;
  const back = Math.trunc(half);
  const span = half * 2;
  const pivotAt = (i: number, isHigh: boolean): [number, number] => {
    // c = nz(src[length])
    const c = i >= back ? (isHigh ? bars[i - back].high : bars[i - back].low) : 0;
    let ok = true;
    for (let k = 0; k <= span; k++) {
      if (k > i) continue; // src[k] is na
      if (isHigh ? gt(bars[i - k].high, c) : lt(bars[i - k].low, c)) ok = false;
    }
    return ok ? [i >= back ? i - back : NaN, c] : [NaN, NaN];
  };

  resetDrawings({ line: MAX_LINES, label: 50 });
  const lineLast = varDrawing<Line>();
  let iLast = 0;
  let pLast = 0;
  let isHighLast = false;
  let iPrevPivot = 0;
  let pPrevPivot = 0;
  let iLastPivot = 0;
  let pLastPivot = 0;
  const zzStyle = cfg.zzStyle === 'Solid' ? 'solid' : cfg.zzStyle === 'Dotted' ? 'dotted' : 'dashed';

  const iPrevChanges = changeValues();
  const pPrevChanges = changeValues();
  const iLastChanges = changeValues();
  const pLastChanges = changeValues();

  // var arrays a_ln, a_lf, a_cl
  const aLn: Line[] = [];
  const aLf: Linefill[] = [];
  const aCl: string[] = [];
  // `var id` of f_drawLine / f_drawLabel: one object per call site (processLevel call x inner call)
  const varLines = new Map<string, ReturnType<typeof varDrawing<Line>>>();
  const varLabels = new Map<string, ReturnType<typeof varDrawing<Label>>>();

  const levels = PROCESS_ORDER.map((k) => ({
    key: k, show: cfg[`show${k}`] as boolean, value: cfg[`value${k}`] as number, css: cfg[`color${k}`] as string,
  }));

  // pivotFound(dev, isHigh, index, price) and the update of the zigzag state
  const swing = (i: number, isHigh: boolean, index: number, price: number) => {
    const dev = (100 * (price - pLast)) / price;
    const devThreshold = (atr10[i] / bars[i].close) * 100 * cfg.thresholdMultiplier;
    let id: Line | undefined;
    let newHigh = isHighLast;
    if (isHighLast === isHigh && lineLast.value) {
      if (isHighLast ? gt(price, pLast) : lt(price, pLast)) {
        line.set_xy2(lineLast.value, index, price);
        id = lineLast.value;
      }
    } else if (gt(Math.abs(dev), devThreshold)) {
      id = cfg.zigZag
        ? line.new(iLast, pLast, index, price, 'bar_index', 'none', cfg.zzColor, zzStyle, cfg.zzWidth)
        : line.new(iLast, pLast, index, price, 'bar_index', 'none', 'transparent', 'dashed', 1);
      newHigh = isHigh;
    }
    if (!id) return;
    // `id != lineLast` is also true while lineLast is na (the first line): the four values become na
    if (id !== lineLast.value) {
      const prev = lineLast.value;
      iPrevPivot = prev ? line.get_x1(prev) : NaN;
      pPrevPivot = prev ? line.get_y1(prev) : NaN;
      iLastPivot = prev ? line.get_x2(prev) : NaN;
      pLastPivot = prev ? line.get_y2(prev) : NaN;
      if (!cfg.zigZag && prev) line.delete(prev);
    }
    lineLast.value = id;
    isHighLast = newHigh;
    iLast = index;
    pLast = price;
  };

  const labelText = (level: number, price: number, txt: string) => {
    const l = cfg.levelFormat === 'Values' ? txt + str.tostring(level) : txt + str.tostring(level * 100) + '%';
    return (cfg.levelLevels ? l : '') + (cfg.levelPrices ? ' (' + priceText(price) + ')' : '');
  };
  const tooltipText = (level: number, price: number, tool: string) => `${tool} Level ${str.tostring(level)} : ${priceText(price)}`;

  // f_drawLabel(index, price, txt, colorx, txtColor, style, size, align, tooltip): the calls depend on the inputs only,
  // so they run on every bar and the texts of the last bar replace the earlier ones; the texts are formatted on the
  // last bar only (formatting the prices of every bar was most of the run time)
  const drawLabel = (site: string, index: number, price: number, txt: () => string, colorx: string, txtColor: string,
    style: 'label_left' | 'label_right' | 'circle', size: 'normal' | 'auto', align: 'left' | 'right', tooltip: () => string) => {
    const last = barIdx === n - 1;
    let v = varLabels.get(site);
    if (!v) {
      v = varDrawing<Label>();
      v.value = label.new(index, price, last ? txt() : '', 'bar_index', 'price', colorx, style, txtColor, size, align);
      varLabels.set(site, v);
    }
    const id = v.value!;
    label.set_xy(id, index, price);
    if (last) label.set_text(id, txt() + ALIGN_PAD);
    label.set_textcolor(id, txtColor);
    if (last) label.set_tooltip(id, tooltip());
  };

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    barIdx = i;
    // f_crossingLevel(close, r): r > close and r < close[1] or r < close and r > close[1] (the calls run on every bar)
    const close = bars[i].close;
    const closePrev = i > 0 ? bars[i - 1].close : NaN;
    const crossing = (r: number) => (gt(r, close) && lt(r, closePrev)) || (lt(r, close) && gt(r, closePrev));
    const [iH, pH] = pivotAt(i, true);
    if (!isNaN(iH)) {
      swing(i, true, iH, pH);
    } else {
      const [iL, pL] = pivotAt(i, false);
      if (!isNaN(iL)) swing(i, false, iL, pL);
    }

    iPrevChanges.update(iPrevPivot);
    pPrevChanges.update(pPrevPivot);
    iLastChanges.update(iLastPivot);
    pLastChanges.update(pLastPivot);
    const hist = cfg.histPivot;
    const zz = lineLast.value;
    const iStartBase = iPrevChanges.get(hist > 0 ? hist : 0);
    const pStartBase = pPrevChanges.get(hist > 0 ? hist : 0);
    const iEndBase = hist > 0 ? iLastChanges.get(hist - 1) : zz ? line.get_x2(zz) : NaN;
    const pEndBase = hist > 0 ? pLastChanges.get(hist - 1) : zz ? line.get_y2(zz) : NaN;
    const iMidPivot = hist > 0 ? iPrevChanges.get(hist - 1) : zz ? line.get_x1(zz) : NaN;
    const pMidPivot = hist > 0 ? pPrevChanges.get(hist - 1) : zz ? line.get_y1(zz) : NaN;
    const slope = (pEndBase - pStartBase) / (iEndBase - iStartBase);
    const iPivotDiff = iMidPivot - iStartBase;
    const pPivotDiff = Math.abs(pMidPivot - pStartBase);

    // ta.change(time): false on the first bar; the loops end at the size read once
    if (i > 0) {
      while (aLn.length > 0) line.delete(aLn.shift()!);
      while (aLf.length > 0) linefill.delete(aLf.shift()!);
    }

    if (cfg.isFibChannel || (cfg.fibExtRet === 'Fib Extention' && cfg.isFibRetOrExt)) {
      aLn.push(line.new(iStartBase, pStartBase, iMidPivot, pMidPivot, 'bar_index', 'none', GRAY, 'dashed', 1));
      aLn.push(line.new(iMidPivot, pMidPivot, iEndBase, pEndBase, 'bar_index', 'none', GRAY, 'dashed', 1));
    }
    if (cfg.fibExtRet === 'Fib Retracement' && cfg.isFibRetOrExt && !cfg.isFibChannel) {
      aLn.push(line.new(iStartBase, pStartBase, iMidPivot, pMidPivot, 'bar_index', 'none', GRAY, 'dashed', 1));
    }

    // processLevel(show, value, colorL)
    for (const { key, show, value, css } of levels) {
      if (cfg.isFibChannel && show) {
        const iStart = math.round(iStartBase + iPivotDiff * value);
        const intercept = lt(pStartBase, pMidPivot)
          ? pStartBase + pPivotDiff * value - slope * iStart
          : pStartBase - pPivotDiff * value - slope * iStart;
        const pStart = slope * iStart + intercept;
        const iEnd = iStart < iEndBase ? iEndBase : iStart + 1;
        const pEnd = slope * iEnd + intercept;
        const pLastBar = slope * i + intercept;
        const col = cfg.uniColor ? cfg.uniColor1 : css;
        // f_drawLineX(): only for a start before bar_index + 500
        if (iStart < i + 500) aLn.push(line.new(iStart, pStart, iEnd, pEnd, 'bar_index', ext, col, 'solid', 1));
        if (cfg.channelLevels) {
          drawLabel(`${key}:chl`, i, pLastBar, () => labelText(value, pLastBar, 'CHL '), '#00000000', col, 'label_left', 'normal',
            'left', () => tooltipText(value, pLastBar, 'Fib Channel'));
          drawLabel(`${key}:dot`, i, pLastBar, () => '', col, '#00000000', 'circle', 'auto', 'left', () => '');
        }
        if (crossing(pLastBar)) {
          alertCalls.push({ time: bars[i].time, message: 'AutoFibChannel: ' + ticker + ' crossing level ' + str.tostring(value), freq: 'once_per_bar' });
        }
        if (cfg.bgChannel) {
          const cLines = aLn.length;
          if (cLines === 3) aCl.push(css);
          if (cLines > 3) {
            if (aCl.length === 0) throw new Error("Auto Fib Channels by DGT: Cannot call 'array.pop()' on an empty array.");
            aLf.push(linefill.new(aLn[cLines - 2], aLn[cLines - 1], String(color.new(aCl.pop()!, 89))));
            aCl.push(css);
          }
        }
      }
      if (cfg.isFibRetOrExt) {
        let r: number;
        let isExt = false;
        const sign = cfg.reverse ? -1 : 1;
        if (cfg.fibExtRet === 'Fib Extention') {
          isExt = true;
          const offset = Math.abs(pMidPivot - pEndBase);
          r = lt(pEndBase, pMidPivot)
            ? pMidPivot - offset + sign * pPivotDiff * value
            : pMidPivot + offset - sign * pPivotDiff * value;
        } else {
          const base = cfg.reverse ? pMidPivot : pStartBase;
          r = lt(pStartBase, pMidPivot) ? base + sign * pPivotDiff * value : base - sign * pPivotDiff * value;
        }
        if (show) {
          const col = cfg.uniColor ? cfg.uniColor2 : css;
          // f_drawLine(_price, _color, _ext)
          let v = varLines.get(key);
          if (!v) {
            v = varDrawing<Line>();
            v.value = line.new(iLast, r, i, r, 'bar_index', ext, col, 'solid', 1);
            varLines.set(key, v);
          }
          if (zz) {
            line.set_xy1(v.value!, isExt ? iMidPivot : iStartBase, r);
            line.set_xy2(v.value!, line.get_x2(zz), r);
          }
          if (cfg.retExtLevels) {
            drawLabel(`${key}:ret`, isExt ? iMidPivot : iStartBase, r, () => labelText(value, r, isExt ? 'EXT ' : 'RET '), '#00000000',
              col, 'label_right', 'normal', 'right', () => tooltipText(value, r, isExt ? 'Fib Extention' : 'Fib Retracement'));
          }
          if (crossing(r)) {
            alertCalls.push({ time: bars[i].time, message: 'Autofib: ' + ticker + ' crossing level ' + str.tostring(value), freq: 'once_per_bar' });
          }
        }
      }
    }
  }
  setDrawingBar(null);

  const interval = barInterval(bars);
  const T = (index: number) => barTime(bars, index, interval);
  const lineData = (ln: Line): LineDrawingData => ({
    time1: T(ln.x1), price1: ln.y1, time2: T(ln.x2), price2: ln.y2, color: String(ln.color ?? 'transparent'),
    width: ln.width ?? 1, style: ln.style ?? 'solid', extend: ln.extend,
  });
  const alive = new Set(line.all());
  const drawn = (ln: Line) => !isNaN(ln.x1) && !isNaN(ln.x2) && !isNaN(ln.y1) && !isNaN(ln.y2);
  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    // a line with an na coordinate is not drawn
    lines: line.all().filter(drawn).map(lineData),
    // a linefill whose line was deleted by the line limit is not drawn
    linefills: linefill.all().filter((f) => alive.has(f.line1) && alive.has(f.line2))
      .map((f) => ({ line1: lineData(f.line1), line2: lineData(f.line2), color: String(f.color) })),
    labels: label.all().filter((lb) => !isNaN(lb.x) && !isNaN(lb.y)).map((lb) => ({
      time: T(lb.x), price: lb.y, text: lb.text ?? '', color: String(lb.color), textColor: String(lb.textcolor),
      style: lb.style as LabelData['style'], size: lb.size as LabelData['size'], textAlign: lb.textalign,
      tooltip: lb.tooltip ?? '',
    })),
    // var table logo = table.new(position.bottom_right, 1, 1): the cell is set on every bar
    tables: n > 0 ? [{
      position: 'bottom_right', columns: 1, rows: 1,
      cells: [{ column: 0, row: 0, text: '☼☾  ', textSize: 'normal', textColor: TEAL }],
    }] : [],
    alertCalls,
  };
}

export const AutoFibChannelsByDgt = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hasAlertFunction,
};
