/**
 * Delta Ladder
 *
 * Splits each of the last chart bars into rows ("Divide Bars Into How Many Rows ?", from the low to the high) and
 * builds a volume delta per row from the bars of a lower timeframe ("Lower TF For Delta Calculation"): a lower bar
 * whose close is above the close before it is buying volume, below it selling volume. A lower bar that covers some
 * row starts gives its volume in equal parts to them; a lower bar strictly between two row starts gives all its
 * volume to the lower row, and one above the last row start to the last row. "Use Volume Assumption" moves 40 % of a
 * one-sided row to the other side.
 *
 * On the last bar the ladder of the last round(500 / rows) bars is drawn next to small candles of the same bars
 * ("Classic"), inside them ("On Bar") or as a single column ("Pure Ladder"): one box per row with the delta as text,
 * a colour gradient by the size of the delta in its bar, the row with the largest delta of the bar framed with the
 * "POC" colour, and one label per bar with the total delta and the date (and the time on intraday charts). The script
 * calculates only the last 1000 bars of the chart. "Black Background" draws a black background 20 bars to the right.
 *
 * Lower timeframe bars: the bars of the chart symbol on the lower timeframe come from the chart context
 * (`requiredSymbols`, `bars` accessor); without them the port throws a MissingSymbolDataError. A lower timeframe
 * equal to the chart timeframe uses the chart bars. The box borders use the chart background colour (chart context).
 *
 * Reference: "Delta Ladder [Kioseff Trading]" by KioseffTrading
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © KioseffTrading
 */

import {
  str, color, matrix, timeframe, time as pineTime, box, label, line, resetDrawings, setDrawingBar, drawingOutputs,
  type Bar, type IndicatorResult, type InputConfig, type PlotConfig, type BarColorConfig, type Box, type Label, type Line,
} from 'oakscriptjs';
import type { BgColorData, BoxData, LabelData, LineDrawingData } from '../types';
import {
  backgroundColorOf, symbolBarsOf, tickeridOf, timezoneOf, type ChartContext, type SymbolRequest,
} from '../chart-context';
import { chartTimeframe } from '../anchor-period';
import { securityLowerTf, otherSymbolChart } from '../other-symbol';
import { barInterval, barTime } from '../bar-time';
import type { StudyDrawingKind } from '../style-outputs';

type TextSize = 'Auto' | 'Tiny' | 'Small' | 'Normal' | 'Large' | 'Huge';

export interface DeltaLadderInputs {
  /** Data Display Method */
  classix: 'Classic' | 'Pure Ladder' | 'On Bar';
  /** Lower TF For Delta Calculation */
  userTF: string;
  /** Divide Bars Into How Many Rows ? */
  barDiv: number;
  showDelt: boolean;
  /** Delta Total Above Bar */
  total: boolean;
  boxMerge: boolean;
  /** Hide Total Delta Labels */
  hide: boolean;
  /** Use Volume Assumption */
  assume: boolean;
  /** Last Bar Calculation Only */
  lastBar: boolean;
  /** Black Background */
  blackBox: boolean;
  textSize: TextSize;
  textSize2: TextSize;
  fnt: 'Default' | 'Monospace';
  c: string;
  c1: string;
  c2: string;
  c3: string;
  c4: string;
}

export const defaultInputs: DeltaLadderInputs = {
  classix: 'Classic',
  userTF: '1',
  barDiv: 10,
  showDelt: true,
  total: false,
  boxMerge: false,
  hide: false,
  assume: false,
  lastBar: false,
  blackBox: false,
  textSize: 'Auto',
  textSize2: 'Tiny',
  fnt: 'Default',
  c: '#26c6da',
  c1: '#FF5252',
  c2: 'rgba(148, 139, 57, 1)',
  c3: '#26c6da',
  c4: '#FF5252',
};

