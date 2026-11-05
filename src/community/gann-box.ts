/**
 * Gann Box (Zeiierman)
 *
 * A Gann box between the highest high and the lowest low of the bars visible on the chart.
 * - On each visible bar, a high at or above the highest visible high so far (a low at or below the lowest low)
 *   becomes the new extreme. The box starts at the earlier extreme (x0, y0) and ends at the later one (x6, y6);
 *   with 'Extend' the end is mirrored into the future (later extreme + the bar distance between them, at most 500 bars
 *   after the current bar).
 * - Levels: 0, the five 'Gann Box' percentages and 1 of the time span and of the price span.
 * - Drawn on each visible bar (the last visible bar gives the final drawings):
 *   - Box: one box per time interval and price interval (36), border and fill in the colour of the price interval.
 *   - Fibonacci labels: the level values on the left and right sides and on the top and bottom sides (chart text
 *     colour). The labels of the bar before are kept until there are more than 28 (the oldest two are deleted then),
 *     as the original.
 *   - Fan (off by default): lines from the start to each time level at the end price and to each price level at the
 *     end time.
 *   - Curves (off by default): a quarter circle of 91 points from the start through each level.
 *   - Angles (off by default): lines from the four corners to the levels of the opposite sides. The original keeps
 *     two lines of each visible bar (it stores two angle lines in the same cell): they stay until the line limit
 *     (144) deletes them.
 * - Alerts: low crossing under or high crossing over the bar index of the box start and of the first five time
 *   levels (the original compares prices with bar indexes).
 *
 * Visible range: the indicator reads the first and the last visible bar time of the chart (`leftVisibleBarTime` /
 * `rightVisibleBarTime` of the chart context, third argument of calculate). It must be calculated again when the
 * user scrolls or zooms. Without these values all the bars are visible. The label text colour is the chart
 * foreground colour of the context (`foregroundColor`). When the box starts more than 10,000 bars before a visible
 * bar, the original stops with a runtime error (drawing x too far back); the port throws the same error.
 *
 * Reference: "Gann Box (Zeiierman)" by Zeiierman
 * Licence: Mozilla Public License 2.0, as the original Pine script (https://mozilla.org/MPL/2.0/).
 * Original notice: © Zeiierman
 */

import {
  ta, math, str, color, Series, line, box, label, polyline, chartPoint, resetDrawings, setDrawingBar,
  drawingOutputs,
  type Bar, type Box, type IndicatorResult, type InputConfig, type Label, type Line, type PlotConfig, type Polyline,
} from 'oakscriptjs';
import type { StudyDrawingKind } from '../style-outputs';
import { foregroundColorOf, visibleRangeOf, type ChartContext } from '../chart-context';
import { alertStates, type AlertConditionDecl } from '../alert-states';

export interface GannBoxInputs {
  /** Reverse */
  reverse: boolean;
  /** Extend */
  future: boolean;
  /** Show Box */
  showBox: boolean;
  /** Show Fibonacci Labels */
  showLabel: boolean;
  /** Box rows 1 to 6 */
  box1: boolean;
  box2: boolean;
  box3: boolean;
  box4: boolean;
  box5: boolean;
  box6: boolean;
  /** Levels 1 to 5 (%) */
  perc1: number;
  perc2: number;
  perc3: number;
  perc4: number;
  perc5: number;
  /** Box row colours 1 to 6 */
  boxCol1: string;
  boxCol2: string;
  boxCol3: string;
  boxCol4: string;
  boxCol5: string;
  boxCol6: string;
  /** Show Fan */
  showFan: boolean;
  /** Fan lines 25% ... 100% */
  fan1: boolean;
  fan2: boolean;
  fan3: boolean;
  fan4: boolean;
  fan5: boolean;
  fan6: boolean;
  fanCol1: string;
  fanCol2: string;
  fanCol3: string;
  fanCol4: string;
  fanCol5: string;
  fanCol6: string;
  /** Show Curves */
  showCurve: boolean;
  /** Curves 25% ... 100% */
  curve1: boolean;
  curve2: boolean;
  curve3: boolean;
  curve4: boolean;
  curve5: boolean;
  curve6: boolean;
  curveCol1: string;
  curveCol2: string;
  curveCol3: string;
  curveCol4: string;
  curveCol5: string;
  curveCol6: string;
  /** Show Angles */
  showAngles: boolean;
  angleCol: string;
}

