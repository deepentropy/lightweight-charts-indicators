/**
 * Auto Fib Speed Resistance Fans by DGT
 *
 * A zigzag of pivots (a high or low that no bar of the window around it exceeds, the window being twice half the
 * "Depth"; a new leg needs a move larger than "Deviation" times ATR(10) / close, in percent) gives the last leg (or an
 * older one with "Historical Fans"): Start and End. From them, Fibonacci speed resistance fans are drawn from Start,
 * extended to the right:
 * - price levels: lines from Start to the bar of End at End plus (minus) each level of the Start -> End price range,
 *   with a horizontal grid line at that price from Start to End, a label on each side and a light background between
 *   neighbour fan lines;
 * - time levels: lines from Start to the price of End at the bar End minus each level of the Start -> End bar range,
 *   with a vertical grid line, a label at the top and at the bottom, and a light background between neighbour lines.
 * The values of the bar before (Start, End) are used, and the fans are drawn again on every bar. "Reverse Fan Levels"
 * uses 1 - level, "Second Fib Speed Resistance Fan" adds the fans of the opposite direction from the price of End.
 * "Zig Zag" draws the legs of the zigzag.
 *
 * Chart context (optional third argument of calculate): the symbol tick of the prices in the labels
 * (`format.mintick`) and the ticker of the alert messages; without a context the tick is 0.01.
 *
 * Alerts (alert() calls, `alertCalls` of the result, once per bar), on every bar in the original's order:
 * "AutoFibFan: new zigzag" when the end of the last completed leg changed, then for each fan / grid line drawn on
 * the bar (price levels, then time levels) "AutoFibFan: <ticker> crossing <price|time|grid> level <level>" when the
 * line's price at the bar (the line read as extended both ways) is strictly between the close and the previous close.
 *
 * Reference: "Auto Fib Speed Resistance Fans by DGT" by dgtrd
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © dgtrd
 */

import {
  ta, math, str, color, line, label, linefill, table, resetDrawings, setDrawingBar, varDrawing, drawingOutputs,
  type IndicatorResult, type InputConfig, type PlotConfig, type Bar, type Line, type Label, type Linefill,
} from 'oakscriptjs';
import type { AlertCall, LabelData, LineDrawingData, LinefillData, TableData } from '../types';
import { mintickOf, tickerOf, type ChartContext } from '../chart-context';

type LineStyleInput = 'Dashed' | 'Dotted' | 'Solid';
type LabelContent = 'Levels' | 'Prices' | 'Levels (Prices)' | 'None';

/** The 7 levels of each group: key, value, colour */
const LEVELS = [
  ['0', 0, '#787b86'],
  ['0_25', 0.25, '#f57c00'],
  ['0_382', 0.382, '#81c784'],
  ['0_50', 0.5, '#4caf50'],
  ['0_618', 0.618, '#009688'],
  ['0_75', 0.75, '#2196f3'],
  ['1', 1, '#787b86'],
] as const;

type LevelKey = (typeof LEVELS)[number][0];
type LevelInputs = { [K in LevelKey as `pshow_${K}` | `tshow_${K}`]: boolean }
  & { [K in LevelKey as `pvalue_${K}` | `tvalue_${K}`]: number }
  & { [K in LevelKey as `pcolor_${K}` | `tcolor_${K}`]: string }
  & { [K in LevelKey as `pwidth_${K}` | `twidth_${K}`]: number }
  & { [K in LevelKey as `pstyle_${K}` | `tstyle_${K}`]: LineStyleInput };