const SIZES: TextSize[] = ['Auto', 'Tiny', 'Small', 'Normal', 'Large', 'Huge'];
const ASSUME_TIP = 'When This Setting Is Selected, the Script Will Not Record “0” Buy Volume or “0” Sell Volume at a '
  + 'Level Where Green Bars \n                                         Formed and No Red Bars Formed, or Where Only Red '
  + 'Bars Formed and No Green Bars Formed. If a Level Were Recorded With All “Buy Volume” - \n                          '
  + '               The Script Will Assume 40% Of the Buy Volume Was Sell Volume. Vice Versa for a Level Where Only '
  + '“Sell Volume” Was Recorded \n                                         - The Script Will Assume 40% Of the “Sell '
  + 'Volume” Was “Buy Volume”. This Assumption May or May Not Help the Indicator \n                                    '
  + '     Better Replicate Volume Delta Indicators on Other Charting Platforms. \n                                      '
  + '   If You Do Not Want to Adhere to This Assumption - Simply Deselect This Setting';

export const inputConfig: InputConfig[] = [
  { id: 'classix', type: 'string', title: 'Data Display Method', defval: 'Classic', options: ['Classic', 'Pure Ladder', 'On Bar'] },
  { id: 'userTF', type: 'timeframe', title: 'Lower TF For Delta Calculation', defval: '1' },
  { id: 'barDiv', type: 'int', title: 'Divide Bars Into How Many Rows ?', defval: 10, min: 4, max: 499, group: 'Rows Per Bar' },
  { id: 'showDelt', type: 'bool', title: 'Show Delta Values', defval: true, group: 'Aesthetics 1', inline: '1' },
  { id: 'total', type: 'bool', title: 'Delta Total Above Bar', defval: false, group: 'Aesthetics 1', inline: '1' },
  { id: 'boxMerge', type: 'bool', title: 'Merge Delta Boxes', defval: false, group: 'Aesthetics 1', inline: '2' },
  { id: 'hide', type: 'bool', title: 'Hide Total Delta Labels', defval: false, group: 'Aesthetics 1', inline: '2' },
  { id: 'assume', type: 'bool', title: 'Use Volume Assumption', defval: false, group: 'Volume Assumption', tooltip: ASSUME_TIP },
  { id: 'lastBar', type: 'bool', title: 'Last Bar Calculation Only', defval: false, group: 'Calculate on Last Bar Only' },
  { id: 'blackBox', type: 'bool', title: 'Black Background', defval: false, group: 'Aesthetics 2 ' },
  { id: 'textSize', type: 'string', title: 'Delta Box Text Size', defval: 'Auto', options: SIZES, group: 'Aesthetics 2 ' },
  { id: 'textSize2', type: 'string', title: 'Total Delta Text Size', defval: 'Tiny', options: SIZES, group: 'Aesthetics 2 ' },
  { id: 'fnt', type: 'string', title: 'Font Type', defval: 'Default', options: ['Default', 'Monospace'], group: 'Aesthetics 2 ' },
  { id: 'c', type: 'color', title: 'Delta "Up" Color', defval: '#26c6da', group: 'Colors', inline: '2' },
  { id: 'c1', type: 'color', title: 'Delta "Down" Color', defval: '#FF5252', group: 'Colors', inline: '3' },
  { id: 'c2', type: 'color', title: 'General "POC" Color', defval: 'rgba(148, 139, 57, 1)', group: 'Colors', inline: '3' },
  { id: 'c3', type: 'color', title: 'Candle "Up" Color', defval: '#26c6da', group: 'Colors', inline: '2' },
  { id: 'c4', type: 'color', title: 'Candle "Down" Color', defval: '#FF5252', group: 'Colors', inline: '4' },
];

export const plotConfig: PlotConfig[] = [];

export const barColorConfig: BarColorConfig[] = [{ id: 'bgcolor0', kind: 'bgcolor', title: 'Background Color' }];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'box'];

export const metadata = {
  title: 'Delta Ladder [Kioseff Trading]',
  shortTitle: 'Delta Ladder [Kioseff Trading]',
  overlay: true,
};

/** indicator(max_labels_count = 500, max_boxes_count = 500, max_lines_count = 500) */
const MAX_OBJECTS = 500;
/** indicator(calc_bars_count = 1000): only the last 1000 bars are calculated */
const CALC_BARS = 1000;
/** bgcolor(..., offset = 20) */
const BG_OFFSET = 20;

/** Pine float comparisons: a > b only when a - b > 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);
const eq = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) <= EPS;
const ne = (a: number, b: number) => !isNaN(a) && !isNaN(b) && Math.abs(a - b) > EPS;

/** Pine `for i = a to b`: counts down when a > b */
function pineRange(a: number, b: number): number[] {
  const out: number[] = [];
  if (isNaN(a) || isNaN(b)) return out;
  if (a <= b) for (let i = a; i <= b; i++) out.push(i);
  else for (let i = a; i >= b; i--) out.push(i);
  return out;
}