export const defaultInputs: GannBoxInputs = {
  reverse: false,
  future: true,
  showBox: true,
  showLabel: true,
  box1: true,
  box2: true,
  box3: true,
  box4: true,
  box5: true,
  box6: true,
  perc1: 25.0,
  perc2: 38.2,
  perc3: 50.0,
  perc4: 61.8,
  perc5: 75.0,
  boxCol1: '#F44336',
  boxCol2: '#81C784',
  boxCol3: '#0097A7',
  boxCol4: '#9598A1',
  boxCol5: '#A5D6A7',
  boxCol6: '#F44336',
  showFan: false,
  fan1: true,
  fan2: true,
  fan3: true,
  fan4: true,
  fan5: true,
  fan6: true,
  fanCol1: '#FF9800',
  fanCol2: '#089981',
  fanCol3: '#4CAF50',
  fanCol4: '#089981',
  fanCol5: '#00BCD4',
  fanCol6: '#2962FF',
  showCurve: false,
  curve1: true,
  curve2: true,
  curve3: true,
  curve4: true,
  curve5: true,
  curve6: true,
  curveCol1: '#FF9800',
  curveCol2: '#81C784',
  curveCol3: '#4CAF50',
  curveCol4: '#089981',
  curveCol5: '#00BCD4',
  curveCol6: '#2962FF',
  showAngles: false,
  angleCol: '#787B86',
};

const T1 = 'Reverses the orientation of labels and calculations in the Gann Box, offering alternative analytical perspectives.';
const T2 = 'Extend the drawing of Gann lines or boxes into the future beyond the current last bar to anticipate potential support or resistance levels. This setting is crucial for traders looking to forecast future price movements and prepare for potential market reactions at these extended levels.';
const T3 = 'Enables or disables the display of the Gann Box. When enabled, the Gann Box will be visible on the chart, illustrating key levels based on selected high and low points. The Gann Box is a fundamental tool in Gann analysis, providing insights into potential support and resistance levels, and enabling traders to identify strategic entry and exit points.';
const T4 = 'Enables or disables the display of Fibonacci labels within the Gann Box and Gann Fan. Useful for identifying specific Fibonacci retracement levels for support or resistance, these labels help traders to quickly recognize significant percentage levels that are often considered in trading strategies for their potential to indicate reversal points.';
const T5 = 'Enables or disables the display of Gann Curves. When enabled, it draws curves based on Gann percentages to predict potential market movements. These curves offer a dynamic view of potential support and resistance levels as they adjust to changing market conditions, aiding in the analysis of momentum and trend strength.';
const T6 = 'Enables or disables the display of Gann Angles. These are diagonal lines that extend from significant price points to provide insights into future support and resistance levels. Gann Angles are a cornerstone of Gann theory, offering a unique perspective on price and time dynamics that can signal significant market movements.';

const GB = 'Gann Box';
const GF = 'Gann Fan';
const GC = 'Gann Curves';
const FAN_TITLES = ['25%', '38.2%', '50%', '61.8%', '75%', '100%'];
const D = defaultInputs;

export const inputConfig: InputConfig[] = [
  { id: 'reverse', type: 'bool', title: 'Reverse', defval: false, group: 'General Settings', tooltip: T1 },
  { id: 'future', type: 'bool', title: 'Extend', defval: true, group: 'General Settings', tooltip: T2 },
  { id: 'showBox', type: 'bool', title: 'Show Box', defval: true, group: GB, tooltip: T3 },
  { id: 'showLabel', type: 'bool', title: 'Show Fibonacci Labels', defval: true, group: GB, tooltip: T4 },
  ...[1, 2, 3, 4, 5, 6].map((k): InputConfig => ({ id: `box${k}`, type: 'bool', title: '', defval: true, inline: String(k), group: GB })),
  ...[1, 2, 3, 4, 5].map((k): InputConfig => ({
    id: `perc${k}`, type: 'float', title: '', defval: D[`perc${k}` as 'perc1'], step: 0.1, inline: String(k), group: GB,
  })),
  ...[1, 2, 3, 4, 5, 6].map((k): InputConfig => ({
    id: `boxCol${k}`, type: 'color', title: '', defval: D[`boxCol${k}` as 'boxCol1'], inline: String(k), group: GB,
  })),
  { id: 'showFan', type: 'bool', title: 'Show Fan', defval: false, group: GF, tooltip: T4 },
  ...[1, 2, 3, 4, 5, 6].map((k): InputConfig => ({
    id: `fan${k}`, type: 'bool', title: FAN_TITLES[k - 1], defval: true, inline: `f${k}`, group: GF,
  })),
  ...[1, 2, 3, 4, 5, 6].map((k): InputConfig => ({
    id: `fanCol${k}`, type: 'color', title: '', defval: D[`fanCol${k}` as 'fanCol1'], inline: `f${k}`, group: GF,
  })),
  { id: 'showCurve', type: 'bool', title: 'Show Curves', defval: false, group: GC, tooltip: T5 },
  ...[1, 2, 3, 4, 5, 6].map((k): InputConfig => ({
    id: `curve${k}`, type: 'bool', title: FAN_TITLES[k - 1], defval: true, inline: `c${k}`, group: GC,
  })),
  ...[1, 2, 3, 4, 5, 6].map((k): InputConfig => ({
    id: `curveCol${k}`, type: 'color', title: '', defval: D[`curveCol${k}` as 'curveCol1'], inline: `c${k}`, group: GC,
  })),
  { id: 'showAngles', type: 'bool', title: 'Show Angles', defval: false, group: 'Gann Angles', inline: 'a1', tooltip: T6 },
  { id: 'angleCol', type: 'color', title: '', defval: '#787B86', group: 'Gann Angles', inline: 'a1' },
];