export interface AutoFibSpeedResistanceFansByDgtInputs extends LevelInputs {
  /** Multiplier of ATR(10) / close, in percent: smallest move that starts a new leg */
  thresholdMultiplier: number;
  depth: number;
  secondFans: boolean;
  histPivot: number;
  reverse: boolean;
  uniColor: boolean;
  uniColor1: string;
  uniColor2: string;
  lSize: 'Small' | 'Normal' | 'Large';
  showGrid: boolean;
  colorGrid: string;
  widthGrid: number;
  styleGrid: LineStyleInput;
  zigZag: boolean;
  zzColor: string;
  zzWidth: number;
  zzStyle: LineStyleInput;
  extendPGrid: boolean;
  pGridColor: boolean;
  lbLeft: LabelContent;
  lbRight: LabelContent;
  priceBg: boolean;
  tpLabel: boolean;
  btLabel: boolean;
  timeBg: boolean;
}

const levelDefaults = Object.fromEntries(LEVELS.flatMap(([k, value, css]) => ['p', 't'].flatMap((g) => [
  [`${g}show_${k}`, true], [`${g}value_${k}`, value], [`${g}color_${k}`, css], [`${g}width_${k}`, 1],
  [`${g}style_${k}`, 'Solid'],
]))) as unknown as LevelInputs;

export const defaultInputs: AutoFibSpeedResistanceFansByDgtInputs = {
  thresholdMultiplier: 3,
  depth: 11,
  secondFans: false,
  histPivot: 0,
  reverse: false,
  uniColor: false,
  uniColor1: '#0ac9f0',
  uniColor2: '#ffa726',
  lSize: 'Normal',
  showGrid: true,
  // #153899ce as an input default: alpha round(0xce / 255, 2) = 0.81
  colorGrid: 'rgba(21, 56, 153, 0.81)',
  widthGrid: 1,
  styleGrid: 'Solid',
  zigZag: false,
  zzColor: '#c77a08',
  zzWidth: 1,
  zzStyle: 'Solid',
  extendPGrid: false,
  pGridColor: false,
  lbLeft: 'Levels (Prices)',
  lbRight: 'Levels',
  priceBg: true,
  tpLabel: true,
  btLabel: true,
  timeBg: true,
  ...levelDefaults,
};

const G_PRICE = 'Price Levels';
const G_TIME = 'Time Levels';
const STYLES = ['Dashed', 'Dotted', 'Solid'];
const LABELS = ['Levels', 'Prices', 'Levels (Prices)', 'None'];
const F = ' ';

const levelInputs = (g: 'p' | 't'): InputConfig[] => LEVELS.flatMap(([k, value, css]): InputConfig[] => {
  const inline = `${g}Level_${k}`;
  const group = g === 'p' ? G_PRICE : G_TIME;
  return [
    { id: `${g}show_${k}`, type: 'bool', title: '', defval: true, inline, group },
    { id: `${g}value_${k}`, type: 'float', title: '', defval: value, step: 0.1, inline, group },
    { id: `${g}color_${k}`, type: 'color', title: '', defval: css, inline, group },
    { id: `${g}width_${k}`, type: 'int', title: '', defval: 1, min: 1, inline, group },
    { id: `${g}style_${k}`, type: 'string', title: '', defval: 'Solid', options: STYLES, inline, group },
  ];
});