/** The lower timeframe differs from the chart timeframe: its bars come from the context */
function lowerTimeframeRequested(ltf: string, chartTf: string): boolean {
  return ltf !== '' && timeframe.in_seconds(ltf) !== timeframe.in_seconds(chartTf);
}

/** Bars the indicator needs: the chart symbol on "Lower TF For Delta Calculation" (none when it is the chart timeframe). */
export function requiredSymbols(inputs: Partial<DeltaLadderInputs> = {}, chart?: ChartContext): SymbolRequest[] {
  const cfg = { ...defaultInputs, ...inputs };
  const tf = chartTimeframe([], chart);
  if (tf === '' || !lowerTimeframeRequested(cfg.userTF, tf)) return [];
  return [{ symbol: tickeridOf(chart), timeframe: cfg.userTF }];
}

const sizeOf = (s: TextSize) => s.toLowerCase() as 'auto' | 'tiny' | 'small' | 'normal' | 'large' | 'huge';

export function calculate(
  bars: Bar[],
  inputs: Partial<DeltaLadderInputs> = {},
  chart?: ChartContext,
): IndicatorResult & { boxes: BoxData[]; labels: LabelData[]; lines: LineDrawingData[]; bgColors: BgColorData[] } {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const barDiv = Math.trunc(cfg.barDiv);
  const { c, c1, c2, c3, c4 } = cfg;
  const classix = cfg.classix;
  const fonT = cfg.fnt === 'Monospace' ? 'monospace' : 'default';
  const sz = sizeOf(cfg.textSize);
  const sz2 = sizeOf(cfg.textSize2);
  const bg = backgroundColorOf(chart);
  const tz = timezoneOf(chart);
  const interval = barInterval(bars);
  const toMs = chart?.timeUnit === 'ms' || (n > 0 && bars[0].time >= 1e12) ? 1 : 1000;
  const start = Math.max(0, n - CALC_BARS);

  const empty = {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {}, boxes: [] as BoxData[], labels: [] as LabelData[], lines: [] as LineDrawingData[], bgColors: [] as BgColorData[],
  };
  if (n === 0) return empty;

  // bgcolor(blackBox ? #000000 : na, offset = 20) on the calculated bars
  const bgColors: BgColorData[] = [];
  if (cfg.blackBox) {
    for (let i = start; i < n; i++) bgColors.push({ id: 'bgcolor0', time: barTime(bars, i + BG_OFFSET, interval), color: '#000000' });
  }

  // ---- request.security_lower_tf(syminfo.tickerid, userTF, [close, close[1], volume, high, low, ...])
  const chartTf = chartTimeframe(bars, chart) || '1D';
  if (cfg.userTF !== '' && timeframe.in_seconds(cfg.userTF) > timeframe.in_seconds(chartTf)) {
    throw new Error(`The lower timeframe "${cfg.userTF}" is above the chart timeframe "${chartTf}"`);
  }
  let ltfBars: Bar[];
  let range: (i: number) => [number, number];
  if (lowerTimeframeRequested(cfg.userTF, chartTf)) {
    [ltfBars] = symbolBarsOf([{ symbol: tickeridOf(chart), timeframe: cfg.userTF }], chart);
    const ranges = securityLowerTf(bars, ltfBars, cfg.userTF, otherSymbolChart(bars, chart),
      { other: { timezone: chart?.timezone, session: chart?.session } });
    range = (i) => ranges[i];
  } else {
    ltfBars = bars;
    range = (i) => [i, i + 1];
  }

  resetDrawings({ line: MAX_OBJECTS, box: MAX_OBJECTS, label: MAX_OBJECTS });
  const last = n - 1;
  const R = Math.round(500 / barDiv);
  let firstBar = Math.round(1e8);
  // var matrixPlace / matrixLevels: one row per bar with lower timeframe bars
  const matrixPlace: number[][] = [];
  const matrixLevels: number[][] = [];
  const hi = (k: number) => (last - k >= 0 ? bars[last - k].high : NaN);
  const lo = (k: number) => (last - k >= 0 ? bars[last - k].low : NaN);
  const op = (k: number) => (last - k >= 0 ? bars[last - k].open : NaN);
  const cl = (k: number) => (last - k >= 0 ? bars[last - k].close : NaN);

  for (let i = start; i < n; i++) {
    setDrawingBar(i, i === last);
    const b = bars[i];
    const [from, to] = range(i);
    const size = to - from;
    if (i === last - R && last - i <= R) firstBar = i;
    const div = (b.high - b.low) / barDiv;
    const levelsCount: number[] = [];
    const lettersBoxClassic: Box[] = [];
    if (size > 0 && i >= firstBar) {
      for (let x = 0; x <= barDiv - 1; x++) levelsCount.push(b.low + x * div);
      levelsCount.sort((p, q) => p - q);
      for (const lv of levelsCount) {
        lettersBoxClassic.push(box.new(i, lv + div, i + 1, lv, 'transparent', 1, 'solid', 'none', 'bar_index',
          String(color.new(color.white, 100)), '', sz, cfg.showDelt ? color.white : '#ffffff00', 'center', undefined,
          undefined, fonT));
      }
    }
    const L = levelsCount.length;
    const volCount: number[][] = Array.from({ length: L }, () => [0, 0]);
    if (L > 1) {
      // m = close, m1 = close[1], m2 = volume, m3 = high, m4 = low of the lower timeframe bars
      const sign = (k: number) => {
        const prev = k > 0 ? ltfBars[k - 1].close : NaN;
        return Math.sign(ltfBars[k].close - prev);
      };
      const boxTrack2 = new Array<number>(size).fill(0);
      for (let nx = 0; nx < size; nx++) {
        const lb = ltfBars[from + nx];
        for (let x = 0; x < L; x++) {
          if (le(levelsCount[x], lb.high) && ge(levelsCount[x], lb.low)) boxTrack2[nx] += 1;
        }
      }
      if (boxTrack2.reduce((s, v) => s + v, 0) > 0) {
        for (let x = 0; x < L; x++) {
          for (let nx = 0; nx < size; nx++) {
            const lb = ltfBars[from + nx];
            if (boxTrack2[nx] !== 0 && le(levelsCount[x], lb.high) && ge(levelsCount[x], lb.low)) {
              const s = sign(from + nx);
              if (s === 1) volCount[x][0] += (lb.volume ?? NaN) / boxTrack2[nx];
              else if (s === -1) volCount[x][1] += (lb.volume ?? NaN) / boxTrack2[nx];
            }
          }
        }
      }
      for (let r = 1; r < L; r++) {
        for (let x = 0; x < size; x++) {
          const lb = ltfBars[from + x];
          if (lt(lb.high, levelsCount[r]) && gt(lb.low, levelsCount[r - 1])) {
            const s = sign(from + x);
            if (s === 1) volCount[r - 1][0] += lb.volume ?? NaN;
            else if (s === -1) volCount[r - 1][1] += lb.volume ?? NaN;
          }
        }
      }
      for (let x = 0; x < size; x++) {
        const lb = ltfBars[from + x];
        if (gt(lb.low, levelsCount[L - 1])) {
          const s = sign(from + x);
          if (s === 1) volCount[L - 1][0] += lb.volume ?? NaN;
          else if (s === -1) volCount[L - 1][1] += lb.volume ?? NaN;
        }
      }
    }
    if (lettersBoxClassic.length > 1 && cfg.assume) {
      for (let r = 0; r < lettersBoxClassic.length; r++) {
        const [up, dn] = volCount[r];
        if (eq(up, 0) && gt(dn, 0)) {
          volCount[r] = [dn * 0.4, dn * 0.6];
        } else if (gt(up, 0) && eq(dn, 0)) {
          volCount[r] = [up * 0.6, up * 0.4];
        }
      }
    }
    if (L > 0) {
      const place = new Array<number>(barDiv).fill(NaN);
      const lvls = new Array<number>(barDiv).fill(NaN);
      for (let r = 0; r < L; r++) {
        place[r] = volCount[r][0] - volCount[r][1];
        lvls[r] = levelsCount[r];
      }
      matrixPlace.push(place);
      matrixLevels.push(lvls);
    }
    for (const bx of lettersBoxClassic) box.delete(bx);

    if (i !== last) continue;
    // ---- barstate.islast
    if (cfg.lastBar) for (const bx of box.all()) box.delete(bx);
    const pure = classix === 'Pure Ladder';
    const n1 = pure ? 1 : 13;
    const n2 = pure ? 1 : 5;
    const nLevel: number[] = [pure ? i : i + n1];
    const nLevel2: number[] = [pure ? i : i + n2, i - n2];
    nLevel.push(i - n1);
    for (const k of pineRange(2, R)) {
      nLevel.push(nLevel[k - 1] - n1);
      nLevel2.push(nLevel[k - 1] - n2);
    }
    const rowsPlace = matrixPlace.length;
    const matrixFin: number[][] = [];
    const matrixLevelsFin: number[][] = [];
    for (const k of pineRange(Math.max(rowsPlace - 1, 0), Math.max(rowsPlace - R, 0))) {
      if (k >= rowsPlace) throw new Error(`Error on bar ${i}: Row index ${k} is out of bounds, the number of rows is ${rowsPlace}.`);
      matrixFin.push([...matrixPlace[k]]);
      matrixLevelsFin.push([...matrixLevels[k]]);
    }
    const rows = matrixFin.length;
    const finBox: Box[] = [];
    const finBoxFloat: number[] = [];
    const finBoxFloat2 = new Array<number>(rows).fill(0);
    const MAX = matrix.new_matrix<number>(rows, barDiv, NaN);
    const MIN = matrix.new_matrix<number>(rows, barDiv, NaN);
    for (let r = rows - 1; r >= 0; r--) {
      for (let x = barDiv - 1; x >= 0; x--) {
        const v = matrixFin[r][x];
        const s = Math.sign(v);
        let txt = '';
        if (s === 0 || s === 1) {
          txt = '+';
          matrix.set(MAX, r, x, v);
        } else {
          matrix.set(MIN, r, x, v);
        }
        const calc = (hi(r) - lo(r)) / barDiv;
        const x3 = ge(v, 0);
        let x1 = 0;
        let x2 = 0;
        if (classix === 'Classic') {
          if (r === 0) {
            x1 = x3 ? 4 : 2; x2 = x3 ? 10 : 8;
          } else {
            x1 = x3 ? 10 : 8; x2 = x3 ? 4 : 2;
          }
        } else if (classix === 'On Bar') {
          if (r === 0) {
            x1 = x3 ? 0 : -5; x2 = x3 ? 5 : 0;
          } else {
            x1 = x3 ? 5 : 0; x2 = x3 ? 0 : -5;
          }
        } else {
          x1 = 0; x2 = 1;
        }
        finBox.push(box.new(nLevel[r] + x1, matrixLevelsFin[r][x] + calc, nLevel2[r] + x2, matrixLevelsFin[r][x],
          cfg.boxMerge ? 'transparent' : bg, 1, 'solid', 'none', 'bar_index', '#FFEB3B',
          txt + str.tostring(v, '###,###.00'), sz, cfg.showDelt ? color.white : '#ffffff00'));
        finBoxFloat.push(v);
        finBoxFloat2[r] = finBoxFloat2[r] + v;
      }
    }
    let x7 = Math.round(1e8);
    const value: number[][] = [];
    const nz = (v: number) => (isNaN(v) ? 0 : v);
    for (let r = rows - 1; r >= 0; r--) {
      const subUp = matrix.submatrix(MAX, r, r + 1, 0, barDiv);
      const subDn = matrix.submatrix(MIN, r, r + 1, 0, barDiv);
      const row = [nz(matrix.max(subUp)), nz(matrix.min(subUp)), nz(matrix.min(subDn)), nz(matrix.max(subDn))];
      for (let x = 0; x < barDiv; x++) {
        value.push(row);
        x7 = Math.round(Math.min(x7, matrixLevelsFin[r][x] * 0.995));
      }
    }
    let iTrack = 0;
    for (let k = 0; k < finBox.length; k++) {
      const v = finBoxFloat[k];
      const [v0, v1, v2, v3] = value[k];
      if (ge(v, 0)) {
        box.set_bgcolor(finBox[k], ne(v0, v1)
          ? color.from_gradient(v, v1, v0, color.new(c, 90), color.new(c, 10)) : String(color.new(c, 10)));
        if (ge(v0, Math.abs(v2)) && ne(iTrack, v) && eq(v, v0)) {
          box.set_border_color(finBox[k], c2);
          iTrack = v;
        }
      } else {
        box.set_bgcolor(finBox[k], ne(v2, v3)
          ? color.from_gradient(v, v2, v3, color.new(c1, 10), color.new(c1, 90)) : String(color.new(c1, 10)));
        if (ge(Math.abs(v2), v0) && ne(iTrack, v) && eq(v, v2)) {
          box.set_border_color(finBox[k], c2);
          iTrack = v;
        }
      }
    }
    const finalBox: Label[] = [];
    if (!cfg.hide) {
      const intraday = timeframe.info(chartTf).isintraday;
      const tNow = b.time * toMs;
      for (let r = rows - 1; r >= 0; r--) {
        const tr = last - r >= 0 ? bars[last - r].time * toMs : NaN;
        const preemptive = intraday
          ? ` ${str.tostring(pineTime.hour(tr, tz))}:${str.tostring(pineTime.minute(tr, tz))}` : '';
        const s = Math.sign(finBoxFloat2[r]);
        const plus = s === 0 || s === 1;
        finalBox.push(label.new(nLevel[r], !cfg.total ? x7 : hi(r) * 1.005,
          `                            ${plus ? '+' : ''}${str.tostring(finBoxFloat2[r], '###,###.00')}`
          + `\n                          (${str.tostring(pineTime.month(tNow, tz))}/${str.tostring(pineTime.dayofmonth(tNow, tz))})`
          + preemptive,
          'bar_index', 'price', '#ffffff00', 'label_center', plus ? c : c1, sz2, 'center', undefined, fonT));
      }
    }
    const priceBox: Box[] = [];
    const priceLine: Array<[Line | null, Line | null]> = Array.from({ length: R }, () => [null, null]);
    if (!pure) {
      const candleBox = (left: number, top: number, right: number, bottom: number, up: boolean) => box.new(left, top,
        right, bottom, up ? c3 : c4, 2, 'solid', 'none', 'bar_index', String(color.new(up ? c3 : c4, 97)));
      priceBox.push(candleBox(i + 5, Math.max(cl(0), op(0)), i + 13, Math.min(cl(0), op(0)), gt(cl(0), op(0))));
      priceBox.push(candleBox(i - 13, Math.max(cl(1), op(1)), i - 5, Math.min(cl(1), op(1)), gt(cl(1), op(1))));
      for (const k of pineRange(2, R)) {
        const left = box.get_left(priceBox[k - 1]);
        priceBox.push(candleBox(left - 13, cl(k), left - 5, op(k), gt(cl(k), op(k))));
      }
      for (let k = 0; k < R; k++) {
        const x = Math.round((box.get_left(priceBox[k]) + box.get_right(priceBox[k])) / 2);
        const col = gt(cl(k), op(k)) ? c3 : c4;
        priceLine[k] = [
          line.new(x, hi(k), x, Math.max(op(k), cl(k)), 'bar_index', 'none', col, 'solid', 2),
          line.new(x, lo(k), x, Math.min(op(k), cl(k)), 'bar_index', 'none', col, 'solid', 2),
        ];
      }
    }
    if (cfg.lastBar) {
      if (finBox.length > barDiv) for (const bx of finBox.splice(0, finBox.length - barDiv)) box.delete(bx);
      if (priceBox.length > 1) for (const bx of priceBox.splice(1)) box.delete(bx);
      for (let k = 1; k < priceLine.length; k++) {
        for (const ln of priceLine[k]) if (ln) line.delete(ln);
      }
      if (finalBox.length > 1) for (const lb of finalBox.splice(0, finalBox.length - 1)) label.delete(lb);
      if (pure) {
        for (const bx of finBox) {
          box.set_left(bx, i + 1);
          box.set_left(bx, i + 2);
        }
      }
    }
  }
  setDrawingBar(null);
  const drawn = drawingOutputs(bars, toMs === 1 ? 'ms' : 's');
  resetDrawings();
  return {
    ...empty,
    boxes: drawn.boxes ?? [],
    labels: drawn.labels ?? [],
    lines: drawn.lines ?? [],
    bgColors,
  };
}

export const DeltaLadder = {
  calculate, metadata, defaultInputs, inputConfig, plotConfig, barColorConfig, drawingKinds, requiredSymbols,
};