export const plotConfig: PlotConfig[] = [];

export const drawingKinds: StudyDrawingKind[] = ['box', 'label', 'line', 'polyline'];

/** The original's alertconditions */
export const alertConditions: AlertConditionDecl[] = [
  { id: 'alert0', title: 'Gann Box Breakout', message: 'Price breaks out from Gann Box' },
  { id: 'alert1', title: 'Gann Box Breakout Level 1', message: 'Price breaks Level 1' },
  { id: 'alert2', title: 'Gann Box Breakout Level 2', message: 'Price breaks Level 2' },
  { id: 'alert3', title: 'Gann Box Breakout Level 3', message: 'Price breaks Level 3' },
  { id: 'alert4', title: 'Gann Box Breakout Level 4', message: 'Price breaks Level 4' },
  { id: 'alert5', title: 'Gann Box Breakout Level 5', message: 'Price breaks Level 5' },
];

export const metadata = {
  title: 'Gann Box (Zeiierman)',
  shortTitle: 'Gann Box (Zeiierman)',
  overlay: true,
};

/** The indicator reads the visible range of the chart: calculate again when the user scrolls or zooms */
export const usesVisibleRange = true;

/** indicator(max_boxes_count = 50, max_labels_count = 50, max_lines_count = 144) */
const LIMITS = { box: 50, label: 50, line: 144, polyline: 50 };
/** Visible bars at the end whose drawings can remain: a fan line lives 6 bars with one fan, a curve 7 with one curve */
const LAST_DRAWING_BARS = 7;
/** A drawing more than this many bars before the current bar throws */
const MAX_BARS_BACK = 10000;

/** Pine float comparisons: a >= b unless b - a > 1e-10 (na compares false) */
const EPS = 1e-10;
const ge = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(b - a > EPS);
const le = (a: number, b: number) => !isNaN(a) && !isNaN(b) && !(a - b > EPS);

