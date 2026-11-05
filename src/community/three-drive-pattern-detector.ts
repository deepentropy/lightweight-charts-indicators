/**
 * Three Drive Pattern Detector [LuxAlgo]
 *
 * One zigzag per swing length, from Minimum Swing Length to Maximum Swing Length - 1 (pivots with that many bars on
 * the left and 1 bar on the right; a new pivot of the same direction that goes further replaces the last point). On
 * every bar each zigzag tests its last six points Y, Z, A, B, C, D for a three-drive pattern: B and D extend the moves
 * Y-Z and A-B by Extension (1.272 to 1.618 by default), A and C retrace them by Retracement (0.618 to 0.786), and the
 * durations of the retracements and of the extensions differ by at most Width Margin percent.
 *
 * A new pattern (another C / D than the patterns drawn) is drawn as a polyline through the six points (more
 * transparent for each further pattern found on the same bar), four dashed lines Y-A, Z-B, A-C, B-D and four labels with
 * the measured ratios (tooltips: the ratio range); optional boxes show the ratio range at each point ("Show Ratios").
 * A pattern with the same C as a drawn one replaces it: the old drawing is deleted and a dashed line joins C to the new
 * D. At most 100 patterns are kept. The dashboard shows the time of the last pattern found.
 *
 * As the original (`calc_bars_count = 10000`), the port calculates on the last 10,000 bars only. The first of them gets
 * a vertical line (extend both), as in the original.
 *
 * Chart context: symbol tick (`mintickOf`), exchange time zone of the dashboard time (`timezoneOf`), dashboard text
 * colour `chart.fg_color` (`foregroundColorOf`).
 *
 * Reference: "Three Drive Pattern Detector [LuxAlgo]" by LuxAlgo
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © LuxAlgo
 */