export const inputConfig: InputConfig[] = [
  {
    id: 'thresholdMultiplier', type: 'float', title: 'Deviation', defval: 3, min: 0, inline: 'Pivots',
    tooltip: 'Deviation is a multiplier that affects how much the price should deviate from the previous pivot in order for the bar to become a new pivot'
      + '\n\nDepth affects the minimum number of bars that will be taken into account when building',
  },
  { id: 'depth', type: 'int', title: 'Depth', defval: 11, min: 1, inline: 'Pivots' },
  { id: 'secondFans', type: 'bool', title: 'Second Fib Speed Resistance Fan (Experimental Alternative)', defval: false },
  { id: 'histPivot', type: 'int', title: 'Historical Fans', defval: 0, min: 0 },
  { id: 'reverse', type: 'bool', title: 'Reverse Fan Levels', defval: false },
  { id: 'uniColor', type: 'bool', title: 'UniColor', defval: false, inline: 'uni' },
  { id: 'uniColor1', type: 'color', title: 'First | Second Fans', defval: '#0ac9f0', inline: 'uni' },
  { id: 'uniColor2', type: 'color', title: '', defval: '#ffa726', inline: 'uni' },
  { id: 'lSize', type: 'string', title: 'Label Size', defval: 'Normal', options: ['Small', 'Normal', 'Large'] },
  { id: 'showGrid', type: 'bool', title: 'Grid', defval: true, inline: 'grid' },
  { id: 'colorGrid', type: 'color', title: `${F}${F}`, defval: 'rgba(21, 56, 153, 0.81)', inline: 'grid' },
  { id: 'widthGrid', type: 'int', title: '', defval: 1, min: 1, inline: 'grid' },
  { id: 'styleGrid', type: 'string', title: '', defval: 'Solid', options: STYLES, inline: 'grid' },
  { id: 'zigZag', type: 'bool', title: 'Zig Zag', defval: false, inline: 'ZZ' },
  { id: 'zzColor', type: 'color', title: '', defval: '#c77a08', inline: 'ZZ' },
  { id: 'zzWidth', type: 'int', title: '', defval: 1, min: 1, inline: 'ZZ' },
  { id: 'zzStyle', type: 'string', title: '', defval: 'Solid', options: STYLES, inline: 'ZZ' },
  {
    id: 'extendPGrid', type: 'bool', title: `Price Grid Lines${F}: Extend${F}${F}|${F}${F}Apply Level Colors`, defval: false,
    inline: 'EL', group: G_PRICE,
  },
  { id: 'pGridColor', type: 'bool', title: '', defval: false, inline: 'EL', group: G_PRICE },
  { id: 'lbLeft', type: 'string', title: 'Left Labels', defval: 'Levels (Prices)', options: LABELS, inline: 'PD', group: G_PRICE },
  { id: 'lbRight', type: 'string', title: 'Right Labels', defval: 'Levels', options: LABELS, inline: 'PD', group: G_PRICE },
  { id: 'priceBg', type: 'bool', title: 'Background', defval: true, group: G_PRICE },
  { id: 'tpLabel', type: 'bool', title: `Top Labels${F}${F}${F}|${F}${F}${F}Bottom Lables`, defval: true, inline: 'TL', group: G_TIME },
  { id: 'btLabel', type: 'bool', title: '', defval: true, inline: 'TL', group: G_TIME },
  { id: 'timeBg', type: 'bool', title: 'Background', defval: true, group: G_TIME },
  ...levelInputs('p'),
  ...levelInputs('t'),
];

export const plotConfig: PlotConfig[] = [];

export const metadata = {
  title: 'Auto Fib Speed Resistance Fans by DGT',
  shortTitle: 'FibFans ʙʏ DGT ☼☾',
  overlay: true,
};

/** indicator(max_lines_count = 500); labels: the default 50 */
const MAX_LINES = 500;
/** color.teal of this version of the language */
const TEAL = '#00897B';

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;

const styleOf = (s: string): 'solid' | 'dotted' | 'dashed' => (s === 'Solid' ? 'solid' : s === 'Dotted' ? 'dotted' : 'dashed');

/**
 * ta.valuewhen(ta.change(x), x, occurrence): the values of x on the bars where it changed. Both functions keep the
 * history of the values passed to them: x is read at the top of the bar (the value of the end of the bar before),
 * so a change made on a bar is seen on the next bar.
 */
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

/**
 * str.tostring kept per value: the labels are drawn again on every bar with the same few values, and formatting them
 * is most of the run time
 */
function cachedText(format: (v: number) => string): (v: number) => string {
  const texts = new Map<number, string>();
  return (v) => {
    // the map does not tell -0 from 0
    if (Object.is(v, -0)) return format(v);
    let s = texts.get(v);
    if (s === undefined) {
      s = format(v);
      texts.set(v, s);
    }
    return s;
  };
}