export function calculate(
  bars: Bar[],
  inputs: Partial<GannBoxInputs> = {},
  chart?: ChartContext,
): IndicatorResult {
  const cfg = { ...defaultInputs, ...inputs };
  const n = bars.length;
  const toMs = chart?.timeUnit === 'ms' ? 1 : 1000;
  const range = visibleRangeOf(bars, chart);
  const fg = foregroundColorOf(chart);
  const noColour = String(color.new('#FFFFFF', 100));

  const boxbool = [cfg.box1, cfg.box2, cfg.box3, cfg.box4, cfg.box5, cfg.box6];
  const perc = [cfg.perc1, cfg.perc2, cfg.perc3, cfg.perc4, cfg.perc5].map((p) => p / 100);
  const c = [cfg.boxCol1, cfg.boxCol2, cfg.boxCol3, cfg.boxCol4, cfg.boxCol5, cfg.boxCol6];
  const fperc = [cfg.fan1, cfg.fan2, cfg.fan3, cfg.fan4, cfg.fan5, cfg.fan6];
  const fcol = [cfg.fanCol1, cfg.fanCol2, cfg.fanCol3, cfg.fanCol4, cfg.fanCol5, cfg.fanCol6];
  const cperc = [cfg.curve1, cfg.curve2, cfg.curve3, cfg.curve4, cfg.curve5, cfg.curve6];
  const ccol = [cfg.curveCol1, cfg.curveCol2, cfg.curveCol3, cfg.curveCol4, cfg.curveCol5, cfg.curveCol6];
  const acol = cfg.angleCol;
  // the same on every bar: built once
  const boxBg = c.map((col) => String(color.new(col, 50)));
  const boxBorder = c.map((col) => String(color.new(col, 80)));
  const labelText = ['0', ...perc.map((p) => str.tostring(p)), '1'];
  if (cfg.reverse) labelText.reverse();
  const curveSin: number[] = [];
  const curveCos: number[] = [];
  for (let j = 0; j <= 90; j++) {
    curveSin.push(math.sin(math.toradians(j)));
    curveCos.push(math.cos(math.toradians(j)));
  }

  resetDrawings(LIMITS);
  let hi = NaN;
  let lo = NaN;
  let hLoc = NaN;
  let lLoc = NaN;
  // var arrays / matrix of the original
  let boxes: Box[] = [];
  const labels: Label[] = [];
  const lin: (Line | undefined)[] = new Array(12).fill(undefined);
  const arr: (Polyline | undefined)[] = new Array(7).fill(undefined);
  const ang: (Line | undefined)[][] = [0, 1, 2, 3].map(() => new Array(13).fill(undefined));
  const del = (l: Line | undefined) => { if (l) line.delete(l); };
  // the time levels of each bar, for the alerts
  const levels: number[][] = [0, 1, 2, 3, 4, 5].map(() => new Array<number>(n).fill(NaN));

  const isVisible = (i: number) => {
    const t = bars[i].time * toMs;
    return t >= range.leftTime && t <= range.rightTime;
  };
  // Each visible bar deletes the drawings of the bars before it and draws them again, and the counts stay below the
  // maxima (36 boxes, 30 labels, 14 lines, 7 curves), so none is deleted by the count: what remains at the end is
  // drawn on the last visible bars. The earlier visible bars draw only when a bar index is too far back, to throw.
  // The angles keep two lines of each bar until the line limit deletes them: with them, every visible bar draws.
  let drawFrom = cfg.showAngles ? 0 : n;
  for (let i = n - 1, count = 0; !cfg.showAngles && i >= 0 && count < LAST_DRAWING_BARS; i--) {
    if (isVisible(i)) {
      drawFrom = i;
      count++;
    }
  }

  for (let i = 0; i < n; i++) {
    setDrawingBar(i, i === n - 1);
    const b = bars[i];
    const visible = isVisible(i);

    // visible high and low
    if (visible && ge(b.high, isNaN(hi) ? b.high : hi)) {
      hi = b.high;
      hLoc = i;
    }
    if (visible && le(b.low, isNaN(lo) ? b.low : lo)) {
      lo = b.low;
      lLoc = i;
    }
    const lowFirst = lLoc < hLoc;
    const x0 = lowFirst ? lLoc : hLoc;
    const x6 = lowFirst
      ? (cfg.future ? Math.min(i + 500, hLoc + (hLoc - lLoc)) : hLoc)
      : (cfg.future ? Math.min(i + 500, lLoc + (lLoc - hLoc)) : lLoc);
    const y0 = lowFirst ? lo : hi;
    const y6 = lowFirst ? hi : lo;

    // Fibonacci levels
    const x: number[] = [x0];
    const y: number[] = [y0];
    for (let k = 0; k <= 4; k++) {
      x.push(math.round(x0 + (x6 - x0) * perc[k]));
      y.push(y0 + (y6 - y0) * perc[k]);
    }
    x.push(x6);
    y.push(y6);
    for (let k = 0; k <= 5; k++) levels[k][i] = x[k];
    const draw = visible && (i >= drawFrom || i - Math.min(...x) > MAX_BARS_BACK);

    // Gann box
    if (cfg.showBox && draw) {
      for (const bx of boxes) box.delete(bx);
      boxes = [];
      for (let k = 0; k <= 5; k++) {
        const left = x[k];
        const right = x[k + 1];
        for (let z = 0; z <= 5; z++) {
          if (boxbool[z]) {
            const bx = box.new(left, y[z + 1], right, y[z], boxBg[z], undefined, undefined,
              undefined, undefined, boxBorder[z]);
            boxes.unshift(bx);
          }
        }
      }
    }

    // labels
    if (cfg.showLabel && draw) {
      const s = labelText;
      for (let k = 0; k <= 6; k++) {
        const xx = x[k];
        for (let z = 0; z <= 6; z++) {
          const yy = y[z];
          if (k === 0 || k === 6) {
            labels.unshift(label.new(xx, yy, s[z], 'bar_index', 'price', noColour,
              k === 0 ? 'label_right' : 'label_left', fg));
          }
          if (z === 0 || z === 6) {
            const style = lowFirst ? (z === 0 ? 'label_up' : 'label_down') : (z === 0 ? 'label_down' : 'label_up');
            labels.unshift(label.new(xx, yy, s[k], 'bar_index', 'price', noColour, style, fg));
          }
          if (labels.length > 28) {
            const prev1 = labels.pop()!;
            const prev2 = labels.pop()!;
            label.delete(prev1);
            label.delete(prev2);
          }
        }
      }
    }

    // Gann fan
    if (cfg.showFan && draw) {
      for (let k = 0; k <= 5; k++) {
        if (fperc[k]) {
          const l1 = line.new(x0, y0, x[k + 1], y6, 'bar_index', undefined, fcol[k]);
          const l2 = line.new(x0, y0, x6, y[k + 1], 'bar_index', undefined, fcol[k]);
          del(lin.pop());
          del(lin.pop());
          lin.unshift(l1);
          lin.unshift(l2);
        }
      }
    }

    // Gann curves
    if (cfg.showCurve && draw) {
      for (let k = 1; k <= arr.length - 1; k++) {
        if (cperc[k - 1]) {
          const points = [];
          for (let j = 0; j <= 90; j++) {
            const xx = x0 - (x0 - x[k]) * curveSin[j];
            const yy = y0 + curveCos[j] * (y[k] - y0);
            points.push(chartPoint.from_index(math.round(xx), yy));
          }
          const poly = polyline.new(points, false, false, 'bar_index', ccol[k - 1]);
          arr.unshift(poly);
          const old = arr.pop();
          if (old) polyline.delete(old);
        }
      }
    }

    // Gann angles
    if (cfg.showAngles && draw) {
      for (let k = 0; k <= 6; k++) {
        const xx = x[k];
        const yy = y[k];
        if (k > 0) {
          del(ang[0][k]);
          del(ang[1][k]);
          del(ang[0][12 - k]);
          del(ang[1][12 - k]);
          const a1 = line.new(x0, y0, xx, y6, 'bar_index', undefined, acol);
          const a2 = line.new(x0, y0, x6, yy, 'bar_index', undefined, acol);
          const a3 = line.new(x0, y6, xx, y0, 'bar_index', undefined, acol);
          const a4 = line.new(x0, y6, x6, yy, 'bar_index', undefined, acol);
          ang[0][k] = a1;
          ang[0][12 - k] = a2;
          ang[1][k] = a3;
          ang[1][12 - k] = a4;
        }
        if (k < 6) {
          del(ang[2][k]);
          del(ang[3][k]);
          del(ang[2][12 - k]);
          del(ang[3][12 - k]);
          const a1 = line.new(x6, y6, xx, y0, 'bar_index', undefined, acol);
          const a2 = line.new(x6, y6, x0, yy, 'bar_index', undefined, acol);
          const a3 = line.new(x6, y0, xx, y6, 'bar_index', undefined, acol);
          const a4 = line.new(x6, y0, x0, yy, 'bar_index', undefined, acol);
          ang[2][k] = a1;
          ang[2][12 - k] = a2;
          ang[3][k] = a3;
          ang[3][12 - k] = a4;
        }
      }
    }
  }
  setDrawingBar(null);

  // alerts: ta.crossunder(low, level) or ta.crossover(high, level) (both run on every bar)
  const low = new Series(bars, (b) => b.low);
  const high = new Series(bars, (b) => b.high);
  const flags = levels.map((lv) => {
    const s = Series.fromArray(bars, lv);
    const under = ta.crossunder(low, s).toArray();
    const over = ta.crossover(high, s).toArray();
    return bars.map((_, i) => !!under[i] || !!over[i]);
  });

  return {
    metadata: { title: metadata.title, shorttitle: metadata.shortTitle, overlay: metadata.overlay },
    plots: {},
    ...drawingOutputs(bars),
    alerts: alertStates(alertConditions, bars, flags),
  } as IndicatorResult;
}

export const GannBox = {
  calculate,
  metadata,
  defaultInputs,
  inputConfig,
  plotConfig,
  drawingKinds,
  alertConditions,
  usesVisibleRange,
};