import {
  color, str, math, label, line, box, polyline, table, chartPoint, resetDrawings, setDrawingBar,
  drawingOutputs,
  type Bar, type Box, type ChartPoint, type IndicatorResult, type InputConfig, type Label, type Line, type PlotConfig,
  type Polyline,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { foregroundColorOf, mintickOf, timezoneOf, type ChartContext } from '../chart-context';

export interface ThreeDrivePatternDetectorInputs {
  stt: number;
  /** Maximum Swing Length (at least Minimum Swing Length + 1) */
  num: number;
  retL: number;
  retH: number;
  extL: number;
  extH: number;
  widthPerc: number;
  colBl: string;
  colBr: string;
  textSize: 'Tiny' | 'Small' | 'Normal';
  showRatios: 'None' | 'Ratios' | 'Ratios With Margin';
  showDash: boolean;
  tablePosition: 'Top Right' | 'Bottom Right' | 'Bottom Left';
  tableSize: 'Tiny' | 'Small' | 'Normal';
}

export const defaultInputs: ThreeDrivePatternDetectorInputs = {
  stt: 3,
  num: 100,
  retL: 0.618,
  retH: 0.786,
  extL: 1.272,
  extH: 1.618,
  widthPerc: 100,
  colBl: '#089981',
  colBr: '#f23645',
  textSize: 'Small',
  showRatios: 'None',
  showDash: true,
  tablePosition: 'Top Right',
  tableSize: 'Small',
};

const NB = ' ';
const SIZES = ['Tiny', 'Small', 'Normal'];

export const inputConfig: InputConfig[] = [
  { id: 'stt', type: 'int', title: 'Minimum Swing Length' + NB.repeat(14), defval: 3, min: 1, max: 99, inline: '1' },
  { id: 'num', type: 'int', title: 'Maximum Swing Length' + NB.repeat(13), defval: 100, min: 2, max: 100, inline: '2' },
  { id: 'retL', type: 'float', title: 'Retracement', defval: 0.618, step: 0.002, min: 0.5, max: 0.618, inline: 'r' },
  { id: 'retH', type: 'float', title: '-', defval: 0.786, step: 0.002, min: 0.786, max: 0.9, inline: 'r' },
  { id: 'extL', type: 'float', title: 'Extension' + NB.repeat(5), defval: 1.272, step: 0.002, min: 1.1, max: 1.272, inline: 'e' },
  { id: 'extH', type: 'float', title: '-', defval: 1.618, step: 0.002, min: 1.618, max: 1.8, inline: 'e' },
  {
    id: 'widthPerc', type: 'float', title: 'Width Margin' + NB.repeat(31), defval: 100, inline: '3',
    tooltip: 'Margin between duration of\nthe extensions/retracements',
  },
  { id: 'colBl', type: 'color', title: 'Bullish', defval: '#089981', group: 'Style' },
  { id: 'colBr', type: 'color', title: 'Bearish', defval: '#f23645', group: 'Style' },
  { id: 'textSize', type: 'string', title: 'Text Size', defval: 'Small', options: SIZES, group: 'Style' },
  { id: 'showRatios', type: 'string', title: 'Show Ratios', defval: 'None', options: ['None', 'Ratios', 'Ratios With Margin'], group: 'Style' },
  { id: 'showDash', type: 'bool', title: 'Show Dashboard', defval: true, group: 'Dashboard' },
  { id: 'tablePosition', type: 'string', title: 'Location', defval: 'Top Right', options: ['Top Right', 'Bottom Right', 'Bottom Left'], group: 'Dashboard' },
  { id: 'tableSize', type: 'string', title: 'Size', defval: 'Small', options: SIZES, group: 'Dashboard' },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['line', 'label', 'box', 'polyline', 'table'];

export const metadata = {
  title: 'Three Drive Pattern Detector [LuxAlgo]',
  shortTitle: 'LuxAlgo - Three Drive Pattern Detector',
  overlay: true,
};

/** indicator(calc_bars_count = 10000) */
const CALC_BARS = 10000;

/** Pine float comparisons within 1e-10 (na compares false) */
const EPS = 1e-10;
const gt = (a: number, b: number) => a - b > EPS;
const lt = (a: number, b: number) => b - a > EPS;
const ge = (a: number, b: number) => a - b >= -EPS;
const le = (a: number, b: number) => b - a >= -EPS;

interface Piv { d: number; x: number; y: number }

interface Drawing {
  points: ChartPoint[];
  poly?: Polyline;
  boxes: Box[];
  lines: Line[];
  labels: Label[];
}

/**
 * ta.pivothigh(source, left, 1) (or ta.pivotlow) for each left length from `minLeft` to `maxLeft`: the window of a
 * length is the window of the length before with one older value, so one scan back from each bar gives all the lengths
 * (a call per length scans the whole window again, about a hundred times more work). Same rules as the library: the na
 * values are skipped, the newest best value of the window must be on the bar before.
 */
function pivotsByLeft(source: number[], minLeft: number, maxLeft: number, isHigh: boolean): number[][] {
  const n = source.length;
  const values: number[] = [];
  const barOf: number[] = [];
  const out = Array.from({ length: maxLeft - minLeft + 1 }, () => new Array<number>(n).fill(NaN));
  for (let i = 0; i < n; i++) {
    if (Number.isFinite(source[i])) {
      values.push(source[i]);
      barOf.push(i);
    }
    // the last non-na value up to this bar
    const k = values.length - 1;
    if (k < 0) continue;
    let best = k;
    let j = k - 1;
    for (let left = minLeft; left <= maxLeft && i >= left + 1; left++) {
      for (; j >= 0 && j >= k - left - 1; j--) {
        if (isHigh ? values[j] > values[best] : values[j] < values[best]) best = j;
      }
      // the best value only moves to older bars: once it is before the bar before, no longer length has a pivot
      if (barOf[best] < i - 1) break;
      if (barOf[best] === i - 1) out[left - minLeft][i] = values[best];
    }
  }
  return out;
}

export function calculate(
  allBars: Bar[],
  inputs: Partial<ThreeDrivePatternDetectorInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  // calc_bars_count: the script runs on the last 10,000 bars
  const bars = allBars.length > CALC_BARS ? allBars.slice(allBars.length - CALC_BARS) : allBars;
  const n = bars.length;
  const stt = cfg.stt;
  const num = Math.max(stt + 1, cfg.num);
  const { retL, retH, extL, extH, widthPerc, colBl, colBr } = cfg;
  const textSize = cfg.textSize.toLowerCase();
  const showRt = cfg.showRatios === 'Ratios';
  const showBx = cfg.showRatios === 'Ratios With Margin';
  const tablePosition = cfg.tablePosition.toLowerCase().replace(' ', '_') as 'top_right' | 'bottom_right' | 'bottom_left';
  const tableSize = cfg.tableSize.toLowerCase();
  const dif = num - stt;
  const INV = 'transparent';
  const fg = foregroundColorOf(chart);
  const tz = timezoneOf(chart);
  const toMs = chart?.timeUnit === 'ms' || (chart?.timeUnit === undefined && n > 0 && bars[0].time >= 1e12) ? 1 : 1000;

  const high = bars.map((b) => b.high);
  const low = bars.map((b) => b.low);
  // ta.pivothigh(left, 1) / ta.pivotlow(left, 1) of each zigzag (stateless: they read the high / low history)
  const phs = pivotsByLeft(high, stt, num - 1, true);
  const pls = pivotsByLeft(low, stt, num - 1, false);

  resetDrawings({ line: 500, label: 500, box: 500, polyline: 100 });
  const tb = table.new(tablePosition, 1, 1, '#1e222d', '#373a46', 1, '#373a46', 1);
  const arrayZZ: Piv[][] = [];
  const drawings: Drawing[] = [];
  let lastTime = '';
  const right = 1;

  const extensions = (levelL: number, levelH: number, Ay: number, By: number, Dy: number, Dd: number) => {
    if (Dd === 1) {
      const distance = By - Ay;
      return ge(Dy, Ay + distance * levelL) && le(Dy, Ay + distance * levelH);
    }
    const distance = Ay - By;
    return ge(Dy, Ay - distance * levelH) && le(Dy, Ay - distance * levelL);
  };
  const retrace = (levelL: number, levelH: number, By: number, Cy: number, Dy: number, Dd: number) => {
    if (Dd === 1) {
      const distance = By - Cy;
      return ge(Dy, Cy + distance * levelL) && le(Dy, Cy + distance * levelH);
    }
    const distance = Cy - By;
    return ge(Dy, Cy - distance * levelH) && le(Dy, Cy - distance * levelL);
  };
  const tooltip = (level: number, levelL: number, levelH: number) =>
    str.format(`{0}\n${NB.repeat(3)}┬\n{1}\n${NB.repeat(3)}┴\n{2}`, levelH, level, levelL);
  const lab = (level: number, levelL: number, levelH: number, x1: number, x2: number, y1: number, y2: number,
    value: number, col: string) =>
    label.new(math.round((x1 + x2) / 2) as number, (y1 + y2) / 2, str.tostring(math.round(value, 3) as number),
      'bar_index', 'price', INV, 'label_center', col, textSize, undefined, tooltip(level, levelL, levelH));
  const newBox = (left: number, top: number, rightX: number, bottom: number, border: string) =>
    box.new(left, top, rightX, bottom, border, undefined, undefined, undefined, undefined, INV);

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    if (i === 0) {
      line.new(i, bars[i].close, i, bars[i].close + mintickOf(chart), 'bar_index', 'both');
      for (let k = 0; k < dif; k++) {
        const zz: Piv[] = [];
        for (let j = 0; j <= 5; j++) zz.unshift({ d: 0, x: 0, y: high[0] });
        arrayZZ.unshift(zz);
      }
    }
    const arrBin: number[] = [NaN, NaN, NaN];

    // for i = dif - 1 to 0: arrayZZ.zigzag(i, stt + i, 1)
    for (let z = dif - 1; z >= 0; z--) {
      const piv = arrayZZ[z];
      const ph = phs[z][i];
      const pl = pls[z][i];
      if (!Number.isNaN(ph)) {
        const p = piv[0];
        const Dx = i - right;
        const Dy = high[i - right];
        if (gt(Dy, p.y)) {
          if (p.d < 1) {
            piv.unshift({ d: 1, x: Dx, y: Dy });
            piv.pop();
          } else if (p.d === 1 && gt(ph, p.y)) {
            p.x = Dx;
            p.y = Dy;
          }
        }
      }
      if (!Number.isNaN(pl)) {
        const p = piv[0];
        const Dx = i - right;
        const Dy = low[i - right];
        if (lt(Dy, p.y)) {
          if (p.d > -1) {
            piv.unshift({ d: -1, x: Dx, y: Dy });
            piv.pop();
          } else if (p.d === -1 && lt(pl, p.y)) {
            p.x = Dx;
            p.y = Dy;
          }
        }
      }
      const [D, C, B, A, Z, Y] = piv;
      const dir = D.d;
      const widthsRetrace = [A.x - Z.x, C.x - B.x];
      const widthsExtenss = [Z.x - Y.x, B.x - A.x, D.x - C.x];
      const minRetrace = Math.min(...widthsRetrace);
      const maxRetrace = Math.max(...widthsRetrace);
      const minExtenss = Math.min(...widthsExtenss);
      const maxExtenss = Math.max(...widthsExtenss);

      if (extensions(extL, extH, A.y, B.y, D.y, D.d)
        && retrace(retL, retH, A.y, B.y, C.y, C.d)
        && extensions(extL, extH, Y.y, Z.y, B.y, B.d)
        && retrace(retL, retH, Y.y, Z.y, A.y, A.d)
        && le((100 / minRetrace) * maxRetrace - 100, widthPerc)
        && le((100 / minExtenss) * maxExtenss - 100, widthPerc)) {
        let isValid = true;
        for (let j = 0; j < drawings.length; j++) {
          const get = drawings[j];
          const drawDx = get.points[5].index as number;
          if (drawDx < Y.x) break;
          if (C.x === get.points[4].index) {
            if (D.x === drawDx) {
              isValid = false;
              break;
            }
            if (get.poly) polyline.delete(get.poly);
            for (const ln of get.lines) line.delete(ln);
            for (const lb of get.labels) label.delete(lb);
            for (const bx of get.boxes) box.delete(bx);
            line.new(C.x, C.y, D.x, D.y, 'bar_index', 'none', gt(D.y, C.y) ? colBr : colBl, 'dashed');
          }
        }

        if (isValid && D.x !== 0) {
          lastTime = str.format_time(bars[i].time * toMs, 'yyyy-MM-dd HH:mm', tz);
          if (!Number.isNaN(arrBin[0])) {
            arrBin[2] = Math.min(90, arrBin[2] + 30);
          } else {
            arrBin[0] = Y.x;
            arrBin[1] = D.x;
            arrBin[2] = 0;
          }
          const transp = arrBin[2];
          const pat: Drawing = {
            points: [Y, Z, A, B, C, D].map((p) => chartPoint.from_index(p.x, p.y)),
            boxes: [], lines: [], labels: [],
          };
          const { y: Yy } = Y;
          const { y: Zy } = Z;
          const { y: Ay } = A;
          const { y: By } = B;
          if (showBx || showRt) {
            if (dir === 1) {
              const bc = String(color.new(colBr, 50));
              const midA = Math.max(Yy, Zy - (Zy - Yy) * 0.618);
              const midB = Math.max(Zy, Yy + (Zy - Yy) * 1.272);
              const midC = Math.max(Ay, By - (By - Ay) * 0.618);
              const midD = Math.max(By, Ay + (By - Ay) * 1.272);
              pat.boxes.push(newBox(A.x - 1, showRt ? midA : Zy - (Zy - Yy) * retL, A.x + 1, midA, bc));
              pat.boxes.push(newBox(B.x - 1, showRt ? midB : Yy + (Zy - Yy) * extH, B.x + 1, midB, bc));
              pat.boxes.push(newBox(C.x - 1, showRt ? midC : By - (By - Ay) * retL, C.x + 1, midC, bc));
              pat.boxes.push(newBox(D.x - 1, showRt ? midD : Ay + (By - Ay) * extH, D.x + 1, midD, bc));
              if (showBx) {
                pat.boxes.push(newBox(A.x - 1, midA, A.x + 1, Math.max(Yy, Zy - (Zy - Yy) * retH), bc));
                pat.boxes.push(newBox(B.x - 1, midB, B.x + 1, Math.max(Zy, Yy + (Zy - Yy) * extL), bc));
                pat.boxes.push(newBox(C.x - 1, midC, C.x + 1, Math.max(Ay, By - (By - Ay) * retH), bc));
                pat.boxes.push(newBox(D.x - 1, midD, D.x + 1, Math.max(By, Ay + (By - Ay) * extL), bc));
              }
            } else {
              const bc = String(color.new(colBl, 50));
              const midA = Math.min(Yy, Zy + (Yy - Zy) * 0.618);
              const midB = Math.min(Zy, Yy - (Yy - Zy) * 1.272);
              const midC = Math.min(Ay, By + (Ay - By) * 0.618);
              const midD = Math.min(By, Ay - (Ay - By) * 1.272);
              pat.boxes.push(newBox(A.x - 1, showRt ? midA : Math.min(Yy, Zy + (Yy - Zy) * retH), A.x + 1, midA, bc));
              pat.boxes.push(newBox(B.x - 1, showRt ? midB : Math.min(Zy, Yy - (Yy - Zy) * extL), B.x + 1, midB, bc));
              pat.boxes.push(newBox(C.x - 1, showRt ? midC : Math.min(Ay, By + (Ay - By) * retH), C.x + 1, midC, bc));
              pat.boxes.push(newBox(D.x - 1, showRt ? midD : Math.min(By, Ay - (Ay - By) * extL), D.x + 1, midD, bc));
              if (showBx) {
                pat.boxes.push(newBox(A.x - 1, midA, A.x + 1, Zy + (Yy - Zy) * retL, bc));
                pat.boxes.push(newBox(B.x - 1, midB, B.x + 1, Yy - (Yy - Zy) * extH, bc));
                pat.boxes.push(newBox(C.x - 1, midC, C.x + 1, By + (Ay - By) * retL, bc));
                pat.boxes.push(newBox(D.x - 1, midD, D.x + 1, Ay - (Ay - By) * extH, bc));
              }
            }
          }
          const colr = dir === 1 ? colBr : colBl;
          pat.poly = polyline.new(pat.points, false, false, 'bar_index', String(color.new(colr, transp)), undefined, undefined, 2);
          const lc = String(color.new(colr, 50));
          pat.lines.unshift(line.new(Y.x, Y.y, A.x, A.y, 'bar_index', 'none', lc, 'dashed'));
          pat.lines.unshift(line.new(Z.x, Z.y, B.x, B.y, 'bar_index', 'none', lc, 'dashed'));
          pat.lines.unshift(line.new(A.x, A.y, C.x, C.y, 'bar_index', 'none', lc, 'dashed'));
          pat.lines.unshift(line.new(B.x, B.y, D.x, D.y, 'bar_index', 'none', lc, 'dashed'));
          const { y: Cy } = C;
          const { y: Dy } = D;
          const up = dir === 1;
          pat.labels.unshift(lab(0.618, retL, retH, Y.x, A.x, Yy, Ay, up ? (1 / (Zy - Yy)) * (Zy - Ay) : (1 / (Yy - Zy)) * (Ay - Zy), colr));
          pat.labels.unshift(lab(1.272, extL, extH, Z.x, B.x, Zy, By, 1 - (up ? (1 / (Zy - Yy)) * (Zy - By) : (1 / (Yy - Zy)) * (By - Zy)), colr));
          pat.labels.unshift(lab(0.618, retL, retH, A.x, C.x, Ay, Cy, up ? (1 / (By - Ay)) * (By - Cy) : (1 / (Ay - By)) * (Cy - By), colr));
          pat.labels.unshift(lab(1.272, extL, extH, B.x, D.x, By, Dy, 1 - (up ? (1 / (By - Ay)) * (By - Dy) : (1 / (Ay - By)) * (Dy - By)), colr));
          drawings.unshift(pat);
        }
      }
    }

    while (drawings.length > 100) {
      const pop = drawings.pop()!;
      for (const bx of pop.boxes) box.delete(bx);
      if (pop.poly) polyline.delete(pop.poly);
    }

    if (i === n - 1 && cfg.showDash) {
      table.cell(tb, 0, 0, `Last know pattern:\n${lastTime === '' ? 'None' : lastTime}`, undefined, undefined, fg,
        undefined, undefined, tableSize);
    }
  }
  setDrawingBar(null);

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars),
  };
}

export const ThreeDrivePatternDetector = { calculate, metadata, defaultInputs, inputConfig, plotConfig, drawingKinds };