export function calculate(
  bars: Bar[],
  inputs: Partial<AutoFibSpeedResistanceFansByDgtInputs> = {},
  chart?: ChartContext,
): Omit<IndicatorResult, 'lines' | 'labels' | 'linefills' | 'tables'> & {
    lines: LineDrawingData[]; labels: LabelData[]; linefills: LinefillData[]; tables: TableData[]; alertCalls: AlertCall[];
  } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const tick = mintickOf(chart);
  const priceText = cachedText((v) => str.tostring(v, 'mintick', tick));
  const levelText = cachedText((v) => str.tostring(v));
  const atr10 = ta.atr(bars, 10).toArray().map((v) => v ?? NaN);
  const lsize = cfg.lSize === 'Normal' ? 'normal' : cfg.lSize === 'Small' ? 'small' : 'large';
  const hist = Math.trunc(cfg.histPivot);
  const ticker = tickerOf(chart);
  const alertCalls: AlertCall[] = [];
  /** Bar being calculated (bar_index) and the previous close (close[1] of f_crossingLevelX) */
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
  const zzStyle = styleOf(cfg.zzStyle);

  const iPrevChanges = changeValues();
  const pPrevChanges = changeValues();
  const iLastChanges = changeValues();
  const pLastChanges = changeValues();

  // var arrays a_lb, a_lnp1, a_lnt1, a_lnp2, a_lnt2, a_lf
  const aLb: Label[] = [];
  const aLnp1: Line[] = [];
  const aLnt1: Line[] = [];
  const aLnp2: Line[] = [];
  const aLnt2: Line[] = [];
  const aLf: Linefill[] = [];
  // `var fibfan` of f_drawLineX: one line per call site (processXLevels call x inner call)
  const varLines = new Map<string, ReturnType<typeof varDrawing<Line>>>();

  const g = cfg as unknown as Record<string, unknown>;
  const levels = (p: 'p' | 't') => LEVELS.map(([k]) => ({
    key: `${p}${k}`,
    show: Boolean(g[`${p}show_${k}`]),
    level: Number(g[`${p}value_${k}`]),
    css: String(g[`${p}color_${k}`]),
    width: Number(g[`${p}width_${k}`]),
    style: String(g[`${p}style_${k}`]),
  }));
  const priceLevels = levels('p');
  const timeLevels = levels('t');

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
        : line.new(iLast, pLast, index, price, 'bar_index', 'none', '#00000000', 'dashed', 1);
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

  // f_drawLineX(): the `var` line of the call site, moved on every bar, and a new copy for the fills
  const drawLineX = (site: string, x1: number, y1: number, x2: number, y2: number, c: string, w: number, style: string,
    extend: boolean, level: number, ptl: 'price' | 'time' | 'grid', was: 'first' | 'second' | 'grid') => {
    const st = styleOf(style);
    const ext = extend ? 'right' : 'none';
    let v = varLines.get(site);
    if (!v) {
      v = varDrawing<Line>();
      v.value = line.new(x1, y1, x2, y2, 'bar_index', ext, c, st, w);
      varLines.set(site, v);
    }
    line.set_xy1(v.value!, x1, y1);
    line.set_xy2(v.value!, x2, y2);
    // if f_crossingLevelX(close, line.get_price(fibfan, bar_index)): r > close and r < close[1] or r < close and r > close[1]
    const r = line.get_price(v.value!, barIdx);
    const c0 = bars[barIdx].close;
    const c1 = barIdx > 0 ? bars[barIdx - 1].close : NaN;
    if ((gt(r, c0) && lt(r, c1)) || (lt(r, c0) && gt(r, c1))) {
      alertCalls.push({
        time: bars[barIdx].time, message: 'AutoFibFan: ' + ticker + ' crossing ' + ptl + ' level ' + levelText(level),
        freq: 'once_per_bar',
      });
    }
    if (ptl === 'grid') return;
    const copy = line.new(x1, y1, x2, y2, 'bar_index', ext, c, st, w);
    if (ptl === 'price') (was === 'first' ? aLnp1 : aLnp2).push(copy);
    else (was === 'first' ? aLnt1 : aLnt2).push(copy);
  };

  // f_drawLabelX()
  const levelLabelText = (content: LabelContent, lb: number, y: number) => (content === 'Levels' ? levelText(lb)
    : content === 'Prices' ? priceText(y) : levelText(lb) + ' (' + priceText(y) + ')');
  const drawLabelX = (x1: number, y1: number, x2: number, y2: number, c: string, lb: number, st: boolean) => {
    if (st) {
      if (cfg.lbRight !== 'None') {
        aLb.push(label.new(x2, y2, levelLabelText(cfg.lbRight, lb, y2), 'bar_index', 'price', '#00000000',
          cfg.extendPGrid ? 'label_lower_left' : 'label_left', c, lsize, undefined, priceText(y2)));
      }
      if (cfg.lbLeft !== 'None') {
        aLb.push(label.new(x1, y2, levelLabelText(cfg.lbLeft, lb, y2), 'bar_index', 'price', '#00000000',
          'label_right', c, lsize, undefined, priceText(y2)));
      }
    } else {
      if (cfg.tpLabel) {
        aLb.push(label.new(x1, Math.max(y1, y2), levelText(lb), 'bar_index', 'price', '#00000000', 'label_down', c, lsize));
      }
      if (cfg.btLabel) {
        aLb.push(label.new(x1, Math.min(y1, y2), levelText(lb), 'bar_index', 'price', '#00000000', 'label_up', c, lsize));
      }
    }
  };
  const fill = (arr: Line[], on: boolean, css: string) => {
    const size = arr.length;
    if (size > 1 && on) aLf.push(linefill.new(arr[size - 2], arr[size - 1], String(color.new(css, 89))));
  };

  let logo: ReturnType<typeof table.new> | undefined;
  try {
    for (let i = 0; i < n; i++) {
      setDrawingBar(i, i === n - 1);
      barIdx = i;
      const iLastPivotBefore = iLastPivot;
      // iStartM / pStartM / iEndM / pEndM: read before the pivots of this bar
      iPrevChanges.update(iPrevPivot);
      pPrevChanges.update(pPrevPivot);
      iLastChanges.update(iLastPivot);
      pLastChanges.update(pLastPivot);
      const zz = lineLast.value;
      const iStartM = hist > 0 ? iPrevChanges.get(hist - 1) : iLastPivot;
      const pStartM = hist > 0 ? pPrevChanges.get(hist - 1) : pLastPivot;
      const iEndM = hist > 0 ? iLastChanges.get(hist - 1) : zz ? line.get_x2(zz) : NaN;
      const pEndM = hist > 0 ? pLastChanges.get(hist - 1) : zz ? line.get_y2(zz) : NaN;
      const iPvtDiff = Math.abs(iStartM - iEndM);
      const pPvtDiff = Math.abs(pStartM - pEndM);

      // ta.change(time): false on the first bar
      if (i > 0) {
        for (const arr of [aLb]) while (arr.length > 0) label.delete(arr.shift()!);
        for (const arr of [aLnp1, aLnt1, aLnp2, aLnt2]) while (arr.length > 0) line.delete(arr.shift()!);
        while (aLf.length > 0) linefill.delete(aLf.shift()!);
      }

      const [iH, pH] = pivotAt(i, true);
      if (!isNaN(iH)) {
        swing(i, true, iH, pH);
      } else {
        const [iL, pL] = pivotAt(i, false);
        if (!isNaN(iL)) swing(i, false, iL, pL);
      }
      // if ta.change(iLastPivot): alert("AutoFibFan: new zigzag") (na on the first bar or next to an na value)
      if (i > 0 && !isNaN(iLastPivot) && !isNaN(iLastPivotBefore) && iLastPivot !== iLastPivotBefore) {
        alertCalls.push({ time: bars[i].time, message: 'AutoFibFan: new zigzag', freq: 'once_per_bar' });
      }

      const xEnd = math.round(iEndM);
      // processPriceLevels(show, level, colorL, widthL, styleL)
      for (const { key, show, level, css, width, style } of priceLevels) {
        const lv = cfg.reverse ? 1 - level : level;
        const pEndY = gt(pStartM, pEndM) ? pEndM + pPvtDiff * lv : pEndM - pPvtDiff * lv;
        const pEndY2 = gt(pStartM, pEndM) ? pStartM - pPvtDiff * lv : pStartM + pPvtDiff * lv;
        if (!show) continue;
        const c1 = cfg.uniColor ? cfg.uniColor1 : css;
        drawLineX(`${key}:first`, iStartM, pStartM, xEnd, pEndY, c1, width, style, true, level, 'price', 'first');
        fill(aLnp1, cfg.priceBg, css);
        if (cfg.secondFans) {
          drawLineX(`${key}:second`, iStartM, pEndM, xEnd, pEndY2, cfg.uniColor ? cfg.uniColor2 : css, width, style, true,
            level, 'price', 'second');
          fill(aLnp2, cfg.priceBg, css);
        }
        if (cfg.showGrid || cfg.extendPGrid) {
          drawLineX(`${key}:grid`, iStartM, pEndY, xEnd, pEndY, cfg.uniColor ? cfg.uniColor1 : cfg.pGridColor ? css : cfg.colorGrid,
            cfg.widthGrid, cfg.styleGrid, cfg.extendPGrid, level, 'grid', 'grid');
        }
        drawLabelX(iStartM, pStartM, xEnd, pEndY, c1, level, true);
      }
      // processTimeLevels(show, level, colorL, widthL, styleL)
      for (const { key, show, level, css, width, style } of timeLevels) {
        const lv = cfg.reverse ? 1 - level : level;
        const xEndX = math.round(iEndM - iPvtDiff * lv);
        if (!show) continue;
        const c1 = cfg.uniColor ? cfg.uniColor1 : css;
        drawLineX(`${key}:first`, iStartM, pStartM, xEndX, pEndM, c1, width, style, true, level, 'time', 'first');
        fill(aLnt1, cfg.timeBg, css);
        if (cfg.secondFans) {
          drawLineX(`${key}:second`, iStartM, pEndM, xEndX, pStartM, cfg.uniColor ? cfg.uniColor2 : css, width, style, true,
            level, 'time', 'second');
          fill(aLnt2, cfg.timeBg, css);
        }
        if (cfg.showGrid) {
          drawLineX(`${key}:grid`, xEndX, pStartM, xEndX, pEndM, cfg.uniColor ? cfg.uniColor1 : cfg.colorGrid, cfg.widthGrid,
            cfg.styleGrid, false, level, 'grid', 'grid');
        }
        drawLabelX(xEndX, pStartM, xEndX, pEndM, c1, level, false);
      }

      // var table logo = table.new(position.bottom_right, 1, 1); the cell is set on every bar
      if (i === 0) logo = table.new('bottom_right', 1, 1);
      if (logo) table.cell(logo, 0, 0, '☼☾  ', undefined, undefined, TEAL, undefined, undefined, 'normal');

    }
  } finally {
    setDrawingBar(null);
  }
  const drawn = drawingOutputs(bars);
  resetDrawings();

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    lines: drawn.lines ?? [],
    labels: drawn.labels ?? [],
    linefills: drawn.linefills ?? [],
    tables: drawn.tables ?? [],
    alertCalls,
  };
}

export const hasAlertFunction = true;

export const AutoFibSpeedResistanceFansByDgt = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  hasAlertFunction,
};
